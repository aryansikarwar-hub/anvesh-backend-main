import { Types } from 'mongoose';
import { TripModel, type TripDocument } from '../../lib/database';

export const MAX_TRIPS_PER_USER = 100;

/** Trips are private to their owner; the user id is always in the filter. */
export class TripRepository {
  async create(document: Record<string, unknown>): Promise<TripDocument> {
    const [created] = await TripModel.create([document]);
    return created as TripDocument;
  }

  async countForUser(userId: string): Promise<number> {
    return TripModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
  }

  async listForUser(userId: string, skip: number, limit: number, destinationId?: string) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (destinationId) filter.destinationId = new Types.ObjectId(destinationId);
    const [items, total] = await Promise.all([
      TripModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean().exec(),
      TripModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findOwned(userId: string, tripId: string) {
    if (!Types.ObjectId.isValid(tripId)) return null;
    return TripModel.findOne({
      _id: new Types.ObjectId(tripId),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  async updateOwned(userId: string, tripId: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(tripId)) return null;
    return TripModel.findOneAndUpdate(
      { _id: new Types.ObjectId(tripId), userId: new Types.ObjectId(userId) },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  async softDeleteOwned(userId: string, tripId: string) {
    return this.updateOwned(userId, tripId, { $set: { deletedAt: new Date() } });
  }
}
