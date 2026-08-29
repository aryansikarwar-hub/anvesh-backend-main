import { AsyncLocalStorage } from 'node:async_hooks';
import { type AuthUser } from '../lib/types';

export interface RequestContext {
  requestId: string;
  auth: AuthUser | null;
  ip: string | null;
  userAgent: string | null;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string {
  return storage.getStore()?.requestId ?? 'no-request-context';
}

export function setContextAuth(auth: AuthUser): void {
  const store = storage.getStore();
  if (store) store.auth = auth;
}
