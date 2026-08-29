import { Schema, type SchemaOptions } from 'mongoose';
import { softDeletePlugin } from './soft-delete';

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  minimize: false,
  strict: 'throw',
  toJSON: {
    virtuals: true,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

/**
 * Builds a schema with the house defaults and soft delete already applied.
 *
 * Mongoose's generic signature does not accept a loosely-typed definition
 * object, so the definition and options are widened here and the result is
 * re-typed once. Every model file still declares a precise document interface,
 * which is what the rest of the codebase type-checks against.
 */
export function createSchema<T>(
  definition: Record<string, unknown>,
  options: SchemaOptions & { softDelete?: boolean } = {},
): Schema<T> {
  const { softDelete = true, ...rest } = options;
  const schema = new Schema(
    definition as never,
    { ...baseSchemaOptions, ...rest } as never,
  ) as unknown as Schema<T>;
  if (softDelete) schema.plugin(softDeletePlugin);
  return schema;
}

const SUB_SCHEMA_OPTIONS = { _id: false, versionKey: false } as const;

/**
 * GeoJSON point sub-schema. Coordinates are always [longitude, latitude], and
 * the validator rejects a reversed pair whenever the latitude value is out of
 * range for a latitude.
 *
 * This is a Schema rather than a plain object because Mongoose gives the key
 * `type` special meaning inside plain definitions.
 */
export const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value: number[]) {
          if (!Array.isArray(value) || value.length !== 2) return false;
          const [lng, lat] = value;
          return (
            typeof lng === 'number' &&
            typeof lat === 'number' &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },
        message: 'coordinates must be [longitude, latitude] within valid ranges',
      },
    },
  },
  SUB_SCHEMA_OPTIONS,
);

export const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    area: { type: String, trim: true, maxlength: 120 },
    city: { type: String, trim: true, required: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, required: true, maxlength: 120 },
    pincode: { type: String, trim: true, maxlength: 6 },
    country: { type: String, trim: true, default: 'IN', maxlength: 2 },
  },
  SUB_SCHEMA_OPTIONS,
);

export const imageSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 300 },
    url: { type: String, required: true, maxlength: 1000 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    alt: { type: String, required: true, maxlength: 200 },
    credit: { type: String, maxlength: 200 },
  },
  SUB_SCHEMA_OPTIONS,
);

export { SUB_SCHEMA_OPTIONS };

/** Integer money field in minor units. Rejects floats at the schema level. */
export function minorAmount(defaultValue = 0) {
  return {
    type: Number,
    required: true,
    default: defaultValue,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Money must be an integer number of minor units (paise)',
    },
  };
}

export function unitInterval(defaultValue = 0) {
  return { type: Number, required: true, default: defaultValue, min: 0, max: 1 };
}
