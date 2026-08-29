import { type NextFunction, type Request, type Response } from 'express';
import { RateLimiterMemory, type RateLimiterAbstract } from 'rate-limiter-flexible';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../api-error';

export interface RateLimitPolicy {
  name: string;
  points: number;
  durationSeconds: number;
  /** Adds the request body email to the key, so one address cannot be sprayed. */
  keyByEmail?: boolean;
  blockSeconds?: number;
}

/** Named policies, documented in docs/security.md section 4. */
export const RATE_LIMITS = {
  login: { name: 'login', points: 5, durationSeconds: 900, keyByEmail: true, blockSeconds: 900 },
  register: { name: 'register', points: 5, durationSeconds: 900 },
  passwordReset: { name: 'pwreset', points: 3, durationSeconds: 3600, keyByEmail: true },
  refresh: { name: 'refresh', points: 30, durationSeconds: 3600 },
  totp: { name: 'totp', points: 5, durationSeconds: 600, blockSeconds: 900 },
  discovery: { name: 'discovery', points: 120, durationSeconds: 60 },
  ai: { name: 'ai', points: 20, durationSeconds: 3600 },
  booking: { name: 'booking', points: 10, durationSeconds: 60 },
  payment: { name: 'payment', points: 10, durationSeconds: 60 },
  review: { name: 'review', points: 5, durationSeconds: 3600 },
  media: { name: 'media', points: 30, durationSeconds: 3600 },
  write: { name: 'write', points: 60, durationSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

const limiters = new Map<string, RateLimiterAbstract>();
let enabled = true;

export function configureRateLimiting(isEnabled: boolean): void {
  enabled = isEnabled;
  limiters.clear();
}

function limiterFor(policy: RateLimitPolicy): RateLimiterAbstract {
  const existing = limiters.get(policy.name);
  if (existing) return existing;

  const options = {
    keyPrefix: `rl:${policy.name}`,
    points: policy.points,
    duration: policy.durationSeconds,
    ...(policy.blockSeconds ? { blockDuration: policy.blockSeconds } : {}),
  };

  // Counters live in this process's memory. That is exact for a single API
  // instance, which is how this project is deployed; behind more than one
  // instance the effective limit is per instance, and a shared store would be
  // needed to make it global again.
  const limiter = new RateLimiterMemory(options);
  limiters.set(policy.name, limiter);
  return limiter;
}

function keyFor(req: Request, policy: RateLimitPolicy): string {
  const identity = req.auth?.userId ?? req.ip ?? 'unknown';
  if (!policy.keyByEmail) return identity;
  const email =
    typeof req.body === 'object' && req.body !== null && 'email' in req.body
      ? String((req.body as { email?: unknown }).email ?? '')
      : '';
  return `${identity}|${email.toLowerCase()}`;
}

export function rateLimit(policy: RateLimitPolicy) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!enabled) {
      next();
      return;
    }
    try {
      const result = await limiterFor(policy).consume(keyFor(req, policy));
      res.setHeader('X-RateLimit-Limit', policy.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      next();
    } catch (rejection) {
      const retryMs = (rejection as { msBeforeNext?: number }).msBeforeNext ?? 60_000;
      res.setHeader('Retry-After', Math.ceil(retryMs / 1000));
      next(
        new AppError(ERROR_CODES.RATE_LIMITED, {
          details: { retryAfterSeconds: Math.ceil(retryMs / 1000) },
        }),
      );
    }
  };
}
