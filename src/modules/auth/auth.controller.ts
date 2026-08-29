import { type Request, type Response } from 'express';
import { type Env } from '../../lib/config';
import { ERROR_CODES } from '../../lib/types';
import {
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { sendCreated, sendOk } from '../../common/envelope';
import { body } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type AuthService } from './auth.service';
import { type AccountService } from './account.service';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from './auth.cookies';

/** Controllers orchestrate only: read the principal, call one service, respond. */
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AccountService,
    private readonly env: Env,
  ) {}

  private meta(req: Request) {
    return { ip: req.ip ?? null, userAgent: req.header('user-agent') ?? null };
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const user = await this.auth.register(body<RegisterInput>(req));
    sendCreated(res, { user });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const session = await this.auth.login(body<LoginInput>(req), this.meta(req));
    setRefreshCookie(res, session.tokens.refreshToken, this.env);
    sendOk(res, session);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const token = readRefreshToken(req);
    if (!token) throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_INVALID);
    const tokens = await this.auth.refresh(token, this.meta(req));
    setRefreshCookie(res, tokens.refreshToken, this.env);
    sendOk(res, { tokens });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { userId } = principal(req);
    const { allDevices } = body<{ allDevices: boolean }>(req);
    await this.auth.logout(userId, readRefreshToken(req), allDevices);
    clearRefreshCookie(res, this.env);
    sendOk(res, { loggedOut: true });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { user: await this.auth.me(principal(req).userId) });
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    await this.accounts.verifyEmail(body<{ token: string }>(req).token);
    sendOk(res, { verified: true });
  };

  resendVerification = async (req: Request, res: Response): Promise<void> => {
    await this.accounts.resendVerification(body<{ email: string }>(req).email);
    sendOk(res, { sent: true });
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ email: string; portal: 'TRAVELLER' | 'TOURIST_GUIDE' | 'ADMIN' }>(req);
    await this.accounts.forgotPassword(input.email, input.portal);
    // Always the same answer, so the endpoint cannot be used to test addresses.
    sendOk(res, { sent: true });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const input = body<ResetPasswordInput>(req);
    await this.accounts.resetPassword(input.token, input.password);
    clearRefreshCookie(res, this.env);
    sendOk(res, { reset: true });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ currentPassword: string; newPassword: string }>(req);
    await this.accounts.changePassword(
      principal(req).userId,
      input.currentPassword,
      input.newPassword,
    );
    clearRefreshCookie(res, this.env);
    sendOk(res, { changed: true });
  };
}
