/**
 * Imagery for seeded places.
 *
 * Every image here is real imagery OF THE ACTUAL COORDINATES — the MapTiler
 * raster tile that contains the place. That is a deliberate choice over stock
 * photography: a generic "waterfall" photo attached to a named waterfall is a
 * small lie, and this project does not ship those. An aerial view of the real
 * location is honest, always matches the place, and never 404s.
 *
 * Why tiles rather than the Static Maps API: static maps are rendered
 * server-side and are not included in MapTiler's free plan — that endpoint
 * answers with an "Invalid key" image even for a valid key. Raster tiles are
 * included, and are the same endpoints the frontend map already uses.
 *
 * When you have genuine photographs (your own, or a licensed set), upload them
 * through the media pipeline and replace `images` on the place — the shape is
 * identical, so nothing else has to change.
 *
 * Needs MAPTILER_API_KEY in the environment. Without it the seed still runs and
 * places are simply created without images, rather than with broken URLs.
 */

export interface SeedImage {
  key: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
}

/** MapTiler serves these endpoints as 512px tiles. */
const TILE_PX = 512;

/** MapTiler requires this attribution wherever its tiles are displayed. */
const SATELLITE_CREDIT = 'Satellite imagery © MapTiler © OpenStreetMap contributors';
const STREET_CREDIT = 'Map © MapTiler © OpenStreetMap contributors';

/**
 * Zoom levels, chosen for how much ground a single tile covers in India:
 * z13 is roughly 4 km across (the place and its immediate surroundings),
 * z11 is roughly 18 km (the district context).
 *
 * A tile is a fixed grid square, so the place sits somewhere inside it rather
 * than dead centre. At these zooms it is always well within frame.
 */
const COVER_ZOOM = 13;
const CONTEXT_ZOOM = 11;

interface Tile {
  z: number;
  x: number;
  y: number;
}

/** Standard Web Mercator (slippy map) tile containing a coordinate. */
function tileFor(lng: number, lat: number, z: number): Tile {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  // Clamp so a coordinate exactly on an edge cannot index past the grid.
  return { z, x: Math.min(Math.max(x, 0), n - 1), y: Math.min(Math.max(y, 0), n - 1) };
}

function satelliteTileUrl(t: Tile, key: string): string {
  return `https://api.maptiler.com/tiles/satellite-v2/${t.z}/${t.x}/${t.y}.jpg?key=${encodeURIComponent(key)}`;
}

function streetTileUrl(t: Tile, key: string): string {
  return `https://api.maptiler.com/maps/streets-v2/${t.z}/${t.x}/${t.y}.png?key=${encodeURIComponent(key)}`;
}

/**
 * Two images per place: a close satellite view as the cover, and a wider street
 * map so the surrounding roads and villages are readable.
 */
export function buildPlaceImages(
  slug: string,
  title: string,
  lng: number,
  lat: number,
): SeedImage[] {
  const key = process.env.MAPTILER_API_KEY;
  if (!key) return [];

  return [
    {
      key: `seed/${slug}/satellite`,
      url: satelliteTileUrl(tileFor(lng, lat, COVER_ZOOM), key),
      width: TILE_PX,
      height: TILE_PX,
      alt: `Satellite view of the area around ${title}`,
      credit: SATELLITE_CREDIT,
    },
    {
      key: `seed/${slug}/map`,
      url: streetTileUrl(tileFor(lng, lat, CONTEXT_ZOOM), key),
      width: TILE_PX,
      height: TILE_PX,
      alt: `Map showing where ${title} is`,
      credit: STREET_CREDIT,
    },
  ];
}