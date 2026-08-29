import { model, type Model, type Types } from 'mongoose';
import { CONTENT_STATUSES, STORY_KINDS } from '../../types';
import { createSchema, imageSchema } from '../plugins/base';

/**
 * A local story: the piece of context a listing cannot carry.
 *
 * Stories are written by the guides themselves — how a dish came to be made
 * that way, what a craft family still does by hand, why a festival falls when
 * it does. They go through the same moderation pipeline as places and
 * experiences, and they can point at the places they are about, so a story is
 * a way into the map rather than a blog sitting beside it.
 */
export interface StoryDocument {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  /** One-line hook, shown on cards and in listings. */
  summary: string;
  /** The story itself. Plain text with blank-line paragraphs, never HTML. */
  body: string;
  kind: (typeof STORY_KINDS)[number];
  /** Author. A story always belongs to a guide, never to the platform. */
  guideId: Types.ObjectId;
  guideSummary: {
    guideId: Types.ObjectId;
    displayName: string;
    slug: string;
    avatarUrl?: string;
    verified: boolean;
    ratingAvg: number;
    ratingCount: number;
  } | null;
  /** Places this story is about. Every id is verified before it is stored. */
  placeIds: Types.ObjectId[];
  coverImage: {
    key: string;
    url: string;
    width: number;
    height: number;
    alt: string;
    credit?: string;
  } | null;
  city: string;
  state: string;
  tags: string[];
  readMinutes: number;
  viewCount: number;
  status: (typeof CONTENT_STATUSES)[number];
  moderationNote: string;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const guideSummarySchema = {
  guideId: { type: 'ObjectId', ref: 'GuideProfile', required: true },
  displayName: { type: String, required: true, maxlength: 120 },
  slug: { type: String, required: true, maxlength: 140 },
  avatarUrl: { type: String, maxlength: 1000 },
  verified: { type: Boolean, required: true, default: false },
  ratingAvg: { type: Number, required: true, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, required: true, default: 0, min: 0 },
};

const storySchema = createSchema<StoryDocument>({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  summary: { type: String, required: true, trim: true, maxlength: 300 },
  body: { type: String, required: true, maxlength: 20_000 },
  kind: { type: String, enum: STORY_KINDS, required: true },
  guideId: { type: 'ObjectId', ref: 'GuideProfile', required: true },
  guideSummary: { type: guideSummarySchema, default: null },
  placeIds: { type: [{ type: 'ObjectId', ref: 'Place' }], default: [] },
  coverImage: { type: imageSchema, default: null },
  city: { type: String, required: true, trim: true, maxlength: 120 },
  state: { type: String, required: true, trim: true, maxlength: 120 },
  tags: { type: [String], default: [] },
  readMinutes: { type: Number, required: true, default: 1, min: 1, max: 90 },
  viewCount: { type: Number, required: true, default: 0, min: 0 },
  status: { type: String, enum: CONTENT_STATUSES, required: true, default: 'DRAFT' },
  moderationNote: { type: String, default: '', maxlength: 400 },
  publishedAt: { type: Date, default: null },
});

export const StoryModel: Model<StoryDocument> = model<StoryDocument>(
  'Story',
  storySchema,
  'stories',
);
