import { type Express, type Router } from 'express';
import { readPrefix } from '../common/mount';
import { API_PREFIX } from '../app';

export interface RouteEntry {
  method: string;
  path: string;
}

interface Layer {
  route?: { path?: string; methods?: Record<string, boolean>; stack?: unknown[] };
  name?: string;
  handle?: { stack?: Layer[] };
}

/**
 * Lists the routes the running application actually serves.
 *
 * This is derived from the live Express router, not from a hand-kept list, so
 * the OpenAPI document and the route-parity test cannot drift from reality.
 */
export function listRoutes(app: Express): RouteEntry[] {
  const root = (app as Express & { router?: Router }).router;
  const stack = (root as unknown as { stack?: Layer[] })?.stack ?? [];
  const entries: RouteEntry[] = [];

  const walk = (layers: Layer[], prefix: string): void => {
    for (const layer of layers) {
      if (layer.route?.path !== undefined) {
        for (const method of Object.keys(layer.route.methods ?? {})) {
          if (method === '_all') continue;
          entries.push({
            method: method.toUpperCase(),
            path: normalise(prefix + layer.route.path),
          });
        }
        continue;
      }
      const child = layer.handle;
      if (!child?.stack) continue;
      const own = readPrefix(child);
      walk(child.stack, own === null ? prefix : prefix + own);
    }
  };

  // Everything under /api/v1 is mounted through one router.
  walk(stack, API_PREFIX);

  return entries.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function normalise(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

export function routeKey(entry: RouteEntry): string {
  return `${entry.method} ${entry.path}`;
}
