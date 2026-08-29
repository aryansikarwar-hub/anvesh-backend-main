import express, { Router } from 'express';
import { z } from 'zod';
import {
  MAX_IMAGE_BYTES,
  finaliseUploadSchema,
  idParamSchema,
  presignUploadSchema,
} from '../../lib/validation';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { sendCreated, sendNoContent, sendOk } from '../../common/envelope';
import { body, params, query, validate } from '../../common/middleware/validate';
import { principal, requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type MediaService } from './media.service';
import { type FileStorage } from '../../infra/storage/local.storage';
import { type TokenService } from '../auth/token.service';

const listQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function mediaRoutes(
  service: MediaService,
  storage: FileStorage,
  tokens: TokenService,
): Router {
  const router = Router();

  /**
   * Receives the bytes for an upload the server already approved.
   *
   * Deliberately not behind `requireAuth`: this is the local stand-in for a
   * presigned S3 PUT, and the signed token in the path IS the authorisation.
   * It pins the key, the content type and the exact byte count, so nothing
   * about the file can differ from what the server approved.
   */
  router.put(
    '/upload/:token',
    express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      const approved = storage.verifyToken(String(req.params.token));
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      if (bytes.length !== approved.contentLength) {
        throw new AppError(ERROR_CODES.MEDIA_UPLOAD_INCOMPLETE, {
          message: 'The uploaded file does not match the approved size.',
          details: { approvedBytes: approved.contentLength, receivedBytes: bytes.length },
        });
      }
      const contentType = String(req.headers['content-type'] ?? '');
      if (contentType !== approved.contentType) {
        throw new AppError(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED, {
          message: 'The uploaded file type does not match the approved type.',
        });
      }

      await storage.write(approved.key, bytes);
      sendOk(res, { key: approved.key });
    },
  );

  router.use(
    requireAuth(tokens),
    requirePortal('TRAVELLER', 'TOURIST_GUIDE', 'ADMIN'),
    rateLimit(RATE_LIMITS.media),
  );

  router.post('/presign', validate({ body: presignUploadSchema }), async (req, res) => {
    sendCreated(res, await service.presign(principal(req).userId, body(req)));
  });

  router.post('/finalise', validate({ body: finaliseUploadSchema }), async (req, res) => {
    sendOk(res, { image: await service.finalise(principal(req).userId, body(req)) });
  });

  router.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    const { limit } = query<{ limit: number }>(req);
    sendOk(res, { items: await service.listMine(principal(req).userId, limit) });
  });

  router.delete('/:id', validate({ params: idParamSchema }), async (req, res) => {
    await service.remove(principal(req).userId, params<{ id: string }>(req).id);
    sendNoContent(res);
  });

  return router;
}
