import { hashPassword, verifyPassword } from '../../lib/database';
import { type Env } from '../../lib/config';
import { ERROR_CODES, type AuthSession, type AuthTokens, type Role } from '../../lib/types';
import { type AdminInviteCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { adminInviteTemplate, type Mailer } from '../../infra/mailer';
import { type AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { type TotpService } from './totp.service';
import { toPublicUser } from './auth.mapper';
import { type AuthService, type RequestMeta } from './auth.service';

export interface AdminLoginResult {
  status: 'TOTP_REQUIRED' | 'TOTP_ENROLMENT_REQUIRED';
  challengeToken: string;
  /** Present only during first-time enrolment. */
  otpauthUrl?: string;
  recoveryCodes?: string[];
}

/**
 * Admin sign-in is invite-only and always two-factor. There is no code path
 * that returns an admin session from a password alone.
 */
export class AdminAuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly auth: AuthService,
    private readonly mailer: Mailer,
    private readonly env: Env,
  ) {}

  async login(email: string, password: string): Promise<AdminLoginResult> {
    const user = await this.repo.findByEmail(email, true);
    if (!user || !user.portals.includes('ADMIN')) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_LOGIN_LOCKED);
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      await this.repo.registerFailedLogin(String(user._id), null);
      throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }
    if (user.status === 'SUSPENDED') {
      throw AppError.unauthorized(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED);
    }

    const challenge = this.tokens.issueOpaqueToken(5 * 60_000);
    await this.repo.storeVerificationToken({
      userId: String(user._id),
      purpose: 'ADMIN_TOTP_CHALLENGE',
      tokenHash: challenge.tokenHash,
      expiresAt: challenge.expiresAt,
    });

    if (user.totp?.enabled && user.totp.secretEnc) {
      return { status: 'TOTP_REQUIRED', challengeToken: challenge.token };
    }

    // First sign-in: enrol before any session can be issued.
    const secret = this.totp.generateSecret();
    const recovery = this.totp.generateRecoveryCodes();
    await this.repo.updateUser(String(user._id), {
      $set: {
        'totp.secretEnc': this.totp.encrypt(secret),
        'totp.enabled': false,
        'totp.recoveryCodeHashes': recovery.hashes,
      },
    });

    return {
      status: 'TOTP_ENROLMENT_REQUIRED',
      challengeToken: challenge.token,
      otpauthUrl: this.totp.otpauthUrl(secret, user.email),
      recoveryCodes: recovery.codes,
    };
  }

  async verifyTotp(
    challengeToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<AuthSession> {
    const record = await this.repo.consumeVerificationToken(
      TokenService.hash(challengeToken),
      'ADMIN_TOTP_CHALLENGE',
    );
    if (!record) throw AppError.unauthorized(ERROR_CODES.AUTH_TOTP_INVALID);

    const user = await this.repo.findById(String(record.userId), true);
    if (!user?.totp?.secretEnc) throw AppError.unauthorized(ERROR_CODES.AUTH_TOTP_NOT_ENABLED);

    const secret = this.totp.decrypt(user.totp.secretEnc);
    const codeOk = this.totp.verify(secret, code);
    const recoveryHash = this.totp.hashRecoveryCode(code);
    const recoveryOk = user.totp.recoveryCodeHashes.includes(recoveryHash);

    if (!codeOk && !recoveryOk) {
      await this.repo.registerFailedLogin(String(user._id), null);
      throw AppError.unauthorized(ERROR_CODES.AUTH_TOTP_INVALID);
    }

    const update: Record<string, unknown> = {
      $set: { 'totp.enabled': true, 'totp.confirmedAt': user.totp.confirmedAt ?? new Date() },
    };
    if (recoveryOk) {
      // A recovery code is single use.
      update.$pull = { 'totp.recoveryCodeHashes': recoveryHash };
    }
    await this.repo.updateUser(String(user._id), update);
    await this.repo.clearFailedLogins(String(user._id));

    const tokens: AuthTokens = await this.auth.issueSession(
      {
        userId: String(user._id),
        role: user.role,
        portal: 'ADMIN',
        tokenVersion: user.tokenVersion,
      },
      meta,
    );
    return { user: toPublicUser(user), tokens };
  }

  async createInvite(input: AdminInviteCreateInput, invitedBy: string, inviterEmail: string) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing?.portals.includes('ADMIN')) {
      throw AppError.conflict(ERROR_CODES.CONFLICT, 'That address is already an admin.');
    }
    const issued = this.tokens.issueOpaqueToken(this.env.ADMIN_INVITE_TTL_HOURS * 3_600_000);
    const invite = await this.repo.createInvite({
      email: input.email,
      role: input.role,
      tokenHash: issued.tokenHash,
      invitedBy,
      note: input.note ?? '',
      expiresAt: issued.expiresAt,
    });
    const url = `${this.env.ADMIN_APP_URL}/invite?token=${issued.token}`;
    await this.mailer.send(adminInviteTemplate(input.email, input.role, url));
    return { id: String(invite._id), email: invite.email, role: invite.role, invitedBy: inviterEmail };
  }

  async acceptInvite(token: string, displayName: string, password: string): Promise<void> {
    const invite = await this.repo.findInviteByTokenHash(TokenService.hash(token));
    if (!invite) throw new AppError(ERROR_CODES.ADMIN_INVITE_INVALID);
    if (invite.acceptedAt) throw new AppError(ERROR_CODES.ADMIN_INVITE_ALREADY_USED);
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ERROR_CODES.ADMIN_INVITE_EXPIRED);
    }

    const passwordHash = await hashPassword(password);
    const existing = await this.repo.findByEmail(invite.email);
    const role = invite.role as Role;

    const user = existing
      ? await this.repo.updateUser(String(existing._id), {
          $set: { role, portals: ['ADMIN'], status: 'ACTIVE', passwordHash },
        })
      : await this.repo.createUser({
          email: invite.email,
          passwordHash,
          displayName,
          role,
          portals: ['ADMIN'],
          status: 'ACTIVE',
        });

    if (!user) throw new AppError(ERROR_CODES.INTERNAL_ERROR);
    await this.repo.updateUser(String(user._id), { $set: { emailVerifiedAt: new Date() } });
    await this.repo.markInviteAccepted(invite._id, user._id);
  }
}
