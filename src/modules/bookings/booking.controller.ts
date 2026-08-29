import { randomUUID } from 'node:crypto';
import { type Request, type Response } from 'express';
import { IDEMPOTENCY_HEADER, type BookingStatus } from '../../lib/types';
import { type BookingCreateInput } from '../../lib/validation';
import { sendCreated, sendOk } from '../../common/envelope';
import { body, params, query } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type BookingService } from './booking.service';

export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? randomUUID();
    const booking = await this.bookings.create(body<BookingCreateInput>(req), {
      userId: principal(req).userId,
      idempotencyKey,
    });
    sendCreated(res, { booking });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const q = query<{ page: number; limit: number; status?: BookingStatus }>(req);
    sendOk(res, await this.bookings.listForUser(principal(req).userId, q));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { booking: await this.bookings.getForUser(principal(req).userId, id) });
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    const { reason } = body<{ reason: string }>(req);
    sendOk(res, { booking: await this.bookings.cancelByUser(principal(req).userId, id, reason) });
  };
}
