import { type ErrorCode } from './error-codes';

export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const REQUEST_ID_HEADER = 'x-request-id';
export const PORTAL_HEADER = 'x-anvesh-portal';
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';
