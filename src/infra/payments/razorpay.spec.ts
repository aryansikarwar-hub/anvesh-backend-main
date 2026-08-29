import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RazorpayClient, safeEqual } from './razorpay.client';
import { AppError } from '../../common/api-error';

// Deliberately not shaped like a real Razorpay key id, so the secret scanner
// in scripts/check-secrets.mjs stays a signal rather than a known false alarm.
const KEY_ID = 'test-key-id';
const KEY_SECRET = 'example_secret_value';
const WEBHOOK_SECRET = 'example_webhook_secret';

const client = new RazorpayClient(KEY_ID, KEY_SECRET, WEBHOOK_SECRET);

describe('Razorpay signature verification', () => {
  it('accepts a correctly computed checkout signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(client.verifyCheckoutSignature(orderId, paymentId, signature)).toBe(true);
  });

  it('rejects a signature computed over different values', () => {
    const signature = createHmac('sha256', KEY_SECRET)
      .update('order_ABC123|pay_OTHER')
      .digest('hex');
    expect(client.verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', signature)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const signature = createHmac('sha256', 'attacker_secret')
      .update('order_ABC123|pay_XYZ789')
      .digest('hex');
    expect(client.verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', signature)).toBe(false);
  });

  it('rejects an empty or truncated signature', () => {
    expect(client.verifyCheckoutSignature('order_A', 'pay_B', '')).toBe(false);
    expect(client.verifyCheckoutSignature('order_A', 'pay_B', 'deadbeef')).toBe(false);
  });

  it('verifies a webhook over the exact raw bytes', () => {
    const raw = Buffer.from('{"event":"payment.captured","payload":{}}', 'utf8');
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
    expect(client.verifyWebhookSignature(raw, signature)).toBe(true);
    // A single byte of difference must fail.
    const tampered = Buffer.from('{"event":"payment.captured","payload":{} }', 'utf8');
    expect(client.verifyWebhookSignature(tampered, signature)).toBe(false);
  });
});

describe('unconfigured provider', () => {
  const unconfigured = new RazorpayClient(undefined, undefined, undefined);

  it('reports itself as not configured rather than pretending', () => {
    expect(unconfigured.configured).toBe(false);
  });

  it('throws PAYMENT_PROVIDER_NOT_CONFIGURED instead of faking success', async () => {
    await expect(
      unconfigured.createOrder({ amountMinor: 100, currency: 'INR', receipt: 'r', notes: {} }),
    ).rejects.toBeInstanceOf(AppError);
    expect(() => unconfigured.publishableKeyId).toThrow(AppError);
    expect(() => unconfigured.verifyCheckoutSignature('a', 'b', 'c')).toThrow(AppError);
  });
});

describe('safeEqual', () => {
  it('is length-safe and value-correct', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});
