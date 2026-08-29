import { model, type Model, type Types } from 'mongoose';
import { createSchema, geoPointSchema } from '../plugins/base';

/** Bounded on purpose: the trip document must never grow without a limit. */
export const MAX_TRIP_DAYS = 30;
export const MAX_ACTIVITIES_PER_DAY = 20;

export interface TripDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  destinationId: Types.ObjectId | null;
  destinationName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  travellers: number;
  notes: string;
  coverImageUrl: string | null;
  generatedByAi: boolean;
  days: {
    _id: Types.ObjectId;
    dayNumber: number;
    date: Date | null;
    title: string;
    activities: {
      _id: Types.ObjectId;
      kind: 'PLACE' | 'EXPERIENCE' | 'NOTE';
      placeId: Types.ObjectId | null;
      experienceId: Types.ObjectId | null;
      title: string;
      note: string;
      startTimeMin: number | null;
      durationMin: number;
      order: number;
      location: { type: 'Point'; coordinates: [number, number] } | null;
    }[];
  }[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const activityDefinition = {
  kind: { type: String, enum: ['PLACE', 'EXPERIENCE', 'NOTE'], required: true },
  placeId: { type: 'ObjectId', ref: 'Place', default: null },
  experienceId: { type: 'ObjectId', ref: 'Experience', default: null },
  title: { type: String, required: true, maxlength: 160 },
  note: { type: String, default: '', maxlength: 600 },
  startTimeMin: { type: Number, default: null, min: 0, max: 1439 },
  durationMin: { type: Number, required: true, default: 60, min: 0, max: 1440 },
  order: { type: Number, required: true, default: 0, min: 0 },
  location: { type: geoPointSchema, default: null },
};

const tripSchema = createSchema<TripDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 120 },
  destinationId: { type: 'ObjectId', ref: 'Destination', default: null },
  destinationName: { type: String, default: null, maxlength: 120 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  travellers: { type: Number, required: true, default: 1, min: 1, max: 30 },
  notes: { type: String, default: '', maxlength: 2000 },
  coverImageUrl: { type: String, default: null, maxlength: 1000 },
  generatedByAi: { type: Boolean, required: true, default: false },
  days: {
    type: [
      {
        dayNumber: { type: Number, required: true, min: 1, max: MAX_TRIP_DAYS },
        date: { type: Date, default: null },
        title: { type: String, required: true, maxlength: 120 },
        activities: {
          type: [activityDefinition],
          default: [],
          validate: {
            validator: (v: unknown[]) => v.length <= MAX_ACTIVITIES_PER_DAY,
            message: `A day may hold at most ${MAX_ACTIVITIES_PER_DAY} activities`,
          },
        },
      },
    ],
    default: [],
    validate: {
      validator: (v: unknown[]) => v.length <= MAX_TRIP_DAYS,
      message: `A trip may hold at most ${MAX_TRIP_DAYS} days`,
    },
  },
});

export const TripModel: Model<TripDocument> = model<TripDocument>('Trip', tripSchema, 'trips');
