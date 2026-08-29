import argon2 from 'argon2';

/**
 * Password hashing lives in the database package because it is server-only and
 * because both the API and the seeder must produce identical hashes. It is
 * deliberately NOT in @anvesh/shared: argon2 is a native module and shared is
 * imported by the Next.js apps.
 *
 * Parameters follow the OWASP argon2id recommendation.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
