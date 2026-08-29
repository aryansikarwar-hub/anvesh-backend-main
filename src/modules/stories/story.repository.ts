import { Types, type FilterQuery, type UpdateQuery } from 'mongoose';
import { StoryModel, type StoryDocument } from '../../lib/database';
import { type StoryListQuery } from '../../lib/validation';

/**
 * Story reads and writes.
 *
 * Two rules, the same ones the place repository follows:
 *  - a public query never leaves out `status: 'PUBLISHED'`, and
 *  - a guide query always carries the authenticated guide's own id, so
 *    ownership is enforced by the filter rather than by a check afterwards.
 */
export class StoryRepository {
  private publicMatch(query: StoryListQuery): FilterQuery<StoryDocument> {
    const match: FilterQuery<StoryDocument> = { status: 'PUBLISHED', deletedAt: null };
    if (query.kind) match.kind = query.kind;
    if (query.state) match.state = new RegExp(`^${escapeRegExp(query.state)}$`, 'i');
    if (query.city) match.city = new RegExp(`^${escapeRegExp(query.city)}$`, 'i');
    if (query.placeId) match.placeIds = new Types.ObjectId(query.placeId);
    if (query.guideSlug) match['guideSummary.slug'] = query.guideSlug;
    if (query.q) match.$text = { $search: query.q };
    return match;
  }

  async listPublished(
    query: StoryListQuery,
    skip: number,
    limit: number,
  ): Promise<{ items: StoryDocument[]; total: number }> {
    const match = this.publicMatch(query);
    const [items, total] = await Promise.all([
      StoryModel.find(match)
        .sort(query.q ? { score: { $meta: 'textScore' } } : { publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<StoryDocument[]>()
        .exec(),
      StoryModel.countDocuments(match).exec(),
    ]);
    return { items, total };
  }

  async findPublishedBySlug(slug: string): Promise<StoryDocument | null> {
    return StoryModel.findOne({ slug, status: 'PUBLISHED', deletedAt: null })
      .lean<StoryDocument>()
      .exec();
  }

  async incrementView(id: Types.ObjectId): Promise<void> {
    await StoryModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
  }

  // --- guide-scoped --------------------------------------------------------

  async listForGuide(
    guideId: Types.ObjectId,
    status: string | undefined,
    skip: number,
    limit: number,
  ): Promise<{ items: StoryDocument[]; total: number }> {
    const match: FilterQuery<StoryDocument> = { guideId, deletedAt: null };
    if (status) match.status = status as StoryDocument['status'];
    const [items, total] = await Promise.all([
      StoryModel.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean<StoryDocument[]>().exec(),
      StoryModel.countDocuments(match).exec(),
    ]);
    return { items, total };
  }

  /** Ownership is part of the filter: another guide's id simply finds nothing. */
  async findOwned(guideId: Types.ObjectId, id: string): Promise<StoryDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return StoryModel.findOne({ _id: new Types.ObjectId(id), guideId, deletedAt: null })
      .lean<StoryDocument>()
      .exec();
  }

  async create(input: Partial<StoryDocument>): Promise<StoryDocument> {
    const [created] = await StoryModel.create([input]);
    return created!.toObject() as StoryDocument;
  }

  async updateOwned(
    guideId: Types.ObjectId,
    id: string,
    update: UpdateQuery<StoryDocument>,
  ): Promise<StoryDocument | null> {
    return StoryModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), guideId, deletedAt: null },
      update,
      { new: true, runValidators: true },
    )
      .lean<StoryDocument>()
      .exec();
  }

  async softDeleteOwned(guideId: Types.ObjectId, id: string): Promise<boolean> {
    const result = await StoryModel.updateOne(
      { _id: new Types.ObjectId(id), guideId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await StoryModel.countDocuments({ slug }).exec()) > 0;
  }

  // --- admin ---------------------------------------------------------------

  async listAny(
    status: string | undefined,
    skip: number,
    limit: number,
  ): Promise<{ items: StoryDocument[]; total: number }> {
    const match: FilterQuery<StoryDocument> = { deletedAt: null };
    if (status) match.status = status as StoryDocument['status'];
    const [items, total] = await Promise.all([
      StoryModel.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean<StoryDocument[]>().exec(),
      StoryModel.countDocuments(match).exec(),
    ]);
    return { items, total };
  }

  async findAnyById(id: string): Promise<StoryDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return StoryModel.findOne({ _id: new Types.ObjectId(id) }).lean<StoryDocument>().exec();
  }

  async adminUpdate(id: string, update: UpdateQuery<StoryDocument>): Promise<StoryDocument | null> {
    return StoryModel.findOneAndUpdate({ _id: new Types.ObjectId(id) }, update, { new: true })
      .lean<StoryDocument>()
      .exec();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
