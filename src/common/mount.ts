import { type Router } from 'express';

const PREFIX = Symbol.for('anvesh.routePrefix');

interface Prefixed {
  [PREFIX]?: string;
}

/**
 * Mounts a sub-router and records the prefix on the router object.
 *
 * Express 5 no longer exposes a usable mount path on the layer, so this is how
 * the OpenAPI emitter and the route-inventory test can derive real, complete
 * paths from the application that is actually running — rather than from a
 * hand-maintained list that could drift.
 */
export function mount(parent: Router, prefix: string, child: Router): void {
  (child as Router & Prefixed)[PREFIX] = prefix;
  parent.use(prefix, child);
}

export function readPrefix(child: unknown): string | null {
  const value = (child as Prefixed | null)?.[PREFIX];
  return typeof value === 'string' ? value : null;
}
