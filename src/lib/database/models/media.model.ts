import { model, type Model, type Types } from 'mongoose';
import { ALLOWED_IMAGE_MIME, MEDIA_KINDS } from '../../types';
import { Schema } from 'mongoose';
import { createSchema, SUB_SCHEMA_OPTIONS } from '../plugins/base';

/** `entity`, not `type`: Mongoose reserves `type` inside a definition object. */
const attachedToSchema = new Schema(
  {
    entity: { type: String, required: true, maxlength: 40 },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export interface MediaAssetDocument {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  kind: (typeof MEDIA_KINDS)[number];
  key: string;
  url: string;
  contentType: (typeof ALLOWED_IMAGE_MIME)[number];
  contentLength: number;
  width: number | null;
  height: number | null;
  alt: string;
  credit: string | null;
  status: 'PENDING' | 'READY' | 'FAILED';
  attachedTo: { entity: string; id: Types.ObjectId } | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mediaAssetSchema = createSchema<MediaAssetDocument>({
  ownerId: { type: 'ObjectId', ref: 'User', required: true },
  kind: { type: String, enum: MEDIA_KINDS, required: true },
  key: { type: String, required: true, maxlength: 300 },
  url: { type: String, required: true, maxlength: 1000 },
  contentType: { type: String, enum: ALLOWED_IMAGE_MIME, required: true },
  contentLength: { type: Number, required: true, min: 1 },
  width: { type: Number, default: null, min: 1 },
  height: { type: Number, default: null, min: 1 },
  alt: { type: String, default: '', maxlength: 200 },
  credit: { type: String, default: null, maxlength: 200 },
  status: { type: String, enum: ['PENDING', 'READY', 'FAILED'], required: true, default: 'PENDING' },
  attachedTo: { type: attachedToSchema, default: null },
});

export const MediaAssetModel: Model<MediaAssetDocument> = model<MediaAssetDocument>(
  'MediaAsset',
  mediaAssetSchema,
  'mediaassets',
);
