import { ERROR_CODES, ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '../lib/types';

/**
 * The only error type the API throws on purpose. Everything else that reaches
 * the error handler is treated as an unexpected failure and reported as
 * INTERNAL_ERROR with no detail leaked to the client.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    options: { message?: string; details?: Record<string, unknown>; status?: number } = {},
  ) {
    super(options.message ?? ERROR_MESSAGES[code] ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? ERROR_STATUS[code] ?? 400;
    this.details = options.details;
    this.expose = this.status < 500;
    Error.captureStackTrace?.(this, AppError);
  }

  static notFound(what: ErrorCode = ERROR_CODES.NOT_FOUND, message?: string): AppError {
    return new AppError(what, message ? { message } : {});
  }

  static forbidden(code: ErrorCode = ERROR_CODES.FORBIDDEN, message?: string): AppError {
    return new AppError(code, message ? { message } : {});
  }

  static unauthorized(code: ErrorCode = ERROR_CODES.UNAUTHORIZED, message?: string): AppError {
    return new AppError(code, message ? { message } : {});
  }

  static conflict(code: ErrorCode, message?: string): AppError {
    return new AppError(code, message ? { message } : {});
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
