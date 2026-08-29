import { PlaceModel, ReviewModel, UserModel } from '../../models';
import { seedId, type SeedContext } from '../context';
import { type SeededPeople } from './people';

interface ReviewSeed {
  placeSlug: string;
  travellerKey: string;
  rating: number;
  title: string;
  body: string;
  crowdFelt: number;
}

const REVIEW_SEEDS: ReviewSeed[] = [
  { placeSlug: 'bandaje-arbi-falls', travellerKey: 'aarav', rating: 5, title: 'Long day, worth every hour', body: 'We started at 5:40 am from Ujire and were at the top by eleven. The grassland stretch is completely exposed so the early start is not optional. Our guide carried the permit and turned two people back who had the wrong shoes, which I respected.', crowdFelt: 0.1 },
  { placeSlug: 'bandaje-arbi-falls', travellerKey: 'kabir', rating: 4, title: 'Leeches in September, but empty', body: 'Went in the second week of September and paid for it in leeches. Saw four other people all day. Salt in the socks, and it was fine.', crowdFelt: 0.05 },
  { placeSlug: 'kanadukathan-mansion-lane', travellerKey: 'ananya', rating: 5, title: 'Do not do this without a local', body: 'The mansions look shut from the street. Going with someone whose family lives here got us into three courtyards and a conversation with an 80-year-old about Burmese teak prices in 1940.', crowdFelt: 0.2 },
  { placeSlug: 'athangudi-tile-workshop', travellerKey: 'ananya', rating: 5, title: 'One tile at a time, genuinely', body: 'I had assumed some part of this was mechanised. It is not. Glass plate, brass stencil, coloured cement poured by hand, cured in shade for days. We ordered a floor and it is being shipped by lorry.', crowdFelt: 0.1 },
  { placeSlug: 'demul-homestay-rotation', travellerKey: 'kabir', rating: 5, title: 'The rotation is the whole point', body: 'You do not pick the house, the village does. Ours had two kids doing homework by solar lamp and yak-butter tea at 5 am. Take the acclimatisation seriously, Demul is over 4,300 m.', crowdFelt: 0.05 },
  { placeSlug: 'langza-fossil-meadow', travellerKey: 'kabir', rating: 4, title: 'Beautiful, and getting busier', body: 'Still stunning but there were six vehicles parked at the Buddha when we arrived at eight. Walk twenty minutes uphill and you have it to yourself again.', crowdFelt: 0.35 },
  { placeSlug: 'nirona-rogan-art', travellerKey: 'ananya', rating: 5, title: 'Watching the stylus never touch the cloth', body: 'The thread of castor paint is drawn in the air and laid down. Hard to believe until you are two feet from it. Bought a small piece directly from the family.', crowdFelt: 0.25 },
  { placeSlug: 'samaguri-satra-mask-making', travellerKey: 'ishaan', rating: 5, title: 'A workshop, not a museum', body: 'They were building a full-body Ravana mask when we visited. The bamboo frame work is extraordinary. Ask before photographing, some pieces are for ritual use.', crowdFelt: 0.15 },
  { placeSlug: 'thalassery-fish-market-kitchens', travellerKey: 'zoya', rating: 5, title: 'Six in the morning is the correct time', body: 'The landing at dawn decides what the mess halls cook by noon. The biryani uses khaima rice and it is nothing like the Hyderabad version I grew up on. Different thing entirely, and very good.', crowdFelt: 0.4 },
  { placeSlug: 'kadalundi-bird-sanctuary', travellerKey: 'ishaan', rating: 4, title: 'Go on a falling tide', body: 'We got the tide wrong on day one and saw almost nothing. Came back the next morning two hours before low water and had whimbrels, terns and a lone curlew on the bar.', crowdFelt: 0.1 },
  { placeSlug: 'melghat-semadoh-ecotourism', travellerKey: 'ishaan', rating: 4, title: 'Forest first, tiger maybe', body: 'Three safaris, no cat. Sloth bear at close range, a lot of teak, and one other vehicle in two days. If you need a guaranteed sighting go somewhere else and leave this one alone.', crowdFelt: 0.05 },
  { placeSlug: 'kaas-plateau-flowers', travellerKey: 'aarav', rating: 3, title: 'Extraordinary flowers, difficult crowds', body: 'The bloom is genuinely unlike anything else in the Ghats. But even with the daily cap, the weekend queue was long and people were stepping off the path constantly. Go midweek or not at all.', crowdFelt: 0.85 },
  { placeSlug: 'divar-island-goa', travellerKey: 'maya', rating: 5, title: 'The Goa that is still Goa', body: 'Free ferry, empty lanes, one taverna that opened when it felt like it. Cycled for three hours and passed maybe six cars.', crowdFelt: 0.1 },
  { placeSlug: 'harishchandragad-konkan-kada', travellerKey: 'aarav', rating: 4, title: 'Do not attempt Nalichi Vaat casually', body: 'The Pachnai route is fine. Konkan Kada in cloud is the reason to go. It gets very busy on long weekends and the cliff edge has no railing at all.', crowdFelt: 0.7 },
  { placeSlug: 'lepchajagat-forest', travellerKey: 'ishaan', rating: 5, title: 'Nothing to do, which is the point', body: 'Four rooms in the whole hamlet as far as I could tell. Pine, oak, a lot of birds and no phone signal worth the name.', crowdFelt: 0.08 },
  { placeSlug: 'raghurajpur-pattachitra', travellerKey: 'zoya', rating: 4, title: 'Every verandah is a studio', body: 'Talked to four painters, watched a tussar cloth being prepared with tamarind seed paste. Prices are negotiable but the work takes weeks, so do not grind them down.', crowdFelt: 0.3 },
];

export async function seedReviews(ctx: SeedContext, people: SeededPeople): Promise<void> {
  const totals = new Map<string, { sum: number; count: number; crowd: number }>();

  for (const [index, r] of REVIEW_SEEDS.entries()) {
    const userId = people.travellerIds.get(r.travellerKey);
    if (!userId) throw new Error(`Review ${index} references unknown traveller ${r.travellerKey}`);
    const user = await UserModel.findById(userId).lean();
    const placeId = seedId(`place:${r.placeSlug}`);

    await ReviewModel.updateOne(
      { _id: seedId(`review:${r.placeSlug}:${r.travellerKey}`) },
      {
        $set: {
          targetType: 'PLACE',
          targetId: placeId,
          userId,
          authorName: user?.profile.displayName ?? 'Traveller',
          rating: r.rating,
          title: r.title,
          body: r.body,
          visitedAt: new Date(ctx.now.getTime() - (index + 5) * 86_400_000),
          crowdFelt: r.crowdFelt,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        $setOnInsert: { imageUrls: [], helpfulCount: 0, reportCount: 0 },
      },
      { upsert: true },
    );

    const acc = totals.get(r.placeSlug) ?? { sum: 0, count: 0, crowd: 0 };
    acc.sum += r.rating;
    acc.count += 1;
    acc.crowd += r.crowdFelt;
    totals.set(r.placeSlug, acc);
  }

  // Ratings on places are derived from the reviews, never invented.
  for (const [slug, acc] of totals) {
    await PlaceModel.updateOne(
      { _id: seedId(`place:${slug}`) },
      {
        $set: {
          'signals.ratingAvg': Number((acc.sum / acc.count).toFixed(2)),
          'signals.ratingCount': acc.count,
        },
      },
    );
  }

  ctx.log(`reviews: ${REVIEW_SEEDS.length} across ${totals.size} places`);
}
