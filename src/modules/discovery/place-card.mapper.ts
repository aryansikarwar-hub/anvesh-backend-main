import { type PlaceCard } from '../../lib/types';
import { type PlaceCandidate } from './discovery.repository';

/** The list-shaped projection of a place. Nothing internal leaks into it. */
export function toPlaceCard(
  place: PlaceCandidate,
  extras: { score?: number; reasons?: string[] } = {},
): PlaceCard {
  const cover = place.images?.[0] as { url?: string; alt?: string } | undefined;
  return {
    id: String(place._id),
    slug: place.slug,
    title: place.title,
    summary: place.summary,
    coverImage: cover?.url
      ? {
          key: String((place.images[0] as { key?: string }).key ?? ''),
          url: cover.url,
          width: Number((place.images[0] as { width?: number }).width ?? 0),
          height: Number((place.images[0] as { height?: number }).height ?? 0),
          alt: cover.alt ?? place.title,
        }
      : null,
    city: String(place.address.city ?? ''),
    state: String(place.address.state ?? ''),
    categorySlugs: place.categorySlugs,
    location: place.location,
    ratingAvg: place.signals.ratingAvg,
    ratingCount: place.signals.ratingCount,
    ownership: place.ownership,
    crowdLevel: place.signals.crowdLevel,
    authenticityScore: place.signals.authenticityScore,
    entryFeeMinor: place.details.entryFeeMinor,
    durationMin: place.details.durationMin,
    bestTimeMonths: place.details.bestTimeMonths ?? [],
    ...(typeof place.distanceKm === 'number'
      ? { distanceKm: Number(place.distanceKm.toFixed(2)) }
      : {}),
    ...(typeof extras.score === 'number' ? { score: extras.score } : {}),
    ...(extras.reasons ? { reasons: extras.reasons } : {}),
  };
}
