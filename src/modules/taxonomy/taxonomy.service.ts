import { CategoryModel, DestinationModel, PlaceModel } from '../../lib/database';
import { ERROR_CODES, type Category, type Destination } from '../../lib/types';
import { AppError } from '../../common/api-error';

/** Categories and destinations: small, cacheable, read-mostly reference data. */
export class TaxonomyService {
  async listCategories(): Promise<Category[]> {
    const docs = await CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean().exec();
    return docs.map((doc) => ({
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      icon: doc.icon,
      parentSlug: doc.parentSlug,
      sortOrder: doc.sortOrder,
    }));
  }

  async listDestinations(): Promise<Destination[]> {
    const docs = await DestinationModel.find({ status: 'PUBLISHED' }).sort({ name: 1 }).lean().exec();
    return docs.map(toDestination);
  }

  async getDestinationBySlug(slug: string): Promise<Destination> {
    const doc = await DestinationModel.findOne({ slug, status: 'PUBLISHED' }).lean().exec();
    if (!doc) throw new AppError(ERROR_CODES.DESTINATION_NOT_FOUND);
    // Kept accurate on read rather than trusting a counter that can drift.
    const placeCount = await PlaceModel.countDocuments({
      destinationId: doc._id,
      status: 'PUBLISHED',
    }).exec();
    return { ...toDestination(doc), placeCount };
  }
}

interface DestinationRow {
  _id: unknown;
  slug: string;
  name: string;
  state: string;
  summary: string;
  description: string;
  heroImage: Record<string, unknown> | null;
  location: { type: 'Point'; coordinates: [number, number] };
  bestMonths: number[];
  placeCount: number;
  status: Destination['status'];
}

function toDestination(doc: DestinationRow): Destination {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    state: doc.state,
    summary: doc.summary,
    description: doc.description,
    heroImage: doc.heroImage
      ? {
          key: String(doc.heroImage.key ?? ''),
          url: String(doc.heroImage.url ?? ''),
          width: Number(doc.heroImage.width ?? 0),
          height: Number(doc.heroImage.height ?? 0),
          alt: String(doc.heroImage.alt ?? doc.name),
        }
      : null,
    location: doc.location,
    bestMonths: doc.bestMonths,
    placeCount: doc.placeCount,
    status: doc.status,
  };
}
