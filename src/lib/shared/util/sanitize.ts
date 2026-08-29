/**
 * NoSQL-injection guard. Any object key that begins with `$` or contains `.`
 * is rejected outright rather than silently stripped, so that a malicious
 * payload fails loudly instead of half-executing.
 */
export class UnsafeKeyError extends Error {
  constructor(public readonly path: string) {
    super(`Unsafe key at ${path}`);
    this.name = 'UnsafeKeyError';
  }
}

const MAX_DEPTH = 12;
// Control characters are exactly what this regex is meant to match.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function assertNoOperatorKeys(value: unknown, path = '$', depth = 0): void {
  if (depth > MAX_DEPTH) throw new UnsafeKeyError(path);
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoOperatorKeys(item, `${path}[${i}]`, depth + 1));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (value instanceof Date) return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      throw new UnsafeKeyError(`${path}.${key}`);
    }
    assertNoOperatorKeys(child, `${path}.${key}`, depth + 1);
  }
}

/** Escapes user input before it is used inside a RegExp. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strips control characters and trims free text to a bounded length. */
export function normaliseText(input: string, maxLength = 5000): string {
  return input.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}
