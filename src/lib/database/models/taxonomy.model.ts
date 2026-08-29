import { model, type Model, type Types } from 'mongoose';
import { CONTENT_STATUSES } from '../../types';
import { createSchema, geoPointSchema, imageSchema } from '../plugins/base';

export interface CategoryDocument {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  icon: string;
  parentSlug: string | null;
  sortOrder: number;
  placeCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = createSchema<CategoryDocument>({
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 300 },
  icon: { type: String, required: true, maxlength: 60 },
  parentSlug: { type: String, default: null, maxlength: 100 },
  sortOrder: { type: Number, required: true, default: 100, min: 0 },
  placeCount: { type: Number, required: true, default: 0, min: 0 },
});

export const CategoryModel: Model<CategoryDocument> = model<CategoryDocument>(
  'Category',
  categorySchema,
  'categories',
);

export interface DestinationDocument {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  state: string;
  summary: string;
  description: string;
  heroImage: Record<string, unknown> | null;
  location: { type: 'Point'; coordinates: [number, number] };
  bestMonths: number[];
  placeCount: number;
  status: (typeof CONTENT_STATUSES)[number];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const destinationSchema = createSchema<DestinationDocument>({
  slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  state: { type: String, required: true, trim: true, maxlength: 120 },
  summary: { type: String, required: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 6000 },
  heroImage: { type: imageSchema, default: null },
  location: { type: geoPointSchema, required: true },
  bestMonths: { type: [Number], default: [] },
  placeCount: { type: Number, required: true, default: 0, min: 0 },
  status: { type: String, enum: CONTENT_STATUSES, required: true, default: 'PUBLISHED' },
});

export const DestinationModel: Model<DestinationDocument> = model<DestinationDocument>(
  'Destination',
  destinationSchema,
  'destinations',
);
