import { type Request, type Response } from 'express';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { type ContentStatus } from '../../lib/types';
import { sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { toBooking } from '../bookings/booking.mapper';
import { toPayment } from '../payments/payment.mapper';
import { type AuthService } from '../auth/auth.service';
import { type BookingRepository } from '../bookings/booking.repository';
import { type PaymentRepository } from '../payments/payment.repository';
import { type RefundService } from '../payments/refund.service';
import { type RecommendationService } from '../recommendations/recommendation.service';
import { type AdminAnalyticsService } from './admin.analytics.service';
import { type AdminModerationService } from './admin.moderation.service';
import { type AdminUsersService } from './admin.users.service';
import { type AuditService } from './audit.service';

/** Thin orchestration. Every mutating call resolves the actor from the token. */
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly moderation: AdminModerationService,
    private readonly analytics: AdminAnalyticsService,
    private readonly audit: AuditService,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
    private readonly refunds: RefundService,
    private readonly recommendations: RecommendationService,
    private readonly auth: AuthService,
  ) {}

  private async actor(req: Request) {
    const { userId } = principal(req);
    const me = await this.auth.me(userId);
    return { userId, email: me.email };
  }

  dashboard = async (_req: Request, res: Response): Promise<void> => {
    sendOk(res, { dashboard: await this.analytics.dashboard() });
  };

  analyticsTimeseries = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.analytics.timeseries(query(req)));
  };

  aiMonitoring = async (_req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.analytics.aiMonitoring(50));
  };

  systemHealth = async (_req: Request, res: Response): Promise<void> => {
    sendOk(res, { system: await this.analytics.systemHealth() });
  };

  listUsers = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.users.listUsers(query(req)));
  };

  getUser = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { user: await this.users.getUser(params<{ id: string }>(req).id) });
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      user: await this.users.updateUser(
        params<{ id: string }>(req).id,
        body(req),
        await this.actor(req),
      ),
    });
  };

  listGuides = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.users.listGuides(query(req)));
  };

  verifyGuide = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ verified: boolean; note: string }>(req);
    sendOk(res, {
      guide: await this.users.verifyGuide(
        params<{ id: string }>(req).id,
        input.verified,
        input.note,
        await this.actor(req),
      ),
    });
  };

  listPlaces = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.moderation.listPlaces(query(req)));
  };

  moderatePlace = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ status: ContentStatus; reason?: string }>(req);
    sendOk(res, {
      place: await this.moderation.moderatePlace(
        params<{ id: string }>(req).id,
        input.status,
        input.reason ?? '',
        await this.actor(req),
      ),
    });
  };

  listStories = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.moderation.listStories(query(req)));
  };

  moderateStory = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ status: ContentStatus; reason?: string }>(req);
    sendOk(res, {
      story: await this.moderation.moderateStory(
        params<{ id: string }>(req).id,
        input.status,
        input.reason ?? '',
        await this.actor(req),
      ),
    });
  };

  listExperiences = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.moderation.listExperiences(query(req)));
  };

  moderateExperience = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ status: ContentStatus; reason?: string }>(req);
    sendOk(res, {
      experience: await this.moderation.moderateExperience(
        params<{ id: string }>(req).id,
        input.status,
        input.reason ?? '',
        await this.actor(req),
      ),
    });
  };

  listReviews = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.moderation.listReviews(query(req)));
  };

  moderateReview = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED'; note: string }>(req);
    sendOk(res, {
      review: await this.moderation.moderateReview(
        params<{ id: string }>(req).id,
        input.status,
        input.note,
        await this.actor(req),
      ),
    });
  };

  listReports = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.moderation.listReports(query(req)));
  };

  resolveReport = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ status: string; resolutionNote: string }>(req);
    sendOk(res, {
      report: await this.moderation.resolveReport(
        params<{ id: string }>(req).id,
        input.status,
        input.resolutionNote,
        await this.actor(req),
      ),
    });
  };

  listBookings = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: string }>(req);
    const { skip, limit } = toSkipLimit(q.page, q.limit);
    const { items, total } = await this.bookings.adminList(
      q.status ? { status: q.status } : {},
      skip,
      limit,
    );
    sendOk(res, {
      items: items.map((i) => toBooking(i as never)),
      pageInfo: buildPageInfo(q.page, q.limit, total),
    });
  };

  listPayments = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: string }>(req);
    const { skip, limit } = toSkipLimit(q.page, q.limit);
    const { items, total } = await this.payments.adminList(
      q.status ? { status: q.status } : {},
      skip,
      limit,
    );
    sendOk(res, {
      items: items.map((i) => toPayment(i as never)),
      pageInfo: buildPageInfo(q.page, q.limit, total),
    });
  };

  refund = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ bookingId: string; amountMinor?: number; reason: string }>(req);
    const actor = principal(req);
    const payment = await this.refunds.refund(input.bookingId, input.amountMinor, input.reason, {
      userId: actor.userId,
      role: actor.role as 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR',
    });
    const me = await this.actor(req);
    await this.audit.record({
      actorId: me.userId,
      actorEmail: me.email,
      action: 'payment.refund',
      targetType: 'Booking',
      targetId: input.bookingId,
      after: { amountMinor: input.amountMinor ?? null, reason: input.reason },
    });
    sendOk(res, { payment });
  };

  listAudit = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.audit.list(query(req)));
  };

  getRecommendationConfig = async (_req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      active: await this.recommendations.getActive(),
      history: await this.recommendations.list(),
    });
  };

  updateRecommendationConfig = async (req: Request, res: Response): Promise<void> => {
    const actor = await this.actor(req);
    const before = await this.recommendations.getActive();
    const updated = await this.recommendations.update(body(req), actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'recommendation-config.update',
      targetType: 'RecommendationConfig',
      targetId: updated.id,
      before: { weights: before.weights, params: before.params },
      after: { weights: updated.weights, params: updated.params },
    });
    sendOk(res, { config: updated });
  };
}
