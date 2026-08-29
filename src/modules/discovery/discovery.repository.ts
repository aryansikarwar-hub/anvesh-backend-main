import { PlaceModel, type PlaceDocument } from '../../lib/database';
import { escapeRegExp } from '../../lib/shared';
import { type SearchQuery } from '../../lib/validation';

export interface CandidateFilter {
  categories?: string[];
  city?: string;
  state?: string;
  destinationId?: string;
  ownership?: string;
  maxCrowd?: number;
  minRating?: number;
  maxEntryFeeMinor?: number;
}

export type PlaceCandidate = PlaceDocument & { distanceKm?: number; textScore?: number };

/**
 * Discovery reads.
 *
 * Two rules hold everywhere in this file:
 *  - $geoNear is always the FIRST aggregation stage (MongoDB requires it), and
 *  - there is no $lookup: everything a card needs is already denormalised.
 */
export class DiscoveryRepository {
  private baseMatch(filter: CandidateFilter): Record<string, unknown> {
    const match: Record<string, unknown> = { status: 'PUBLISHED', deletedAt: null };
    if (filter.categories?.length) match.categorySlugs = { $in: filter.categories };
    if (filter.city) match['address.city'] = new RegExp(`^${escapeRegExp(filter.city)}$`, 'i');
    if (filter.state) match['address.state'] = new RegExp(`^${escapeRegExp(filter.state)}$`, 'i');
    if (filter.destinationId) match.destinationId = filter.destinationId;
    if (filter.ownership) match.ownership = filter.ownership;
    if (typeof filter.maxCrowd === 'number') match['signals.crowdLevel'] = { $lte: filter.maxCrowd };
    if (typeof filter.minRating === 'number') match['signals.ratingAvg'] = { $gte: filter.minRating };
    if (typeof filter.maxEntryFeeMinor === 'number') {
      match['details.entryFeeMinor'] = { $lte: filter.maxEntryFeeMinor };
    }
    return match;
  }

  /** Geo-first candidate fetch. Returns distanceKm on every document. */
  async findNear(
    lng: number,
    lat: number,
    radiusKm: number,
    filter: CandidateFilter,
    limit: number,
  ): Promise<PlaceCandidate[]> {
    return PlaceModel.aggregate<PlaceCandidate>([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: this.baseMatch(filter),
        },
      },
      { $limit: limit },
      { $addFields: { distanceKm: { $divide: ['$distanceMeters', 1000] } } },
      { $project: { distanceMeters: 0 } },
    ]).exec();
  }

  /** Text search. Mongo's textScore is normalised by the service, not here. */
  async findByText(
    text: string,
    filter: CandidateFilter,
    limit: number,
  ): Promise<PlaceCandidate[]> {
    return PlaceModel.aggregate<PlaceCandidate>([
      { $match: { ...this.baseMatch(filter), $text: { $search: text } } },
      { $addFields: { textScore: { $meta: 'textScore' } } },
      { $sort: { textScore: -1 } },
      { $limit: limit },
    ]).exec();
  }

  async findCandidates(filter: CandidateFilter, limit: number): Promise<PlaceCandidate[]> {
    return PlaceModel.find(this.baseMatch(filter))
      .sort({ discoveryScore: -1 })
      .limit(limit)
      .lean<PlaceCandidate[]>()
      .exec();
  }

  /** Bounding-box read for the map. Capped by the caller. */
  async findInBounds(
    box: { west: number; south: number; east: number; north: number },
    filter: CandidateFilter,
    limit: number,
  ): Promise<PlaceCandidate[]> {
    return PlaceModel.find({
      ...this.baseMatch(filter),
      location: {
        $geoWithin: {
          $box: [
            [box.west, box.south],
            [box.east, box.north],
          ],
        },
      },
    })
      .sort({ discoveryScore: -1 })
      .limit(limit)
      .lean<PlaceCandidate[]>()
      .exec();
  }

  async countMatching(filter: CandidateFilter): Promise<number> {
    return PlaceModel.countDocuments(this.baseMatch(filter)).exec();
  }

  toFilter(query: SearchQuery): CandidateFilter {
    return {
      ...(query.categories ? { categories: query.categories } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.destinationId ? { destinationId: query.destinationId } : {}),
      ...(query.ownership ? { ownership: query.ownership } : {}),
      ...(typeof query.maxCrowd === 'number' ? { maxCrowd: query.maxCrowd } : {}),
      ...(typeof query.minRating === 'number' ? { minRating: query.minRating } : {}),
      ...(typeof query.maxEntryFeeMinor === 'number'
        ? { maxEntryFeeMinor: query.maxEntryFeeMinor }
        : {}),
    };
  }
}
