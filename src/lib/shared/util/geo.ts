import { type BoundingBox, type GeoPoint } from '../../types';

export class GeoError extends Error {}

/** Builds a GeoJSON point. Note the argument order: longitude first. */
export function point(lng: number, lat: number): GeoPoint {
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new GeoError('longitude out of range');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new GeoError('latitude out of range');
  return { type: 'Point', coordinates: [lng, lat] };
}

export function lngOf(p: GeoPoint): number {
  return p.coordinates[0];
}

export function latOf(p: GeoPoint): number {
  return p.coordinates[1];
}

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(latOf(b) - latOf(a));
  const dLng = toRad(lngOf(b) - lngOf(a));
  const lat1 = toRad(latOf(a));
  const lat2 = toRad(latOf(b));
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bboxToPolygon(b: BoundingBox): { type: 'Polygon'; coordinates: number[][][] } {
  if (b.west >= b.east || b.south >= b.north) throw new GeoError('invalid bounding box');
  return {
    type: 'Polygon',
    coordinates: [
      [
        [b.west, b.south],
        [b.east, b.south],
        [b.east, b.north],
        [b.west, b.north],
        [b.west, b.south],
      ],
    ],
  };
}

export function bboxArea(b: BoundingBox): number {
  return Math.abs(b.east - b.west) * Math.abs(b.north - b.south);
}
