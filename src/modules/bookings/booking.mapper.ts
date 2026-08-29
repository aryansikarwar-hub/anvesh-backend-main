import { type Booking } from '../../lib/types';
import { type BookingDocument } from '../../lib/database';

export function toBooking(doc: BookingDocument): Booking {
  const guide = doc.guideSummary as Record<string, unknown>;
  return {
    id: String(doc._id),
    code: doc.code,
    userId: String(doc.userId),
    guideId: String(doc.guideId),
    experienceId: String(doc.experienceId),
    slotId: String(doc.slotId),
    status: doc.status,
    amounts: {
      seats: doc.seats,
      unitPriceMinor: doc.unitPriceMinor,
      subtotalMinor: doc.subtotalMinor,
      feeMinor: doc.feeMinor,
      taxMinor: doc.taxMinor,
      totalMinor: doc.totalMinor,
      commissionMinor: doc.commissionMinor,
      guidePayoutMinor: doc.guidePayoutMinor,
      currency: doc.currency,
    },
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    experienceTitle: doc.experienceTitle,
    experienceSlug: doc.experienceSlug,
    ...(doc.coverImageUrl ? { coverImageUrl: doc.coverImageUrl } : {}),
    guideSummary: {
      guideId: String(guide.guideId),
      displayName: String(guide.displayName),
      slug: String(guide.slug),
      ...(guide.avatarUrl ? { avatarUrl: String(guide.avatarUrl) } : {}),
      verified: Boolean(guide.verified),
      ratingAvg: Number(guide.ratingAvg ?? 0),
      ratingCount: Number(guide.ratingCount ?? 0),
    },
    paymentId: doc.paymentId ? String(doc.paymentId) : null,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    timeline: doc.timeline.map((entry) => ({
      status: entry.status as Booking['status'],
      at: new Date(entry.at).toISOString(),
      by: entry.by as 'USER' | 'GUIDE' | 'ADMIN' | 'SYSTEM',
      ...(entry.reason ? { reason: entry.reason } : {}),
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}
