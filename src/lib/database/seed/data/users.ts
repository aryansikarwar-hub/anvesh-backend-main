/**
 * Seed accounts. The shared development password is deliberately obvious and
 * the seeder refuses to run when NODE_ENV=production.
 */
export const SEED_PASSWORD = 'Anvesh@Dev2026';

export interface TravellerSeed {
  key: string;
  email: string;
  displayName: string;
  city: string;
  state: string;
  interests: string[];
  travelStyles: string[];
  budgetBand: 'LOW' | 'MID' | 'HIGH';
  crowdTolerance: number;
  prefersLocalOwned: boolean;
  languages: string[];
}

export const TRAVELLER_SEEDS: TravellerSeed[] = [
  { key: 'aarav', email: 'aarav.mehta@example.in', displayName: 'Aarav Mehta', city: 'Pune', state: 'Maharashtra', interests: ['trek', 'waterfall', 'monsoon', 'mountain'], travelStyles: ['slow', 'outdoors'], budgetBand: 'MID', crowdTolerance: 0.15, prefersLocalOwned: true, languages: ['en', 'hi', 'mr'] },
  { key: 'ananya', email: 'ananya.iyer@example.in', displayName: 'Ananya Iyer', city: 'Bengaluru', state: 'Karnataka', interests: ['craft', 'heritage', 'local-food', 'walk'], travelStyles: ['culture', 'weekend'], budgetBand: 'HIGH', crowdTolerance: 0.35, prefersLocalOwned: true, languages: ['en', 'ta', 'kn'] },
  { key: 'ishaan', email: 'ishaan.roy@example.in', displayName: 'Ishaan Roy', city: 'Kolkata', state: 'West Bengal', interests: ['wildlife', 'birding', 'lake'], travelStyles: ['photography'], budgetBand: 'MID', crowdTolerance: 0.2, prefersLocalOwned: true, languages: ['en', 'bn', 'hi'] },
  { key: 'zoya', email: 'zoya.khan@example.in', displayName: 'Zoya Khan', city: 'Hyderabad', state: 'Telangana', interests: ['local-food', 'market', 'cafe'], travelStyles: ['food', 'city'], budgetBand: 'LOW', crowdTolerance: 0.55, prefersLocalOwned: true, languages: ['en', 'hi', 'ur'] },
  { key: 'kabir', email: 'kabir.singh@example.in', displayName: 'Kabir Singh', city: 'Chandigarh', state: 'Punjab', interests: ['mountain', 'village-stay', 'trek'], travelStyles: ['slow', 'solo'], budgetBand: 'LOW', crowdTolerance: 0.1, prefersLocalOwned: true, languages: ['en', 'hi', 'pa'] },
  { key: 'maya', email: 'maya.dsouza@example.in', displayName: 'Maya D Souza', city: 'Panaji', state: 'Goa', interests: ['beach', 'heritage', 'cafe'], travelStyles: ['weekend'], budgetBand: 'MID', crowdTolerance: 0.4, prefersLocalOwned: false, languages: ['en', 'kok'] },
];

export interface GuideSeed {
  key: string;
  email: string;
  displayName: string;
  slug: string;
  headline: string;
  bio: string;
  baseCity: string;
  baseState: string;
  languages: string[];
  specialities: string[];
  yearsExperience: number;
  verified: boolean;
}

export const GUIDE_SEEDS: GuideSeed[] = [
  {
    key: 'guide-shreya', email: 'shreya.kodagu@example.in', displayName: 'Shreya Ponnappa', slug: 'shreya-ponnappa',
    headline: 'Western Ghats treks out of Kodagu and Dakshina Kannada',
    bio: 'I grew up on a coffee estate near Kakkabe and have been walking the Ghats since school. I run small groups only, handle forest permits, and will call off a trek when the weather says so.',
    baseCity: 'Madikeri', baseState: 'Karnataka', languages: ['en', 'kn', 'hi'], specialities: ['trek', 'waterfall', 'monsoon'], yearsExperience: 11, verified: true,
  },
  {
    key: 'guide-meenakshi', email: 'meenakshi.chettinad@example.in', displayName: 'Meenakshi Alagappan', slug: 'meenakshi-alagappan',
    headline: 'Chettinad mansions, tile workshops and household kitchens',
    bio: 'My family has been in Kanadukathan for four generations. I open doors that are otherwise shut, and I cook the Chettinad food people think they have already eaten.',
    baseCity: 'Karaikudi', baseState: 'Tamil Nadu', languages: ['en', 'ta'], specialities: ['heritage', 'craft', 'local-food'], yearsExperience: 8, verified: true,
  },
  {
    key: 'guide-tenzin', email: 'tenzin.spiti@example.in', displayName: 'Tenzin Norbu', slug: 'tenzin-norbu',
    headline: 'Spiti homestay circuits and high-altitude village walks',
    bio: 'I am from Demul and I help run our village homestay rotation. I plan Spiti trips around acclimatisation first and photographs second.',
    baseCity: 'Kaza', baseState: 'Himachal Pradesh', languages: ['en', 'hi', 'bo'], specialities: ['village-stay', 'mountain', 'trek'], yearsExperience: 9, verified: true,
  },
  {
    key: 'guide-jaydev', email: 'jaydev.kutch@example.in', displayName: 'Jaydev Rabari', slug: 'jaydev-rabari',
    headline: 'Kutch craft villages, with the makers rather than the showrooms',
    bio: 'I work with Rogan, Ajrakh and copper-bell families across Banni. Every visit I run buys directly from the artisan household, never through a Bhuj middleman.',
    baseCity: 'Bhuj', baseState: 'Gujarat', languages: ['en', 'gu', 'hi'], specialities: ['craft', 'village-stay', 'desert'], yearsExperience: 13, verified: true,
  },
  {
    key: 'guide-bhaskar', email: 'bhaskar.majuli@example.in', displayName: 'Bhaskar Pegu', slug: 'bhaskar-pegu',
    headline: 'Majuli satras, Mishing villages and Brahmaputra ferries',
    bio: 'Majuli is home. I take people to the satras that still teach, not the ones that only perform, and I will always put you in a chang ghar rather than a hotel.',
    baseCity: 'Majuli', baseState: 'Assam', languages: ['en', 'as', 'hi'], specialities: ['heritage', 'village-stay', 'craft'], yearsExperience: 7, verified: true,
  },
  {
    key: 'guide-aditi', email: 'aditi.sahyadri@example.in', displayName: 'Aditi Deshmukh', slug: 'aditi-deshmukh',
    headline: 'Sahyadri forts and Melghat forest walks',
    bio: 'Fifteen years on Sahyadri routes and a wildlife guiding certification for Melghat. I cap group size at eight and I do not run the popular forts on weekends.',
    baseCity: 'Pune', baseState: 'Maharashtra', languages: ['en', 'mr', 'hi'], specialities: ['trek', 'wildlife', 'monsoon'], yearsExperience: 15, verified: true,
  },
  {
    key: 'guide-fahad', email: 'fahad.malabar@example.in', displayName: 'Fahad Rahman', slug: 'fahad-rahman',
    headline: 'Malabar food walks from Thalassery to Kannur',
    bio: 'I cook, so my walks follow the fish rather than a fixed list of stops. Expect four kitchens, one market and no restaurant with a printed English menu.',
    baseCity: 'Thalassery', baseState: 'Kerala', languages: ['en', 'ml', 'hi'], specialities: ['local-food', 'market', 'walk'], yearsExperience: 6, verified: true,
  },
  {
    key: 'guide-vikram', email: 'vikram.bundi@example.in', displayName: 'Vikram Rathore', slug: 'vikram-rathore',
    headline: 'Bundi stepwells, Shekhawati frescoes and Jawai leopard country',
    bio: 'I read Rajasthani wall painting for a living and got into leopard tracking through the Rabari families at Jawai. Small vehicles, early starts, no baiting.',
    baseCity: 'Bundi', baseState: 'Rajasthan', languages: ['en', 'hi', 'mr'], specialities: ['heritage', 'craft', 'wildlife'], yearsExperience: 12, verified: true,
  },
  {
    key: 'guide-tashi', email: 'tashi.northeast@example.in', displayName: 'Tashi Wangchu', slug: 'tashi-wangchu',
    headline: 'Ziro, Dzukou and the Khasi hills, permits included',
    bio: 'I handle Inner Line Permits and village protocols across Arunachal, Nagaland and Meghalaya. Where a village asks for no photographs, we take none.',
    baseCity: 'Itanagar', baseState: 'Arunachal Pradesh', languages: ['en', 'hi', 'as'], specialities: ['trek', 'village-stay', 'heritage'], yearsExperience: 10, verified: true,
  },
  {
    key: 'guide-pema', email: 'pema.darjeeling@example.in', displayName: 'Pema Sherpa', slug: 'pema-sherpa',
    headline: 'Singalila ridge treks and quiet Darjeeling forest stays',
    bio: 'Registered Singalila National Park guide. I run the ridge in shoulder season when the light is better and the huts are half empty.',
    baseCity: 'Darjeeling', baseState: 'West Bengal', languages: ['en', 'ne', 'hi'], specialities: ['trek', 'mountain', 'birding'], yearsExperience: 14, verified: true,
  },
];

export const ADMIN_SEEDS = [
  { key: 'root', email: 'root@anvesh.travel', displayName: 'Anvesh Root', role: 'SUPER_ADMIN' as const },
  { key: 'moderator', email: 'moderator@anvesh.travel', displayName: 'Content Moderator', role: 'MODERATOR' as const },
];
