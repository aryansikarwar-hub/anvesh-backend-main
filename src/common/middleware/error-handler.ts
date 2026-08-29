import { type NextFunction, type Request, type Response } from 'express';
import { ERROR_CODES, ERROR_MESSAGES } from '../../lib/types';
import { AppError, isAppError } from '../api-error';
import { failureBody } from '../envelope';
import { getLogger } from '../logger';

interface MongoLikeError {
  name?: string;
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function translate(error: unknown): AppError {
  if (isAppError(error)) return error;

  const candidate = error as MongoLikeError;
  if (candidate?.name === 'MongoServerError' && candidate.code === 11000) {
    return new AppError(ERROR_CODES.CONFLICT, {
      message: 'That record already exists.',
      details: { fields: Object.keys(candidate.keyPattern ?? {}) },
    });
  }
  if (candidate?.name === 'ValidationError' || candidate?.name === 'CastError') {
    return new AppError(ERROR_CODES.INVALID_INPUT, { message: 'The request was not valid.' });
  }
  return new AppError(ERROR_CODES.INTERNAL_ERROR);
}

/**
 * Terminal error middleware. Clients only ever see the error envelope; the
 * stack trace, the Mongo error text and anything else diagnostic stays in the
 * server log.
 */
export function errorHandler() {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = translate(error);
    const log = getLogger();
    const payload = {
      err: error instanceof Error ? { message: error.message, stack: error.stack } : { error },
      code: appError.code,
      status: appError.status,
      method: req.method,
      path: req.path,
    };

    if (appError.status >= 500) log.error(payload, 'request failed');
    else log.warn({ ...payload, err: undefined }, 'request rejected');

    const message = appError.expose
      ? appError.message
      : (ERROR_MESSAGES.INTERNAL_ERROR ?? 'Something went wrong.');

    res
      .status(appError.status)
      .json(failureBody(appError.code, message, appError.expose ? appError.details : undefined));
  };
}
