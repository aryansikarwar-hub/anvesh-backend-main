import { type BookingStatus, type PaymentStatus, type SlotStatus } from '../enums';
import { type GuideSummary } from './user';

export interface AvailabilitySlot {
  id: string;
  experienceId: string;
  guideId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  seatsTotal: number;
  seatsAvailable: number;
  priceMinor: number;
  currency: string;
  status: SlotStatus;
}

export interface BookingTimelineEntry {
  status: BookingStatus;
  at: string;
  by: 'USER' | 'GUIDE' | 'ADMIN' | 'SYSTEM';
  reason?: string;
}

export interface BookingAmounts {
  seats: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  feeMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionMinor: number;
  guidePayoutMinor: number;
  currency: string;
}

export interface Booking {
  id: string;
  code: string;
  userId: string;
  guideId: string;
  experienceId: string;
  slotId: string;
  status: BookingStatus;
  amounts: BookingAmounts;
  startAt: string;
  endAt: string;
  experienceTitle: string;
  experienceSlug: string;
  coverImageUrl?: string;
  guideSummary: GuideSummary;
  paymentId: string | null;
  expiresAt: string | null;
  timeline: BookingTimelineEntry[];
  createdAt: string;
}

export interface RefundEntry {
  providerRefundId: string;
  amountMinor: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  reason: string;
  at: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  provider: 'RAZORPAY';
  providerOrderId: string;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  refunds: RefundEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Everything the browser needs to open Razorpay Checkout. No secrets here. */
export interface CheckoutIntent {
  bookingId: string;
  paymentId: string;
  providerOrderId: string;
  keyId: string;
  amountMinor: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact?: string };
  expiresAt: string;
}

export interface GuideEarnings {
  currency: string;
  lifetimeGrossMinor: number;
  lifetimeCommissionMinor: number;
  lifetimeNetMinor: number;
  pendingPayoutMinor: number;
  paidOutMinor: number;
  monthly: { month: string; grossMinor: number; netMinor: number; bookings: number }[];
}
