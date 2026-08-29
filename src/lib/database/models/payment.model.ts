import { model, type Model, type Types } from 'mongoose';
import { PAYMENT_STATUSES } from '../../types';
import { createSchema, minorAmount } from '../plugins/base';

export interface PaymentDocument {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: 'RAZORPAY';
  providerOrderId: string;
  providerPaymentId: string | null;
  providerSignature: string | null;
  amountMinor: number;
  capturedMinor: number;
  refundedMinor: number;
  currency: string;
  status: (typeof PAYMENT_STATUSES)[number];
  failureReason: string | null;
  refunds: {
    providerRefundId: string;
    amountMinor: number;
    status: string;
    reason: string;
    at: Date;
  }[];
  webhookEvents: { eventId: string; type: string; at: Date }[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = createSchema<PaymentDocument>({
  bookingId: { type: 'ObjectId', ref: 'Booking', required: true },
  userId: { type: 'ObjectId', ref: 'User', required: true },
  provider: { type: String, enum: ['RAZORPAY'], required: true, default: 'RAZORPAY' },
  providerOrderId: { type: String, required: true, maxlength: 80 },
  providerPaymentId: { type: String, default: null, maxlength: 80 },
  providerSignature: { type: String, default: null, maxlength: 256, select: false },
  amountMinor: minorAmount(0),
  capturedMinor: minorAmount(0),
  refundedMinor: minorAmount(0),
  currency: { type: String, required: true, default: 'INR', maxlength: 3 },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'CREATED' },
  failureReason: { type: String, default: null, maxlength: 300 },
  refunds: {
    type: [
      {
        providerRefundId: { type: String, required: true, maxlength: 80 },
        amountMinor: minorAmount(0),
        status: { type: String, required: true, maxlength: 20 },
        reason: { type: String, default: '', maxlength: 300 },
        at: { type: Date, required: true },
      },
    ],
    default: [],
  },
  webhookEvents: {
    type: [
      {
        eventId: { type: String, required: true, maxlength: 120 },
        type: { type: String, required: true, maxlength: 120 },
        at: { type: Date, required: true },
      },
    ],
    default: [],
  },
});

export const PaymentModel: Model<PaymentDocument> = model<PaymentDocument>(
  'Payment',
  paymentSchema,
  'payments',
);
