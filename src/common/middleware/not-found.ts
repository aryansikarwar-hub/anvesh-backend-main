import { type NextFunction, type Request, type Response } from 'express';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../api-error';

export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(
      new AppError(ERROR_CODES.NOT_FOUND, {
        message: `No route matches ${req.method} ${req.path}.`,
      }),
    );
  };
}
