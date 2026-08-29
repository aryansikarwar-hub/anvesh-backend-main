export interface ExperienceSeed {
  slug: string;
  title: string;
  summary: string;
  description: string;
  categorySlugs: string[];
  guideKey: string;
  placeSlug: string | null;
  durationMin: number;
  maxSeats: number;
  basePriceMinor: number;
  meetingLabel: string;
  lng: number;
  lat: number;
  city: string;
  district: string;
  state: string;
  languages: string[];
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: 'FLEXIBLE' | 'MODERATE' | 'STRICT';
}

export const EXPERIENCE_SEEDS: ExperienceSeed[] = [
  {
    slug: 'bandaje-arbi-day-trek', title: 'Bandaje Arbi day trek with forest permits',
    summary: 'Full-day guided trek from Ujire to the falls and back, permits handled.',
    description: 'We leave Ujire before first light, walk the estate track into shola forest, then climb the grassland ridge to the top of Bandaje Arbi. Forest department permission, one local guide per six walkers, and lunch packed by my neighbour are included. If the ridge is in cloud with lightning risk we turn back, and you get a full refund.',
    categorySlugs: ['trek', 'waterfall', 'monsoon'], guideKey: 'guide-shreya', placeSlug: 'bandaje-arbi-falls',
    durationMin: 480, maxSeats: 8, basePriceMinor: 250000,
    meetingLabel: 'Ujire bus stand, opposite the temple gate',
    lng: 75.0664, lat: 12.9989, city: 'Ujire', district: 'Dakshina Kannada', state: 'Karnataka',
    languages: ['en', 'kn', 'hi'],
    inclusions: ['Forest permit', 'Local guide', 'Packed lunch', 'Water refills'],
    exclusions: ['Transport to Ujire', 'Personal gear'],
    cancellationPolicy: 'MODERATE',
  },
  {
    slug: 'kanadukathan-mansion-and-kitchen', title: 'Chettinad mansion walk and a family lunch',
    summary: 'Three lived-in mansions, an Athangudi tile yard, then lunch at my house.',
    description: 'A morning walk through Kanadukathan into houses that are still homes, with an hour at an Athangudi tile press to see the floors being made. We finish with a full Chettinad lunch on a banana leaf at my family house. Vegetarian and non-vegetarian menus both cooked; tell me at booking.',
    categorySlugs: ['heritage', 'craft', 'local-food'], guideKey: 'guide-meenakshi', placeSlug: 'kanadukathan-mansion-lane',
    durationMin: 300, maxSeats: 10, basePriceMinor: 320000,
    meetingLabel: 'Kanadukathan railway station forecourt',
    lng: 78.7789, lat: 10.1653, city: 'Kanadukathan', district: 'Sivaganga', state: 'Tamil Nadu',
    languages: ['en', 'ta'],
    inclusions: ['Mansion entries', 'Tile workshop visit', 'Full lunch'],
    exclusions: ['Hotel pickup', 'Purchases'],
    cancellationPolicy: 'FLEXIBLE',
  },
  {
    slug: 'spiti-village-rotation-4day', title: 'Spiti four-day village rotation',
    summary: 'Langza, Komic and Demul on foot, sleeping in the village rotation.',
    description: 'Four days walking between Spiti villages at 4,000 m and above, staying in whichever house the village rotation assigns. Day one is deliberately short for acclimatisation. Yaks carry the bags on the Demul leg. This is not a photography tour; some households ask for no photographs indoors and we respect that.',
    categorySlugs: ['village-stay', 'mountain', 'trek'], guideKey: 'guide-tenzin', placeSlug: 'demul-homestay-rotation',
    durationMin: 5760, maxSeats: 6, basePriceMinor: 1850000,
    meetingLabel: 'Kaza main bazaar, near the bus stand',
    lng: 78.0722, lat: 32.2261, city: 'Kaza', district: 'Lahaul and Spiti', state: 'Himachal Pradesh',
    languages: ['en', 'hi', 'bo'],
    inclusions: ['Homestay nights', 'All meals', 'Yak baggage transfer', 'Guide'],
    exclusions: ['Travel to Kaza', 'Travel insurance'],
    cancellationPolicy: 'STRICT',
  },
  {
    slug: 'kutch-craft-three-villages', title: 'Kutch craft day: Rogan, Ajrakh and copper bells',
    summary: 'Three villages, three lineages, buying direct from the workshop.',
    description: 'Nirona for Rogan painting and copper bells, Ajrakhpur for the natural-dye printing yards, and a Banni household for mud-mirror work. Everything you buy is paid directly to the artisan; I take no commission and will say so in front of them.',
    categorySlugs: ['craft', 'village-stay'], guideKey: 'guide-jaydev', placeSlug: 'nirona-rogan-art',
    durationMin: 480, maxSeats: 6, basePriceMinor: 450000,
    meetingLabel: 'Bhuj, ST bus stand main gate',
    lng: 69.6669, lat: 23.2419, city: 'Bhuj', district: 'Kutch', state: 'Gujarat',
    languages: ['en', 'gu', 'hi'],
    inclusions: ['Vehicle for the day', 'Workshop visits', 'Lunch in a Banni home'],
    exclusions: ['Craft purchases'],
    cancellationPolicy: 'MODERATE',
  },
  {
    slug: 'majuli-satra-and-mask-day', title: 'Majuli satras and the mask workshop',
    summary: 'Two working satras, the Samaguri mask studio and a Mishing lunch.',
    description: 'We take the morning ferry from Nimati Ghat and spend the day between Auniati and Samaguri satras, with time at the mask workshop while a piece is being built. Lunch is at a Mishing chang ghar. Ferry timings decide the schedule, not the other way round.',
    categorySlugs: ['heritage', 'craft', 'ritual'], guideKey: 'guide-bhaskar', placeSlug: 'samaguri-satra-mask-making',
    durationMin: 540, maxSeats: 8, basePriceMinor: 380000,
    meetingLabel: 'Nimati Ghat ferry ticket counter, Jorhat',
    lng: 94.2506, lat: 26.8433, city: 'Jorhat', district: 'Jorhat', state: 'Assam',
    languages: ['en', 'as', 'hi'],
    inclusions: ['Ferry tickets', 'Satra donations', 'Lunch', 'Island transport'],
    exclusions: ['Travel to Jorhat'],
    cancellationPolicy: 'MODERATE',
  },
  {
    slug: 'melghat-forest-two-night', title: 'Melghat two nights at Semadoh',
    summary: 'Teak forest walks and two safaris with Korku guides, no crowds.',
    description: 'Two nights at the forest rest house at Semadoh with morning and evening safaris and a guided walk on the Sipna river. Melghat is a hard reserve for sightings and I will not pretend otherwise; what it offers is forest, sloth bears and quiet.',
    categorySlugs: ['wildlife', 'trek', 'village-stay'], guideKey: 'guide-aditi', placeSlug: 'melghat-semadoh-ecotourism',
    durationMin: 2880, maxSeats: 6, basePriceMinor: 1450000,
    meetingLabel: 'Paratwada bus stand, Amravati district',
    lng: 77.7833, lat: 21.2667, city: 'Paratwada', district: 'Amravati', state: 'Maharashtra',
    languages: ['en', 'mr', 'hi'],
    inclusions: ['Rest house stay', 'All meals', 'Two safaris', 'Reserve fees'],
    exclusions: ['Travel to Paratwada', 'Camera fees'],
    cancellationPolicy: 'STRICT',
  },
  {
    slug: 'thalassery-morning-food-walk', title: 'Thalassery morning food walk',
    summary: 'Fish landing at dawn, four kitchens, and biryani made with khaima rice.',
    description: 'We start at the fish landing at 6 am, then walk the lanes behind the market through a halwa maker, a kalthappam kitchen, a tea shop that has not changed its stove in forty years, and finish over Thalassery biryani. Around eight tastings; come hungry.',
    categorySlugs: ['local-food', 'market', 'walk'], guideKey: 'guide-fahad', placeSlug: 'thalassery-fish-market-kitchens',
    durationMin: 210, maxSeats: 8, basePriceMinor: 180000,
    meetingLabel: 'Thalassery fishing harbour gate',
    lng: 75.4906, lat: 11.7481, city: 'Thalassery', district: 'Kannur', state: 'Kerala',
    languages: ['en', 'ml', 'hi'],
    inclusions: ['All tastings', 'Biryani lunch', 'Guide'],
    exclusions: ['Transport'],
    cancellationPolicy: 'FLEXIBLE',
  },
  {
    slug: 'bundi-stepwell-and-mural-walk', title: 'Bundi stepwells and the Chitrashala',
    summary: 'Four baoris and the palace mural gallery, read properly.',
    description: 'A half-day on foot through Raniji ki Baori, Nagar Sagar Kund and two smaller stepwells, then up to the Chitrashala where I explain the Bundi school: the blue-greens, the court scenes, and which panels were repainted.',
    categorySlugs: ['heritage', 'walk', 'craft'], guideKey: 'guide-vikram', placeSlug: 'raniji-ki-baori',
    durationMin: 240, maxSeats: 10, basePriceMinor: 160000,
    meetingLabel: 'Bundi, Rani ji ki Baori main gate',
    lng: 75.6403, lat: 25.4381, city: 'Bundi', district: 'Bundi', state: 'Rajasthan',
    languages: ['en', 'hi'],
    inclusions: ['Monument tickets', 'Guide'],
    exclusions: ['Transport', 'Refreshments'],
    cancellationPolicy: 'FLEXIBLE',
  },
  {
    slug: 'ziro-apatani-village-day', title: 'Ziro valley Apatani village day',
    summary: 'Hong and Hija on foot, rice-fish fields, bamboo groves, permits handled.',
    description: 'A walking day through two Apatani villages with time in the paddy-cum-fish fields and the clan bamboo groves. I arrange the Inner Line Permit in advance; send me your ID at booking. No photographs of elders without asking, every time.',
    categorySlugs: ['village-stay', 'heritage', 'walk'], guideKey: 'guide-tashi', placeSlug: 'hong-village-ziro',
    durationMin: 420, maxSeats: 8, basePriceMinor: 280000,
    meetingLabel: 'Hapoli market, Ziro',
    lng: 93.8331, lat: 27.5333, city: 'Ziro', district: 'Lower Subansiri', state: 'Arunachal Pradesh',
    languages: ['en', 'hi', 'as'],
    inclusions: ['Inner Line Permit assistance', 'Village fees', 'Lunch', 'Guide'],
    exclusions: ['Travel to Ziro', 'Permit government fee'],
    cancellationPolicy: 'MODERATE',
  },
  {
    slug: 'singalila-ridge-five-day', title: 'Singalila ridge five-day trek to Sandakphu',
    summary: 'Manebhanjan to Sandakphu and down to Sepi, in shoulder season.',
    description: 'Five days on the Singalila ridge with a registered park guide, staying in trekkers huts and village lodges. We go in late October or April when the huts are half full and the air is clear. Porter support included; group capped at eight.',
    categorySlugs: ['trek', 'mountain'], guideKey: 'guide-pema', placeSlug: 'sandakphu-ridge-walk',
    durationMin: 7200, maxSeats: 8, basePriceMinor: 2200000,
    meetingLabel: 'Manebhanjan, jeep stand',
    lng: 88.1275, lat: 27.0333, city: 'Manebhanjan', district: 'Darjeeling', state: 'West Bengal',
    languages: ['en', 'ne', 'hi'],
    inclusions: ['Park permits', 'Registered guide', 'Lodges', 'All meals', 'Porter support'],
    exclusions: ['Travel to Manebhanjan', 'Sleeping bag hire'],
    cancellationPolicy: 'STRICT',
  },
  {
    slug: 'harishchandragad-night-trek', title: 'Harishchandragad night trek to Konkan Kada',
    summary: 'Pachnai route by headlamp, sunrise over the cliff, group of eight.',
    description: 'We start the Pachnai route around 2 am to reach Konkan Kada for first light, then visit the Kedareshwar cave before descending. The easier of the routes, but still a proper night walk; headlamp compulsory, and I turn people back if the shoes are wrong.',
    categorySlugs: ['trek', 'mountain', 'monsoon'], guideKey: 'guide-aditi', placeSlug: 'harishchandragad-konkan-kada',
    durationMin: 720, maxSeats: 8, basePriceMinor: 195000,
    meetingLabel: 'Pachnai village, base of the trail',
    lng: 73.7897, lat: 19.3947, city: 'Pachnai', district: 'Ahmednagar', state: 'Maharashtra',
    languages: ['en', 'mr', 'hi'],
    inclusions: ['Guide', 'Breakfast at the top', 'First-aid kit'],
    exclusions: ['Transport to Pachnai', 'Headlamp'],
    cancellationPolicy: 'MODERATE',
  },
  {
    slug: 'kodagu-coffee-estate-walk', title: 'Kodagu coffee estate morning walk',
    summary: 'Arabica under shade trees, pepper vines, and a cup at the end.',
    description: 'A three-hour walk through a working estate near Kakkabe: shade trees, pepper vines, the drying yard, and the difference between what gets picked for export and what stays in the house. Ends with a filter coffee made from that year lot.',
    categorySlugs: ['walk', 'local-food', 'village-stay'], guideKey: 'guide-shreya', placeSlug: 'nalknad-palace',
    durationMin: 180, maxSeats: 12, basePriceMinor: 120000,
    meetingLabel: 'Kakkabe, Nalknad palace gate',
    lng: 75.7011, lat: 12.2408, city: 'Kakkabe', district: 'Kodagu', state: 'Karnataka',
    languages: ['en', 'kn', 'hi'],
    inclusions: ['Estate access', 'Coffee tasting', 'Guide'],
    exclusions: ['Transport'],
    cancellationPolicy: 'FLEXIBLE',
  },
];
