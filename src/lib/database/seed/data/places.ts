import { PLACES_SOUTH } from './places-south';
import { PLACES_NORTH } from './places-north';
import { PLACES_WEST } from './places-west';
import { PLACES_EAST } from './places-east';
import { type PlaceSeed } from './place-types';

export { type PlaceSeed } from './place-types';

export const PLACE_SEEDS: PlaceSeed[] = [
  ...PLACES_SOUTH,
  ...PLACES_NORTH,
  ...PLACES_WEST,
  ...PLACES_EAST,
];
