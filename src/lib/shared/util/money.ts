/**
 * Money is ALWAYS an integer number of minor units (paise for INR).
 * Floats are never used for money anywhere in this codebase.
 */
export class MoneyError extends Error {}

export function assertMinor(value: number, label = 'amount'): number {
  if (!Number.isInteger(value)) throw new MoneyError(`${label} must be an integer minor unit`);
  if (value < 0) throw new MoneyError(`${label} must not be negative`);
  if (value > Number.MAX_SAFE_INTEGER) throw new MoneyError(`${label} overflows safe integer range`);
  return value;
}

export function rupeesToMinor(rupees: number): number {
  return assertMinor(Math.round(rupees * 100));
}

export function minorToRupees(minor: number): number {
  return assertMinor(minor) / 100;
}

/** Percentage in basis points (100 bps = 1%), rounded half-up, never producing floats. */
export function applyBasisPoints(minor: number, bps: number): number {
  assertMinor(minor);
  if (!Number.isInteger(bps) || bps < 0) throw new MoneyError('bps must be a non-negative integer');
  return Math.round((minor * bps) / 10_000);
}

export function sumMinor(...values: number[]): number {
  return values.reduce((acc, v) => acc + assertMinor(v), 0);
}

/**
 * Formats for display. Paise are shown only when they are non-zero, so a price
 * is never rounded up in the UI (999.50 must not read as 1,000).
 */
export function formatMinor(minor: number, currency = 'INR'): string {
  assertMinor(minor);
  const fractionDigits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minor / 100);
}
