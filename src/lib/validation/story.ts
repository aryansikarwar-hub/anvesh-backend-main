import { z } from 'zod';
import { STORY_KINDS } from '../types';
import {
  boundedStringArray,
  imageRefSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common';

export const storyKindSchema = z.enum(STORY_KINDS);

/**
 * A story's body is plain text and is stored as plain text. It is never HTML
 * and never Markdown that the client renders as HTML — the whole class of
 * stored-XSS bugs is removed by not having a rendering step at all.
 */
const storyBodySchema = z
  .string()
  .trim()
  .min(200, 'A story needs at least a couple of paragraphs')
  .max(20_000);

export const storyCreateSchema = z.strictObject({
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().min(20).max(300),
  body: storyBodySchema,
  kind: storyKindSchema,
  /** Places this story is about. Verified server side before they are stored. */
  placeIds: z.array(objectIdSchema).max(10).default([]),
  coverImage: imageRefSchema.nullable().default(null),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  tags: boundedStringArray(8, 40).default([]),
});

export const storyUpdateSchema = storyCreateSchema.partial();

export const storyListQuerySchema = paginationQuerySchema.extend({
  kind: storyKindSchema.optional(),
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  placeId: objectIdSchema.optional(),
  guideSlug: z.string().trim().max(140).optional(),
  q: z.string().trim().max(160).optional(),
});

export type StoryCreateInput = z.infer<typeof storyCreateSchema>;
export type StoryUpdateInput = z.infer<typeof storyUpdateSchema>;
export type StoryListQuery = z.infer<typeof storyListQuerySchema>;

/** Moderation transition, same shape as the place and experience ones. */
export const storyModerationSchema = z.strictObject({
  status: z.enum(['PUBLISHED', 'REJECTED', 'PENDING_REVIEW', 'ARCHIVED']),
  reason: z.string().trim().max(400).default(''),
});

export type StoryModerationInput = z.infer<typeof storyModerationSchema>;
