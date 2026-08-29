import { Types } from 'mongoose';
import { ContentReportModel, ReviewModel, type ReviewDocument } from '../../lib/database';

export class ReviewRepository {
  async create(document: Record<string, unknown>): Promise<ReviewDocument> {
    const [created] = await ReviewModel.create([document]);
    return created as ReviewDocument;
  }

  async listForTarget(
    targetType: string,
    targetId: string,
    sort: string,
    skip: number,
    limit: number,
    rating?: number,
  ) {
    const filter: Record<string, unknown> = {
      targetType,
      targetId: new Types.ObjectId(targetId),
      status: 'PUBLISHED',
    };
    if (rating) filter.rating = rating;

    const order: Record<string, 1 | -1> =
      sort === 'rating_high'
        ? { rating: -1, createdAt: -1 }
        : sort === 'rating_low'
          ? { rating: 1, createdAt: -1 }
          : sort === 'helpful'
            ? { helpfulCount: -1, createdAt: -1 }
            : { createdAt: -1 };

    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort(order).skip(skip).limit(limit).lean().exec(),
      ReviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async listForUser(userId: string, skip: number, limit: number) {
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ReviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /** Ownership is in the filter. */
  async findOwned(userId: string, reviewId: string) {
    if (!Types.ObjectId.isValid(reviewId)) return null;
    return ReviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  async updateOwned(userId: string, reviewId: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(reviewId)) return null;
    return ReviewModel.findOneAndUpdate(
      { _id: new Types.ObjectId(reviewId), userId: new Types.ObjectId(userId) },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  async existsForTarget(userId: string, targetType: string, targetId: string) {
    return Boolean(
      await ReviewModel.exists({
        userId: new Types.ObjectId(userId),
        targetType,
        targetId: new Types.ObjectId(targetId),
      }),
    );
  }

  async aggregateRating(targetType: string, targetId: Types.ObjectId) {
    const [row] = await ReviewModel.aggregate<{ ratingAvg: number; ratingCount: number; crowdAvg: number | null }>([
      { $match: { targetType, targetId, status: 'PUBLISHED', deletedAt: null } },
      {
        $group: {
          _id: null,
          ratingAvg: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
          crowdAvg: { $avg: '$crowdFelt' },
        },
      },
    ]).exec();
    return {
      ratingAvg: row ? Number(row.ratingAvg.toFixed(2)) : 0,
      ratingCount: row?.ratingCount ?? 0,
      crowdAvg: row?.crowdAvg ?? null,
    };
  }

  async report(reviewId: string, reporterId: string, reason: string, details: string) {
    await ContentReportModel.create([
      {
        targetType: 'REVIEW',
        targetId: new Types.ObjectId(reviewId),
        reporterId: new Types.ObjectId(reporterId),
        reason,
        details,
      },
    ]);
    await ReviewModel.updateOne(
      { _id: new Types.ObjectId(reviewId) },
      { $inc: { reportCount: 1 } },
    ).exec();
  }

  /** COLD PATH: all reviews across a set of targets, for the guide portal. */
  async listForTargets(targetIds: Types.ObjectId[], skip: number, limit: number) {
    const filter = {
      targetType: 'EXPERIENCE',
      targetId: { $in: targetIds },
      status: 'PUBLISHED',
    };
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ReviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async adminList(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort({ reportCount: -1, createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ReviewModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async adminUpdate(reviewId: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(reviewId)) return null;
    return ReviewModel.findByIdAndUpdate(reviewId, update, { new: true }).exec();
  }

  async findAnyById(reviewId: string) {
    if (!Types.ObjectId.isValid(reviewId)) return null;
    return ReviewModel.findById(reviewId).exec();
  }
}
