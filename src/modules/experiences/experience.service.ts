import { randomBytes } from 'node:crypto';
import { buildPageInfo, slugify, toSkipLimit, uniqueSlug } from '../../lib/shared';
import { ERROR_CODES, type Experience, type Paginated } from '../../lib/types';
import { type ExperienceCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type GuideRepository } from '../guides/guide.repository';
import { type PlaceRepository } from '../places/place.repository';
import { type ExperienceRepository } from './experience.repository';
import { toExperience } from './experience.mapper';

export class ExperienceService {
  constructor(
    private readonly repo: ExperienceRepository,
    private readonly guides: GuideRepository,
    private readonly places: PlaceRepository,
  ) {}

  async getPublishedBySlug(slug: string): Promise<Experience> {
    const doc = await this.repo.findPublishedBySlug(slug);
    if (!doc) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    return toExperience(doc as never);
  }

  async listPublished(options: {
    page: number;
    limit: number;
    guideSlug?: string;
    placeId?: string;
  }): Promise<Paginated<Experience>> {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const filter: Record<string, unknown> = {};
    if (options.guideSlug) filter['guideSummary.slug'] = options.guideSlug;
    if (options.placeId) filter['placeSummary.placeId'] = options.placeId;
    const { items, total } = await this.repo.listPublished(filter, skip, limit);
    return {
      items: items.map((i) => toExperience(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async createForGuide(userId: string, input: ExperienceCreateInput): Promise<Experience> {
    const guide = await this.requireGuide(userId);
    if (!guide.verified) {
      throw new AppError(ERROR_CODES.GUIDE_NOT_VERIFIED, {
        message: 'Your guide profile must be verified before you can publish experiences.',
      });
    }

    const place = input.placeId ? await this.places.findPublishedById(input.placeId) : null;
    if (input.placeId && !place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);

    const created = await this.repo.create({
      ...this.toDocument(input),
      slug: await this.buildSlug(input.title),
      guideId: guide._id,
      guideSummary: {
        guideId: guide._id,
        displayName: guide.displayName,
        slug: guide.slug,
        ...(guide.avatarUrl ? { avatarUrl: guide.avatarUrl } : {}),
        verified: guide.verified,
        ratingAvg: guide.ratingAvg,
        ratingCount: guide.ratingCount,
      },
      placeSummary: place
        ? {
            placeId: place._id,
            title: place.title,
            slug: place.slug,
            city: place.address.city,
            categorySlugs: place.categorySlugs,
          }
        : null,
      status: 'DRAFT',
    });

    await this.guides.incrementStats(guide._id, { 'stats.experienceCount': 1 });
    return toExperience(created);
  }

  async updateForGuide(
    userId: string,
    id: string,
    input: Partial<ExperienceCreateInput>,
  ): Promise<Experience> {
    const guide = await this.requireGuide(userId);
    const updated = await this.repo.updateOwned(String(guide._id), id, {
      $set: this.toDocument(input),
    });
    if (!updated) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    return toExperience(updated);
  }

  async submitForReview(userId: string, id: string): Promise<Experience> {
    const guide = await this.requireGuide(userId);
    const existing = await this.repo.findOwned(String(guide._id), id);
    if (!existing) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    if (existing.status === 'PUBLISHED') {
      throw new AppError(ERROR_CODES.MODERATION_INVALID_TRANSITION);
    }
    const updated = await this.repo.updateOwned(String(guide._id), id, {
      $set: { status: 'PENDING_REVIEW' },
    });
    return toExperience(updated as never);
  }

  async listForGuide(
    userId: string,
    options: { page: number; limit: number; status?: string },
  ): Promise<Paginated<Experience>> {
    const guide = await this.requireGuide(userId);
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.repo.listOwned(String(guide._id), options.status, skip, limit);
    return {
      items: items.map((i) => toExperience(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async getOwned(userId: string, id: string): Promise<Experience> {
    const guide = await this.requireGuide(userId);
    const doc = await this.repo.findOwned(String(guide._id), id);
    if (!doc) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    return toExperience(doc);
  }

  async deleteForGuide(userId: string, id: string): Promise<void> {
    const guide = await this.requireGuide(userId);
    const removed = await this.repo.updateOwned(String(guide._id), id, {
      $set: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    if (!removed) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    await this.guides.incrementStats(guide._id, { 'stats.experienceCount': -1 });
  }

  /** Maps validated input to document fields. `status` is never taken from input. */
  private toDocument(input: Partial<ExperienceCreateInput>): Record<string, unknown> {
    const doc: Record<string, unknown> = {};
    const copy = [
      'title',
      'summary',
      'description',
      'categorySlugs',
      'images',
      'durationMin',
      'maxSeats',
      'basePriceMinor',
      'meetingPoint',
      'languages',
      'inclusions',
      'exclusions',
      'cancellationPolicy',
    ] as const;
    for (const key of copy) {
      if (input[key] !== undefined) doc[key] = input[key];
    }
    return doc;
  }

  private async requireGuide(userId: string) {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return guide;
  }

  private async buildSlug(title: string): Promise<string> {
    const base = slugify(title);
    if (base && !(await this.repo.slugExists(base))) return base;
    return uniqueSlug(title, randomBytes(3).toString('hex'));
  }
}
