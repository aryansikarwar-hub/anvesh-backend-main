import { model, type Model, type Types } from 'mongoose';
import { createSchema, unitInterval } from '../plugins/base';

export interface RecommendationConfigDocument {
  _id: Types.ObjectId;
  name: string;
  active: boolean;
  version: number;
  weights: {
    relevance: number;
    preferenceMatch: number;
    quality: number;
    authenticity: number;
    localOwnership: number;
    freshness: number;
    uniqueness: number;
    popularityPenalty: number;
    crowdPenalty: number;
  };
  params: {
    freshnessHalfLifeDays: number;
    distanceDecayKm: number;
    maxCandidates: number;
    minQuality: number;
    hiddenGemPopularityMax: number;
    hiddenGemMinQuality: number;
  };
  updatedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const weight = (def: number) => ({ type: Number, required: true, default: def, min: 0, max: 5 });
/** Penalty weights are bounded away from zero so popularity can never be a boost. */
const penalty = (def: number) => ({
  type: Number,
  required: true,
  default: def,
  min: 0.05,
  max: 5,
});

const recommendationConfigSchema = createSchema<RecommendationConfigDocument>({
  name: { type: String, required: true, maxlength: 80 },
  active: { type: Boolean, required: true, default: false },
  version: { type: Number, required: true, default: 1, min: 1 },
  weights: {
    relevance: weight(1),
    preferenceMatch: weight(0.9),
    quality: weight(0.8),
    authenticity: weight(0.7),
    localOwnership: weight(0.6),
    freshness: weight(0.3),
    uniqueness: weight(0.5),
    popularityPenalty: penalty(1.2),
    crowdPenalty: penalty(0.9),
  },
  params: {
    freshnessHalfLifeDays: { type: Number, required: true, default: 180, min: 1, max: 3650 },
    distanceDecayKm: { type: Number, required: true, default: 40, min: 1, max: 1000 },
    maxCandidates: { type: Number, required: true, default: 300, min: 20, max: 2000 },
    minQuality: unitInterval(0.2),
    hiddenGemPopularityMax: unitInterval(0.3),
    hiddenGemMinQuality: unitInterval(0.55),
  },
  updatedBy: { type: 'ObjectId', ref: 'User', default: null },
});

export const RecommendationConfigModel: Model<RecommendationConfigDocument> =
  model<RecommendationConfigDocument>(
    'RecommendationConfig',
    recommendationConfigSchema,
    'recommendationconfigs',
  );
