import { type PlaceSeed } from './place-types';

/**
 * Desert country — the Thar in Rajasthan, the salt deserts of Kutch, and the
 * cold desert of Ladakh and Spiti.
 *
 * Every entry is a real place. Coordinates are real-world approximations good
 * enough for map and geo-query behaviour, not survey-grade.
 */
export const PLACES_DESERT: PlaceSeed[] = [
  // --- Thar, Rajasthan -----------------------------------------------------
  {
    slug: 'khuri-dunes',
    title: 'Khuri Dunes',
    summary: 'Village-run dune camping 40 km from Jaisalmer, without the Sam circus.',
    description:
      'Khuri sits inside the Desert National Park buffer and has real dunes with a village of mud-and-thatch houses beside them. Families run their own camps and camel trips, which is the difference from Sam, where the operation is large, loud and mostly owned from town. The dunes are smaller here and nobody is running a generator.',
    categorySlugs: ['desert', 'village-stay', 'homestay'],
    lng: 70.7833, lat: 26.65, city: 'Khuri', district: 'Jaisalmer', state: 'Rajasthan',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 720, amenities: ['Village-run camps', 'Camel safaris', 'Folk music evenings'],
    tips: ['Book with a Khuri family, not a Jaisalmer agent', 'Winter nights in the dunes drop close to freezing'],
    quality: 0.82, authenticity: 0.9, localOwnership: 0.92, uniqueness: 0.8,
    popularity: 0.3, crowd: 0.25, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'kuldhara-abandoned-village',
    title: 'Kuldhara',
    summary: 'A Paliwal Brahmin village abandoned overnight in the 1820s and never reoccupied.',
    description:
      'Kuldhara was one of eighty-four Paliwal villages that emptied in a single night, the usual telling blaming a minister\'s demand for a village girl. The stone houses, street grid and stepwells are still laid out on the sand. The Paliwal were sophisticated dryland farmers, and the water harvesting around the site is the more interesting story.',
    categorySlugs: ['desert', 'heritage', 'walk'],
    lng: 70.8333, lat: 26.7833, city: 'Kuldhara', district: 'Jaisalmer', state: 'Rajasthan',
    ownership: 'GOVERNMENT', entryFeeMinor: 2000, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 120, amenities: ['Ticket counter', 'Restored house', 'Marked lanes'],
    tips: ['Go early, there is no shade anywhere on the site', 'Skip the ghost-story guides and look at the water systems'],
    quality: 0.8, authenticity: 0.85, localOwnership: 0.35, uniqueness: 0.9,
    popularity: 0.45, crowd: 0.4, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'desert-national-park-sudasari',
    title: 'Desert National Park, Sudasari',
    summary: 'One of the last strongholds of the great Indian bustard, in Thar scrub and sand.',
    description:
      'Sudasari is the enclosure inside Desert National Park where great Indian bustards are most reliably seen — the species is down to roughly a hundred and fifty birds in the wild, most of them in this landscape. Power lines across the desert are the main killer. Chinkara, desert fox and a long raptor list come with it.',
    categorySlugs: ['desert', 'wildlife', 'birding'],
    lng: 70.8, lat: 26.8333, city: 'Sudasari', district: 'Jaisalmer', state: 'Rajasthan',
    ownership: 'GOVERNMENT', entryFeeMinor: 30000, bestTimeMonths: [11, 12, 1, 2, 3],
    durationMin: 300, amenities: ['Jeep safari', 'Forest department guides'],
    tips: ['Permit and a forest guide are compulsory', 'Winter mornings are the only realistic bustard window'],
    quality: 0.88, authenticity: 0.9, localOwnership: 0.45, uniqueness: 0.95,
    popularity: 0.15, crowd: 0.12, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'osian-sand-dunes',
    title: 'Osian',
    summary: 'Eighth-century Jain and Hindu temples on the edge of the Thar, with dunes behind.',
    description:
      'Osian was a Gurjara-Pratihara trading town and has a cluster of temples from the 8th to 11th centuries — the Sachiya Mata temple is still in worship, and the Mahavira temple is one of the oldest Jain structures in Rajasthan. Dunes start just outside the town, so the temples and the desert are in the same afternoon.',
    categorySlugs: ['desert', 'heritage', 'ritual'],
    lng: 72.9167, lat: 26.7167, city: 'Osian', district: 'Jodhpur', state: 'Rajasthan',
    ownership: 'GOVERNMENT', entryFeeMinor: 0, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 240, amenities: ['Temples', 'Desert camps', 'Camel rides'],
    tips: ['An hour from Jodhpur, easy day trip with the dunes at sunset', 'The Mahavira temple carving is the best of the group'],
    quality: 0.8, authenticity: 0.82, localOwnership: 0.6, uniqueness: 0.82,
    popularity: 0.35, crowd: 0.35, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'barmer-ajrakh-and-wood-carving',
    title: 'Barmer Craft Villages',
    summary: 'Ajrakh printing, applique and carved wood in villages across the western Thar.',
    description:
      'Barmer district holds several distinct craft traditions — ajrakh resist printing at Balotra, patchwork and applique, and the carved wooden furniture Barmer town is known for. The villages are spread widely across dry country and the crafts are household trades rather than showroom operations.',
    categorySlugs: ['desert', 'craft', 'village-stay'],
    lng: 71.3833, lat: 25.75, city: 'Barmer', district: 'Barmer', state: 'Rajasthan',
    ownership: 'LOCAL_OWNED', entryFeeMinor: 0, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 300, amenities: ['Workshop visits', 'Direct sales'],
    tips: ['Villages are far apart, plan a full day with a car', 'Natural-dye ajrakh smells of the process; chemical prints do not'],
    quality: 0.78, authenticity: 0.92, localOwnership: 0.92, uniqueness: 0.85,
    popularity: 0.08, crowd: 0.08, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'tanot-mata-longewala',
    title: 'Tanot and Longewala',
    summary: 'A border temple that survived the bombing, and the 1971 battlefield beside it.',
    description:
      'Tanot Mata temple sits near the Pakistan border and is maintained by the BSF; unexploded shells dropped around it in 1965 are displayed inside. Longewala nearby is where a small Indian post held off an armoured advance in December 1971. The drive out crosses genuine empty Thar.',
    categorySlugs: ['desert', 'heritage', 'ritual'],
    lng: 70.3833, lat: 27.7667, city: 'Tanot', district: 'Jaisalmer', state: 'Rajasthan',
    ownership: 'GOVERNMENT', entryFeeMinor: 0, bestTimeMonths: [10, 11, 12, 1, 2],
    durationMin: 360, amenities: ['BSF-run temple', 'War memorial museum'],
    tips: ['Carry ID, there are checkpoints on the border road', 'No fuel for long stretches, fill up in Jaisalmer'],
    quality: 0.76, authenticity: 0.85, localOwnership: 0.4, uniqueness: 0.85,
    popularity: 0.3, crowd: 0.3, destinationSlug: null, guideKey: null,
  },

  // --- Kutch, Gujarat ------------------------------------------------------
  {
    slug: 'dholavira-harappan-city',
    title: 'Dholavira',
    summary: 'A Harappan city on an island in the Rann, with the earliest known signboard.',
    description:
      'Dholavira sits on Khadir bet and was one of the largest Harappan cities, laid out in a citadel, middle town and lower town with an extraordinary system of stone reservoirs cut into the rock. A ten-character inscription in large letters was found fallen at a gateway — the oldest signboard anyone knows of. The white Rann surrounds it.',
    categorySlugs: ['desert', 'heritage', 'walk'],
    lng: 70.2167, lat: 23.8833, city: 'Dholavira', district: 'Kutch', state: 'Gujarat',
    ownership: 'GOVERNMENT', entryFeeMinor: 4000, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 240, amenities: ['Ticket counter', 'Museum', 'Road across the Rann'],
    tips: ['The road in across the salt flat is worth the drive by itself', 'No shade on site, carry water and go early'],
    quality: 0.9, authenticity: 0.88, localOwnership: 0.3, uniqueness: 0.95,
    popularity: 0.3, crowd: 0.25, destinationSlug: 'kutch', guideKey: 'guide-jaydev',
  },
  {
    slug: 'banni-grasslands-chhari-dhand',
    title: 'Banni Grasslands and Chhari Dhand',
    summary: 'The largest grassland in the subcontinent, with a seasonal wetland full of raptors.',
    description:
      'Banni is around 2,500 square kilometres of saline grassland grazed by Maldhari pastoralists and their Banni buffalo, a breed developed for exactly this ground. Chhari Dhand, a shallow seasonal wetland at its edge, draws flamingo, cranes and one of the densest raptor congregations in India in winter.',
    categorySlugs: ['desert', 'birding', 'wildlife', 'village-stay'],
    lng: 69.7833, lat: 23.7833, city: 'Bhirandiyara', district: 'Kutch', state: 'Gujarat',
    ownership: 'COMMUNITY', entryFeeMinor: 10000, bestTimeMonths: [11, 12, 1, 2, 3],
    durationMin: 300, amenities: ['Local naturalists', 'Maldhari homestays', 'Bhunga stays'],
    tips: ['Chhari Dhand only holds water after a decent monsoon, check before going', 'Go with a Maldhari guide, the grassland is trackless'],
    quality: 0.88, authenticity: 0.92, localOwnership: 0.85, uniqueness: 0.92,
    popularity: 0.18, crowd: 0.15, destinationSlug: 'kutch', guideKey: 'guide-jaydev',
  },
  {
    slug: 'white-rann-dhordo',
    title: 'White Rann at Dhordo',
    summary: 'A salt flat that goes to the horizon in every direction after the water dries.',
    description:
      'The Great Rann floods in the monsoon and dries to a salt crust from about November, leaving a white plain with no features at all. Full-moon nights are the reason to time a visit. The Rann Utsav tent city at Dhordo is a large commercial operation; the Banni villages a short drive away are not.',
    categorySlugs: ['desert', 'walk'],
    lng: 69.65, lat: 23.85, city: 'Dhordo', district: 'Kutch', state: 'Gujarat',
    ownership: 'GOVERNMENT', entryFeeMinor: 10000, bestTimeMonths: [11, 12, 1, 2],
    durationMin: 180, amenities: ['Permit checkpoint', 'Tent city in season', 'Camel carts'],
    tips: ['Permit required at Bhirandiyara, carry ID', 'Full moon nights are extraordinary and also the busiest'],
    quality: 0.85, authenticity: 0.6, localOwnership: 0.4, uniqueness: 0.95,
    popularity: 0.7, crowd: 0.7, destinationSlug: 'kutch', guideKey: 'guide-jaydev',
  },

  // --- Cold desert ---------------------------------------------------------
  {
    slug: 'hunder-nubra-dunes',
    title: 'Hunder Dunes, Nubra',
    summary: 'Sand dunes at 3,000 metres, with double-humped Bactrian camels on them.',
    description:
      'The Shyok valley at Hunder has genuine sand dunes surrounded by 6,000 m peaks, which is an odd thing to stand in. The Bactrian camels here descend from Silk Road caravan stock that stayed after the trade routes closed. Nubra is reached over Khardung La and needs an inner line permit.',
    categorySlugs: ['desert', 'mountain', 'village-stay'],
    lng: 77.5, lat: 34.5833, city: 'Hunder', district: 'Leh', state: 'Ladakh',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [5, 6, 7, 8, 9],
    durationMin: 240, amenities: ['Camel rides', 'Guesthouses', 'Camps'],
    tips: ['Inner Line Permit required, arrange in Leh', 'Camel rides are short and fixed-rate, agree before mounting'],
    quality: 0.8, authenticity: 0.7, localOwnership: 0.75, uniqueness: 0.9,
    popularity: 0.6, crowd: 0.55, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'tso-moriri-korzok',
    title: 'Tso Moriri and Korzok',
    summary: 'A high-altitude lake at 4,500 m, with a Changpa nomad settlement on its shore.',
    description:
      'Tso Moriri is a brackish lake in Changthang, a designated Ramsar wetland where bar-headed geese and black-necked cranes breed. Korzok village on the shore is one of the highest permanent settlements anywhere and the Changpa graze pashmina goats around it. Camping on the shoreline is now restricted to protect the breeding birds.',
    categorySlugs: ['desert', 'lake', 'village-stay', 'birding'],
    lng: 78.3, lat: 32.9, city: 'Korzok', district: 'Leh', state: 'Ladakh',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [6, 7, 8, 9],
    durationMin: 720, amenities: ['Homestays in Korzok', 'Monastery', 'Permit checkpoint'],
    tips: ['Inner Line Permit required; acclimatise before coming up to 4,500 m', 'Do not camp on the shoreline, the cranes nest there'],
    quality: 0.9, authenticity: 0.88, localOwnership: 0.8, uniqueness: 0.95,
    popularity: 0.35, crowd: 0.25, destinationSlug: null, guideKey: null,
  },
  {
    slug: 'kibber-spiti-snow-leopard',
    title: 'Kibber, Spiti',
    summary: 'A cold-desert village at 4,200 m, and the best odds anywhere of a wild snow leopard.',
    description:
      'Kibber sits above the Spiti river with a wildlife sanctuary behind it, and the winter snow leopard tracking here — done on foot with village spotters, in February temperatures around minus twenty — has the highest success rate of anywhere in the world. Homestays run on a rotation, and the income has changed how the village sees the cat.',
    categorySlugs: ['desert', 'wildlife', 'village-stay', 'mountain'],
    lng: 78.0111, lat: 32.3333, city: 'Kibber', district: 'Lahaul and Spiti', state: 'Himachal Pradesh',
    ownership: 'COMMUNITY', entryFeeMinor: 0, bestTimeMonths: [1, 2, 3, 6, 7, 8, 9],
    durationMin: 1440, amenities: ['Homestay rotation', 'Village spotters', 'Sanctuary access'],
    tips: ['Snow leopard season is January to March and it is genuinely brutal cold', 'Use village spotters and homestays — that is what keeps the cat alive here'],
    quality: 0.9, authenticity: 0.95, localOwnership: 0.95, uniqueness: 0.96,
    popularity: 0.3, crowd: 0.2, destinationSlug: 'spiti-valley', guideKey: 'guide-tenzin',
  },
];