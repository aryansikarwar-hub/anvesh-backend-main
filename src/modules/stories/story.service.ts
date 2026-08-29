import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { PlaceModel, type StoryDocument } from '../../lib/database';
import { buildPageInfo, slugify, toSkipLimit, uniqueSlug } from '../../lib/shared';
import {
  ERROR_CODES,
  type Paginated,
  type PlaceSummary,
  type Story,
  type StoryCard,
} from '../../lib/types';
import {
  type StoryCreateInput,
  type StoryListQuery,
  type StoryUpdateInput,
} from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type GuideRepository } from '../guides/guide.repository';
import { type StoryRepository } from './story.repository';
import { readMinutesFor, toStory, toStoryCard } from './story.mapper';

/**
 * Local stories.
 *
 * Same shape as places: guides author, moderation publishes. Two things are
 * enforced here rather than trusted from the client — the reading time, which
 * is computed from the body, and the linked places, which are filtered down to
 * the ones that actually exist and are published. A story cannot reference a
 * place into existence any more than the AI assistant can.
 */
export class StoryService {
  constructor(
    private readonly repo: StoryRepository,
    private readonly guides: GuideRepository,
  ) {}

  // --- public --------------------------------------------------------------

  async listPublished(query: StoryListQuery): Promise<Paginated<StoryCard>> {
    const { skip, limit } = toSkipLimit(query.page, query.limit);
    const { items, total } = await this.repo.listPublished(query, skip, limit);
    return { items: items.map(toStoryCard), pageInfo: buildPageInfo(query.page, limit, total) };
  }

  async getPublishedBySlug(slug: string, options: { countView: boolean }): Promise<Story> {
    const story = await this.repo.findPublishedBySlug(slug);
    if (!story) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    if (options.countView) await this.repo.incrementView(story._id);
    return toStory(story, await this.resolvePlaces(story.placeIds));
  }

  // --- guide ---------------------------------------------------------------

  async listForGuide(
    userId: string,
    query: { page: number; limit: number; status?: string },
  ): Promise<Paginated<StoryCard>> {
    const guide = await this.requireGuide(userId);
    const { skip, limit } = toSkipLimit(query.page, query.limit);
    const { items, total } = await this.repo.listForGuide(guide._id, query.status, skip, limit);
    return { items: items.map(toStoryCard), pageInfo: buildPageInfo(query.page, limit, total) };
  }

  async getForGuide(userId: string, storyId: string): Promise<Story> {
    const guide = await this.requireGuide(userId);
    const story = await this.repo.findOwned(guide._id, storyId);
    if (!story) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    return toStory(story, await this.resolvePlaces(story.placeIds));
  }

  async createForGuide(userId: string, input: StoryCreateInput): Promise<Story> {
    const guide = await this.requireGuide(userId);
    const placeIds = await this.verifyPlaceIds(input.placeIds);

    const created = await this.repo.create({
      slug: await this.buildSlug(input.title),
      title: input.title,
      summary: input.summary,
      body: input.body,
      kind: input.kind,
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
      placeIds,
      coverImage: input.coverImage,
      city: input.city,
      state: input.state,
      tags: input.tags,
      readMinutes: readMinutesFor(input.body),
      status: 'DRAFT',
    });

    return toStory(created, await this.resolvePlaces(created.placeIds));
  }

  async updateForGuide(userId: string, storyId: string, input: StoryUpdateInput): Promise<Story> {
    const guide = await this.requireGuide(userId);
    const set: Record<string, unknown> = { ...input };

    if (input.placeIds) set.placeIds = await this.verifyPlaceIds(input.placeIds);
    if (input.body) set.readMinutes = readMinutesFor(input.body);

    // An edit to a published story sends it back through review, exactly as a
    // place edit does. Otherwise "publish, then rewrite" is a way around
    // moderation entirely.
    const existing = await this.repo.findOwned(guide._id, storyId);
    if (!existing) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    if (existing.status === 'PUBLISHED') {
      set.status = 'PENDING_REVIEW';
      set.publishedAt = null;
    }

    const updated = await this.repo.updateOwned(guide._id, storyId, { $set: set });
    if (!updated) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    return toStory(updated, await this.resolvePlaces(updated.placeIds));
  }

  /** A guide can submit for review. Only a moderator can publish. */
  async submitForReview(userId: string, storyId: string): Promise<Story> {
    const guide = await this.requireGuide(userId);
    const story = await this.repo.findOwned(guide._id, storyId);
    if (!story) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    if (story.status === 'PUBLISHED') return toStory(story, await this.resolvePlaces(story.placeIds));

    const updated = await this.repo.updateOwned(guide._id, storyId, {
      $set: { status: 'PENDING_REVIEW' },
    });
    if (!updated) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    return toStory(updated, await this.resolvePlaces(updated.placeIds));
  }

  async removeForGuide(userId: string, storyId: string): Promise<void> {
    const guide = await this.requireGuide(userId);
    const removed = await this.repo.softDeleteOwned(guide._id, storyId);
    if (!removed) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
  }

  // --- helpers -------------------------------------------------------------

  private async requireGuide(userId: string) {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return guide;
  }

  /** Drops any id that is not a published place, rather than failing the write. */
  private async verifyPlaceIds(ids: string[]): Promise<Types.ObjectId[]> {
    if (!ids.length) return [];
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const found = await PlaceModel.find({
      _id: { $in: objectIds },
      status: 'PUBLISHED',
      deletedAt: null,
    })
      .select('_id')
      .lean()
      .exec();
    return found.map((place) => place._id as Types.ObjectId);
  }

  private async resolvePlaces(ids: StoryDocument['placeIds']): Promise<PlaceSummary[]> {
    if (!ids?.length) return [];
    const places = await PlaceModel.find({
      _id: { $in: ids },
      status: 'PUBLISHED',
      deletedAt: null,
    })
      .select('_id title slug images address categorySlugs')
      .lean()
      .exec();

    return places.map((place) => {
      const cover = (place.images as Array<{ url?: string }> | undefined)?.[0];
      return {
        placeId: String(place._id),
        title: String(place.title),
        slug: String(place.slug),
        ...(cover?.url ? { coverImageUrl: cover.url } : {}),
        city: String((place.address as { city?: string })?.city ?? ''),
        categorySlugs: (place.categorySlugs as string[]) ?? [],
      };
    });
  }

  private async buildSlug(title: string): Promise<string> {
    const base = slugify(title, 100);
    if (base && !(await this.repo.slugExists(base))) return base;
    return uniqueSlug(title, randomBytes(3).toString('hex'));
  }
}
