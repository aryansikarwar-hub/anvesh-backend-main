import { type Request, type Response } from 'express';
import { type Env } from '../../lib/config';
import { type AdminInviteCreateInput } from '../../lib/validation';
import { sendCreated, sendOk } from '../../common/envelope';
import { body } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type AdminAuthService } from './admin-auth.service';
import { setRefreshCookie } from './auth.cookies';
import { type AuthService } from './auth.service';

export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly auth: AuthService,
    private readonly env: Env,
  ) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ email: string; password: string }>(req);
    sendOk(res, await this.adminAuth.login(input.email, input.password));
  };

  totp = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ challengeToken: string; code: string }>(req);
    const session = await this.adminAuth.verifyTotp(input.challengeToken, input.code, {
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    setRefreshCookie(res, session.tokens.refreshToken, this.env);
    sendOk(res, session);
  };

  createInvite = async (req: Request, res: Response): Promise<void> => {
    const actor = principal(req);
    const me = await this.auth.me(actor.userId);
    const invite = await this.adminAuth.createInvite(
      body<AdminInviteCreateInput>(req),
      actor.userId,
      me.email,
    );
    sendCreated(res, { invite });
  };

  acceptInvite = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ token: string; displayName: string; password: string }>(req);
    await this.adminAuth.acceptInvite(input.token, input.displayName, input.password);
    sendOk(res, { accepted: true });
  };
}
