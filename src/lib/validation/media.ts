import { z } from 'zod';
import { ALLOWED_IMAGE_MIME, MEDIA_KINDS } from '../types';
import { objectIdSchema } from './common';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const presignUploadSchema = z.strictObject({
  kind: z.enum(MEDIA_KINDS),
  contentType: z.enum(ALLOWED_IMAGE_MIME),
  contentLength: z.number().int().min(1).max(MAX_IMAGE_BYTES),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[\w. -]+$/, 'File name contains unsupported characters'),
});

export const finaliseUploadSchema = z.strictObject({
  mediaId: objectIdSchema,
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  alt: z.string().trim().min(1).max(200),
  credit: z.string().trim().max(200).optional(),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
