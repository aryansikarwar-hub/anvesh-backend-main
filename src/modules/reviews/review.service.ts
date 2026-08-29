import { Types } from 'mongoose';
import { buildPageInfo, clamp01, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type Paginated, type Review } from '../../lib/types';
import { type ReviewCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type AuthRepository } from '../auth/auth.repository';
import { type BookingRepository } from '../bookings/booking.repository';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type PlaceRepository } from '../places/place.repository';
import { type ReviewRepository } from './review.repository';

const EDIT_WINDOW_MS = 14 * 86_400_000;

/**
 * Reviews.
 *
 * A review is always written by the authenticated traveller; the author id and
 * name come from the token and the user document, never from the payload, so a
 * guide or an admin cannot post as somebody else.
 *
 * `crowdFelt` is not decoration: it feeds the crowd signal on the place, which
 * is a penalty in the ranking.
 */
export class ReviewService {
  constructor(
    private readonly repo: ReviewRepository,
    private readonly places: PlaceRepository,
    private readonly experiences: ExperienceRepository,
    private readonly bookings: BookingRepository,
    private readonly users: AuthRepository,
  ) {}

  async create(userId: string, input: ReviewCreateInput): Promise<Review> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    if (!user.emailVerifiedAt) throw new AppError(ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED);

    await this.assertTargetExists(input.targetType, input.targetId);

    if (await this.repo.existsForTarget(userId, input.targetType, input.targetId)) {
      throw new AppError(ERROR_CODES.REVIEW_ALREADY_EXISTS);
    }

    // An experience can only be reviewed by somebody who actually booked it.
    if (input.targetType === 'EXPERIENCE') {
      const eligible = await this.bookings.hasCompletedBooking(userId, input.targetId);
      if (!eligible) {
        throw new AppError(ERROR_CODES.REVIEW_NOT_ELIGIBLE, {
          message: 'Only travellers who booked this experience can review it.',
        });
      }
    }

    const created = await this.repo.create({
      targetType: input.targetType,
      targetId: new Types.ObjectId(input.targetId),
      userId: new Types.ObjectId(userId),
      authorName: user.profile.displayName,
      ...(user.profile.avatarUrl ? { authorAvatarUrl: user.profile.avatarUrl } : {}),
      rating: input.rating,
      title: input.title,
      body: input.body,
      visitedAt: input.visitedAt ? new Date(input.visitedAt) : null,
      crowdFelt: input.crowdFelt,
      imageUrls: input.imageUrls,
    });

    await this.syncTarget(input.targetType, new Types.ObjectId(input.targetId));
    return toReview(created);
  }

  async listForTarget(options: {
    targetType: 'PLACE' | 'EXPERIENCE';
    targetId: string;
    sort: string;
    page: number;
    limit: number;
    rating?: number;
  }): Promise<Paginated<Review>> {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.repo.listForTarget(
      options.targetType,
      options.targetId,
      options.sort,
      skip,
      limit,
      options.rating,
    );
    return {
      items: items.map((i) => toReview(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async listMine(userId: string, page: number, limit: number): Promise<Paginated<Review>> {
    const { skip, limit: take } = toSkipLimit(page, limit);
    const { items, total } = await this.repo.listForUser(userId, skip, take);
    return {
      items: items.map((i) => toReview(i as never)),
      pageInfo: buildPageInfo(page, limit, total),
    };
  }

  /** Reviews left on a guide's own experiences. */
  async listForGuideExperiences(
    experienceIds: string[],
    page: number,
    limit: number,
  ): Promise<Paginated<Review>> {
    if (experienceIds.length === 0) {
      return { items: [], pageInfo: buildPageInfo(page, limit, 0) };
    }
    const { skip, limit: take } = toSkipLimit(page, limit);
    const { items, total } = await this.repo.listForTargets(
      experienceIds.map((id) => new Types.ObjectId(id)),
      skip,
      take,
    );
    return {
      items: items.map((i) => toReview(i as never)),
      pageInfo: buildPageInfo(page, limit, total),
    };
  }

  async update(userId: string, reviewId: string, patch: Record<string, unknown>): Promise<Review> {
    const existing = await this.repo.findOwned(userId, reviewId);
    if (!existing) throw new AppError(ERROR_CODES.REVIEW_NOT_FOUND);
    if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new AppError(ERROR_CODES.REVIEW_EDIT_WINDOW_CLOSED, {
        message: 'Reviews can be edited for 14 days after posting.',
      });
    }
    const updated = await this.repo.updateOwned(userId, reviewId, { $set: patch });
    await this.syncTarget(existing.targetType, existing.targetId);
    return toReview(updated as never);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const existing = await this.repo.findOwned(userId, reviewId);
    if (!existing) throw new AppError(ERROR_CODES.REVIEW_NOT_FOUND);
    await this.repo.updateOwned(userId, reviewId, { $set: { deletedAt: new Date() } });
    await this.syncTarget(existing.targetType, existing.targetId);
  }

  async report(userId: string, reviewId: string, reason: string, details: string): Promise<void> {
    const review = await this.repo.findAnyById(reviewId);
    if (!review) throw new AppError(ERROR_CODES.REVIEW_NOT_FOUND);
    await this.repo.report(reviewId, userId, reason, details);
  }

  /** Recomputes the target's rating, and a place's crowd level, from reviews. */
  private async syncTarget(targetType: string, targetId: Types.ObjectId): Promise<void> {
    const stats = await this.repo.aggregateRating(targetType, targetId);
    if (targetType === 'PLACE') {
      await this.places.syncRating(targetId, stats.ratingAvg, stats.ratingCount);
      if (stats.crowdAvg !== null) {
        const place = await this.places.findAnyById(String(targetId));
        if (place) {
          // Blend reported crowding into the stored signal rather than
          // replacing it, so one review cannot swing the ranking.
          const blended = clamp01(place.signals.crowdLevel * 0.7 + stats.crowdAvg * 0.3);
          place.set('signals.crowdLevel', blended);
          await place.save();
        }
      }
      return;
    }
    await this.experiences.syncRating(targetId, stats.ratingAvg, stats.ratingCount);
  }

  private async assertTargetExists(targetType: string, targetId: string): Promise<void> {
    if (targetType === 'PLACE') {
      const place = await this.places.findPublishedById(targetId);
      if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
      return;
    }
    const experience = await this.experiences.findPublishedById(targetId);
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
  }
}

interface ReviewRow {
  _id: unknown;
  targetType: Review['targetType'];
  targetId: unknown;
  userId: unknown;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  title: string;
  body: string;
  visitedAt: Date | null;
  crowdFelt: number | null;
  imageUrls: string[];
  helpfulCount: number;
  status: Review['status'];
  createdAt: Date;
  updatedAt: Date;
}

export function toReview(row: ReviewRow): Review {
  return {
    id: String(row._id),
    targetType: row.targetType,
    targetId: String(row.targetId),
    userId: String(row.userId),
    authorName: row.authorName,
    ...(row.authorAvatarUrl ? { authorAvatarUrl: row.authorAvatarUrl } : {}),
    rating: row.rating,
    title: row.title,
    body: row.body,
    visitedAt: row.visitedAt ? row.visitedAt.toISOString() : null,
    crowdFelt: row.crowdFelt,
    imageUrls: row.imageUrls,
    helpfulCount: row.helpfulCount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
