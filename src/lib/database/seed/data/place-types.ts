export interface PlaceSeed {
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  lng: number;
  lat: number;
  city: string;
  district: string;
  state: string;
  ownership: 'LOCAL_OWNED' | 'CHAIN' | 'GOVERNMENT' | 'COMMUNITY' | 'UNKNOWN';
  entryFeeMinor: number;
  bestTimeMonths: number[];
  durationMin: number;
  amenities: string[];
  tips: string[];
  /** 0..1 signals. popularity and crowd LOWER the discovery score. */
  quality: number;
  authenticity: number;
  localOwnership: number;
  uniqueness: number;
  popularity: number;
  crowd: number;
  destinationSlug: string | null;
  guideKey: string | null;
}
