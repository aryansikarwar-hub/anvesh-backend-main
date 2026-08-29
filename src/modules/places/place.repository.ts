import { Types } from 'mongoose';
import { PlaceModel, type PlaceDocument } from '../../lib/database';

export interface GuideScopedFilter {
  guideId: string;
  status?: string;
}

/**
 * Place data access.
 *
 * Guide-owned reads and writes always carry `guideSummary.guideId` in the
 * filter. A guide can therefore never reach another guide's place, even if a
 * route or a guard were mounted incorrectly.
 */
export class PlaceRepository {
  async findPublishedBySlug(slug: string) {
    return PlaceModel.findOne({ slug, status: 'PUBLISHED' }).lean().exec();
  }

  async findPublishedById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return PlaceModel.findOne({ _id: id, status: 'PUBLISHED' }).lean().exec();
  }

  async findManyPublishedByIds(ids: string[]) {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) return [];
    return PlaceModel.find({ _id: { $in: objectIds }, status: 'PUBLISHED' }).lean().exec();
  }

  async incrementView(id: string) {
    await PlaceModel.updateOne({ _id: id }, { $inc: { 'signals.viewCount': 1 } }).exec();
  }

  async create(document: Record<string, unknown>): Promise<PlaceDocument> {
    const [created] = await PlaceModel.create([document]);
    return created as PlaceDocument;
  }

  async findOwned(guideId: string, placeId: string) {
    if (!Types.ObjectId.isValid(placeId)) return null;
    return PlaceModel.findOne({
      _id: new Types.ObjectId(placeId),
      'guideSummary.guideId': new Types.ObjectId(guideId),
    }).exec();
  }

  async updateOwned(guideId: string, placeId: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(placeId)) return null;
    return PlaceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(placeId),
        'guideSummary.guideId': new Types.ObjectId(guideId),
      },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  async softDeleteOwned(guideId: string, placeId: string) {
    return this.updateOwned(guideId, placeId, { $set: { deletedAt: new Date() } });
  }

  async listOwned(filter: GuideScopedFilter, skip: number, limit: number) {
    const query: Record<string, unknown> = {
      'guideSummary.guideId': new Types.ObjectId(filter.guideId),
    };
    if (filter.status) query.status = filter.status;
    const [items, total] = await Promise.all([
      PlaceModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean().exec(),
      PlaceModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async slugExists(slug: string): Promise<boolean> {
    return Boolean(await PlaceModel.exists({ slug }));
  }

  /** Admin scope: no guide filter, every status visible. */
  async adminList(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      PlaceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      PlaceModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async adminUpdate(placeId: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(placeId)) return null;
    return PlaceModel.findByIdAndUpdate(placeId, update, { new: true, runValidators: true }).exec();
  }

  async findAnyById(placeId: string) {
    if (!Types.ObjectId.isValid(placeId)) return null;
    return PlaceModel.findById(placeId).exec();
  }

  async syncRating(placeId: Types.ObjectId, ratingAvg: number, ratingCount: number) {
    await PlaceModel.updateOne(
      { _id: placeId },
      { $set: { 'signals.ratingAvg': ratingAvg, 'signals.ratingCount': ratingCount } },
    ).exec();
  }
}
