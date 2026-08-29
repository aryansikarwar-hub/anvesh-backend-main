import {
  blendRelevance,
  freshness,
  isHiddenGem,
  preferenceMatch,
  proximityScore,
  scoreCandidate,
  buildPageInfo,
  toSkipLimit,
} from '../../lib/shared';
import { type Paginated, type PlaceCard, type UserPreferences } from '../../lib/types';
import { type MapQuery, type NearbyQuery, type SearchQuery } from '../../lib/validation';
import { type ActiveRankingConfig, type RecommendationService } from '../recommendations/recommendation.service';
import { type DiscoveryRepository, type PlaceCandidate } from './discovery.repository';
import { toPlaceCard } from './place-card.mapper';
import { type UserRepository } from '../users/user.repository';

export interface DiscoveryActor {
  userId: string | null;
}

/**
 * Discovery ranking.
 *
 * The service fetches a bounded candidate set with the cheapest index that
 * fits the query, then scores every candidate with the pure scorer from
 * @anvesh/shared using the weights from the active recommendation config.
 * Popularity and crowding always subtract; there is no sort option that
 * ranks by popularity, by design.
 */
export class DiscoveryService {
  constructor(
    private readonly repo: DiscoveryRepository,
    private readonly recommendations: RecommendationService,
    private readonly users: UserRepository,
  ) {}

  async search(query: SearchQuery, actor: DiscoveryActor): Promise<Paginated<PlaceCard>> {
    const config = await this.recommendations.getActive();
    const prefs = await this.loadPreferences(actor);
    const filter = this.repo.toFilter(query);
    const cap = config.params.maxCandidates;

    const candidates = await this.fetchCandidates(query, filter, cap);
    const ranked = this.rank(candidates, query, prefs, config);
    const sorted = this.applySort(ranked, query.sort);

    const { skip, limit } = toSkipLimit(query.page, query.limit);
    return {
      items: sorted.slice(skip, skip + limit).map((r) => toPlaceCard(r.place, r)),
      pageInfo: buildPageInfo(query.page, query.limit, sorted.length),
    };
  }

  async nearby(query: NearbyQuery, actor: DiscoveryActor): Promise<PlaceCard[]> {
    const config = await this.recommendations.getActive();
    const prefs = await this.loadPreferences(actor);
    const filter = query.categories ? { categories: query.categories } : {};
    const candidates = await this.repo.findNear(
      query.lng,
      query.lat,
      query.radiusKm,
      filter,
      Math.min(config.params.maxCandidates, query.limit * 6),
    );
    const excluded = query.excludePlaceId
      ? candidates.filter((c) => String(c._id) !== query.excludePlaceId)
      : candidates;

    return this.rank(excluded, { sort: 'recommended' }, prefs, config)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit)
      .map((r) => toPlaceCard(r.place, r));
  }

  async map(query: MapQuery, actor: DiscoveryActor): Promise<PlaceCard[]> {
    const config = await this.recommendations.getActive();
    const prefs = await this.loadPreferences(actor);
    const filter = {
      ...(query.categories ? { categories: query.categories } : {}),
      ...(typeof query.maxCrowd === 'number' ? { maxCrowd: query.maxCrowd } : {}),
    };
    const candidates = await this.repo.findInBounds(query, filter, query.limit);
    return this.rank(candidates, { sort: 'recommended' }, prefs, config)
      .sort((a, b) => b.score - a.score)
      .map((r) => toPlaceCard(r.place, r));
  }

  /** Personalised home feed. Falls back to precomputed scores when anonymous. */
  async feed(
    options: { limit: number; lng?: number; lat?: number },
    actor: DiscoveryActor,
  ): Promise<PlaceCard[]> {
    const config = await this.recommendations.getActive();
    const prefs = await this.loadPreferences(actor);
    const candidates =
      typeof options.lng === 'number' && typeof options.lat === 'number'
        ? await this.repo.findNear(options.lng, options.lat, 300, {}, config.params.maxCandidates)
        : await this.repo.findCandidates({}, config.params.maxCandidates);

    return this.rank(candidates, { sort: 'recommended' }, prefs, config)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
      .map((r) => toPlaceCard(r.place, r));
  }

  /** Only places that are still genuinely unpopular qualify. */
  async hiddenGems(
    options: { limit: number; state?: string },
    actor: DiscoveryActor,
  ): Promise<PlaceCard[]> {
    const config = await this.recommendations.getActive();
    const prefs = await this.loadPreferences(actor);
    const candidates = await this.repo.findCandidates(
      {
        ...(options.state ? { state: options.state } : {}),
        maxCrowd: config.params.hiddenGemPopularityMax + 0.2,
      },
      config.params.maxCandidates,
    );

    const gems = candidates.filter((place) =>
      isHiddenGem(
        { popularity: place.signals.popularityScore, quality: place.signals.qualityScore },
        config.params.hiddenGemPopularityMax,
        config.params.hiddenGemMinQuality,
      ),
    );

    return this.rank(gems, { sort: 'recommended' }, prefs, config)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
      .map((r) => toPlaceCard(r.place, r));
  }

  private async fetchCandidates(
    query: SearchQuery,
    filter: ReturnType<DiscoveryRepository['toFilter']>,
    cap: number,
  ): Promise<PlaceCandidate[]> {
    const hasGeo = typeof query.lng === 'number' && typeof query.lat === 'number';
    if (query.q && query.q.length > 1) {
      const byText = await this.repo.findByText(query.q, filter, cap);
      if (byText.length > 0 || !hasGeo) return byText;
    }
    if (hasGeo) {
      return this.repo.findNear(query.lng as number, query.lat as number, query.radiusKm, filter, cap);
    }
    return this.repo.findCandidates(filter, cap);
  }

  private rank(
    candidates: PlaceCandidate[],
    query: { sort: SearchQuery['sort']; q?: string },
    prefs: UserPreferences | null,
    config: ActiveRankingConfig,
  ): { place: PlaceCandidate; score: number; reasons: string[] }[] {
    const maxTextScore = Math.max(1, ...candidates.map((c) => c.textScore ?? 0));

    return candidates.map((place) => {
      const proximity = proximityScore(place.distanceKm ?? null, config.params.distanceDecayKm);
      const text = (place.textScore ?? 0) / maxTextScore;
      const { score, reasons } = scoreCandidate(
        {
          relevance: query.q ? blendRelevance(text, proximity) : proximity || place.signals.qualityScore,
          preferenceMatch: preferenceMatch(
            { categorySlugs: place.categorySlugs, ownership: place.ownership, signals: place.signals },
            prefs,
          ),
          quality: place.signals.qualityScore,
          authenticity: place.signals.authenticityScore,
          localOwnership: place.signals.localOwnership,
          freshness: freshness(place.signals.lastVerifiedAt, config.params.freshnessHalfLifeDays),
          uniqueness: place.signals.uniquenessScore,
          popularity: place.signals.popularityScore,
          crowd: place.signals.crowdLevel,
        },
        config.weights,
      );
      return { place, score, reasons };
    });
  }

  private applySort(
    ranked: { place: PlaceCandidate; score: number; reasons: string[] }[],
    sort: SearchQuery['sort'],
  ) {
    const copy = [...ranked];
    switch (sort) {
      case 'nearest':
        return copy.sort((a, b) => (a.place.distanceKm ?? 1e9) - (b.place.distanceKm ?? 1e9));
      case 'rating':
        return copy.sort((a, b) => b.place.signals.ratingAvg - a.place.signals.ratingAvg);
      case 'newest':
        return copy.sort((a, b) => b.place.createdAt.getTime() - a.place.createdAt.getTime());
      case 'quietest':
        return copy.sort((a, b) => a.place.signals.crowdLevel - b.place.signals.crowdLevel);
      default:
        return copy.sort((a, b) => b.score - a.score);
    }
  }

  private async loadPreferences(actor: DiscoveryActor): Promise<UserPreferences | null> {
    if (!actor.userId) return null;
    return this.users.findPreferences(actor.userId);
  }
}
