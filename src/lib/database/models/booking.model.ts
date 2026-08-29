import { model, type Model, type Types } from 'mongoose';
import { BOOKING_STATUSES } from '../../types';
import { createSchema, minorAmount } from '../plugins/base';
import { guideSummarySchema } from './guide.model';

export interface BookingDocument {
  _id: Types.ObjectId;
  code: string;
  userId: Types.ObjectId;
  guideId: Types.ObjectId;
  experienceId: Types.ObjectId;
  slotId: Types.ObjectId;
  status: (typeof BOOKING_STATUSES)[number];
  seats: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  feeMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionMinor: number;
  guidePayoutMinor: number;
  currency: string;
  startAt: Date;
  endAt: Date;
  experienceTitle: string;
  experienceSlug: string;
  coverImageUrl: string | null;
  guideSummary: Record<string, unknown>;
  travellerName: string;
  travellerEmail: string;
  travellerPhoneEnc: string | null;
  travellerNote: string;
  paymentId: Types.ObjectId | null;
  idempotencyKey: string;
  expiresAt: Date | null;
  timeline: { status: string; at: Date; by: string; reason: string }[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = createSchema<BookingDocument>({
  code: { type: String, required: true, maxlength: 20 },
  userId: { type: 'ObjectId', ref: 'User', required: true },
  guideId: { type: 'ObjectId', ref: 'GuideProfile', required: true },
  experienceId: { type: 'ObjectId', ref: 'Experience', required: true },
  slotId: { type: 'ObjectId', ref: 'AvailabilitySlot', required: true },
  status: { type: String, enum: BOOKING_STATUSES, required: true, default: 'PENDING_PAYMENT' },
  seats: { type: Number, required: true, min: 1, max: 20 },
  unitPriceMinor: minorAmount(0),
  subtotalMinor: minorAmount(0),
  feeMinor: minorAmount(0),
  taxMinor: minorAmount(0),
  totalMinor: minorAmount(0),
  commissionMinor: minorAmount(0),
  guidePayoutMinor: minorAmount(0),
  currency: { type: String, required: true, default: 'INR', maxlength: 3 },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  experienceTitle: { type: String, required: true, maxlength: 140 },
  experienceSlug: { type: String, required: true, maxlength: 120 },
  coverImageUrl: { type: String, default: null, maxlength: 1000 },
  guideSummary: { type: guideSummarySchema, required: true },
  travellerName: { type: String, required: true, maxlength: 80 },
  travellerEmail: { type: String, required: true, maxlength: 254, select: false },
  travellerPhoneEnc: { type: String, default: null, select: false },
  travellerNote: { type: String, default: '', maxlength: 500 },
  paymentId: { type: 'ObjectId', ref: 'Payment', default: null },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  expiresAt: { type: Date, default: null },
  timeline: {
    type: [
      {
        status: { type: String, required: true, maxlength: 40 },
        at: { type: Date, required: true },
        by: { type: String, required: true, maxlength: 20 },
        reason: { type: String, default: '', maxlength: 300 },
      },
    ],
    default: [],
  },
});

export const BookingModel: Model<BookingDocument> = model<BookingDocument>(
  'Booking',
  bookingSchema,
  'bookings',
);
