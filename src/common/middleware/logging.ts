import { type NextFunction, type Request, type Response } from 'express';
import { getLogger } from '../logger';
import { getContext } from '../request-context';

/**
 * One structured line per request. Bodies, query strings and headers are never
 * logged; the request id is what ties a log line to a user report.
 */
export function httpLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const ctx = getContext();
      getLogger().info(
        {
          method: req.method,
          path: req.route?.path ?? req.path,
          status: res.statusCode,
          ms: Date.now() - startedAt,
          userId: ctx?.auth?.userId,
          portal: ctx?.auth?.portal,
        },
        'request',
      );
    });
    next();
  };
}
