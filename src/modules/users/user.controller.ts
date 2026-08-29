import { type Request, type Response } from 'express';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type UserService } from './user.service';

export class UserController {
  constructor(private readonly users: UserService) {}

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      user: await this.users.updateProfile(principal(req).userId, body<Record<string, unknown>>(req)),
    });
  };

  updatePreferences = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      user: await this.users.updatePreferences(
        principal(req).userId,
        body<Record<string, unknown>>(req),
      ),
    });
  };

  savePlace = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ placeId: string; collectionId: string | null }>(req);
    sendCreated(res, {
      saved: await this.users.savePlace(principal(req).userId, input.placeId, input.collectionId),
    });
  };

  unsavePlace = async (req: Request, res: Response): Promise<void> => {
    await this.users.unsavePlace(principal(req).userId, params<{ id: string }>(req).id);
    sendNoContent(res);
  };

  listSaved = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; collectionId?: string }>(req);
    sendOk(
      res,
      await this.users.listSaved(
        principal(req).userId,
        q.collectionId ?? null,
        q.page,
        q.limit,
      ),
    );
  };

  createCollection = async (req: Request, res: Response): Promise<void> => {
    sendCreated(res, {
      collection: await this.users.createCollection(
        principal(req).userId,
        body<Record<string, unknown>>(req),
      ),
    });
  };

  listCollections = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { collections: await this.users.listCollections(principal(req).userId) });
  };

  updateCollection = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      collection: await this.users.updateCollection(
        principal(req).userId,
        params<{ id: string }>(req).id,
        body<Record<string, unknown>>(req),
      ),
    });
  };

  deleteCollection = async (req: Request, res: Response): Promise<void> => {
    await this.users.deleteCollection(principal(req).userId, params<{ id: string }>(req).id);
    sendNoContent(res);
  };
}
