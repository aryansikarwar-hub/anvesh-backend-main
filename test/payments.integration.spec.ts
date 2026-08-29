import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { BookingModel, PaymentModel } from '../src/lib/database';
import { IDEMPOTENCY_HEADER } from '../src/lib/types';
import {
  accessToken,
  bearer,
  createUser,
  resetDatabase,
  startHarness,
  stopHarness,
  type Harness,
  type TestUser,
} from './harness';
import { createExperience, createSlot } from './fixtures';

const KEY_SECRET = 'test_key_secret_value';
const WEBHOOK_SECRET = 'test_webhook_secret_value';

/**
 * Payments.
 *
 * The harness deliberately supplies the two secrets needed for signature
 * verification but no RAZORPAY_KEY_ID, so `configured` is false. That means
 * order creation must refuse rather than invent an order, while the HMAC paths
 * — which are pure crypto and need no network — are exercised for real.
 */
describe('payments', () => {
  let harness: Harness;
  let traveller: TestUser;
  let guide: TestUser;
  let bookingId: string;
  let totalMinor: number;

  beforeAll(async () => {
    harness = await startHarness({
      RAZORPAY_KEY_SECRET: KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    });
  });

  afterAll(async () => {
    await stopHarness();
  });

  beforeEach(async () => {
    await resetDatabase();
    traveller = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    guide = await createUser({
      role: 'TOURIST_GUIDE',
      portals: ['TRAVELLER', 'TOURIST_GUIDE'],
      withGuideProfile: true,
    });

    const experience = await createExperience({ guideId: guide.guideId as string });
    const slot = await createSlot({
      experienceId: String(experience._id),
      guideId: guide.guideId as string,
      seatsTotal: 6,
    });

    const created = await request(harness.app)
      .post('/api/v1/bookings')
      .set(...bearer(accessToken(harness, traveller, 'TRAVELLER')))
      .set(IDEMPOTENCY_HEADER, `payments-${String(slot._id)}`)
      .send({ slotId: String(slot._id), seats: 2 });

    expect(created.status).toBe(201);
    bookingId = created.body.data.booking.id as string;
    totalMinor = created.body.data.booking.totalMinor as number;
  });

  function travellerAuth() {
    return bearer(accessToken(harness, traveller, 'TRAVELLER'));
  }

  it('refuses to create an order when the provider is not configured', async () => {
    const res = await request(harness.app)
      .post('/api/v1/payments/order')
      .set(...travellerAuth())
      .send({ bookingId });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_NOT_CONFIGURED');
    // Crucially, nothing was written that would suggest a payment had started.
    expect(await PaymentModel.countDocuments({ bookingId })).toBe(0);
  });

  it('does not let another traveller create an order for someone else’s booking', async () => {
    const other = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const res = await request(harness.app)
      .post('/api/v1/payments/order')
      .set(...bearer(accessToken(harness, other, 'TRAVELLER')))
      .send({ bookingId });

    // Ownership is checked before anything else, so this is a 404, not a 503.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  describe('checkout verification', () => {
    const orderId = 'order_TESTORDER123';
    const paymentId = 'pay_TESTPAYMENT123';

    beforeEach(async () => {
      await PaymentModel.create({
        bookingId: new Types.ObjectId(bookingId),
        userId: new Types.ObjectId(traveller.id),
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        amountMinor: totalMinor,
        currency: 'INR',
        status: 'CREATED',
      });
    });

    it('rejects a forged signature and never confirms the booking', async () => {
      const res = await request(harness.app)
        .post('/api/v1/payments/verify')
        .set(...travellerAuth())
        .send({
          bookingId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: 'f'.repeat(64),
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');

      const payment = await PaymentModel.findOne({ providerOrderId: orderId }).lean();
      expect(payment?.status).toBe('FAILED');

      const booking = await BookingModel.findById(bookingId).lean();
      expect(booking?.status).toBe('PENDING_PAYMENT');
    });

    it('does not accept a valid signature belonging to a different order', async () => {
      // Correctly signed, but for an order this booking does not own.
      const foreign = createHmac('sha256', KEY_SECRET)
        .update(`order_SOMEONEELSE|${paymentId}`)
        .digest('hex');

      const res = await request(harness.app)
        .post('/api/v1/payments/verify')
        .set(...travellerAuth())
        .send({
          bookingId,
          razorpayOrderId: 'order_SOMEONEELSE',
          razorpayPaymentId: paymentId,
          razorpaySignature: foreign,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PAYMENT_NOT_FOUND');

      const booking = await BookingModel.findById(bookingId).lean();
      expect(booking?.status).toBe('PENDING_PAYMENT');
    });

    it('does not let a traveller verify another traveller’s payment', async () => {
      const other = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
      const signature = createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(harness.app)
        .post('/api/v1/payments/verify')
        .set(...bearer(accessToken(harness, other, 'TRAVELLER')))
        .send({
          bookingId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('webhook', () => {
    function sign(payload: unknown): { body: string; signature: string } {
      const body = JSON.stringify(payload);
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
      return { body, signature };
    }

    const capturedEvent = (orderId: string, amount: number) => ({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_WEBHOOK1',
            order_id: orderId,
            amount,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    });

    it('rejects a webhook with no signature header', async () => {
      const { body } = sign(capturedEvent('order_X', totalMinor));
      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .send(body);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a webhook whose signature does not match the raw body', async () => {
      const { body } = sign(capturedEvent('order_X', totalMinor));
      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', 'a'.repeat(64))
        .send(body);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a body that was tampered with after signing', async () => {
      const { signature } = sign(capturedEvent('order_X', totalMinor));
      const tampered = JSON.stringify(capturedEvent('order_X', totalMinor * 2));

      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', signature)
        .send(tampered);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    });

    it('confirms a booking the browser never came back to confirm', async () => {
      const orderId = 'order_WEBHOOKOK';
      await PaymentModel.create({
        bookingId: new Types.ObjectId(bookingId),
        userId: new Types.ObjectId(traveller.id),
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        amountMinor: totalMinor,
        currency: 'INR',
        status: 'CREATED',
      });

      const { body, signature } = sign(capturedEvent(orderId, totalMinor));
      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_first')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.data.handled).toBe(true);

      const booking = await BookingModel.findById(bookingId).lean();
      expect(booking?.status).toBe('CONFIRMED');
      const payment = await PaymentModel.findOne({ providerOrderId: orderId }).lean();
      expect(payment?.status).toBe('CAPTURED');
    });

    it('treats a redelivered webhook as a no-op', async () => {
      const orderId = 'order_WEBHOOKDUP';
      await PaymentModel.create({
        bookingId: new Types.ObjectId(bookingId),
        userId: new Types.ObjectId(traveller.id),
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        amountMinor: totalMinor,
        currency: 'INR',
        status: 'CREATED',
      });

      const { body, signature } = sign(capturedEvent(orderId, totalMinor));
      const send = () =>
        request(harness.app)
          .post('/api/v1/payments/webhook')
          .set('content-type', 'application/json')
          .set('x-razorpay-signature', signature)
          .set('x-razorpay-event-id', 'evt_same')
          .send(body);

      await send();
      const second = await send();

      expect(second.status).toBe(200);
      expect(second.body.data.reason).toBe('duplicate delivery');

      const payments = await PaymentModel.find({ providerOrderId: orderId }).lean();
      expect(payments).toHaveLength(1);
      expect(payments[0]?.status).toBe('CAPTURED');
    });

    it('refuses to confirm when the webhook amount disagrees with the booking', async () => {
      const orderId = 'order_WEBHOOKAMT';
      await PaymentModel.create({
        bookingId: new Types.ObjectId(bookingId),
        userId: new Types.ObjectId(traveller.id),
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        amountMinor: totalMinor,
        currency: 'INR',
        status: 'CREATED',
      });

      const { body, signature } = sign(capturedEvent(orderId, totalMinor - 100));
      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_amount')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.data.handled).toBe(false);
      expect(res.body.data.reason).toBe('amount mismatch');

      const booking = await BookingModel.findById(bookingId).lean();
      expect(booking?.status).toBe('PENDING_PAYMENT');
    });

    it('ignores an event it does not handle', async () => {
      const payload = { event: 'payment.authorized', payload: {} };
      const { body, signature } = sign(payload);

      const res = await request(harness.app)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_unhandled')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.data.handled).toBe(false);
    });
  });
});
