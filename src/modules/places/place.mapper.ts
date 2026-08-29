import { type ImageRef, type Place } from '../../lib/types';
import { type PlaceDocument } from '../../lib/database';

function toImages(images: Record<string, unknown>[]): ImageRef[] {
  return images.map((image) => ({
    key: String(image.key ?? ''),
    url: String(image.url ?? ''),
    width: Number(image.width ?? 0),
    height: Number(image.height ?? 0),
    alt: String(image.alt ?? ''),
    ...(image.credit ? { credit: String(image.credit) } : {}),
  }));
}

/** Full place detail. Internal moderation fields are not part of it. */
export function toPlace(doc: PlaceDocument): Place {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    description: doc.description,
    categorySlugs: doc.categorySlugs,
    location: doc.location,
    address: {
      ...(doc.address.line1 ? { line1: doc.address.line1 } : {}),
      ...(doc.address.area ? { area: doc.address.area } : {}),
      city: String(doc.address.city),
      ...(doc.address.district ? { district: doc.address.district } : {}),
      state: String(doc.address.state),
      ...(doc.address.pincode ? { pincode: doc.address.pincode } : {}),
      country: String(doc.address.country ?? 'IN'),
    },
    images: toImages(doc.images ?? []),
    openingHours: doc.openingHours ?? [],
    details: {
      entryFeeMinor: doc.details.entryFeeMinor,
      bestTimeMonths: doc.details.bestTimeMonths,
      durationMin: doc.details.durationMin,
      accessibility: doc.details.accessibility,
      amenities: doc.details.amenities,
      tips: doc.details.tips,
    },
    signals: {
      qualityScore: doc.signals.qualityScore,
      authenticityScore: doc.signals.authenticityScore,
      localOwnership: doc.signals.localOwnership,
      uniquenessScore: doc.signals.uniquenessScore,
      popularityScore: doc.signals.popularityScore,
      crowdLevel: doc.signals.crowdLevel,
      ratingAvg: doc.signals.ratingAvg,
      ratingCount: doc.signals.ratingCount,
      saveCount: doc.signals.saveCount,
      viewCount: doc.signals.viewCount,
      ...(doc.signals.lastVerifiedAt
        ? { lastVerifiedAt: new Date(doc.signals.lastVerifiedAt).toISOString() }
        : {}),
    },
    discoveryScore: doc.discoveryScore,
    ownership: doc.ownership,
    guideSummary: doc.guideSummary
      ? {
          guideId: String((doc.guideSummary as { guideId: unknown }).guideId),
          displayName: String((doc.guideSummary as { displayName: string }).displayName),
          slug: String((doc.guideSummary as { slug: string }).slug),
          verified: Boolean((doc.guideSummary as { verified: boolean }).verified),
          ratingAvg: Number((doc.guideSummary as { ratingAvg: number }).ratingAvg ?? 0),
          ratingCount: Number((doc.guideSummary as { ratingCount: number }).ratingCount ?? 0),
        }
      : null,
    destinationId: doc.destinationId ? String(doc.destinationId) : null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
