export interface DestinationSeed {
  slug: string;
  name: string;
  state: string;
  summary: string;
  description: string;
  lng: number;
  lat: number;
  bestMonths: number[];
}

export const DESTINATION_SEEDS: DestinationSeed[] = [
  {
    slug: 'coorg-kodagu',
    name: 'Kodagu (Coorg)',
    state: 'Karnataka',
    summary: 'Coffee country in the Western Ghats, best just after the rains break.',
    description:
      'Kodagu is a hill district of coffee estates, pepper vines and small Kodava villages. Most visitors stay on the Madikeri strip; the district is far larger than that, and the quieter valleys around Kakkabe, Nalknad and Kotebetta hold most of what is worth the drive.',
    lng: 75.7382,
    lat: 12.3375,
    bestMonths: [9, 10, 11, 12, 1, 2],
  },
  {
    slug: 'spiti-valley',
    name: 'Spiti Valley',
    state: 'Himachal Pradesh',
    summary: 'A cold desert of monasteries, fossil beds and villages above 4,000 m.',
    description:
      'Spiti sits between Kinnaur and Ladakh, reachable over Kunzum La in summer and through Kinnaur most of the year. Villages such as Langza, Komic and Demul run homestay rotations so the income spreads instead of pooling at one guesthouse.',
    lng: 78.0413,
    lat: 32.2464,
    bestMonths: [6, 7, 8, 9],
  },
  {
    slug: 'majuli',
    name: 'Majuli',
    state: 'Assam',
    summary: 'A river island of satras, mask makers and shifting sandbars.',
    description:
      'Majuli is a large inhabited river island on the Brahmaputra, reached by ferry from Nimati Ghat near Jorhat. Its satras are living Vaishnavite monasteries; Samaguri satra is where the mask-making tradition is still taught.',
    lng: 94.1667,
    lat: 26.9,
    bestMonths: [11, 12, 1, 2, 3],
  },
  {
    slug: 'kutch',
    name: 'Kutch',
    state: 'Gujarat',
    summary: 'Salt flats, embroidery villages and a horizon with nothing on it.',
    description:
      'Kutch is craft country. Bhuj is the base; the villages north and west of it — Nirona, Ajrakhpur, Hodka, Khavda — each hold a distinct craft lineage. The Rann is at its most striking between November and February.',
    lng: 69.8597,
    lat: 23.7337,
    bestMonths: [11, 12, 1, 2],
  },
  {
    slug: 'ziro-valley',
    name: 'Ziro Valley',
    state: 'Arunachal Pradesh',
    summary: 'Apatani rice-fish fields ringed by pine ridges.',
    description:
      'Ziro is the home of the Apatani, whose valley-floor paddy fields raise fish alongside rice. The valley is quiet outside the September music festival, and the surrounding villages of Hong, Hija and Bamin Michi are walkable from one another.',
    lng: 93.8383,
    lat: 27.5448,
    bestMonths: [3, 4, 5, 9, 10, 11],
  },
  {
    slug: 'gokarna-coast',
    name: 'Gokarna Coast',
    state: 'Karnataka',
    summary: 'Temple town with a string of coves reachable only on foot.',
    description:
      'Gokarna is first a temple town and second a beach one. The coves south of the main beach — Kudle, Om, Half Moon, Paradise — are joined by a cliff path, and the further you walk the fewer people you meet.',
    lng: 74.3188,
    lat: 14.5479,
    bestMonths: [10, 11, 12, 1, 2],
  },
  {
    slug: 'chettinad',
    name: 'Chettinad',
    state: 'Tamil Nadu',
    summary: 'Merchant mansions, Athangudi tiles and a very specific kitchen.',
    description:
      'Chettinad is a cluster of villages around Karaikudi built by the Nattukottai Chettiar trading community. The mansions are private but several families host visitors, and the tile workshops at Athangudi still press by hand.',
    lng: 78.7739,
    lat: 10.0704,
    bestMonths: [11, 12, 1, 2],
  },
  {
    slug: 'bundi',
    name: 'Bundi',
    state: 'Rajasthan',
    summary: 'Stepwells and a palace of murals, an hour from a much busier town.',
    description:
      'Bundi sits below the Aravalli escarpment with a palace whose Chitrashala murals are among the best surviving Rajput wall paintings. Its stepwells — Raniji ki Baori chief among them — are why the town was built where it is.',
    lng: 75.6499,
    lat: 25.4305,
    bestMonths: [10, 11, 12, 1, 2],
  },
  {
    slug: 'chikhaldara-melghat',
    name: 'Chikhaldara & Melghat',
    state: 'Maharashtra',
    summary: 'Vidarbha hill country and a tiger reserve almost nobody queues for.',
    description:
      'Chikhaldara is the only hill station in Vidarbha, sitting above the Melghat Tiger Reserve. Melghat is a Korku-majority landscape and its community-run eco-camps are the way in.',
    lng: 77.3167,
    lat: 21.4,
    bestMonths: [10, 11, 12, 1, 2, 3],
  },
  {
    slug: 'sandakphu-singalila',
    name: 'Sandakphu & Singalila',
    state: 'West Bengal',
    summary: 'The ridge walk with four eight-thousanders on the skyline.',
    description:
      'The Singalila ridge runs along the Nepal border above Darjeeling. From Sandakphu, the highest point in West Bengal, the view takes in Kanchenjunga and, on a clear morning, Everest, Lhotse and Makalu.',
    lng: 88.0072,
    lat: 27.1039,
    bestMonths: [10, 11, 12, 3, 4, 5],
  },
];
