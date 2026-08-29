import { randomBytes } from 'node:crypto';
import { buildPageInfo, slugify, toSkipLimit, uniqueSlug } from '../../lib/shared';
import { ERROR_CODES, type Paginated, type Place } from '../../lib/types';
import { type PlaceCreateInput, type PlaceUpdateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type GuideRepository } from '../guides/guide.repository';
import { type PlaceRepository } from './place.repository';
import { toPlace } from './place.mapper';

/**
 * Places have two very different write paths:
 *  - the public read path, which only ever sees PUBLISHED documents, and
 *  - the guide path, where every query carries the authenticated guide's id.
 *
 * A guide may never set `status`, `discoveryScore`, `popularityScore` or
 * `crowdLevel`; those come from moderation and from real interaction data.
 */
export class PlaceService {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly guides: GuideRepository,
  ) {}

  async getPublishedBySlug(slug: string, options: { countView: boolean }): Promise<Place> {
    const place = await this.repo.findPublishedBySlug(slug);
    if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    if (options.countView) await this.repo.incrementView(String(place._id));
    return toPlace(place as never);
  }

  async createForGuide(userId: string, input: PlaceCreateInput): Promise<Place> {
    const guide = await this.requireGuide(userId);
    const slug = await this.buildSlug(input.title);

    const created = await this.repo.create({
      slug,
      title: input.title,
      summary: input.summary,
      description: input.description,
      categorySlugs: input.categorySlugs,
      location: input.location,
      address: input.address,
      images: input.images,
      openingHours: input.openingHours,
      details: input.details,
      ownership: input.ownership,
      destinationId: input.destinationId,
      // Self-declared signals are accepted; the ranking-critical ones are not.
      signals: {
        localOwnership: input.selfDeclared.localOwnership,
        authenticityScore: input.selfDeclared.authenticityScore,
        uniquenessScore: input.selfDeclared.uniquenessScore,
        lastVerifiedAt: new Date(),
      },
      guideSummary: {
        guideId: guide._id,
        displayName: guide.displayName,
        slug: guide.slug,
        ...(guide.avatarUrl ? { avatarUrl: guide.avatarUrl } : {}),
        verified: guide.verified,
        ratingAvg: guide.ratingAvg,
        ratingCount: guide.ratingCount,
      },
      status: 'DRAFT',
      createdBy: userId,
    });

    await this.guides.incrementStats(guide._id, { 'stats.placeCount': 1 });
    return toPlace(created);
  }

  async updateForGuide(userId: string, placeId: string, input: PlaceUpdateInput): Promise<Place> {
    const guide = await this.requireGuide(userId);
    const set: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (key === 'selfDeclared') continue;
      set[key] = value;
    }
    if (input.selfDeclared) {
      set['signals.localOwnership'] = input.selfDeclared.localOwnership;
      set['signals.authenticityScore'] = input.selfDeclared.authenticityScore;
      set['signals.uniquenessScore'] = input.selfDeclared.uniquenessScore;
    }

    const updated = await this.repo.updateOwned(String(guide._id), placeId, { $set: set });
    if (!updated) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    return toPlace(updated);
  }

  /** A guide submits for review; only a moderator can publish. */
  async submitForReview(userId: string, placeId: string): Promise<Place> {
    const guide = await this.requireGuide(userId);
    const place = await this.repo.findOwned(String(guide._id), placeId);
    if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    if (place.status === 'PUBLISHED') {
      throw new AppError(ERROR_CODES.MODERATION_INVALID_TRANSITION, {
        message: 'This place is already published.',
      });
    }
    if (place.images.length === 0) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: 'Add at least one photograph before submitting.',
      });
    }
    const updated = await this.repo.updateOwned(String(guide._id), placeId, {
      $set: { status: 'PENDING_REVIEW' },
    });
    return toPlace(updated as never);
  }

  async deleteForGuide(userId: string, placeId: string): Promise<void> {
    const guide = await this.requireGuide(userId);
    const deleted = await this.repo.softDeleteOwned(String(guide._id), placeId);
    if (!deleted) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    await this.guides.incrementStats(guide._id, { 'stats.placeCount': -1 });
  }

  async listForGuide(
    userId: string,
    options: { page: number; limit: number; status?: string },
  ): Promise<Paginated<Place>> {
    const guide = await this.requireGuide(userId);
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.repo.listOwned(
      { guideId: String(guide._id), ...(options.status ? { status: options.status } : {}) },
      skip,
      limit,
    );
    return {
      items: items.map((i) => toPlace(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async getOwned(userId: string, placeId: string): Promise<Place> {
    const guide = await this.requireGuide(userId);
    const place = await this.repo.findOwned(String(guide._id), placeId);
    if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    return toPlace(place);
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
