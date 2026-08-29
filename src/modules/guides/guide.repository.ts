import { Types } from 'mongoose';
import { GuideProfileModel, type GuideProfileDocument } from '../../lib/database';
import { slugify } from '../../lib/shared';

/**
 * All guide reads are scoped. `findOwnedBy` is the only way a guide-portal
 * request resolves its own profile: the owner id is part of the filter, so a
 * mistyped route cannot return somebody else's record.
 */
export class GuideRepository {
  async createForUser(userId: string, displayName: string): Promise<GuideProfileDocument> {
    const slug = await this.uniqueSlug(displayName);
    const [created] = await GuideProfileModel.create([
      {
        userId: new Types.ObjectId(userId),
        slug,
        displayName,
        headline: '',
        baseCity: 'Unknown',
        baseState: 'Unknown',
      },
    ]);
    return created as GuideProfileDocument;
  }

  async findOwnedBy(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return null;
    return GuideProfileModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async findBySlug(slug: string) {
    return GuideProfileModel.findOne({ slug, verified: true }).lean().exec();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return GuideProfileModel.findById(id).exec();
  }

  async updateOwned(userId: string, update: Record<string, unknown>) {
    return GuideProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  async list(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      GuideProfileModel.find(filter).sort({ ratingAvg: -1 }).skip(skip).limit(limit).lean().exec(),
      GuideProfileModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async incrementStats(guideId: Types.ObjectId, inc: Record<string, number>) {
    return GuideProfileModel.updateOne({ _id: guideId }, { $inc: inc }).exec();
  }

  private async uniqueSlug(displayName: string): Promise<string> {
    const base = slugify(displayName) || 'guide';
    let candidate = base;
    let suffix = 1;
    // Bounded: after a few collisions we fall back to a random suffix.
    while (await GuideProfileModel.exists({ slug: candidate })) {
      suffix += 1;
      candidate = suffix <= 20 ? `${base}-${suffix}` : `${base}-${Date.now().toString(36)}`;
      if (suffix > 20) break;
    }
    return candidate;
  }
}
