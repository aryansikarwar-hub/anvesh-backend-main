import { model, type Model, type Types } from 'mongoose';
import { AI_TASKS } from '../../types';
import { createSchema } from '../plugins/base';

export const ANALYTICS_EVENTS = [
  'PLACE_VIEW',
  'PLACE_SAVE',
  'PLACE_UNSAVE',
  'EXPERIENCE_VIEW',
  'SEARCH',
  'MAP_PAN',
  'BOOKING_STARTED',
  'BOOKING_CONFIRMED',
  'AI_DISCOVER',
] as const;

export interface AnalyticsEventDocument {
  _id: Types.ObjectId;
  type: (typeof ANALYTICS_EVENTS)[number];
  userId: Types.ObjectId | null;
  /** Hashed session identifier — never a raw cookie value or IP address. */
  sessionHash: string | null;
  placeId: Types.ObjectId | null;
  experienceId: Types.ObjectId | null;
  query: string | null;
  meta: Record<string, unknown>;
  occurredAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsEventSchema = createSchema<AnalyticsEventDocument>(
  {
    type: { type: String, enum: ANALYTICS_EVENTS, required: true },
    userId: { type: 'ObjectId', ref: 'User', default: null },
    sessionHash: { type: String, default: null, maxlength: 64 },
    placeId: { type: 'ObjectId', ref: 'Place', default: null },
    experienceId: { type: 'ObjectId', ref: 'Experience', default: null },
    query: { type: String, default: null, maxlength: 200 },
    meta: { type: Object, default: {} },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 400 * 86_400_000),
    },
  },
  { strict: true },
);

export const AnalyticsEventModel: Model<AnalyticsEventDocument> = model<AnalyticsEventDocument>(
  'AnalyticsEvent',
  analyticsEventSchema,
  'analyticsevents',
);

export interface PlaceDailyStatsDocument {
  _id: Types.ObjectId;
  placeId: Types.ObjectId;
  day: string;
  views: number;
  saves: number;
  reviews: number;
  bookings: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const placeDailyStatsSchema = createSchema<PlaceDailyStatsDocument>({
  placeId: { type: 'ObjectId', ref: 'Place', required: true },
  day: { type: String, required: true, maxlength: 10 },
  views: { type: Number, required: true, default: 0, min: 0 },
  saves: { type: Number, required: true, default: 0, min: 0 },
  reviews: { type: Number, required: true, default: 0, min: 0 },
  bookings: { type: Number, required: true, default: 0, min: 0 },
});

export const PlaceDailyStatsModel: Model<PlaceDailyStatsDocument> = model<PlaceDailyStatsDocument>(
  'PlaceDailyStats',
  placeDailyStatsSchema,
  'placedailystats',
);

export interface AiRequestLogDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  task: (typeof AI_TASKS)[number];
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  verdict: 'OK' | 'SCHEMA_REJECTED' | 'REFERENCE_REJECTED' | 'PROVIDER_ERROR';
  rejectionDetail: string | null;
  requestId: string;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiRequestLogSchema = createSchema<AiRequestLogDocument>({
  userId: { type: 'ObjectId', ref: 'User', default: null },
  task: { type: String, enum: AI_TASKS, required: true },
  provider: { type: String, required: true, maxlength: 40 },
  model: { type: String, required: true, maxlength: 80 },
  promptTokens: { type: Number, required: true, default: 0, min: 0 },
  completionTokens: { type: Number, required: true, default: 0, min: 0 },
  latencyMs: { type: Number, required: true, default: 0, min: 0 },
  verdict: {
    type: String,
    enum: ['OK', 'SCHEMA_REJECTED', 'REFERENCE_REJECTED', 'PROVIDER_ERROR'],
    required: true,
  },
  rejectionDetail: { type: String, default: null, maxlength: 600 },
  requestId: { type: String, required: true, maxlength: 64 },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 90 * 86_400_000) },
});

export const AiRequestLogModel: Model<AiRequestLogDocument> = model<AiRequestLogDocument>(
  'AiRequestLog',
  aiRequestLogSchema,
  'airequestlogs',
);
