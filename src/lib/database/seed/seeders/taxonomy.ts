import { CategoryModel, DestinationModel } from '../../models';
import { CATEGORY_SEEDS } from '../data/categories';
import { DESTINATION_SEEDS } from '../data/destinations';
import { seedId, type SeedContext } from '../context';

export async function seedCategories(ctx: SeedContext): Promise<void> {
  for (const c of CATEGORY_SEEDS) {
    await CategoryModel.updateOne(
      { _id: seedId(`category:${c.slug}`) },
      {
        $set: {
          slug: c.slug,
          name: c.name,
          description: c.description,
          icon: c.icon,
          parentSlug: c.parentSlug,
          sortOrder: c.sortOrder,
          deletedAt: null,
        },
        $setOnInsert: { placeCount: 0 },
      },
      { upsert: true },
    );
  }
  ctx.log(`categories: ${CATEGORY_SEEDS.length}`);
}

export async function seedDestinations(ctx: SeedContext): Promise<void> {
  for (const d of DESTINATION_SEEDS) {
    await DestinationModel.updateOne(
      { _id: seedId(`destination:${d.slug}`) },
      {
        $set: {
          slug: d.slug,
          name: d.name,
          state: d.state,
          summary: d.summary,
          description: d.description,
          heroImage: null,
          location: { type: 'Point', coordinates: [d.lng, d.lat] },
          bestMonths: d.bestMonths,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        $setOnInsert: { placeCount: 0 },
      },
      { upsert: true },
    );
  }
  ctx.log(`destinations: ${DESTINATION_SEEDS.length}`);
}
