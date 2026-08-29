import { Types } from 'mongoose';
import { ContentReportModel, GuideProfileModel } from '../../lib/database';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type ContentStatus } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { toPlace } from '../places/place.mapper';
import { toExperience } from '../experiences/experience.mapper';
import { toReview } from '../reviews/review.service';
import { type PlaceRepository } from '../places/place.repository';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type ReviewRepository } from '../reviews/review.repository';
import { type StoryRepository } from '../stories/story.repository';
import { toStoryCard } from '../stories/story.mapper';
import { type NotificationService } from '../notifications/notification.service';
import { type AdminActor } from './admin.users.service';
import { type AuditService } from './audit.service';

/** Only these transitions are allowed from the moderation queue. */
const ALLOWED: Record<string, ContentStatus[]> = {
  DRAFT: ['ARCHIVED'],
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['ARCHIVED', 'REJECTED'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  ARCHIVED: ['PENDING_REVIEW'],
};

export class AdminModerationService {
  constructor(
    private readonly places: PlaceRepository,
    private readonly experiences: ExperienceRepository,
    private readonly reviews: ReviewRepository,
    private readonly stories: StoryRepository,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async listPlaces(options: { page: number; limit: number; status?: string }) {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const filter = options.status ? { status: options.status } : {};
    const { items, total } = await this.places.adminList(filter, skip, limit);
    return {
      items: items.map((i) => toPlace(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async moderatePlace(
    placeId: string,
    status: ContentStatus,
    reason: string,
    actor: AdminActor,
  ) {
    const place = await this.places.findAnyById(placeId);
    if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    assertModerationTransition(place.status, status);

    const updated = await this.places.adminUpdate(placeId, {
      $set: {
        status,
        'moderation.reviewedBy': new Types.ObjectId(actor.userId),
        'moderation.reviewedAt': new Date(),
        'moderation.reason': reason,
        ...(status === 'PUBLISHED' ? { 'signals.lastVerifiedAt': new Date() } : {}),
      },
    });

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: `place.${status.toLowerCase()}`,
      targetType: 'Place',
      targetId: placeId,
      before: { status: place.status },
      after: { status, reason },
    });

    const guideUserId = await this.guideUserId(place.guideSummary);
    if (guideUserId && (status === 'PUBLISHED' || status === 'REJECTED')) {
      await this.notifications.create({
        userId: guideUserId,
        type: status === 'PUBLISHED' ? 'PLACE_APPROVED' : 'PLACE_REJECTED',
        title: status === 'PUBLISHED' ? `${place.title} is live` : `${place.title} needs changes`,
        body: reason || (status === 'PUBLISHED' ? 'Travellers can find it now.' : 'See the moderator note.'),
        href: `/places/${place.slug}`,
      });
    }

    return toPlace(updated as never);
  }

  async listStories(options: { page: number; limit: number; status?: string }) {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.stories.listAny(options.status, skip, limit);
    return {
      items: items.map(toStoryCard),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  /**
   * Publishing a story is the same gate as publishing a place: a guide can
   * only submit, and `publishedAt` is stamped here, by the moderator's action.
   */
  async moderateStory(storyId: string, status: ContentStatus, reason: string, actor: AdminActor) {
    const story = await this.stories.findAnyById(storyId);
    if (!story) throw new AppError(ERROR_CODES.STORY_NOT_FOUND);
    assertModerationTransition(story.status, status);

    const updated = await this.stories.adminUpdate(storyId, {
      $set: {
        status,
        moderationNote: reason,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: `story.${status.toLowerCase()}`,
      targetType: 'Story',
      targetId: storyId,
      before: { status: story.status },
      after: { status, reason },
    });

    const guideUserId = await this.guideUserId(story.guideSummary);
    if (guideUserId && (status === 'PUBLISHED' || status === 'REJECTED')) {
      await this.notifications.create({
        userId: guideUserId,
        type: status === 'PUBLISHED' ? 'PLACE_APPROVED' : 'PLACE_REJECTED',
        title:
          status === 'PUBLISHED' ? `${story.title} is live` : `${story.title} needs changes`,
        body:
          reason ||
          (status === 'PUBLISHED' ? 'Travellers can read it now.' : 'See the moderator note.'),
        href: `/stories/${story.slug}`,
      });
    }

    return toStoryCard(updated!);
  }

  async listExperiences(options: { page: number; limit: number; status?: string }) {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const filter = options.status ? { status: options.status } : {};
    const { items, total } = await this.experiences.adminList(filter, skip, limit);
    return {
      items: items.map((i) => toExperience(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async moderateExperience(
    id: string,
    status: ContentStatus,
    reason: string,
    actor: AdminActor,
  ) {
    const experience = await this.experiences.findAnyById(id);
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    assertModerationTransition(experience.status, status);

    const updated = await this.experiences.adminUpdate(id, {
      $set: {
        status,
        'moderation.reviewedBy': new Types.ObjectId(actor.userId),
        'moderation.reviewedAt': new Date(),
        'moderation.reason': reason,
      },
    });

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: `experience.${status.toLowerCase()}`,
      targetType: 'Experience',
      targetId: id,
      before: { status: experience.status },
      after: { status, reason },
    });

    return toExperience(updated as never);
  }

  async listReviews(options: { page: number; limit: number; status?: string; reportedOnly?: boolean }) {
    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.reportedOnly) filter.reportCount = { $gt: 0 };
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.reviews.adminList(filter, skip, limit);
    return {
      items: items.map((i) => toReview(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async moderateReview(
    reviewId: string,
    status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED',
    note: string,
    actor: AdminActor,
  ) {
    const review = await this.reviews.findAnyById(reviewId);
    if (!review) throw new AppError(ERROR_CODES.REVIEW_NOT_FOUND);
    const updated = await this.reviews.adminUpdate(reviewId, {
      $set: { status, moderationNote: note },
    });
    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: `review.${status.toLowerCase()}`,
      targetType: 'Review',
      targetId: reviewId,
      before: { status: review.status },
      after: { status, note },
    });
    return toReview(updated as never);
  }

  async listReports(options: { page: number; limit: number; status?: string }) {
    const filter = options.status ? { status: options.status } : {};
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const [items, total] = await Promise.all([
      ContentReportModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      ContentReportModel.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map((item) => ({
        id: String(item._id),
        targetType: item.targetType,
        targetId: String(item.targetId),
        reporterId: String(item.reporterId),
        reason: item.reason,
        details: item.details,
        status: item.status,
        resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
        resolutionNote: item.resolutionNote,
        createdAt: item.createdAt.toISOString(),
      })),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async resolveReport(
    reportId: string,
    status: string,
    resolutionNote: string,
    actor: AdminActor,
  ) {
    const report = await ContentReportModel.findById(reportId).exec();
    if (!report) throw new AppError(ERROR_CODES.REPORT_NOT_FOUND);
    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      throw new AppError(ERROR_CODES.REPORT_ALREADY_RESOLVED);
    }
    report.set('status', status);
    report.set('resolutionNote', resolutionNote);
    report.set('resolvedBy', new Types.ObjectId(actor.userId));
    await report.save();

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'report.resolve',
      targetType: 'ContentReport',
      targetId: reportId,
      after: { status, resolutionNote },
    });
    return { id: reportId, status };
  }

  private async guideUserId(guideSummary: Record<string, unknown> | null): Promise<string | null> {
    if (!guideSummary?.guideId) return null;
    const guide = await GuideProfileModel.findById(String(guideSummary.guideId))
      .select('userId')
      .lean()
      .exec();
    return guide ? String(guide.userId) : null;
  }
}

export function assertModerationTransition(from: string, to: ContentStatus): void {
  if (!(ALLOWED[from] ?? []).includes(to)) {
    throw new AppError(ERROR_CODES.MODERATION_INVALID_TRANSITION, {
      details: { from, to, allowed: ALLOWED[from] ?? [] },
    });
  }
}
