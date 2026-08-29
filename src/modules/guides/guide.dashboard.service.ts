import { type Types } from 'mongoose';
import {
  AnalyticsEventModel,
  AvailabilitySlotModel,
  BookingModel,
  ExperienceModel,
  PlaceModel,
  ReviewModel,
} from '../../lib/database';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { type GuideRepository } from './guide.repository';

export interface GuideDashboard {
  places: { total: number; published: number; pendingReview: number };
  experiences: { total: number; published: number };
  bookings: { upcoming: number; pendingPayment: number; completed: number };
  slots: { openNext30Days: number; seatsAvailable: number };
  reviews: { total: number; ratingAvg: number };
  earnings: { lifetimeNetMinor: number; pendingPayoutMinor: number; currency: 'INR' };
}

/**
 * Real aggregates only. Every number on the guide dashboard is counted from
 * the guide's own documents at request time; nothing here is a placeholder.
 */
export class GuideDashboardService {
  constructor(private readonly guides: GuideRepository) {}

  async build(userId: string): Promise<GuideDashboard> {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    const guideId = guide._id as Types.ObjectId;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    const [
      placesTotal,
      placesPublished,
      placesPending,
      experiencesTotal,
      experiencesPublished,
      bookingsUpcoming,
      bookingsPendingPayment,
      bookingsCompleted,
      slots,
      reviewStats,
      earnings,
    ] = await Promise.all([
      PlaceModel.countDocuments({ 'guideSummary.guideId': guideId }),
      PlaceModel.countDocuments({ 'guideSummary.guideId': guideId, status: 'PUBLISHED' }),
      PlaceModel.countDocuments({ 'guideSummary.guideId': guideId, status: 'PENDING_REVIEW' }),
      ExperienceModel.countDocuments({ guideId }),
      ExperienceModel.countDocuments({ guideId, status: 'PUBLISHED' }),
      BookingModel.countDocuments({ guideId, status: 'CONFIRMED', startAt: { $gte: now } }),
      BookingModel.countDocuments({ guideId, status: 'PENDING_PAYMENT' }),
      BookingModel.countDocuments({ guideId, status: 'COMPLETED' }),
      AvailabilitySlotModel.aggregate<{ count: number; seats: number }>([
        {
          $match: {
            guideId,
            deletedAt: null,
            status: 'OPEN',
            startAt: { $gte: now, $lte: in30Days },
          },
        },
        { $group: { _id: null, count: { $sum: 1 }, seats: { $sum: '$seatsAvailable' } } },
      ]),
      this.reviewStats(guideId),
      this.earnings(guideId),
    ]);

    return {
      places: { total: placesTotal, published: placesPublished, pendingReview: placesPending },
      experiences: { total: experiencesTotal, published: experiencesPublished },
      bookings: {
        upcoming: bookingsUpcoming,
        pendingPayment: bookingsPendingPayment,
        completed: bookingsCompleted,
      },
      slots: {
        openNext30Days: slots[0]?.count ?? 0,
        seatsAvailable: slots[0]?.seats ?? 0,
      },
      reviews: reviewStats,
      earnings: {
        lifetimeNetMinor: earnings,
        pendingPayoutMinor: Math.max(0, earnings - guide.stats.paidOutMinor),
        currency: 'INR',
      },
    };
  }

  /** Views, saves and conversion for the guide's own places, last 30 days. */
  async analytics(userId: string) {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    const guideId = guide._id as Types.ObjectId;
    const since = new Date(Date.now() - 30 * 86_400_000);

    const places = await PlaceModel.find({ 'guideSummary.guideId': guideId })
      .select('_id title slug signals.viewCount signals.saveCount')
      .lean()
      .exec();
    const placeIds = places.map((p) => p._id);

    const daily = await AnalyticsEventModel.aggregate<{
      _id: { day: string; type: string };
      count: number;
    }>([
      { $match: { placeId: { $in: placeIds }, occurredAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]).exec();

    const bookings = await BookingModel.countDocuments({
      guideId,
      createdAt: { $gte: since },
    }).exec();

    const totalViews = places.reduce((sum, p) => sum + p.signals.viewCount, 0);
    return {
      windowDays: 30,
      places: places.map((p) => ({
        id: String(p._id),
        title: p.title,
        slug: p.slug,
        views: p.signals.viewCount,
        saves: p.signals.saveCount,
      })),
      daily: daily.map((row) => ({ day: row._id.day, type: row._id.type, count: row.count })),
      bookingsInWindow: bookings,
      viewToBookingRate: totalViews === 0 ? 0 : Number((bookings / totalViews).toFixed(4)),
    };
  }

  private async reviewStats(guideId: Types.ObjectId) {
    // COLD PATH: guide dashboard.
    const experiences = await ExperienceModel.find({ guideId }).select('_id').lean().exec();
    const ids = experiences.map((e) => e._id);
    if (ids.length === 0) return { total: 0, ratingAvg: 0 };
    const [row] = await ReviewModel.aggregate<{ total: number; ratingAvg: number }>([
      { $match: { targetType: 'EXPERIENCE', targetId: { $in: ids }, status: 'PUBLISHED' } },
      { $group: { _id: null, total: { $sum: 1 }, ratingAvg: { $avg: '$rating' } } },
    ]).exec();
    return {
      total: row?.total ?? 0,
      ratingAvg: row ? Number(row.ratingAvg.toFixed(2)) : 0,
    };
  }

  private async earnings(guideId: Types.ObjectId): Promise<number> {
    const [row] = await BookingModel.aggregate<{ net: number }>([
      {
        $match: {
          guideId,
          deletedAt: null,
          status: { $in: ['CONFIRMED', 'COMPLETED', 'PARTIALLY_REFUNDED'] },
        },
      },
      { $group: { _id: null, net: { $sum: '$guidePayoutMinor' } } },
    ]).exec();
    return row?.net ?? 0;
  }
}
