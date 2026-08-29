import { type CookieOptions, type Request, type Response } from 'express';
import { type Env } from '../../lib/config';

export const REFRESH_COOKIE = 'anvesh_rt';

/**
 * The refresh token travels in an httpOnly cookie so browser JavaScript, and
 * therefore any XSS payload, cannot read it.
 *
 * SameSite=Lax only works when the frontend and API share a site (e.g. both
 * on localhost, or same-origin behind one domain). This app is commonly
 * deployed with the frontend and API on two different domains (say, Vercel +
 * Render) — a genuinely cross-site setup — so the cookie needs
 * SameSite=None there, which browsers only honour together with Secure. Lax
 * remains correct for local development over plain http, where Secure isn't
 * available at all.
 */
export function refreshCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string, env: Env): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(env));
}

export function clearRefreshCookie(res: Response, env: Env): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(env), maxAge: undefined });
}

/** Cookie first, body second — the body form exists for native clients. */
export function readRefreshToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const fromCookie = cookies?.[REFRESH_COOKIE];
  if (fromCookie) return fromCookie;
  const body = req.body as { refreshToken?: unknown } | undefined;
  return typeof body?.refreshToken === 'string' ? body.refreshToken : null;
}