import { Types } from 'mongoose';
import { ExperienceModel, type ExperienceDocument } from '../../lib/database';

/** Guide-owned reads always carry guideId in the filter. */
export class ExperienceRepository {
  async findPublishedBySlug(slug: string) {
    return ExperienceModel.findOne({ slug, status: 'PUBLISHED' }).lean().exec();
  }

  async findPublishedById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return ExperienceModel.findOne({ _id: id, status: 'PUBLISHED' }).lean().exec();
  }

  async listPublished(filter: Record<string, unknown>, skip: number, limit: number) {
    const query = { ...filter, status: 'PUBLISHED' };
    const [items, total] = await Promise.all([
      ExperienceModel.find(query)
        .sort({ 'signals.ratingAvg': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      ExperienceModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async create(document: Record<string, unknown>): Promise<ExperienceDocument> {
    const [created] = await ExperienceModel.create([document]);
    return created as ExperienceDocument;
  }

  async findOwned(guideId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return ExperienceModel.findOne({
      _id: new Types.ObjectId(id),
      guideId: new Types.ObjectId(guideId),
    }).exec();
  }

  async updateOwned(guideId: string, id: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return ExperienceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), guideId: new Types.ObjectId(guideId) },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  async listOwned(guideId: string, status: string | undefined, skip: number, limit: number) {
    const query: Record<string, unknown> = { guideId: new Types.ObjectId(guideId) };
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      ExperienceModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ExperienceModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async slugExists(slug: string): Promise<boolean> {
    return Boolean(await ExperienceModel.exists({ slug }));
  }

  async adminList(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      ExperienceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ExperienceModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async adminUpdate(id: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return ExperienceModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  }

  async findAnyById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return ExperienceModel.findById(id).exec();
  }

  async syncRating(id: Types.ObjectId, ratingAvg: number, ratingCount: number) {
    await ExperienceModel.updateOne(
      { _id: id },
      { $set: { 'signals.ratingAvg': ratingAvg, 'signals.ratingCount': ratingCount } },
    ).exec();
  }

  async incrementBookings(id: Types.ObjectId, by: number) {
    await ExperienceModel.updateOne({ _id: id }, { $inc: { 'signals.bookingCount': by } }).exec();
  }
}
