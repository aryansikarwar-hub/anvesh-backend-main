import { type Request, type Response } from 'express';
import { type PlaceCreateInput, type PlaceUpdateInput } from '../../lib/validation';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type PlaceService } from './place.service';

export class PlaceController {
  constructor(private readonly places: PlaceService) {}

  /** Public detail read. */
  getBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = params<{ slug: string }>(req);
    sendOk(res, { place: await this.places.getPublishedBySlug(slug, { countView: true }) });
  };

  // --- guide-scoped ---------------------------------------------------------

  listMine = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: string }>(req);
    sendOk(res, await this.places.listForGuide(principal(req).userId, q));
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { place: await this.places.getOwned(principal(req).userId, id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      place: await this.places.createForGuide(principal(req).userId, body<PlaceCreateInput>(req)),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      place: await this.places.updateForGuide(
        principal(req).userId,
        id,
        body<PlaceUpdateInput>(req),
      ),
    });
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { place: await this.places.submitForReview(principal(req).userId, id) });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.places.deleteForGuide(principal(req).userId, id);
    sendNoContent(res);
  };
}
