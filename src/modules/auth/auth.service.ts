import { hashPassword, verifyPassword } from '../../lib/database';
import { type Env } from '../../lib/config';
import {
  ERROR_CODES,
  ROLE_PORTALS,
  type AuthSession,
  type AuthTokens,
  type Portal,
  type PublicUser,
  type Role,
} from '../../lib/types';
import { type LoginInput, type RegisterInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { toPublicUser } from './auth.mapper';
import { type AccountService } from './account.service';
import { type GuideRepository } from '../guides/guide.repository';

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
/** Hashing a throwaway value keeps the unknown-email path as slow as the known one. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNlZWRzZWVkc2VlZA$0000000000000000000000000000000000000000000';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly guides: GuideRepository,
    private readonly tokens: TokenService,
    private readonly accounts: AccountService,
    private readonly env: Env,
  ) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw AppError.conflict(ERROR_CODES.AUTH_EMAIL_ALREADY_REGISTERED);

    // The role and the portals come from accountType, never from the payload.
    const role: Role = input.accountType === 'TOURIST_GUIDE' ? 'TOURIST_GUIDE' : 'TRAVELLER';
    const portals = [...ROLE_PORTALS[role]] as Portal[];

    const user = await this.repo.createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      role,
      portals,
      status: 'PENDING',
    });

    if (role === 'TOURIST_GUIDE') {
      await this.guides.createForUser(String(user._id), input.displayName);
    }

    // Verification mail is best-effort. The account exists and is PENDING either
    // way, so a mailer outage must not turn a successful signup into a 503.
    // The user can request a fresh link from the resend endpoint.
    try {
      await this.accounts.sendVerificationEmail(user);
    } catch (err) {
      console.error('[auth.register] verification email failed', {
        userId: String(user._id),
        err,
      });
    }

    return toPublicUser(user);
  }

  /**
   * Re-sends the verification link. Always resolves, whether or not the address
   * belongs to an account, so the endpoint cannot be used to enumerate emails.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.repo.findByEmail(email);
    if (!user || user.status !== 'PENDING') return;

    try {
      await this.accounts.sendVerificationEmail(user);
    } catch (err) {
      console.error('[auth.resendVerification] verification email failed', {
        userId: String(user._id),
        err,
      });
    }
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<AuthSession> {
    const user = await this.repo.findByEmail(input.email, true);

    if (!user) {
      await verifyPassword(DUMMY_HASH, input.password);
      throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_LOGIN_LOCKED);
    }

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      const nextCount = user.failedLoginCount + 1;
      const lockUntil =
        nextCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await this.repo.registerFailedLogin(String(user._id), lockUntil);
      throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    if (user.status === 'SUSPENDED') {
      throw AppError.unauthorized(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED);
    }

    // Admin sign-in always goes through the TOTP challenge flow instead.
    if (input.portal === 'ADMIN') {
      throw AppError.forbidden(
        ERROR_CODES.PORTAL_NOT_ALLOWED,
        'Use the admin portal sign-in, which requires a second factor.',
      );
    }

    if (!user.portals.includes(input.portal)) {
      throw AppError.forbidden(
        ERROR_CODES.PORTAL_NOT_ALLOWED,
        'This account cannot sign in to that Anvesh portal.',
      );
    }

    await this.repo.clearFailedLogins(String(user._id));
    const tokens = await this.issueSession(
      { userId: String(user._id), role: user.role, portal: input.portal, tokenVersion: user.tokenVersion },
      meta,
    );
    return { user: toPublicUser(user), tokens };
  }

  /**
   * Rotating refresh with reuse detection: presenting a token that has already
   * been exchanged revokes the whole token family, because that is the shape of
   * a stolen-token replay.
   */
  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = TokenService.hash(rawToken);
    const stored = await this.repo.findRefreshToken(tokenHash);
    if (!stored) throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_INVALID);

    if (stored.revokedAt) {
      await this.repo.revokeFamily(stored.familyId);
      throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_REUSED);
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }

    const user = await this.repo.findById(String(stored.userId));
    if (!user) throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_INVALID);
    if (user.status === 'SUSPENDED') {
      throw AppError.unauthorized(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED);
    }

    const issued = this.tokens.issueRefreshToken(stored.familyId);
    await this.repo.rotateRefreshToken(stored._id, issued.tokenHash);
    await this.repo.storeRefreshToken({
      userId: String(user._id),
      portal: stored.portal,
      tokenHash: issued.tokenHash,
      familyId: issued.familyId,
      expiresAt: issued.expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    const access = this.tokens.signAccessToken({
      userId: String(user._id),
      role: user.role,
      portal: stored.portal,
      tokenVersion: user.tokenVersion,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: issued.token,
      refreshTokenExpiresIn: this.env.JWT_REFRESH_TTL_SECONDS,
    };
  }

  async logout(userId: string, rawToken: string | null, allDevices: boolean): Promise<void> {
    if (allDevices) {
      await this.repo.revokeAllForUser(userId);
      await this.repo.bumpTokenVersion(userId);
      return;
    }
    if (!rawToken) return;
    const stored = await this.repo.findRefreshToken(TokenService.hash(rawToken));
    if (stored && String(stored.userId) === userId) {
      await this.repo.revokeFamily(stored.familyId);
    }
  }

  async issueSession(
    principal: { userId: string; role: Role; portal: Portal; tokenVersion: number },
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const access = this.tokens.signAccessToken(principal);
    const refresh = this.tokens.issueRefreshToken();
    await this.repo.storeRefreshToken({
      userId: principal.userId,
      portal: principal.portal,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshTokenExpiresIn: this.env.JWT_REFRESH_TTL_SECONDS,
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repo.findById(userId);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    return toPublicUser(user);
  }
}