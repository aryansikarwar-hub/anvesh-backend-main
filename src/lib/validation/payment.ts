import { z } from 'zod';
import { minorAmountSchema, objectIdSchema } from './common';

export const createOrderSchema = z.strictObject({
  bookingId: objectIdSchema,
});

/**
 * Exactly what Razorpay Checkout hands back to the browser. The server
 * re-computes the HMAC before anything is marked paid — the client's word is
 * never enough.
 */
export const verifyPaymentSchema = z.strictObject({
  bookingId: objectIdSchema,
  razorpayOrderId: z.string().min(6).max(80),
  razorpayPaymentId: z.string().min(6).max(80),
  razorpaySignature: z.string().min(20).max(256),
});

export const refundCreateSchema = z.strictObject({
  bookingId: objectIdSchema,
  amountMinor: minorAmountSchema.optional(),
  reason: z.string().trim().min(3).max(300),
});

/** Razorpay webhook envelope. Only the fields the handler actually reads. */
export const razorpayWebhookSchema = z.object({
  event: z.string().min(1).max(120),
  created_at: z.number().int().optional(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string().nullable().optional(),
          amount: z.number().int(),
          currency: z.string(),
          status: z.string(),
          error_description: z.string().nullable().optional(),
        }),
      })
      .optional(),
    refund: z
      .object({
        entity: z.object({
          id: z.string(),
          payment_id: z.string(),
          amount: z.number().int(),
          status: z.string(),
        }),
      })
      .optional(),
  }),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type RazorpayWebhook = z.infer<typeof razorpayWebhookSchema>;
