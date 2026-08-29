import { applyBasisPoints, assertMinor } from '../../lib/shared';

export interface BookingAmountsInput {
  unitPriceMinor: number;
  seats: number;
  commissionBps: number;
  /** GST on the platform fee, in basis points. 1800 = 18%. */
  taxBps?: number;
}

export interface ComputedAmounts {
  seats: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  feeMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionMinor: number;
  guidePayoutMinor: number;
  currency: 'INR';
}

export const DEFAULT_TAX_BPS = 1800;

/**
 * Pure money maths, in integer paise throughout.
 *
 * The traveller pays subtotal + tax on the platform fee. The commission is
 * taken out of the subtotal, so the guide payout is what is actually owed.
 * Every intermediate value is asserted to be an integer.
 */
export function computeBookingAmounts(input: BookingAmountsInput): ComputedAmounts {
  assertMinor(input.unitPriceMinor, 'unitPriceMinor');
  if (!Number.isInteger(input.seats) || input.seats < 1) {
    throw new Error('seats must be a positive integer');
  }

  const subtotalMinor = assertMinor(input.unitPriceMinor * input.seats, 'subtotalMinor');
  const commissionMinor = applyBasisPoints(subtotalMinor, input.commissionBps);
  const taxMinor = applyBasisPoints(commissionMinor, input.taxBps ?? DEFAULT_TAX_BPS);

  return {
    seats: input.seats,
    unitPriceMinor: input.unitPriceMinor,
    subtotalMinor,
    // The platform fee is the visible line item; it equals the commission.
    feeMinor: commissionMinor,
    taxMinor,
    totalMinor: assertMinor(subtotalMinor + taxMinor, 'totalMinor'),
    commissionMinor,
    guidePayoutMinor: assertMinor(subtotalMinor - commissionMinor, 'guidePayoutMinor'),
    currency: 'INR',
  };
}
