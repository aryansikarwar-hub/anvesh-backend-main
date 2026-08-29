import { model, Schema, type Model, type Types } from 'mongoose';
import { CONTENT_STATUSES, OWNERSHIP_TYPES } from '../../types';
import {
  addressSchema,
  createSchema,
  geoPointSchema,
  imageSchema,
  minorAmount,
  SUB_SCHEMA_OPTIONS,
  unitInterval,
} from '../plugins/base';
import { guideSummarySchema } from './guide.model';

export interface PlaceDocument {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  location: { type: 'Point'; coordinates: [number, number] };
  address: Record<string, string | undefined>;
  images: Record<string, unknown>[];
  openingHours: { day: number; opensMin: number; closesMin: number; closed: boolean }[];
  details: {
    entryFeeMinor: number;
    bestTimeMonths: number[];
    durationMin: number;
    accessibility: string[];
    amenities: string[];
    tips: string[];
  };
  signals: {
    qualityScore: number;
    authenticityScore: number;
    localOwnership: number;
    uniquenessScore: number;
    popularityScore: number;
    crowdLevel: number;
    ratingAvg: number;
    ratingCount: number;
    saveCount: number;
    viewCount: number;
    lastVerifiedAt: Date | null;
  };
  discoveryScore: number;
  ownership: (typeof OWNERSHIP_TYPES)[number];
  guideSummary: Record<string, unknown> | null;
  destinationId: Types.ObjectId | null;
  status: (typeof CONTENT_STATUSES)[number];
  moderation: { reviewedBy: Types.ObjectId | null; reviewedAt: Date | null; reason: string };
  createdBy: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const placeSchema = createSchema<PlaceDocument>({
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  summary: { type: String, required: true, trim: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 8000 },
  categorySlugs: { type: [String], required: true, default: [] },
  location: { type: geoPointSchema, required: true },
  address: { type: addressSchema, required: true },
  images: { type: [imageSchema], default: [] },
  openingHours: {
    type: [
      {
        day: { type: Number, required: true, min: 0, max: 6 },
        opensMin: { type: Number, required: true, min: 0, max: 1440 },
        closesMin: { type: Number, required: true, min: 0, max: 1440 },
        closed: { type: Boolean, required: true, default: false },
      },
    ],
    default: [],
  },
  details: {
    entryFeeMinor: minorAmount(0),
    bestTimeMonths: { type: [Number], default: [] },
    durationMin: { type: Number, required: true, default: 60, min: 0, max: 2880 },
    accessibility: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    tips: { type: [String], default: [] },
  },
  signals: {
    qualityScore: unitInterval(0.5),
    authenticityScore: unitInterval(0.5),
    localOwnership: unitInterval(0.5),
    uniquenessScore: unitInterval(0.5),
    // Computed from real interactions only. Never accepted from a client.
    popularityScore: unitInterval(0),
    crowdLevel: unitInterval(0.2),
    ratingAvg: { type: Number, required: true, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, required: true, default: 0, min: 0 },
    saveCount: { type: Number, required: true, default: 0, min: 0 },
    viewCount: { type: Number, required: true, default: 0, min: 0 },
    lastVerifiedAt: { type: Date, default: null },
  },
  discoveryScore: { type: Number, required: true, default: 0 },
  ownership: { type: String, enum: OWNERSHIP_TYPES, required: true, default: 'UNKNOWN' },
  guideSummary: { type: guideSummarySchema, default: null },
  destinationId: { type: 'ObjectId', ref: 'Destination', default: null },
  status: { type: String, enum: CONTENT_STATUSES, required: true, default: 'DRAFT' },
  moderation: {
    reviewedBy: { type: 'ObjectId', ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reason: { type: String, default: '', maxlength: 500 },
  },
  createdBy: { type: 'ObjectId', ref: 'User', required: true },
});

export const PlaceModel: Model<PlaceDocument> = model<PlaceDocument>(
  'Place',
  placeSchema,
  'places',
);

/** Denormalised place card embedded into experiences and trips. */
export const placeSummarySchema = new Schema(
  {
    placeId: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
    title: { type: String, required: true, maxlength: 140 },
    slug: { type: String, required: true, maxlength: 120 },
    coverImageUrl: { type: String, maxlength: 1000 },
    city: { type: String, required: true, maxlength: 120 },
    categorySlugs: { type: [String], default: [] },
  },
  SUB_SCHEMA_OPTIONS,
);
