import {
  AiRequestLogModel,
  AnalyticsEventModel,
  BookingModel,
  ExperienceModel,
  GuideProfileModel,
  PaymentModel,
  PlaceModel,
  ReviewModel,
  UserModel,
} from '../../lib/database';
import { pingDatabase, supportsTransactions } from '../../lib/database';

export interface AdminDashboard {
  users: { total: number; travellers: number; guides: number; newLast30Days: number };
  content: { places: number; published: number; pendingReview: number; experiences: number };
  commerce: {
    bookingsLast30Days: number;
    confirmedLast30Days: number;
    grossMinorLast30Days: number;
    commissionMinorLast30Days: number;
    currency: 'INR';
  };
  moderation: { placesPending: number; reviewsReported: number };
  ai: { requestsLast30Days: number; rejectedLast30Days: number };
}

/**
 * Admin analytics. Every figure is a live count or aggregate; there are no
 * placeholder numbers anywhere on the admin dashboard.
 */
export class AdminAnalyticsService {
  async dashboard(): Promise<AdminDashboard> {
    const since = new Date(Date.now() - 30 * 86_400_000);

    const [
      users,
      travellers,
      guides,
      newUsers,
      places,
      published,
      pendingReview,
      experiences,
      bookings30,
      commerce,
      reviewsReported,
      aiTotal,
      aiRejected,
    ] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ role: 'TRAVELLER' }),
      GuideProfileModel.countDocuments({}),
      UserModel.countDocuments({ createdAt: { $gte: since } }),
      PlaceModel.countDocuments({}),
      PlaceModel.countDocuments({ status: 'PUBLISHED' }),
      PlaceModel.countDocuments({ status: 'PENDING_REVIEW' }),
      ExperienceModel.countDocuments({}),
      BookingModel.countDocuments({ createdAt: { $gte: since } }),
      BookingModel.aggregate<{ count: number; gross: number; commission: number }>([
        {
          $match: {
            createdAt: { $gte: since },
            deletedAt: null,
            status: { $in: ['CONFIRMED', 'COMPLETED', 'PARTIALLY_REFUNDED'] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            gross: { $sum: '$subtotalMinor' },
            commission: { $sum: '$commissionMinor' },
          },
        },
      ]).exec(),
      ReviewModel.countDocuments({ reportCount: { $gt: 0 }, status: 'PUBLISHED' }),
      AiRequestLogModel.countDocuments({ createdAt: { $gte: since } }),
      AiRequestLogModel.countDocuments({
        createdAt: { $gte: since },
        verdict: { $in: ['SCHEMA_REJECTED', 'REFERENCE_REJECTED'] },
      }),
    ]);

    return {
      users: { total: users, travellers, guides, newLast30Days: newUsers },
      content: { places, published, pendingReview, experiences },
      commerce: {
        bookingsLast30Days: bookings30,
        confirmedLast30Days: commerce[0]?.count ?? 0,
        grossMinorLast30Days: commerce[0]?.gross ?? 0,
        commissionMinorLast30Days: commerce[0]?.commission ?? 0,
        currency: 'INR',
      },
      moderation: { placesPending: pendingReview, reviewsReported },
      ai: { requestsLast30Days: aiTotal, rejectedLast30Days: aiRejected },
    };
  }

  async timeseries(options: { from?: string; to?: string; granularity: 'day' | 'week' | 'month' }) {
    const from = options.from ? new Date(options.from) : new Date(Date.now() - 90 * 86_400_000);
    const to = options.to ? new Date(options.to) : new Date();
    const format =
      options.granularity === 'month' ? '%Y-%m' : options.granularity === 'week' ? '%G-W%V' : '%Y-%m-%d';

    const [bookings, events] = await Promise.all([
      BookingModel.aggregate<{ _id: string; count: number; gross: number }>([
        { $match: { createdAt: { $gte: from, $lte: to }, deletedAt: null } },
        {
          $group: {
            _id: { $dateToString: { format, date: '$createdAt' } },
            count: { $sum: 1 },
            gross: { $sum: '$subtotalMinor' },
          },
        },
        { $sort: { _id: 1 } },
      ]).exec(),
      AnalyticsEventModel.aggregate<{ _id: { bucket: string; type: string }; count: number }>([
        { $match: { occurredAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { bucket: { $dateToString: { format, date: '$occurredAt' } }, type: '$type' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.bucket': 1 } },
      ]).exec(),
    ]);

    return {
      granularity: options.granularity,
      bookings: bookings.map((b) => ({ bucket: b._id, count: b.count, grossMinor: b.gross })),
      events: events.map((e) => ({ bucket: e._id.bucket, type: e._id.type, count: e.count })),
    };
  }

  async aiMonitoring(limit: number) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [byVerdict, recent] = await Promise.all([
      AiRequestLogModel.aggregate<{ _id: string; count: number; avgLatency: number }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$verdict',
            count: { $sum: 1 },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
      ]).exec(),
      AiRequestLogModel.find({ verdict: { $ne: 'OK' } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      byVerdict: byVerdict.map((v) => ({
        verdict: v._id,
        count: v.count,
        avgLatencyMs: Math.round(v.avgLatency),
      })),
      recentRejections: recent.map((r) => ({
        id: String(r._id),
        task: r.task,
        provider: r.provider,
        model: r.model,
        verdict: r.verdict,
        detail: r.rejectionDetail,
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async systemHealth() {
    const mongo = await pingDatabase();
    const transactions = mongo ? await supportsTransactions() : false;
    const [pendingPayments, staleBookings] = await Promise.all([
      PaymentModel.countDocuments({ status: 'CREATED' }),
      BookingModel.countDocuments({ status: 'PENDING_PAYMENT', expiresAt: { $lt: new Date() } }),
    ]);
    return {
      mongo: mongo ? 'up' : 'down',
      mongoReplicaSet: transactions ? 'up' : 'missing',
      pendingPaymentOrders: pendingPayments,
      expiredHoldsAwaitingSweep: staleBookings,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
    };
  }
}
