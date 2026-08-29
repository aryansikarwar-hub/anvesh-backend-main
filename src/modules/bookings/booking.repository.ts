import { Types, type ClientSession } from 'mongoose';
import { BookingModel, type BookingDocument } from '../../lib/database';

export class BookingRepository {
  async create(
    document: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<BookingDocument> {
    const [created] = await BookingModel.create(
      [document],
      session ? { session } : {},
    );
    return created as BookingDocument;
  }

  async findByIdempotencyKey(key: string) {
    return BookingModel.findOne({ idempotencyKey: key }).exec();
  }

  /** Traveller scope. */
  async findOwnedByUser(userId: string, bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) return null;
    return BookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  async listForUser(userId: string, filter: Record<string, unknown>, skip: number, limit: number) {
    const query = { ...filter, userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      BookingModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      BookingModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Guide scope. */
  async findOwnedByGuide(guideId: string, bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) return null;
    return BookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      guideId: new Types.ObjectId(guideId),
    }).exec();
  }

  async listForGuide(guideId: string, filter: Record<string, unknown>, skip: number, limit: number) {
    const query = { ...filter, guideId: new Types.ObjectId(guideId) };
    const [items, total] = await Promise.all([
      BookingModel.find(query).sort({ startAt: -1 }).skip(skip).limit(limit).lean().exec(),
      BookingModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async updateStatus(
    bookingId: Types.ObjectId,
    status: string,
    by: string,
    reason: string,
    extra: Record<string, unknown> = {},
    session?: ClientSession,
  ) {
    return BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: { status, ...extra },
        $push: { timeline: { status, at: new Date(), by, reason } },
      },
      { new: true, ...(session ? { session } : {}) },
    ).exec();
  }

  async findById(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) return null;
    return BookingModel.findById(bookingId).exec();
  }

  async findWithContact(bookingId: Types.ObjectId) {
    return BookingModel.findById(bookingId).select('+travellerEmail').exec();
  }

  async findExpired(limit: number) {
    return BookingModel.find({
      status: 'PENDING_PAYMENT',
      expiresAt: { $lt: new Date() },
    })
      .limit(limit)
      .exec();
  }

  async adminList(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      BookingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async aggregateGuideEarnings(guideId: Types.ObjectId) {
    // COLD PATH: guide dashboard, not a hot read.
    return BookingModel.aggregate<{
      _id: string | null;
      grossMinor: number;
      netMinor: number;
      commissionMinor: number;
      bookings: number;
    }>([
      {
        $match: {
          guideId,
          deletedAt: null,
          status: { $in: ['CONFIRMED', 'COMPLETED', 'PARTIALLY_REFUNDED'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$startAt' } },
          grossMinor: { $sum: '$subtotalMinor' },
          netMinor: { $sum: '$guidePayoutMinor' },
          commissionMinor: { $sum: '$commissionMinor' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 24 },
    ]).exec();
  }

  async hasCompletedBooking(userId: string, experienceId: string): Promise<boolean> {
    return Boolean(
      await BookingModel.exists({
        userId: new Types.ObjectId(userId),
        experienceId: new Types.ObjectId(experienceId),
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
      }),
    );
  }
}
