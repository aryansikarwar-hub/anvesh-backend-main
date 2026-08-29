import { hashPassword, verifyPassword, type UserDocument } from '../../lib/database';
import { type Env } from '../../lib/config';
import { ERROR_CODES, type Portal } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { getLogger } from '../../common/logger';
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
  type Mailer,
} from '../../infra/mailer';
import { type AuthRepository } from './auth.repository';
import { TokenService } from './token.service';

/** Email verification, password reset and password change. */
export class AccountService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
    private readonly mailer: Mailer,
    private readonly env: Env,
  ) {}

  private appUrlFor(portal: Portal): string {
    if (portal === 'TOURIST_GUIDE') return this.env.GUIDE_APP_URL;
    if (portal === 'ADMIN') return this.env.ADMIN_APP_URL;
    return this.env.WEB_APP_URL;
  }

  async sendVerificationEmail(user: UserDocument): Promise<void> {
    const issued = this.tokens.issueOpaqueToken(
      this.env.EMAIL_VERIFICATION_TTL_HOURS * 3_600_000,
    );
    await this.repo.storeVerificationToken({
      userId: String(user._id),
      purpose: 'EMAIL_VERIFY',
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    const base = this.appUrlFor(user.portals[0] ?? 'TRAVELLER');
    const url = `${base}/verify-email?token=${issued.token}`;
    await this.mailer.send(verifyEmailTemplate(user.email, user.profile.displayName, url));
    getLogger().info({ userId: String(user._id) }, 'verification email queued');
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.repo.findByEmail(email);
    // Always succeeds from the caller's point of view: replying differently for
    // a known and an unknown address would be an account-enumeration oracle.
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.repo.consumeVerificationToken(
      TokenService.hash(token),
      'EMAIL_VERIFY',
    );
    if (!record) throw new AppError(ERROR_CODES.AUTH_VERIFICATION_TOKEN_INVALID);
    await this.repo.updateUser(String(record.userId), {
      $set: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });
  }

  async forgotPassword(email: string, portal: Portal): Promise<void> {
    const user = await this.repo.findByEmail(email);
    if (!user) return;
    const issued = this.tokens.issueOpaqueToken(this.env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    await this.repo.storeVerificationToken({
      userId: String(user._id),
      purpose: 'PASSWORD_RESET',
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    const url = `${this.appUrlFor(portal)}/reset-password?token=${issued.token}`;
    await this.mailer.send(resetPasswordTemplate(user.email, user.profile.displayName, url));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.repo.consumeVerificationToken(
      TokenService.hash(token),
      'PASSWORD_RESET',
    );
    if (!record) throw new AppError(ERROR_CODES.AUTH_RESET_TOKEN_INVALID);

    const userId = String(record.userId);
    await this.repo.updateUser(userId, {
      $set: {
        passwordHash: await hashPassword(newPassword),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    // Every existing session dies with the old password.
    await this.repo.revokeAllForUser(userId);
    await this.repo.bumpTokenVersion(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repo.findById(userId, true);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);

    await this.repo.updateUser(userId, {
      $set: { passwordHash: await hashPassword(newPassword) },
    });
    await this.repo.revokeAllForUser(userId);
    await this.repo.bumpTokenVersion(userId);
  }
}
