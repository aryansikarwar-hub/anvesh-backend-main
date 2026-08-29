import { type Request, type Response } from 'express';
import { type ExperienceCreateInput } from '../../lib/validation';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type ExperienceService } from './experience.service';
import { type AvailabilityService } from '../availability/availability.service';

export class ExperienceController {
  constructor(
    private readonly experiences: ExperienceService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = params<{ slug: string }>(req);
    sendOk(res, { experience: await this.experiences.getPublishedBySlug(slug) });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; guideSlug?: string; placeId?: string }>(req);
    sendOk(res, await this.experiences.listPublished(q));
  };

  listAvailability = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    const q = query<{ from?: string; to?: string }>(req);
    sendOk(res, { slots: await this.availabilityService.listPublic(id, q.from, q.to) });
  };

  // --- guide-scoped ---------------------------------------------------------

  listMine = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: string }>(req);
    sendOk(res, await this.experiences.listForGuide(principal(req).userId, q));
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { experience: await this.experiences.getOwned(principal(req).userId, id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      experience: await this.experiences.createForGuide(
        principal(req).userId,
        body<ExperienceCreateInput>(req),
      ),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      experience: await this.experiences.updateForGuide(
        principal(req).userId,
        id,
        body<Partial<ExperienceCreateInput>>(req),
      ),
    });
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { experience: await this.experiences.submitForReview(principal(req).userId, id) });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.experiences.deleteForGuide(principal(req).userId, id);
    sendNoContent(res);
  };
}
