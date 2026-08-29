import { type Request, type Response } from 'express';
import { type ReviewCreateInput } from '../../lib/validation';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type ReviewService } from './review.service';

export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const q = query<{
      targetType: 'PLACE' | 'EXPERIENCE';
      targetId: string;
      sort: string;
      page: number;
      limit: number;
      rating?: number;
    }>(req);
    sendOk(res, await this.reviews.listForTarget(q));
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number }>(req);
    sendOk(res, await this.reviews.listMine(principal(req).userId, q.page, q.limit));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      review: await this.reviews.create(principal(req).userId, body<ReviewCreateInput>(req)),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      review: await this.reviews.update(
        principal(req).userId,
        id,
        body<Record<string, unknown>>(req),
      ),
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.reviews.remove(principal(req).userId, id);
    sendNoContent(res);
  };

  report = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    const input = body<{ reason: string; details: string }>(req);
    await this.reviews.report(principal(req).userId, id, input.reason, input.details);
    sendOk(res, { reported: true });
  };
}
