/**
 * Imagery for seeded places.
 *
 * Every image here is real imagery OF THE ACTUAL COORDINATES — MapTiler's
 * static map endpoint renders satellite and street tiles for the exact point
 * the place sits on. That is a deliberate choice over stock photography: a
 * generic "waterfall" photo attached to a named waterfall is a small lie, and
 * this project does not ship those. An aerial view of the real location is
 * honest, always matches the place, and never 404s.
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

const WIDTH = 1200;
const HEIGHT = 800;

/**
 * The cover style. `satellite` looks far better on a card, but it depends on
 * satellite tiles being enabled for your MapTiler key. If covers come back
 * blank, change this one constant to 'streets-v2' — that style is already
 * proven with this key because the frontend map uses it — and re-run the seed.
 */
const COVER_STYLE = 'satellite';
const MAP_STYLE = 'streets-v2';

/** MapTiler requires this attribution wherever its tiles are displayed. */
const SATELLITE_CREDIT = 'Satellite imagery © MapTiler © OpenStreetMap contributors';
const STREET_CREDIT = 'Map © MapTiler © OpenStreetMap contributors';

function staticMapUrl(
  style: string,
  lng: number,
  lat: number,
  zoom: number,
  key: string,
  marker: boolean,
): string {
  const base = `https://api.maptiler.com/maps/${style}/static/${lng},${lat},${zoom}/${WIDTH}x${HEIGHT}.png`;
  const params = new URLSearchParams({ key });
  if (marker) params.set('markers', `${lng},${lat}`);
  return `${base}?${params.toString()}`;
}

/**
 * Two images per place: a close satellite view as the cover, and a wider street
 * map with a marker so the surrounding roads and villages are readable.
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
      key: `seed/${slug}/cover`,
      url: staticMapUrl(COVER_STYLE, lng, lat, 15, key, false),
      width: WIDTH,
      height: HEIGHT,
      alt: `Satellite view of ${title}`,
      credit: SATELLITE_CREDIT,
    },
    {
      key: `seed/${slug}/map`,
      url: staticMapUrl(MAP_STYLE, lng, lat, 12, key, true),
      width: WIDTH,
      height: HEIGHT,
      alt: `Map showing the location of ${title}`,
      credit: STREET_CREDIT,
    },
  ];
}