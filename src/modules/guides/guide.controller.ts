import { type Request, type Response } from 'express';
import { sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type GuideService } from './guide.service';
import { type GuideDashboardService } from './guide.dashboard.service';
import { type BookingService } from '../bookings/booking.service';
import { type AvailabilityService } from '../availability/availability.service';
import { type ExperienceService } from '../experiences/experience.service';
import { type ReviewService } from '../reviews/review.service';

export class GuideController {
  constructor(
    private readonly guides: GuideService,
    private readonly dashboard: GuideDashboardService,
    private readonly bookings: BookingService,
    private readonly availability: AvailabilityService,
    private readonly experiences: ExperienceService,
    private readonly reviews: ReviewService,
  ) {}

  getPublic = async (req: Request, res: Response): Promise<void> => {
    const { slug } = params<{ slug: string }>(req);
    sendOk(res, { guide: await this.guides.getPublicBySlug(slug) });
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { guide: await this.guides.getMine(principal(req).userId) });
  };

  updateMine = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      guide: await this.guides.updateMine(principal(req).userId, body<Record<string, unknown>>(req)),
    });
  };

  updatePayout = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.guides.updatePayout(principal(req).userId, body<Record<string, string>>(req)));
  };

  earnings = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { earnings: await this.guides.getEarnings(principal(req).userId) });
  };

  dashboardSummary = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { dashboard: await this.dashboard.build(principal(req).userId) });
  };

  analytics = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { analytics: await this.dashboard.analytics(principal(req).userId) });
  };

  listBookings = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.bookings.listForGuide(principal(req).userId, query(req)));
  };

  getBooking = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { booking: await this.bookings.getForGuide(principal(req).userId, id) });
  };

  actOnBooking = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    const input = body<{ action: 'CANCEL' | 'COMPLETE'; reason: string }>(req);
    sendOk(res, {
      booking: await this.bookings.actAsGuide(
        principal(req).userId,
        id,
        input.action,
        input.reason,
      ),
    });
  };

  listReviews = async (req: Request, res: Response): Promise<void> => {
    const { userId } = principal(req);
    const q = query<{ page: number; limit: number }>(req);
    // Only this guide's own experiences are ever looked up.
    const owned = await this.experiences.listForGuide(userId, { page: 1, limit: 100 });
    sendOk(
      res,
      await this.reviews.listForGuideExperiences(
        owned.items.map((experience) => experience.id),
        q.page,
        q.limit,
      ),
    );
  };

  listSlots = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.availability.listForGuide(principal(req).userId, query(req)));
  };

  createSlot = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { slot: await this.availability.createOne(principal(req).userId, body(req)) });
  };

  createSlotsBulk = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.availability.createBulk(principal(req).userId, body(req)));
  };

  updateSlot = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      slot: await this.availability.updateForGuide(principal(req).userId, id, body(req)),
    });
  };

  cancelSlot = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.availability.cancelForGuide(principal(req).userId, id);
    sendOk(res, { cancelled: true });
  };
}
