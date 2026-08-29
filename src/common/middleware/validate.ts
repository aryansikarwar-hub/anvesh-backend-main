import { type NextFunction, type Request, type Response } from 'express';
import type { z, ZodType } from 'zod';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../api-error';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function issuesToDetails(error: z.ZodError): Record<string, unknown> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return { fields };
}

/**
 * Parses body/query/params with the shared Zod schemas and REPLACES the
 * request values with the parsed output, so a handler downstream can never see
 * an unvalidated or unknown field.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const source of ['params', 'query', 'body'] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source] ?? {});
      if (!result.success) {
        next(
          new AppError(ERROR_CODES.VALIDATION_ERROR, {
            message: `The ${source} failed validation.`,
            details: { source, ...issuesToDetails(result.error) },
          }),
        );
        return;
      }
      if (source === 'query') {
        // Express 5 exposes req.query via a getter, so it is redefined rather
        // than assigned.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[source] = result.data as never;
      }
    }
    next();
  };
}

/** Typed accessors so controllers do not have to cast. */
export function body<T>(req: Request): T {
  return req.body as T;
}

export function query<T>(req: Request): T {
  return req.query as unknown as T;
}

export function params<T>(req: Request): T {
  return req.params as unknown as T;
}
