import { createHmac, timingSafeEqual } from 'node:crypto';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
}

export interface RazorpayRefund {
  id: string;
  amount: number;
  status: string;
}

const BASE_URL = 'https://api.razorpay.com/v1';

/**
 * Real Razorpay REST client.
 *
 * Signature verification is pure crypto and therefore works — and is tested —
 * without any network access or API key. When the keys are absent the client
 * reports PAYMENT_PROVIDER_NOT_CONFIGURED; it never fabricates an order or a
 * successful capture.
 */
export class RazorpayClient {
  readonly configured: boolean;

  constructor(
    private readonly keyId: string | undefined,
    private readonly keySecret: string | undefined,
    private readonly webhookSecret: string | undefined,
  ) {
    this.configured = Boolean(keyId && keySecret);
  }

  get publishableKeyId(): string {
    if (!this.keyId) throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED);
    return this.keyId;
  }

  private authHeader(): string {
    if (!this.keyId || !this.keySecret) {
      throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED, {
        message:
          'Razorpay keys are not configured on this deployment, so payments cannot be taken.',
      });
    }
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { authorization: this.authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        payment_capture: 1,
        notes: input.notes,
      }),
    });
    if (!response.ok) await this.throwProviderError(response);
    return (await response.json()) as RazorpayOrder;
  }

  async fetchPayment(paymentId: string): Promise<{ id: string; status: string; amount: number }> {
    const response = await fetch(`${BASE_URL}/payments/${paymentId}`, {
      headers: { authorization: this.authHeader() },
    });
    if (!response.ok) await this.throwProviderError(response);
    return (await response.json()) as { id: string; status: string; amount: number };
  }

  async createRefund(paymentId: string, amountMinor: number, notes: Record<string, string>) {
    const response = await fetch(`${BASE_URL}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { authorization: this.authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ amount: amountMinor, speed: 'normal', notes }),
    });
    if (!response.ok) await this.throwProviderError(response);
    return (await response.json()) as RazorpayRefund;
  }

  /**
   * Checkout callback signature: HMAC-SHA256 of "orderId|paymentId" keyed with
   * the API secret. Compared in constant time.
   */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED);
    const expected = createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqual(expected, signature);
  }

  /** Webhook signature: HMAC-SHA256 over the exact raw request body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED);
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  private async throwProviderError(response: Response): Promise<never> {
    const detail = await response.text().catch(() => '');
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      message: 'The payment provider rejected the request.',
      details: { status: response.status, detail: detail.slice(0, 300) },
    });
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
