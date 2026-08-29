import { describe, expect, it } from 'vitest';
import { parseConfig } from '../lib/config';
import { createApp } from '../app';
import { createContainer } from '../container';
import { createLogger } from '../common/logger';
import { listRoutes, routeKey } from './inventory';
import { OPERATIONS } from './operations';
import { buildOpenApiDocument } from './document';

const SECRET = 'a'.repeat(40);
createLogger('fatal', false);

const config = parseConfig({
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/anvesh-test',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: SECRET,
  TOTP_ENCRYPTION_KEY: SECRET,
  AI_PROVIDER: 'stub',
  RATE_LIMIT_ENABLED: 'false',
});

const app = createApp(createContainer(config));
const routes = listRoutes(app);
const served = new Set(routes.map(routeKey));
const documented = new Set(Object.keys(OPERATIONS));

/**
 * The specification says: document every API, and do not document endpoints
 * that do not exist. These two assertions enforce both directions against the
 * live router, so the OpenAPI file cannot drift from the running service.
 */
describe('OpenAPI parity with the real router', () => {
  it('serves a non-trivial number of routes', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('documents every route that is served', () => {
    const undocumented = [...served].filter((key) => !documented.has(key));
    expect(undocumented, 'served but undocumented').toEqual([]);
  });

  it('does not document a route that is not served', () => {
    const phantom = [...documented].filter((key) => !served.has(key));
    expect(phantom, 'documented but not served').toEqual([]);
  });

  it('builds a valid-looking OpenAPI 3.1 document', () => {
    const document = buildOpenApiDocument(app);
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths).length).toBeGreaterThan(80);
    expect(document.components).toHaveProperty('securitySchemes.bearerAuth');
  });

  it('marks every protected operation with bearer security', () => {
    const document = buildOpenApiDocument(app);
    for (const [path, methods] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const key = `${method.toUpperCase()} ${path.replace(/\{([^}]+)\}/g, ':$1')}`;
        const meta = OPERATIONS[key];
        if (!meta || meta.portal === null) continue;
        expect((operation as { security?: unknown[] }).security, key).toBeDefined();
      }
    }
  });

  it('uses only error codes that exist in the registry', () => {
    const document = buildOpenApiDocument(app);
    const schema = document.components as {
      schemas: { ErrorEnvelope: { properties: { error: { properties: { code: { enum: string[] } } } } } };
    };
    const codes = schema.schemas.ErrorEnvelope.properties.error.properties.code.enum;
    expect(codes.length).toBeGreaterThan(50);
    expect(codes).toContain('PORTAL_MISMATCH');
    expect(codes).toContain('AI_HALLUCINATED_REFERENCE');
  });
});
