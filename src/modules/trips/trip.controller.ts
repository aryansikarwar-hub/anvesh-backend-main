import { type Request, type Response } from 'express';
import { type TripActivityInput, type TripCreateInput } from '../../lib/validation';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type TripService } from './trip.service';

export class TripController {
  constructor(private readonly trips: TripService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      trip: await this.trips.create(principal(req).userId, body<TripCreateInput>(req)),
    });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; destinationId?: string }>(req);
    sendOk(res, await this.trips.list(principal(req).userId, q));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { trip: await this.trips.get(principal(req).userId, id) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, {
      trip: await this.trips.update(principal(req).userId, id, body<Partial<TripCreateInput>>(req)),
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    await this.trips.remove(principal(req).userId, id);
    sendNoContent(res);
  };

  addDay = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendCreated(res, {
      trip: await this.trips.addDay(
        principal(req).userId,
        id,
        body<{ title: string; date: string | null }>(req),
      ),
    });
  };

  updateDay = async (req: Request, res: Response): Promise<void> => {
    const { id, dayId } = params<{ id: string; dayId: string }>(req);
    sendOk(res, {
      trip: await this.trips.updateDay(
        principal(req).userId,
        id,
        dayId,
        body<{ title?: string; date?: string | null }>(req),
      ),
    });
  };

  removeDay = async (req: Request, res: Response): Promise<void> => {
    const { id, dayId } = params<{ id: string; dayId: string }>(req);
    sendOk(res, { trip: await this.trips.removeDay(principal(req).userId, id, dayId) });
  };

  addActivity = async (req: Request, res: Response): Promise<void> => {
    const { id, dayId } = params<{ id: string; dayId: string }>(req);
    sendCreated(res, {
      trip: await this.trips.addActivity(
        principal(req).userId,
        id,
        dayId,
        body<TripActivityInput>(req),
      ),
    });
  };

  removeActivity = async (req: Request, res: Response): Promise<void> => {
    const { id, dayId, activityId } = params<{ id: string; dayId: string; activityId: string }>(req);
    sendOk(res, {
      trip: await this.trips.removeActivity(principal(req).userId, id, dayId, activityId),
    });
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    const { id, dayId } = params<{ id: string; dayId: string }>(req);
    const { activityIds } = body<{ activityIds: string[] }>(req);
    sendOk(res, {
      trip: await this.trips.reorderActivities(principal(req).userId, id, dayId, activityIds),
    });
  };
}
