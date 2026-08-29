import { type PlaceSeed } from './place-types';

/**
 * Coordinates are real-world approximations good enough for map and geo-query
 * behaviour. They are not survey-grade and should be corrected against an
 * authoritative source before any production launch (see README).
 */
export const PLACES_SOUTH: PlaceSeed[] = [
  {
    slug: 'bandaje-arbi-falls',
    title: 'Bandaje Arbi Falls',
    summary: 'A long forest trek from Ujire ending at a wide falls on the Ghat edge.',
    description:
      'Bandaje Arbi drops off the escarpment between Dakshina Kannada and Chikkamagaluru. The approach is a full-day trek from Ujire through shola forest and grassland, and the last stretch is exposed. Forest department permission is required and local guides handle it as part of the walk.',
    categorySlugs: ['waterfall', 'trek', 'monsoon'],
    lng: 75.3562, lat: 12.9908, city: 'Ujire', district: 'Dakshina Kannada', state: 'Karnataka',
    ownership: 'GOVERNMENT', entryFeeMinor: 30000, bestTimeMonths: [10, 11, 12, 1],
    durationMin: 480, amenities: ['Guide required', 'Forest permit'],
    tips: ['Start before 6 am, the ridge has no shade', 'Leeches from June to September'],
    quality: 0.86, authenticity: 0.9, localOwnership: 0.8, uniqueness: 0.85,
    popularity: 0.22, crowd: 0.15, destinationSlug: null, guideKey: 'guide-shreya',
  },
  {
    slug: 'kotebetta-ridge',
    title: 'Kotebetta Ridge',
    summary: 'Coorg grassland climb with a shrine at the top and no ticket counter.',
    description:
      'Kotebetta is the third highest peak in Kodagu, reached from Hattihole near Madikeri. The route crosses estate land and grassland, and the summit shrine is still used, so shoes come off at the last stretch.',
    categorySlugs: ['trek', 'mountain'],
    lng: 75.6889, lat: 12.4986, city: 'Madikeri', district: 'Kodagu', state: 'Karnataka',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 300, amenities: ['Local guide', 'Parking at base'],
    tips: ['Ask before crossing estate land', 'Carry all water, none on route'],
    quality: 0.82, authenticity: 0.85, localOwnership: 0.9, uniqueness: 0.7,
    popularity: 0.3, crowd: 0.25, destinationSlug: 'coorg-kodagu', guideKey: 'guide-shreya',
  },
  {
    slug: 'nalknad-palace',
    title: 'Nalknad Palace',
    summary: 'A small 18th-century Kodava palace at the foot of Tadiandamol.',
    description:
      'Nalknad Aramane was built by the Haleri kings and is the last surviving palace of its kind in Kodagu. The painted wooden interiors are modest by Rajput standards and all the better for it. It sits at Yavakapadi near Kakkabe.',
    categorySlugs: ['heritage'],
    lng: 75.7011, lat: 12.2408, city: 'Kakkabe', district: 'Kodagu', state: 'Karnataka',
    ownership: 'GOVERNMENT', entryFeeMinor: 2000, bestTimeMonths: [10, 11, 12, 1, 2, 3],
    durationMin: 60, amenities: ['Caretaker on site'],
    tips: ['Combine with the Tadiandamol trailhead nearby'],
    quality: 0.78, authenticity: 0.88, localOwnership: 0.4, uniqueness: 0.75,
    popularity: 0.18, crowd: 0.12, destinationSlug: 'coorg-kodagu', guideKey: null,
  },
  {
    slug: 'paradise-beach-gokarna',
    title: 'Paradise Beach, Gokarna',
    summary: 'The last cove on the cliff path, reachable on foot or by small boat.',
    description:
      'Paradise is the fourth cove south of Gokarna town, past Kudle, Om and Half Moon. There is no road; you walk the headland path or take a boat from Om Beach. Facilities are minimal by design and change every season.',
    categorySlugs: ['beach', 'trek'],
    lng: 74.3078, lat: 14.5063, city: 'Gokarna', district: 'Uttara Kannada', state: 'Karnataka',
    ownership: 'UNKNOWN', entryFeeMinor: 0, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 240, amenities: ['Boat access', 'Cliff path'],
    tips: ['Last boat back leaves earlier than you think', 'No ATM past Gokarna town'],
    quality: 0.79, authenticity: 0.7, localOwnership: 0.6, uniqueness: 0.72,
    popularity: 0.55, crowd: 0.5, destinationSlug: 'gokarna-coast', guideKey: null,
  },
  {
    slug: 'athangudi-tile-workshop',
    title: 'Athangudi Tile Workshops',
    summary: 'Handmade cement tiles pressed one at a time, in the village that named them.',
    description:
      'Athangudi tiles are made on glass plates with local sand and coloured cement, one tile per mould, then cured in the shade. Several family units around Athangudi let visitors watch the whole cycle and most will sell direct.',
    categorySlugs: ['craft', 'heritage'],
    lng: 78.7208, lat: 10.1417, city: 'Athangudi', district: 'Sivaganga', state: 'Tamil Nadu',
    ownership: 'LOCAL_OWNED', entryFeeMinor: 0, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 90, amenities: ['Workshop visit', 'Direct purchase'],
    tips: ['Mornings are when the pressing happens', 'Shipping is arranged locally, not online'],
    quality: 0.84, authenticity: 0.95, localOwnership: 1, uniqueness: 0.88,
    popularity: 0.2, crowd: 0.15, destinationSlug: 'chettinad', guideKey: 'guide-meenakshi',
  },
  {
    slug: 'kanadukathan-mansion-lane',
    title: 'Kanadukathan Mansion Lane',
    summary: 'A street of Chettiar mansions where a few families still receive visitors.',
    description:
      'Kanadukathan has the densest surviving cluster of Nattukottai Chettiar mansions. Most are shuttered; a handful are lived in and a few open their courtyards on request. Burmese teak, Belgian glass and Athangudi floors in the same room is the point.',
    categorySlugs: ['heritage', 'walk'],
    lng: 78.7789, lat: 10.1653, city: 'Kanadukathan', district: 'Sivaganga', state: 'Tamil Nadu',
    ownership: 'LOCAL_OWNED', entryFeeMinor: 10000, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 150, amenities: ['Guided access', 'Photography allowed in some houses'],
    tips: ['Entry is by arrangement, not by turning up', 'Ask before photographing a lived-in house'],
    quality: 0.88, authenticity: 0.92, localOwnership: 0.95, uniqueness: 0.9,
    popularity: 0.28, crowd: 0.2, destinationSlug: 'chettinad', guideKey: 'guide-meenakshi',
  },
  {
    slug: 'kadalundi-bird-sanctuary',
    title: 'Kadalundi Community Reserve',
    summary: 'An estuary in Malabar where waders stop over between September and April.',
    description:
      'Kadalundi is where the river meets the Arabian Sea south of Kozhikode, and it is India first community reserve. Terns, plovers and whimbrels use the sandbars on passage; the light is best on an early falling tide.',
    categorySlugs: ['wildlife', 'birding', 'lake'],
    lng: 75.8272, lat: 11.1339, city: 'Kadalundi', district: 'Kozhikode', state: 'Kerala',
    ownership: 'COMMUNITY', entryFeeMinor: 5000, bestTimeMonths: [11, 12, 1, 2, 3],
    durationMin: 180, amenities: ['Boat hire', 'Local birding guide'],
    tips: ['Go on a falling tide', 'Binoculars are not available for hire on site'],
    quality: 0.81, authenticity: 0.86, localOwnership: 0.85, uniqueness: 0.78,
    popularity: 0.24, crowd: 0.18, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'thalassery-fish-market-kitchens',
    title: 'Thalassery Kitchens & Fish Market',
    summary: 'Malabar biryani, kalthappam and a morning market that sets the day menu.',
    description:
      'Thalassery cooking sits at the meeting point of Malabar, Arab and colonial kitchens. The morning fish landing decides what the small mess halls behind the market will serve by noon; the biryani here uses khaima rice, not basmati.',
    categorySlugs: ['local-food', 'market', 'walk'],
    lng: 75.4906, lat: 11.7481, city: 'Thalassery', district: 'Kannur', state: 'Kerala',
    ownership: 'LOCAL_OWNED', entryFeeMinor: 0, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 120, amenities: ['Walking route', 'Cash only at most stalls'],
    tips: ['Market is done by 9 am', 'Ask for the day catch, not the printed menu'],
    quality: 0.87, authenticity: 0.93, localOwnership: 1, uniqueness: 0.8,
    popularity: 0.35, crowd: 0.4, destinationSlug: null, guideKey: 'guide-fahad',
  },
  {
    slug: 'hampi-anegundi-north-bank',
    title: 'Anegundi, the north bank of Hampi',
    summary: 'The older settlement across the river, still farmed and still lived in.',
    description:
      'Anegundi predates Vijayanagara and sits across the Tungabhadra from the Hampi ruins. It is a working village with banana fields, a functioning fort gate and community-run stays, and it takes the overflow from the south bank without behaving like it.',
    categorySlugs: ['heritage', 'village-stay', 'walk'],
    lng: 76.4736, lat: 15.3486, city: 'Anegundi', district: 'Koppal', state: 'Karnataka',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 300, amenities: ['Coracle crossing', 'Community homestays', 'Cycle hire'],
    tips: ['The river crossing stops at dusk', 'Stay on the north bank to avoid the day crowd'],
    quality: 0.85, authenticity: 0.88, localOwnership: 0.9, uniqueness: 0.76,
    popularity: 0.42, crowd: 0.35, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'valparai-tea-road',
    title: 'Valparai Tea Road',
    summary: 'Forty hairpins into a plateau of tea, with lion-tailed macaques on the wires.',
    description:
      'The climb from Pollachi to Valparai crosses the Aliyar reservoir and forty numbered hairpins into Anamalai country. The plateau is working tea estate rather than resort land, and the forest fragments between divisions hold lion-tailed macaques and hornbills.',
    categorySlugs: ['mountain', 'wildlife', 'monsoon'],
    lng: 76.9554, lat: 10.3271, city: 'Valparai', district: 'Coimbatore', state: 'Tamil Nadu',
    ownership: 'UNKNOWN', entryFeeMinor: 0, bestTimeMonths: [9, 10, 11, 12, 1, 2],
    durationMin: 360, amenities: ['Fuel at Valparai only', 'Estate roads'],
    tips: ['Do not stop on hairpins to photograph macaques', 'Fill fuel in Pollachi'],
    quality: 0.83, authenticity: 0.8, localOwnership: 0.5, uniqueness: 0.74,
    popularity: 0.38, crowd: 0.3, destinationSlug: null, guideKey: null,
  },
];
