import { PLACES_SOUTH } from './places-south';
import { PLACES_NORTH } from './places-north';
import { PLACES_WEST } from './places-west';
import { PLACES_EAST } from './places-east';
import { PLACES_SOUTH_EXTRA } from './places-south-extra';
import { PLACES_NORTH_EXTRA } from './places-north-extra';
import { PLACES_WEST_EXTRA } from './places-west-extra';
import { PLACES_EAST_EXTRA } from './places-east-extra';
import { PLACES_NORTHEAST } from './places-northeast';
import { PLACES_CENTRAL } from './places-central';
import { PLACES_COAST_ISLANDS } from './places-coast-islands';
import { PLACES_DESERT } from './places-desert';
import { PLACES_FOOD_CAFES } from './places-food-cafes';
import { type PlaceSeed } from './place-types';

export { type PlaceSeed } from './place-types';

/**
 * Every seeded place, by region.
 *
 * All of these are real places with real (approximate) coordinates — nothing
 * here is generated filler. `slug` is the natural key the deterministic seed
 * id is derived from, so slugs must stay unique and stable: changing one
 * creates a second document rather than updating the first.
 */
export const PLACE_SEEDS: PlaceSeed[] = [
  ...PLACES_SOUTH,
  ...PLACES_SOUTH_EXTRA,
  ...PLACES_NORTH,
  ...PLACES_NORTH_EXTRA,
  ...PLACES_WEST,
  ...PLACES_WEST_EXTRA,
  ...PLACES_EAST,
  ...PLACES_EAST_EXTRA,
  ...PLACES_NORTHEAST,
  ...PLACES_CENTRAL,
  ...PLACES_COAST_ISLANDS,
  ...PLACES_DESERT,
  ...PLACES_FOOD_CAFES,
];