import { type ContentStatus, type OwnershipType, type StoryKind } from '../enums';
import { type Address, type GeoPoint } from '../geo';
import { type GuideSummary } from './user';

export interface ImageRef {
  key: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  credit?: string;
}

export interface OpeningHour {
  day: number;
  opensMin: number;
  closesMin: number;
  closed: boolean;
}

export interface PlaceSignals {
  qualityScore: number;
  authenticityScore: number;
  localOwnership: number;
  uniquenessScore: number;
  /** Higher = more popular = ranked LOWER. Popularity is a penalty. */
  popularityScore: number;
  crowdLevel: number;
  ratingAvg: number;
  ratingCount: number;
  saveCount: number;
  viewCount: number;
  lastVerifiedAt?: string;
}

export interface PlaceDetails {
  entryFeeMinor: number;
  bestTimeMonths: number[];
  durationMin: number;
  accessibility: string[];
  amenities: string[];
  tips: string[];
}

export interface Place {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  location: GeoPoint;
  address: Address;
  images: ImageRef[];
  openingHours: OpeningHour[];
  details: PlaceDetails;
  signals: PlaceSignals;
  discoveryScore: number;
  ownership: OwnershipType;
  guideSummary: GuideSummary | null;
  destinationId: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: ImageRef | null;
  city: string;
  state: string;
  categorySlugs: string[];
  location: GeoPoint;
  ratingAvg: number;
  ratingCount: number;
  ownership: OwnershipType;
  /** 0..1. Higher = more crowded = ranked lower. */
  crowdLevel: number;
  /** 0..1, from moderation. Shown on the card as an authenticity figure. */
  authenticityScore: number;
  /** Entry fee in paise. 0 means free. */
  entryFeeMinor: number;
  /** Typical visit length in minutes. */
  durationMin: number;
  /** Months (1-12) this place is worth visiting. Empty = any time. */
  bestTimeMonths: number[];
  distanceKm?: number;
  /** The discovery score, 0..1, when this card came from a ranked query. */
  score?: number;
  reasons?: string[];
}

export interface PlaceSummary {
  placeId: string;
  title: string;
  slug: string;
  coverImageUrl?: string;
  city: string;
  categorySlugs: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  parentSlug: string | null;
  sortOrder: number;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  state: string;
  summary: string;
  description: string;
  heroImage: ImageRef | null;
  location: GeoPoint;
  bestMonths: number[];
  placeCount: number;
  status: ContentStatus;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  images: ImageRef[];
  durationMin: number;
  maxSeats: number;
  basePriceMinor: number;
  currency: string;
  meetingPoint: { label: string; location: GeoPoint; address: Address };
  languages: string[];
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: 'FLEXIBLE' | 'MODERATE' | 'STRICT';
  guideSummary: GuideSummary;
  placeSummary: PlaceSummary | null;
  signals: Pick<PlaceSignals, 'ratingAvg' | 'ratingCount' | 'popularityScore' | 'qualityScore'>;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * A local story — the context a listing cannot carry, written by the guide
 * who knows it. Moderated exactly like a place, and linked to the places it
 * is about so a story is a way into the map rather than a blog beside it.
 */
export interface StoryCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: StoryKind;
  coverImage: ImageRef | null;
  city: string;
  state: string;
  tags: string[];
  readMinutes: number;
  guideSummary: GuideSummary | null;
  placeCount: number;
  /** Always PUBLISHED on the public list; the real value on a guide's own list. */
  status: ContentStatus;
  publishedAt: string | null;
}

export interface Story extends StoryCard {
  /** Plain text, blank-line separated paragraphs. Never HTML. */
  body: string;
  places: PlaceSummary[];
  moderationNote: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}
