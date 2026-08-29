import { type Response } from 'express';
import { type ApiFailure, type ApiSuccess, type ErrorCode } from '../lib/types';
import { getRequestId } from './request-context';

export function successBody<T>(data: T, meta: Record<string, unknown> = {}): ApiSuccess<T> {
  return { success: true, data, meta: { requestId: getRequestId(), ...meta } };
}

export function failureBody(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiFailure {
  return {
    success: false,
    error: details ? { code, message, details } : { code, message },
    meta: { requestId: getRequestId() },
  };
}

export function sendOk<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
  res.status(200).json(successBody(data, meta));
}

export function sendCreated<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
  res.status(201).json(successBody(data, meta));
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
