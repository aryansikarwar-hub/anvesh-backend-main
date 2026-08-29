import { Types } from 'mongoose';
import {
  AvailabilitySlotModel,
  ExperienceModel,
  GuideProfileModel,
  PlaceModel,
  RecommendationConfigModel,
  type AvailabilitySlotDocument,
  type ExperienceDocument,
  type PlaceDocument,
} from '../src/lib/database';

/** The ranking configuration the discovery tests run against. */
export async function seedRankingConfig(): Promise<void> {
  await RecommendationConfigModel.create({
    name: 'test',
    active: true,
    version: 1,
    weights: {
      relevance: 1,
      preferenceMatch: 0.9,
      quality: 0.8,
      authenticity: 0.7,
      localOwnership: 0.6,
      freshness: 0.3,
      uniqueness: 0.5,
      popularityPenalty: 1.2,
      crowdPenalty: 0.9,
    },
    params: {
      freshnessHalfLifeDays: 180,
      distanceDecayKm: 40,
      maxCandidates: 300,
      minQuality: 0.2,
      hiddenGemPopularityMax: 0.3,
      hiddenGemMinQuality: 0.55,
    },
  });
}

export interface PlaceOverrides {
  title?: string;
  slug?: string;
  city?: string;
  state?: string;
  categorySlugs?: string[];
  lng?: number;
  lat?: number;
  popularity?: number;
  crowd?: number;
  quality?: number;
  ownership?: string;
  status?: string;
  guideId?: string;
  guideSlug?: string;
  createdBy?: string;
}

let placeCounter = 0;

export async function createPlace(overrides: PlaceOverrides = {}): Promise<PlaceDocument> {
  placeCounter += 1;
  const guideSummary = overrides.guideId
    ? {
        guideId: new Types.ObjectId(overrides.guideId),
        displayName: 'Fixture Guide',
        slug: overrides.guideSlug ?? `fixture-guide-${placeCounter}`,
        verified: true,
        ratingAvg: 0,
        ratingCount: 0,
      }
    : null;

  return PlaceModel.create({
    slug: overrides.slug ?? `fixture-place-${placeCounter}-${Date.now()}`,
    title: overrides.title ?? `Fixture Place ${placeCounter}`,
    summary: 'A fixture place used by the integration suite for ranking assertions.',
    description:
      'A fixture place with enough description text to satisfy the schema minimum length rule.',
    categorySlugs: overrides.categorySlugs ?? ['waterfall'],
    location: {
      type: 'Point',
      coordinates: [overrides.lng ?? 75.3562, overrides.lat ?? 12.9908],
    },
    address: {
      city: overrides.city ?? 'Ujire',
      state: overrides.state ?? 'Karnataka',
      country: 'IN',
    },
    signals: {
      qualityScore: overrides.quality ?? 0.8,
      authenticityScore: 0.8,
      localOwnership: 0.9,
      uniquenessScore: 0.7,
      popularityScore: overrides.popularity ?? 0.1,
      crowdLevel: overrides.crowd ?? 0.1,
      lastVerifiedAt: new Date(),
    },
    ownership: overrides.ownership ?? 'LOCAL_OWNED',
    guideSummary,
    status: overrides.status ?? 'PUBLISHED',
    createdBy: new Types.ObjectId(overrides.createdBy ?? new Types.ObjectId().toHexString()),
  });
}

let experienceCounter = 0;

export async function createExperience(input: {
  guideId: string;
  maxSeats?: number;
  priceMinor?: number;
  status?: string;
}): Promise<ExperienceDocument> {
  experienceCounter += 1;
  const guide = await GuideProfileModel.findById(input.guideId).lean();
  return ExperienceModel.create({
    slug: `fixture-experience-${experienceCounter}-${Date.now()}`,
    title: `Fixture Experience ${experienceCounter}`,
    summary: 'A fixture experience used by the booking and payment integration suite.',
    description:
      'A fixture experience with enough description text to satisfy the schema minimum length.',
    categorySlugs: ['trek'],
    durationMin: 240,
    maxSeats: input.maxSeats ?? 8,
    basePriceMinor: input.priceMinor ?? 250000,
    currency: 'INR',
    meetingPoint: {
      label: 'Ujire bus stand',
      location: { type: 'Point', coordinates: [75.0664, 12.9989] },
      address: { city: 'Ujire', state: 'Karnataka', country: 'IN' },
    },
    guideId: new Types.ObjectId(input.guideId),
    guideSummary: {
      guideId: new Types.ObjectId(input.guideId),
      displayName: guide?.displayName ?? 'Fixture Guide',
      slug: guide?.slug ?? `fixture-guide-${experienceCounter}`,
      verified: true,
      ratingAvg: 0,
      ratingCount: 0,
    },
    status: input.status ?? 'PUBLISHED',
  });
}

export async function createSlot(input: {
  experienceId: string;
  guideId: string;
  seatsTotal: number;
  priceMinor?: number;
  startInDays?: number;
}): Promise<AvailabilitySlotDocument> {
  const startAt = new Date(Date.now() + (input.startInDays ?? 14) * 86_400_000);
  return AvailabilitySlotModel.create({
    experienceId: new Types.ObjectId(input.experienceId),
    guideId: new Types.ObjectId(input.guideId),
    startAt,
    endAt: new Date(startAt.getTime() + 4 * 3_600_000),
    seatsTotal: input.seatsTotal,
    seatsAvailable: input.seatsTotal,
    priceMinor: input.priceMinor ?? 250000,
    currency: 'INR',
    status: 'OPEN',
  });
}
