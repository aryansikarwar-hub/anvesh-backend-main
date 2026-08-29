import { randomUUID } from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';
import { REQUEST_ID_HEADER } from '../../lib/types';
import { runWithContext } from '../request-context';

const UUID_LIKE = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Establishes the async context for the request and guarantees an
 * X-Request-Id on the way in and on the way out. A client-supplied id is
 * accepted only if it looks sane, so it cannot be used to inject into logs.
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header(REQUEST_ID_HEADER);
    const id = incoming && UUID_LIKE.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, id);
    runWithContext(
      {
        requestId: id,
        auth: null,
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
        startedAt: Date.now(),
      },
      () => next(),
    );
  };
}
