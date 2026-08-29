import { type StoryKind } from '../../../types';

export interface StorySeed {
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: StoryKind;
  guideKey: string;
  /** Slugs of seeded places this story is about. */
  placeSlugs: string[];
  city: string;
  state: string;
  tags: string[];
}

/**
 * Development seed stories.
 *
 * Written to sit beside the seeded places, in the voice of the guide who owns
 * them. They describe real crafts, foods and landscapes at the level of detail
 * a knowledgeable local would give — and, like the place seeds, they are
 * development data, not verified journalism. Correct them against the people
 * involved before any of this goes near a real launch.
 */
export const STORY_SEEDS: StorySeed[] = [
  {
    slug: 'rogan-art-nirona-one-family',
    title: 'The last families painting with boiled castor oil',
    summary:
      'Rogan work survives in one village in Kutch, in the hands of very few people. What the craft actually involves, and why it nearly ended.',
    kind: 'CRAFT',
    guideKey: 'guide-jaydev',
    placeSlugs: ['nirona-rogan-art', 'ajrakhpur-block-printing'],
    city: 'Nirona',
    state: 'Gujarat',
    tags: ['craft', 'kutch', 'textile'],
    body: `Rogan is not printing and it is not embroidery. Castor oil is boiled for the better part of a day until it thickens into a residue called rogan, then mixed with natural pigment. The artist picks up a thread of that paste on a blunt iron stylus, holds it in the air, and lays it onto cloth without the stylus ever touching the fabric.

Because the paste is drawn out into a filament and placed rather than pressed, the line has a slight relief you can feel with a fingertip. A large piece is often painted on one half of a folded cloth and then pressed onto the other half while still wet, which is why so many rogan pieces are perfectly symmetrical.

By the 1980s the craft was down to a single family still working in it, in Nirona. Demand for rogan on everyday clothing had collapsed decades earlier; machine printing was cheaper and faster and nobody could tell the difference at arm's length. The revival that followed came from exhibitions and from state craft programmes, and it is real but it is narrow: the number of people who can do this well is still countable on your fingers.

If you visit, go on a working day rather than a weekend, and go in the morning. The oil behaves differently as the day heats up, and you will see more actual work and fewer demonstrations. Ask before photographing hands — the grip on the stylus is the part that took years to learn, and it is not a free sample.

Buying a piece directly does more than any entry ticket. Ask what took longest. The answer is usually not the part you expected.`,
  },
  {
    slug: 'thalassery-biryani-kitchen-order',
    title: 'Why Thalassery biryani uses the small-grained rice',
    summary:
      'Kaima rice, browned onions done in a specific order, and a fish market that decides the day’s menu before any kitchen does.',
    kind: 'FOOD',
    guideKey: 'guide-fahad',
    placeSlugs: ['thalassery-fish-market-kitchens'],
    city: 'Thalassery',
    state: 'Kerala',
    tags: ['food', 'malabar', 'biryani'],
    body: `Almost every biryani in India is made with a long-grain rice. Thalassery is the exception that people notice first: it uses kaima, also called jeerakasala, a short fat grain that cooks quickly and holds a lot of aroma without going sticky.

The reason is practical rather than romantic. Malabar kitchens layer the rice over the masala and finish it on a low fire with coals on the lid, and kaima finishes in that window without breaking. A long grain either dries out or needs more liquid than the dish can carry.

The order of work matters more than the spice list. Onions are browned first and set aside, and the same fat carries the masala afterwards, which is where most of the colour comes from — not from any powder. The browned onion goes back at the layering stage, along with fried cashew and raisin, so it stays crisp against the rice.

None of this is decided in the kitchen, though. It is decided at the fish auction at dawn. What lands determines whether the day runs to biryani, to a thick fish curry, or to something fried and eaten standing up. Kitchens here have always cooked what the boats brought, and the menu you get at eleven in the morning was set at five.

Go to the auction first, then eat. In that order it makes sense; in the other order it is just a good lunch.`,
  },
  {
    slug: 'majuli-mask-making-satra',
    title: 'The masks of Samaguri Satra are made to be worn, not hung',
    summary:
      'Bamboo, clay and cow dung, built up over weeks, so that a character can be performed and not merely displayed.',
    kind: 'CRAFT',
    guideKey: 'guide-bhaskar',
    placeSlugs: ['samaguri-satra-mask-making', 'majuli-mishing-chang-ghar'],
    city: 'Majuli',
    state: 'Assam',
    tags: ['craft', 'majuli', 'performance'],
    body: `A mukha from Samaguri starts as split bamboo, woven into a frame the size and shape of the head it will sit on. Cloth goes over the frame, then a paste of clay and cow dung, layer by layer, each one left to dry before the next. Only after that does anyone think about a face.

The point of all that structure is that these are theatre objects. They are made for bhaona, the dramatic form that came out of the satras, and the large ones have jaws and eyes that move on cords so that a performer can work them from inside. A mask that cannot be worn and moved has failed, however good it looks on a wall.

The satra has kept the craft going through a long stretch when nobody outside Majuli was paying attention, and through the more serious problem of the island itself shrinking to the Brahmaputra year after year. Erosion is the real threat here, not fashion.

If you go, ask to see an unfinished one. A half-built mask tells you far more than a finished one: you can see the bamboo, the layers, and where the mechanism is anchored. And time your trip against the ferry schedule rather than the other way round — the river decides.`,
  },
  {
    slug: 'spiti-fossils-langza-what-not-to-take',
    title: 'The fossils at Langza are what is left of a sea',
    summary:
      'Ammonites at 4,400 metres, why they are there, and the case for leaving them where they lie.',
    kind: 'NATURE',
    guideKey: 'guide-tenzin',
    placeSlugs: ['langza-fossil-meadow', 'demul-homestay-rotation'],
    city: 'Langza',
    state: 'Himachal Pradesh',
    tags: ['geology', 'spiti', 'fossils'],
    body: `The meadow above Langza is scattered with ammonites — coiled shells of animals that lived in the Tethys Sea. The Tethys is gone; the Himalaya is what happened when the Indian plate closed it and drove into Asia. The seabed went up, and it is now the slope you are standing on, and the shells came with it.

That is the whole explanation, and it is worth holding onto while you look, because it changes what the field is. It is not a curiosity shop. It is a horizon of rock that happens to be exposed here.

Children will offer to sell you fossils. This is the awkward part, and it deserves an honest answer rather than a lecture: the money is real and the household needs it, and the supply is not infinite. What has worked better in villages that thought it through is paying for time and knowledge instead — a guided walk, a meal, a night in a homestay — so the income does not depend on the field being emptied.

Take photographs. Put the shell back where you found it, the same way up. The cold and the altitude will end your visit before the field does, so go slowly, and give yourself a day at Kaza before you come up here at all.`,
  },
  {
    slug: 'chettinad-athangudi-tiles',
    title: 'Athangudi tiles are made on glass, one at a time',
    summary:
      'No kiln, no press. A sheet of glass, a brass stencil, coloured cement, and a week of curing under wet sacking.',
    kind: 'CRAFT',
    guideKey: 'guide-meenakshi',
    placeSlugs: ['athangudi-tile-workshop', 'kanadukathan-mansion-lane'],
    city: 'Athangudi',
    state: 'Tamil Nadu',
    tags: ['craft', 'chettinad', 'architecture'],
    body: `An Athangudi tile is poured, not fired. A brass stencil is laid on a sheet of glass, coloured cement slurry is spooned into each cell, the stencil is lifted, dry cement and sand are packed on top, and the whole thing is pressed and left in water to cure for about a week.

The glass is what gives the surface its particular sheen. Nothing polishes it afterwards — the face of the tile is simply the face that lay against the glass. It is also why no two tiles are identical, and why a floor laid with them reads as handmade from across a room.

The pattern vocabulary came out of the Chettiar mansions and travelled with the community's trading routes through Burma and Southeast Asia, picking up motifs on the way. Walk the mansion lanes at Kanadukathan and you will see the same handful of patterns recombined house after house, in different colourways.

The workshops are small and they work to order. If you want tiles, expect to wait and expect to talk about quantity — a floor is hundreds of tiles and each one was made by hand by somebody. Watching for twenty minutes is free and, honestly, worth more than the mansion tour.`,
  },
  {
    slug: 'kaas-plateau-flowering-window',
    title: 'The Kaas plateau flowers for about three weeks',
    summary:
      'Lateritic rock, a thin skin of soil, and a bloom that is over almost as soon as it is photographed.',
    kind: 'NATURE',
    guideKey: 'guide-aditi',
    placeSlugs: ['kaas-plateau-flowers', 'harishchandragad-konkan-kada'],
    city: 'Satara',
    state: 'Maharashtra',
    tags: ['nature', 'monsoon', 'sahyadri'],
    body: `Kaas is a lateritic plateau: hard rock with only a few centimetres of soil on it, and no depth for anything woody to hold on. What that produces is a flora of small, fast plants that complete a whole life in the weeks after the monsoon, while the thin soil still holds water.

The result is a bloom that turns colour every few days as one species gives way to the next — Karvi, Topli Karvi, the carnivorous Drosera down at ground level if you look properly. Then the water goes and it is brown rock again until next year.

The window is roughly late August into September and it moves with the rain. Anyone who promises you a date in advance is guessing.

Two things are worth saying plainly. Visitor numbers are capped and booked, and that is the reason there is anything left to see. And the flowers are centimetres tall, growing in soil you can scrape away with a fingernail, so stepping off the path does more damage than it looks like. Stay on the marked route, go on a weekday, and bring something that focuses close — a wide landscape shot of Kaas is almost always disappointing.`,
  },
];
