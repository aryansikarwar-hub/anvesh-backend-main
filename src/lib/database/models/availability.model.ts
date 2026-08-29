import { model, type Model, type Types } from 'mongoose';
import { SLOT_STATUSES } from '../../types';
import { createSchema, minorAmount } from '../plugins/base';

export interface AvailabilitySlotDocument {
  _id: Types.ObjectId;
  experienceId: Types.ObjectId;
  guideId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  timezone: string;
  seatsTotal: number;
  /**
   * Decremented with a single conditional $inc — see BookingService.
   * There is deliberately no application-level lock anywhere near this field.
   */
  seatsAvailable: number;
  seatsHeld: number;
  priceMinor: number;
  currency: string;
  status: (typeof SLOT_STATUSES)[number];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySlotSchema = createSchema<AvailabilitySlotDocument>({
  experienceId: { type: 'ObjectId', ref: 'Experience', required: true },
  guideId: { type: 'ObjectId', ref: 'GuideProfile', required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  timezone: { type: String, required: true, default: 'Asia/Kolkata', maxlength: 40 },
  seatsTotal: { type: Number, required: true, min: 1, max: 60 },
  seatsAvailable: { type: Number, required: true, min: 0, max: 60 },
  seatsHeld: { type: Number, required: true, default: 0, min: 0, max: 60 },
  priceMinor: minorAmount(0),
  currency: { type: String, required: true, default: 'INR', maxlength: 3 },
  status: { type: String, enum: SLOT_STATUSES, required: true, default: 'OPEN' },
});

export const AvailabilitySlotModel: Model<AvailabilitySlotDocument> =
  model<AvailabilitySlotDocument>('AvailabilitySlot', availabilitySlotSchema, 'availabilityslots');
