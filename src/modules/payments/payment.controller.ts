import { type Request, type Response } from 'express';
import { type VerifyPaymentInput } from '../../lib/validation';
import { sendCreated, sendOk } from '../../common/envelope';
import { body, params } from '../../common/middleware/validate';
import { principal } from '../../common/middleware/auth';
import { type PaymentService } from './payment.service';
import { type WebhookService } from './webhook.service';

export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly webhooks: WebhookService,
  ) {}

  createOrder = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = body<{ bookingId: string }>(req);
    sendCreated(res, {
      checkout: await this.payments.createOrder(principal(req).userId, bookingId),
    });
  };

  verify = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, {
      payment: await this.payments.verify(principal(req).userId, body<VerifyPaymentInput>(req)),
    });
  };

  getByBooking = async (req: Request, res: Response): Promise<void> => {
    const { id } = params<{ id: string }>(req);
    sendOk(res, { payment: await this.payments.getByBooking(principal(req).userId, id) });
  };

  /** Unauthenticated but signature-verified. */
  webhook = async (req: Request, res: Response): Promise<void> => {
    const signature = req.header('x-razorpay-signature');
    const eventId = req.header('x-razorpay-event-id') ?? `evt_${Date.now()}`;
    const result = await this.webhooks.handle(req.rawBody, signature, eventId);
    sendOk(res, result);
  };
}
