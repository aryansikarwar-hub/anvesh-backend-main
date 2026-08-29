import { type Request, type Response } from 'express';
import { type MapQuery, type NearbyQuery, type SearchQuery } from '../../lib/validation';
import { sendOk } from '../../common/envelope';
import { query } from '../../common/middleware/validate';
import { type DiscoveryService } from './discovery.service';

export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  private actor(req: Request) {
    return { userId: req.auth?.userId ?? null };
  }

  search = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.discovery.search(query<SearchQuery>(req), this.actor(req)));
  };

  nearby = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { items: await this.discovery.nearby(query<NearbyQuery>(req), this.actor(req)) });
  };

  map = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, { items: await this.discovery.map(query<MapQuery>(req), this.actor(req)) });
  };

  feed = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ limit: number; lng?: number; lat?: number }>(req);
    sendOk(res, { items: await this.discovery.feed(q, this.actor(req)) });
  };

  hiddenGems = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ limit: number; state?: string }>(req);
    sendOk(res, { items: await this.discovery.hiddenGems(q, this.actor(req)) });
  };
}
