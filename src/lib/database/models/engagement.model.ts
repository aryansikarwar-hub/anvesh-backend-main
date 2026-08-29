import { model, type Model, type Types } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../types';
import { createSchema } from '../plugins/base';
import { placeSummarySchema } from './place.model';

export interface SavedPlaceDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  placeId: Types.ObjectId;
  collectionId: Types.ObjectId | null;
  placeSummary: Record<string, unknown>;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const savedPlaceSchema = createSchema<SavedPlaceDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  placeId: { type: 'ObjectId', ref: 'Place', required: true },
  collectionId: { type: 'ObjectId', ref: 'UserCollection', default: null },
  placeSummary: { type: placeSummarySchema, required: true },
});

export const SavedPlaceModel: Model<SavedPlaceDocument> = model<SavedPlaceDocument>(
  'SavedPlace',
  savedPlaceSchema,
  'savedplaces',
);

export interface UserCollectionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description: string;
  isPublic: boolean;
  itemCount: number;
  coverImageUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userCollectionSchema = createSchema<UserCollectionDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 400 },
  isPublic: { type: Boolean, required: true, default: false },
  itemCount: { type: Number, required: true, default: 0, min: 0 },
  coverImageUrl: { type: String, default: null, maxlength: 1000 },
});

export const UserCollectionModel: Model<UserCollectionDocument> = model<UserCollectionDocument>(
  'UserCollection',
  userCollectionSchema,
  'collections',
);

export interface NotificationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: (typeof NOTIFICATION_TYPES)[number];
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = createSchema<NotificationDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, required: true, maxlength: 600 },
  href: { type: String, default: null, maxlength: 500 },
  readAt: { type: Date, default: null },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 180 * 86_400_000),
  },
});

export const NotificationModel: Model<NotificationDocument> = model<NotificationDocument>(
  'Notification',
  notificationSchema,
  'notifications',
);
