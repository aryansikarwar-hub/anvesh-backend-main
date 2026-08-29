import { describe, expect, it } from 'vitest';
import { computeBookingAmounts, DEFAULT_TAX_BPS } from './booking.pricing';

describe('computeBookingAmounts', () => {
  it('keeps every amount an integer number of paise', () => {
    const amounts = computeBookingAmounts({
      unitPriceMinor: 249999,
      seats: 3,
      commissionBps: 1200,
    });
    for (const [key, value] of Object.entries(amounts)) {
      if (typeof value === 'number') expect(Number.isInteger(value), key).toBe(true);
    }
  });

  it('splits the subtotal into commission and guide payout without losing a paisa', () => {
    const amounts = computeBookingAmounts({
      unitPriceMinor: 250000,
      seats: 2,
      commissionBps: 1200,
    });
    expect(amounts.subtotalMinor).toBe(500000);
    expect(amounts.commissionMinor).toBe(60000);
    expect(amounts.guidePayoutMinor).toBe(440000);
    expect(amounts.commissionMinor + amounts.guidePayoutMinor).toBe(amounts.subtotalMinor);
  });

  it('charges tax on the platform fee only', () => {
    const amounts = computeBookingAmounts({
      unitPriceMinor: 100000,
      seats: 1,
      commissionBps: 1000,
    });
    expect(amounts.commissionMinor).toBe(10000);
    expect(amounts.taxMinor).toBe(Math.round((10000 * DEFAULT_TAX_BPS) / 10000));
    expect(amounts.totalMinor).toBe(amounts.subtotalMinor + amounts.taxMinor);
  });

  it('rejects fractional prices and non-positive seat counts', () => {
    expect(() =>
      computeBookingAmounts({ unitPriceMinor: 999.5, seats: 1, commissionBps: 1200 }),
    ).toThrow();
    expect(() =>
      computeBookingAmounts({ unitPriceMinor: 1000, seats: 0, commissionBps: 1200 }),
    ).toThrow();
    expect(() =>
      computeBookingAmounts({ unitPriceMinor: 1000, seats: 1.5, commissionBps: 1200 }),
    ).toThrow();
  });

  it('handles a zero-commission configuration', () => {
    const amounts = computeBookingAmounts({ unitPriceMinor: 5000, seats: 4, commissionBps: 0 });
    expect(amounts.commissionMinor).toBe(0);
    expect(amounts.taxMinor).toBe(0);
    expect(amounts.guidePayoutMinor).toBe(amounts.subtotalMinor);
    expect(amounts.totalMinor).toBe(20000);
  });
});
