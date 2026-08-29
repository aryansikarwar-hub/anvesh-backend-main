import { type NextFunction, type Request, type Response } from 'express';
import { assertNoOperatorKeys, UnsafeKeyError } from '../../lib/shared';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../api-error';

/**
 * NoSQL-injection guard. Rejects — never silently strips — any key that starts
 * with `$` or contains a dot, anywhere in the body, query or params.
 *
 * Rejecting is deliberate: a stripped payload can still half-execute and leave
 * the caller thinking the request succeeded as written.
 */
export function mongoSanitize() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      assertNoOperatorKeys(req.body, 'body');
      assertNoOperatorKeys(req.query, 'query');
      assertNoOperatorKeys(req.params, 'params');
      next();
    } catch (error) {
      if (error instanceof UnsafeKeyError) {
        next(
          new AppError(ERROR_CODES.INVALID_INPUT, {
            message: 'Request contains a disallowed key.',
            details: { path: error.path },
          }),
        );
        return;
      }
      next(error);
    }
  };
}
