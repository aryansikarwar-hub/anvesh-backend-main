import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** Namespace used to make seed data deterministic and therefore idempotent. */
export const SEED_NAMESPACE = 'anvesh.travel/seed/v1';

/** Deterministic 24-hex ObjectId-compatible string derived from a natural key. */
export function deterministicObjectId(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}::${key}`).digest('hex').slice(0, 24);
}

export function newRequestId(): string {
  return randomUUID();
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const BOOKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-quotable booking reference, e.g. ANV-7KQ2-M4XD. */
export function bookingCode(): string {
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => BOOKING_ALPHABET[b % BOOKING_ALPHABET.length])
      .join('');
  return `ANV-${pick(4)}-${pick(4)}`;
}
