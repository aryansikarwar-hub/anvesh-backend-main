import { model, type Model, type Types } from 'mongoose';
import { Schema } from 'mongoose';
import { createSchema, SUB_SCHEMA_OPTIONS } from '../plugins/base';

export interface GuideProfileDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  languages: string[];
  specialities: string[];
  yearsExperience: number;
  baseCity: string;
  baseState: string;
  verified: boolean;
  verifiedAt: Date | null;
  verifiedBy: Types.ObjectId | null;
  ratingAvg: number;
  ratingCount: number;
  responseRate: number;
  payout: {
    accountHolderName: string | null;
    accountNumberEnc: string | null;
    accountNumberLast4: string | null;
    ifsc: string | null;
    bankName: string | null;
    upiId: string | null;
    verified: boolean;
  };
  stats: {
    placeCount: number;
    experienceCount: number;
    bookingCount: number;
    lifetimeGrossMinor: number;
    lifetimeNetMinor: number;
    paidOutMinor: number;
  };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const guideProfileSchema = createSchema<GuideProfileDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 100 },
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  headline: { type: String, required: true, trim: true, maxlength: 140, default: '' },
  bio: { type: String, default: '', maxlength: 2000 },
  avatarUrl: { type: String, maxlength: 1000 },
  coverImageUrl: { type: String, maxlength: 1000 },
  languages: { type: [String], default: ['en'] },
  specialities: { type: [String], default: [] },
  yearsExperience: { type: Number, required: true, default: 0, min: 0, max: 70 },
  baseCity: { type: String, required: true, maxlength: 120 },
  baseState: { type: String, required: true, maxlength: 120 },
  verified: { type: Boolean, required: true, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: 'ObjectId', ref: 'User', default: null },
  ratingAvg: { type: Number, required: true, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, required: true, default: 0, min: 0 },
  responseRate: { type: Number, required: true, default: 0, min: 0, max: 1 },
  payout: {
    accountHolderName: { type: String, default: null, maxlength: 120 },
    // Encrypted at rest; the plaintext account number never leaves the service.
    accountNumberEnc: { type: String, default: null, select: false },
    accountNumberLast4: { type: String, default: null, maxlength: 4 },
    ifsc: { type: String, default: null, maxlength: 11 },
    bankName: { type: String, default: null, maxlength: 120 },
    upiId: { type: String, default: null, maxlength: 100 },
    verified: { type: Boolean, required: true, default: false },
  },
  stats: {
    placeCount: { type: Number, required: true, default: 0, min: 0 },
    experienceCount: { type: Number, required: true, default: 0, min: 0 },
    bookingCount: { type: Number, required: true, default: 0, min: 0 },
    lifetimeGrossMinor: { type: Number, required: true, default: 0, min: 0 },
    lifetimeNetMinor: { type: Number, required: true, default: 0, min: 0 },
    paidOutMinor: { type: Number, required: true, default: 0, min: 0 },
  },
});

export const GuideProfileModel: Model<GuideProfileDocument> = model<GuideProfileDocument>(
  'GuideProfile',
  guideProfileSchema,
  'guideprofiles',
);

/** Denormalised guide card embedded into places and experiences. */
export const guideSummarySchema = new Schema(
  {
    guideId: { type: Schema.Types.ObjectId, ref: 'GuideProfile', required: true },
    displayName: { type: String, required: true, maxlength: 80 },
    slug: { type: String, required: true, maxlength: 100 },
    avatarUrl: { type: String, maxlength: 1000 },
    verified: { type: Boolean, required: true, default: false },
    ratingAvg: { type: Number, required: true, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, required: true, default: 0, min: 0 },
  },
  SUB_SCHEMA_OPTIONS,
);
