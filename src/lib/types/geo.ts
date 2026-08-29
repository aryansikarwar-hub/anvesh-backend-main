/** GeoJSON Point — coordinates are ALWAYS [longitude, latitude]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Address {
  line1?: string;
  area?: string;
  city: string;
  district?: string;
  state: string;
  pincode?: string;
  country: string;
}

export const INDIA_BBOX: BoundingBox = { west: 68.0, south: 6.5, east: 97.5, north: 37.6 };
