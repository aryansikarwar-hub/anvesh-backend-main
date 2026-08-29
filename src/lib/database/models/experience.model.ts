import { model, type Model, type Types } from 'mongoose';
import { CONTENT_STATUSES } from '../../types';
import {
  addressSchema,
  createSchema,
  geoPointSchema,
  imageSchema,
  minorAmount,
  unitInterval,
} from '../plugins/base';
import { guideSummarySchema } from './guide.model';
import { placeSummarySchema } from './place.model';

export interface ExperienceDocument {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  images: Record<string, unknown>[];
  durationMin: number;
  maxSeats: number;
  basePriceMinor: number;
  currency: string;
  meetingPoint: {
    label: string;
    location: { type: 'Point'; coordinates: [number, number] };
    address: Record<string, string | undefined>;
  };
  languages: string[];
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: 'FLEXIBLE' | 'MODERATE' | 'STRICT';
  guideId: Types.ObjectId;
  guideSummary: Record<string, unknown>;
  placeSummary: Record<string, unknown> | null;
  signals: {
    ratingAvg: number;
    ratingCount: number;
    popularityScore: number;
    qualityScore: number;
    bookingCount: number;
  };
  status: (typeof CONTENT_STATUSES)[number];
  moderation: { reviewedBy: Types.ObjectId | null; reviewedAt: Date | null; reason: string };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const experienceSchema = createSchema<ExperienceDocument>({
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  summary: { type: String, required: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 8000 },
  categorySlugs: { type: [String], required: true, default: [] },
  images: { type: [imageSchema], default: [] },
  durationMin: { type: Number, required: true, min: 15, max: 1440 },
  maxSeats: { type: Number, required: true, min: 1, max: 60 },
  basePriceMinor: minorAmount(0),
  currency: { type: String, required: true, default: 'INR', maxlength: 3 },
  meetingPoint: {
    label: { type: String, required: true, maxlength: 160 },
    location: { type: geoPointSchema, required: true },
    address: { type: addressSchema, required: true },
  },
  languages: { type: [String], default: ['en'] },
  inclusions: { type: [String], default: [] },
  exclusions: { type: [String], default: [] },
  cancellationPolicy: {
    type: String,
    enum: ['FLEXIBLE', 'MODERATE', 'STRICT'],
    required: true,
    default: 'MODERATE',
  },
  guideId: { type: 'ObjectId', ref: 'GuideProfile', required: true },
  guideSummary: { type: guideSummarySchema, required: true },
  placeSummary: { type: placeSummarySchema, default: null },
  signals: {
    ratingAvg: { type: Number, required: true, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, required: true, default: 0, min: 0 },
    popularityScore: unitInterval(0),
    qualityScore: unitInterval(0.5),
    bookingCount: { type: Number, required: true, default: 0, min: 0 },
  },
  status: { type: String, enum: CONTENT_STATUSES, required: true, default: 'DRAFT' },
  moderation: {
    reviewedBy: { type: 'ObjectId', ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reason: { type: String, default: '', maxlength: 500 },
  },
});

export const ExperienceModel: Model<ExperienceDocument> = model<ExperienceDocument>(
  'Experience',
  experienceSchema,
  'experiences',
);
