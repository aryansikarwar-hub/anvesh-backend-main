import { ExperienceModel, GuideProfileModel, PlaceModel, StoryModel } from '../../models';
import { PLACE_SEEDS } from '../data/places';
import { EXPERIENCE_SEEDS } from '../data/experiences';
import { STORY_SEEDS } from '../data/stories';
import { seedId, type SeedContext } from '../context';
import { buildPlaceImages } from '../place-images';
import { type SeededPeople } from './people';

interface GuideSummaryShape {
  guideId: unknown;
  displayName: string;
  slug: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
}

async function loadGuideSummaries(people: SeededPeople): Promise<Map<string, GuideSummaryShape>> {
  const summaries = new Map<string, GuideSummaryShape>();
  for (const [key, profileId] of people.guideProfileIds) {
    const profile = await GuideProfileModel.findById(profileId).lean();
    if (!profile) continue;
    summaries.set(key, {
      guideId: profile._id,
      displayName: profile.displayName,
      slug: profile.slug,
      verified: profile.verified,
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount,
    });
  }
  return summaries;
}

export async function seedPlaces(ctx: SeedContext, people: SeededPeople): Promise<void> {
  const summaries = await loadGuideSummaries(people);
  const rootAdminId = seedId('user:admin-root');

  for (const p of PLACE_SEEDS) {
    const guideSummary = p.guideKey ? (summaries.get(p.guideKey) ?? null) : null;
    await PlaceModel.updateOne(
      { _id: seedId(`place:${p.slug}`) },
      {
        $set: {
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          description: p.description,
          categorySlugs: p.categorySlugs,
          location: { type: 'Point', coordinates: [p.lng, p.lat] },
          address: {
            city: p.city,
            district: p.district,
            state: p.state,
            country: 'IN',
          },
          'details.entryFeeMinor': p.entryFeeMinor,
          'details.bestTimeMonths': p.bestTimeMonths,
          'details.durationMin': p.durationMin,
          'details.amenities': p.amenities,
          'details.tips': p.tips,
          'signals.qualityScore': p.quality,
          'signals.authenticityScore': p.authenticity,
          'signals.localOwnership': p.localOwnership,
          'signals.uniquenessScore': p.uniqueness,
          'signals.popularityScore': p.popularity,
          'signals.crowdLevel': p.crowd,
          'signals.lastVerifiedAt': ctx.now,
          ownership: p.ownership,
          guideSummary,
          destinationId: p.destinationSlug ? seedId(`destination:${p.destinationSlug}`) : null,
          status: 'PUBLISHED',
          createdBy: rootAdminId,
          deletedAt: null,
          // In $set, not $setOnInsert: re-running the seed after adding a
          // MAPTILER_API_KEY should backfill imagery onto places that were
          // created without it.
          images: buildPlaceImages(p.slug, p.title, p.lng, p.lat),
        },
        $setOnInsert: {
          openingHours: [],
          discoveryScore: 0,
          'signals.ratingAvg': 0,
          'signals.ratingCount': 0,
          'signals.saveCount': 0,
          'signals.viewCount': 0,
        },
      },
      { upsert: true },
    );
  }
  const withImages = process.env.MAPTILER_API_KEY ? 'with imagery' : 'no imagery (MAPTILER_API_KEY unset)';
  ctx.log(`places: ${PLACE_SEEDS.length} (${withImages})`);
}

export async function seedExperiences(ctx: SeedContext, people: SeededPeople): Promise<void> {
  const summaries = await loadGuideSummaries(people);

  for (const e of EXPERIENCE_SEEDS) {
    const guideSummary = summaries.get(e.guideKey);
    if (!guideSummary) throw new Error(`Experience ${e.slug} references unknown guide ${e.guideKey}`);

    const place = e.placeSlug
      ? await PlaceModel.findById(seedId(`place:${e.placeSlug}`)).lean()
      : null;

    await ExperienceModel.updateOne(
      { _id: seedId(`experience:${e.slug}`) },
      {
        $set: {
          slug: e.slug,
          title: e.title,
          summary: e.summary,
          description: e.description,
          categorySlugs: e.categorySlugs,
          durationMin: e.durationMin,
          maxSeats: e.maxSeats,
          basePriceMinor: e.basePriceMinor,
          currency: 'INR',
          meetingPoint: {
            label: e.meetingLabel,
            location: { type: 'Point', coordinates: [e.lng, e.lat] },
            address: { city: e.city, district: e.district, state: e.state, country: 'IN' },
          },
          languages: e.languages,
          inclusions: e.inclusions,
          exclusions: e.exclusions,
          cancellationPolicy: e.cancellationPolicy,
          guideId: guideSummary.guideId,
          guideSummary,
          placeSummary: place
            ? {
                placeId: place._id,
                title: place.title,
                slug: place.slug,
                city: place.address.city,
                categorySlugs: place.categorySlugs,
              }
            : null,
          status: 'PUBLISHED',
          deletedAt: null,
          images: buildPlaceImages(e.slug, e.title, e.lng, e.lat),
        },
        $setOnInsert: {
          'signals.ratingAvg': 0,
          'signals.ratingCount': 0,
          'signals.popularityScore': 0,
          'signals.qualityScore': 0.6,
          'signals.bookingCount': 0,
        },
      },
      { upsert: true },
    );
  }
  ctx.log(`experiences: ${EXPERIENCE_SEEDS.length}`);
}

/**
 * Local stories, published and attached to the places they are about.
 *
 * `readMinutes` is computed from the body here for the same reason the service
 * computes it on write: it is a fact about the text, not a field anybody gets
 * to choose.
 */
export async function seedStories(ctx: SeedContext, people: SeededPeople): Promise<void> {
  const summaries = await loadGuideSummaries(people);

  for (const story of STORY_SEEDS) {
    const guideSummary = summaries.get(story.guideKey);
    if (!guideSummary) throw new Error(`Story ${story.slug} references unknown guide ${story.guideKey}`);

    const placeIds = story.placeSlugs.map((slug) => seedId(`place:${slug}`));
    const words = story.body.trim().split(/\s+/).filter(Boolean).length;

    await StoryModel.updateOne(
      { _id: seedId(`story:${story.slug}`) },
      {
        $set: {
          slug: story.slug,
          title: story.title,
          summary: story.summary,
          body: story.body,
          kind: story.kind,
          guideId: guideSummary.guideId,
          guideSummary,
          placeIds,
          coverImage: null,
          city: story.city,
          state: story.state,
          tags: story.tags,
          readMinutes: Math.max(1, Math.min(90, Math.round(words / 200) || 1)),
          status: 'PUBLISHED',
          moderationNote: '',
          publishedAt: ctx.now,
          deletedAt: null,
        },
        $setOnInsert: { viewCount: 0 },
      },
      { upsert: true },
    );
  }
  ctx.log(`stories: ${STORY_SEEDS.length}`);
}