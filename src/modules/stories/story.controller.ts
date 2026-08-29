import { type Request, type Response } from 'express';
import { type StoryCreateInput, type StoryListQuery, type StoryUpdateInput } from '../../lib/validation';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type StoryService } from './story.service';

export class StoryController {
  constructor(private readonly stories: StoryService) {}

  // --- public ---------------------------------------------------------------

  list = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.stories.listPublished(query<StoryListQuery>(req)));
  };

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = params<{ slug: string }>(req);
    sendOk(res, { story: await this.stories.getPublishedBySlug(slug, { countView: true }) });
  };

  // --- guide-scoped ---------------------------------------------------------

  listMine = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: string }>(req);
    sendOk(res, await this.stories.listForGuide(principal(req).userId, q));
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { story: await this.stories.getForGuide(principal(req).userId, id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      story: await this.stories.createForGuide(principal(req).userId, body<StoryCreateInput>(req)),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      story: await this.stories.updateForGuide(
        principal(req).userId,
        id,
        body<StoryUpdateInput>(req),
      ),
    });
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { story: await this.stories.submitForReview(principal(req).userId, id) });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.stories.removeForGuide(principal(req).userId, id);
    sendNoContent(res);
  };
}
