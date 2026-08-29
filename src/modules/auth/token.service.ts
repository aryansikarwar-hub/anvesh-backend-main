import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { ERROR_CODES, type AuthUser, type Portal, type Role } from '../../lib/types';
import { type Env } from '../../lib/config';
import { AppError } from '../../common/api-error';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  role: Role;
  portal: Portal;
  tv: number;
  typ: 'access';
}

export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

/**
 * Access tokens are short-lived JWTs. Refresh tokens are opaque random values;
 * only their SHA-256 hash is ever stored, so a database leak cannot be replayed
 * against the API.
 */
export class TokenService {
  constructor(private readonly env: Env) {}

  signAccessToken(user: { userId: string; role: Role; portal: Portal; tokenVersion: number }): {
    token: string;
    expiresIn: number;
  } {
    const options: SignOptions = {
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
      jwtid: randomUUID(),
      algorithm: 'HS256',
    };
    const token = jwt.sign(
      { sub: user.userId, role: user.role, portal: user.portal, tv: user.tokenVersion, typ: 'access' },
      this.env.JWT_ACCESS_SECRET,
      options,
    );
    return { token, expiresIn: this.env.JWT_ACCESS_TTL_SECONDS };
  }

  verifyAccessToken(token: string): AuthUser {
    let decoded: AccessTokenClaims;
    try {
      decoded = jwt.verify(token, this.env.JWT_ACCESS_SECRET, {
        issuer: this.env.JWT_ISSUER,
        audience: this.env.JWT_AUDIENCE,
        algorithms: ['HS256'],
      }) as AccessTokenClaims;
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw AppError.unauthorized(
        expired ? ERROR_CODES.AUTH_TOKEN_EXPIRED : ERROR_CODES.AUTH_TOKEN_INVALID,
      );
    }

    if (decoded.typ !== 'access' || !decoded.sub || !decoded.role || !decoded.portal) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_TOKEN_INVALID);
    }

    return {
      userId: decoded.sub,
      role: decoded.role,
      portal: decoded.portal,
      tokenVersion: typeof decoded.tv === 'number' ? decoded.tv : 0,
    };
  }

  issueRefreshToken(familyId?: string): IssuedRefreshToken {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: TokenService.hash(token),
      familyId: familyId ?? randomUUID(),
      expiresAt: new Date(Date.now() + this.env.JWT_REFRESH_TTL_SECONDS * 1000),
    };
  }

  /** One-time links (email verification, password reset, TOTP challenge). */
  issueOpaqueToken(ttlMs: number): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: TokenService.hash(token),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
