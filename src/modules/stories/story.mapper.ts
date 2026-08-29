import { type StoryDocument } from '../../lib/database';
import { type PlaceSummary, type Story, type StoryCard } from '../../lib/types';

function toImage(image: StoryDocument['coverImage']) {
  if (!image?.url) return null;
  return {
    key: image.key,
    url: image.url,
    width: image.width,
    height: image.height,
    alt: image.alt,
    ...(image.credit ? { credit: image.credit } : {}),
  };
}

function toGuideSummary(summary: StoryDocument['guideSummary']) {
  if (!summary) return null;
  return {
    guideId: String(summary.guideId),
    displayName: summary.displayName,
    slug: summary.slug,
    ...(summary.avatarUrl ? { avatarUrl: summary.avatarUrl } : {}),
    verified: summary.verified,
    ratingAvg: summary.ratingAvg,
    ratingCount: summary.ratingCount,
  };
}

/** The list projection. The body is deliberately absent from a card. */
export function toStoryCard(doc: StoryDocument): StoryCard {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    kind: doc.kind,
    coverImage: toImage(doc.coverImage),
    city: doc.city,
    state: doc.state,
    tags: doc.tags ?? [],
    readMinutes: doc.readMinutes,
    guideSummary: toGuideSummary(doc.guideSummary),
    placeCount: doc.placeIds?.length ?? 0,
    status: doc.status,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
  };
}

/**
 * The full story. `places` is resolved by the service from `placeIds`, and only
 * ever contains places that still exist and are still published — a story
 * never links to something a reader cannot open.
 */
export function toStory(doc: StoryDocument, places: PlaceSummary[]): Story {
  return {
    ...toStoryCard(doc),
    body: doc.body,
    places,
    moderationNote: doc.moderationNote ?? '',
    viewCount: doc.viewCount ?? 0,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/**
 * Reading time from the body itself, at 200 words per minute.
 *
 * Computed on write rather than stored from the client, so it cannot be
 * inflated to make a story look more substantial than it is.
 */
export function readMinutesFor(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(90, Math.round(words / 200) || 1));
}
