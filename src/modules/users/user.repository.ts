import { Types } from 'mongoose';
import {
  PlaceModel,
  SavedPlaceModel,
  UserCollectionModel,
  UserModel,
  type SavedPlaceDocument,
  type UserCollectionDocument,
} from '../../lib/database';
import { type UserPreferences } from '../../lib/types';

export const MAX_COLLECTIONS_PER_USER = 50;

/** Every method here is scoped by the authenticated user id. */
export class UserRepository {
  async findPreferences(userId: string): Promise<UserPreferences | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const user = await UserModel.findById(userId).select('preferences').lean().exec();
    return (user?.preferences as UserPreferences) ?? null;
  }

  async updateProfile(userId: string, patch: Record<string, unknown>) {
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) set[`profile.${key}`] = value;
    return UserModel.findByIdAndUpdate(userId, { $set: set }, { new: true, runValidators: true }).exec();
  }

  async updatePreferences(userId: string, patch: Record<string, unknown>) {
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) set[`preferences.${key}`] = value;
    return UserModel.findByIdAndUpdate(userId, { $set: set }, { new: true, runValidators: true }).exec();
  }

  // --- saved places --------------------------------------------------------

  async savePlace(
    userId: string,
    placeId: string,
    collectionId: string | null,
  ): Promise<SavedPlaceDocument | null> {
    const place = await PlaceModel.findOne({ _id: placeId, status: 'PUBLISHED' }).lean().exec();
    if (!place) return null;

    const saved = await SavedPlaceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), placeId: new Types.ObjectId(placeId) },
      {
        $set: {
          collectionId: collectionId ? new Types.ObjectId(collectionId) : null,
          placeSummary: {
            placeId: place._id,
            title: place.title,
            slug: place.slug,
            city: place.address.city,
            categorySlugs: place.categorySlugs,
            ...(place.images[0] ? { coverImageUrl: (place.images[0] as { url: string }).url } : {}),
          },
          deletedAt: null,
        },
      },
      { upsert: true, new: true },
    ).exec();

    await PlaceModel.updateOne({ _id: placeId }, { $inc: { 'signals.saveCount': 1 } }).exec();
    return saved;
  }

  async unsavePlace(userId: string, placeId: string): Promise<boolean> {
    const result = await SavedPlaceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), placeId: new Types.ObjectId(placeId) },
      { $set: { deletedAt: new Date() } },
    ).exec();
    if (result) {
      await PlaceModel.updateOne(
        { _id: placeId, 'signals.saveCount': { $gt: 0 } },
        { $inc: { 'signals.saveCount': -1 } },
      ).exec();
    }
    return Boolean(result);
  }

  async listSaved(userId: string, collectionId: string | null, skip: number, limit: number) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (collectionId) filter.collectionId = new Types.ObjectId(collectionId);
    const [items, total] = await Promise.all([
      SavedPlaceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      SavedPlaceModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async isSaved(userId: string, placeId: string): Promise<boolean> {
    return Boolean(
      await SavedPlaceModel.exists({
        userId: new Types.ObjectId(userId),
        placeId: new Types.ObjectId(placeId),
      }),
    );
  }

  // --- collections ---------------------------------------------------------

  async countCollections(userId: string): Promise<number> {
    return UserCollectionModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
  }

  async createCollection(userId: string, input: Record<string, unknown>) {
    const [created] = await UserCollectionModel.create([
      { ...input, userId: new Types.ObjectId(userId) },
    ]);
    return created as UserCollectionDocument;
  }

  async listCollections(userId: string) {
    return UserCollectionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  /** Ownership is part of the filter, not a check after the fetch. */
  async findOwnedCollection(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return UserCollectionModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  async updateOwnedCollection(userId: string, id: string, patch: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return UserCollectionModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: patch },
      { new: true, runValidators: true },
    ).exec();
  }

  async deleteOwnedCollection(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const deleted = await UserCollectionModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { deletedAt: new Date() } },
    ).exec();
    if (deleted) {
      await SavedPlaceModel.updateMany(
        { userId: new Types.ObjectId(userId), collectionId: deleted._id },
        { $set: { collectionId: null } },
      ).exec();
    }
    return deleted;
  }

  async recountCollection(userId: string, collectionId: Types.ObjectId) {
    const itemCount = await SavedPlaceModel.countDocuments({
      userId: new Types.ObjectId(userId),
      collectionId,
    }).exec();
    await UserCollectionModel.updateOne({ _id: collectionId }, { $set: { itemCount } }).exec();
    return itemCount;
  }
}
