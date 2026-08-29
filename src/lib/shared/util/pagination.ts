import { type PageInfo, type Paginated } from '../../types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function toSkipLimit(page: number, limit: number): { skip: number; limit: number } {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_SIZE);
  const safePage = Math.max(1, Math.trunc(page));
  return { skip: (safePage - 1) * safeLimit, limit: safeLimit };
}

export function buildPageInfo(page: number, limit: number, total: number): PageInfo {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_SIZE);
  const safePage = Math.max(1, Math.trunc(page));
  const totalPages = safeLimit === 0 ? 0 : Math.ceil(total / safeLimit);
  return { page: safePage, limit: safeLimit, total, totalPages, hasNext: safePage < totalPages };
}

export function paginate<T>(items: T[], page: number, limit: number, total: number): Paginated<T> {
  return { items, pageInfo: buildPageInfo(page, limit, total) };
}
