export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  parentSlug: string | null;
  sortOrder: number;
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  { slug: 'waterfall', name: 'Waterfalls', description: 'Monsoon-fed falls, plunge pools and cascades away from the tour-bus circuit.', icon: 'droplets', parentSlug: null, sortOrder: 10 },
  { slug: 'trek', name: 'Treks & Trails', description: 'Day hikes and forest trails, usually with a local guide who knows the weather.', icon: 'footprints', parentSlug: null, sortOrder: 20 },
  { slug: 'village-stay', name: 'Village Stays', description: 'Rooms in family homes where dinner is whatever the household is eating.', icon: 'home', parentSlug: null, sortOrder: 30 },
  { slug: 'homestay', name: 'Homestays', description: 'Small, owner-run places to sleep, usually four rooms or fewer.', icon: 'bed-double', parentSlug: null, sortOrder: 35 },
  { slug: 'local-food', name: 'Local Food', description: 'Kitchens, mess halls and carts that locals queue at, not review sites.', icon: 'utensils', parentSlug: null, sortOrder: 40 },
  { slug: 'heritage', name: 'Heritage', description: 'Stepwells, forts, temples and quarters that survived without ticket counters.', icon: 'landmark', parentSlug: null, sortOrder: 50 },
  { slug: 'craft', name: 'Crafts & Makers', description: 'Weavers, potters, brass workers and printers who still take visitors.', icon: 'hammer', parentSlug: null, sortOrder: 60 },
  { slug: 'wildlife', name: 'Wildlife & Forests', description: 'Community reserves, birding wetlands and lesser-known forest ranges.', icon: 'bird', parentSlug: null, sortOrder: 70 },
  { slug: 'beach', name: 'Quiet Beaches', description: 'Coves and shorelines that never got a shack row.', icon: 'waves', parentSlug: null, sortOrder: 80 },
  { slug: 'lake', name: 'Lakes & Backwaters', description: 'Still water, small boats, and mornings worth waking up for.', icon: 'sailboat', parentSlug: null, sortOrder: 90 },
  { slug: 'mountain', name: 'Mountains & Passes', description: 'High roads, meadows and ridgelines with room to breathe.', icon: 'mountain', parentSlug: null, sortOrder: 100 },
  { slug: 'desert', name: 'Desert & Dunes', description: 'Sand, scrub and the villages that read them.', icon: 'sun', parentSlug: null, sortOrder: 110 },
  { slug: 'ritual', name: 'Rituals & Festivals', description: 'Living traditions with a calendar, not a performance schedule.', icon: 'flame', parentSlug: null, sortOrder: 120 },
  { slug: 'market', name: 'Markets & Bazaars', description: 'Weekly haats and old trading lanes still doing business.', icon: 'store', parentSlug: null, sortOrder: 130 },
  { slug: 'cafe', name: 'Cafes & Chai', description: 'Small, independent, usually one family deep.', icon: 'coffee', parentSlug: null, sortOrder: 140 },
  { slug: 'walk', name: 'City Walks', description: 'Neighbourhood routes led by people who live on them.', icon: 'map', parentSlug: null, sortOrder: 150 },
  { slug: 'monsoon', name: 'Monsoon Escapes', description: 'Places that are at their best when everything is wet.', icon: 'cloud-rain', parentSlug: 'waterfall', sortOrder: 160 },
  { slug: 'birding', name: 'Birding', description: 'Wetlands, grasslands and scrub with real checklists.', icon: 'binoculars', parentSlug: 'wildlife', sortOrder: 170 },
];
