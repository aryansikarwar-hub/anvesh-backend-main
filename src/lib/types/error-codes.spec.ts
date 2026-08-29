import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from './error-codes';

describe('error code registry', () => {
  it('maps every code to a plausible HTTP status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      const status = ERROR_STATUS[code];
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });

  it('uses the conventional status for the generic codes', () => {
    const expected: Partial<Record<ErrorCode, number>> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      CONFLICT: 409,
      UNAUTHORIZED: 401,
      VALIDATION_ERROR: 422,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      SERVICE_UNAVAILABLE: 503,
      PORTAL_MISMATCH: 403,
      NOT_RESOURCE_OWNER: 403,
      SLOT_SOLD_OUT: 409,
      PLACE_NOT_FOUND: 404,
      PAYMENT_PROVIDER_NOT_CONFIGURED: 503,
    };
    for (const [code, status] of Object.entries(expected)) {
      expect(ERROR_STATUS[code as ErrorCode], code).toBe(status);
    }
  });

  it('keeps every code value identical to its key', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });
});
