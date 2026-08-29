import { type Experience } from '../../lib/types';
import { type ExperienceDocument } from '../../lib/database';

export function toExperience(doc: ExperienceDocument): Experience {
  const guide = doc.guideSummary as Record<string, unknown>;
  const place = doc.placeSummary as Record<string, unknown> | null;
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    description: doc.description,
    categorySlugs: doc.categorySlugs,
    images: (doc.images ?? []).map((image) => ({
      key: String(image.key ?? ''),
      url: String(image.url ?? ''),
      width: Number(image.width ?? 0),
      height: Number(image.height ?? 0),
      alt: String(image.alt ?? doc.title),
    })),
    durationMin: doc.durationMin,
    maxSeats: doc.maxSeats,
    basePriceMinor: doc.basePriceMinor,
    currency: doc.currency,
    meetingPoint: {
      label: doc.meetingPoint.label,
      location: doc.meetingPoint.location,
      address: {
        city: String(doc.meetingPoint.address.city),
        state: String(doc.meetingPoint.address.state),
        ...(doc.meetingPoint.address.district
          ? { district: doc.meetingPoint.address.district }
          : {}),
        country: String(doc.meetingPoint.address.country ?? 'IN'),
      },
    },
    languages: doc.languages,
    inclusions: doc.inclusions,
    exclusions: doc.exclusions,
    cancellationPolicy: doc.cancellationPolicy,
    guideSummary: {
      guideId: String(guide.guideId),
      displayName: String(guide.displayName),
      slug: String(guide.slug),
      ...(guide.avatarUrl ? { avatarUrl: String(guide.avatarUrl) } : {}),
      verified: Boolean(guide.verified),
      ratingAvg: Number(guide.ratingAvg ?? 0),
      ratingCount: Number(guide.ratingCount ?? 0),
    },
    placeSummary: place
      ? {
          placeId: String(place.placeId),
          title: String(place.title),
          slug: String(place.slug),
          ...(place.coverImageUrl ? { coverImageUrl: String(place.coverImageUrl) } : {}),
          city: String(place.city),
          categorySlugs: (place.categorySlugs as string[]) ?? [],
        }
      : null,
    signals: {
      ratingAvg: doc.signals.ratingAvg,
      ratingCount: doc.signals.ratingCount,
      popularityScore: doc.signals.popularityScore,
      qualityScore: doc.signals.qualityScore,
    },
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
