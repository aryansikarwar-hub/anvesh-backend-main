import { type NextFunction, type Request, type Response } from 'express';
import { ERROR_CODES, type AuthUser, type Portal, type Role } from '../../lib/types';
import { AppError } from '../api-error';
import { setContextAuth } from '../request-context';
import { type TokenService } from '../../modules/auth/token.service';

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

/**
 * Layer 1 — authentication. There is no "skip this route" flag: public routes
 * simply do not mount this middleware, so a forgotten decorator cannot expose
 * a protected endpoint.
 */
export function requireAuth(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = readBearer(req);
    if (!token) {
      next(AppError.unauthorized(ERROR_CODES.UNAUTHORIZED, 'A bearer token is required.'));
      return;
    }
    const auth = tokens.verifyAccessToken(token);
    req.auth = auth;
    setContextAuth(auth);
    next();
  };
}

/** Attaches the principal when a token is present, but never rejects. */
export function optionalAuth(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = readBearer(req);
    if (!token) {
      next();
      return;
    }
    try {
      const auth = tokens.verifyAccessToken(token);
      req.auth = auth;
      setContextAuth(auth);
    } catch {
      // An invalid token on a public route is simply an anonymous visitor.
    }
    next();
  };
}

/**
 * Layer 2 — portal. Deliberately separate from the role check: a token minted
 * for the traveller portal must not work against the guide or admin API even
 * when the account's role would otherwise allow it.
 */
export function requirePortal(...allowed: Portal[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowed.includes(auth.portal)) {
      next(
        new AppError(ERROR_CODES.PORTAL_MISMATCH, {
          details: { expected: allowed, received: auth.portal },
        }),
      );
      return;
    }
    next();
  };
}

/** Layer 3 — role. */
export function requireRoles(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowed.includes(auth.role)) {
      next(new AppError(ERROR_CODES.ROLE_NOT_ALLOWED, { details: { required: allowed } }));
      return;
    }
    next();
  };
}

/** Reads the verified principal. Throws rather than returning undefined. */
export function principal(req: Request): AuthUser {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
}
