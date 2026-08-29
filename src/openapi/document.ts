import { type Express } from 'express';
import { ERROR_CODES } from '../lib/types';
import { API_VERSION } from '../routes';
import { listRoutes, routeKey, type RouteEntry } from './inventory';
import { OPERATIONS, type OperationMeta } from './operations';

export interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: { url: string; description: string }[];
  tags: { name: string }[];
  components: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

const ENVELOPE_SUCCESS = {
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'object' },
    meta: {
      type: 'object',
      required: ['requestId'],
      properties: { requestId: { type: 'string' } },
    },
  },
};

const ENVELOPE_ERROR = {
  type: 'object',
  required: ['success', 'error', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', enum: Object.values(ERROR_CODES) },
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
    meta: {
      type: 'object',
      required: ['requestId'],
      properties: { requestId: { type: 'string' } },
    },
  },
};

/**
 * Builds the OpenAPI document from the routes the application actually serves.
 *
 * If a route has no entry in OPERATIONS this throws, so the document can never
 * silently omit an endpoint, and `openapi.spec.ts` catches the reverse case.
 */
export function buildOpenApiDocument(app: Express): OpenApiDocument {
  const routes = listRoutes(app);
  const paths: Record<string, Record<string, unknown>> = {};
  const tags = new Set<string>();

  for (const route of routes) {
    const meta = OPERATIONS[routeKey(route)];
    if (!meta) {
      throw new Error(
        `Route ${routeKey(route)} is served but not documented. Add it to src/openapi/operations.ts.`,
      );
    }
    tags.add(meta.tag);
    const openApiPath = toOpenApiPath(route.path);
    paths[openApiPath] ??= {};
    paths[openApiPath][route.method.toLowerCase()] = buildOperation(route, meta);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Anvesh API',
      version: API_VERSION,
      description: [
        'Anvesh is a local-first travel discovery platform for India.',
        '',
        'Every response uses one envelope. Success is `{ success: true, data, meta }`;',
        'failure is `{ success: false, error: { code, message, details? }, meta }`.',
        '`meta.requestId` matches the `X-Request-Id` header and the server log line.',
        '',
        'Money is always an integer number of minor units (paise). Coordinates are',
        'GeoJSON `[longitude, latitude]`.',
        '',
        'Tokens are portal-scoped: a token minted for one portal presented to another',
        'is rejected with `PORTAL_MISMATCH`.',
      ].join('\n'),
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: 'http://localhost:4000/api/v1', description: 'Local development' },
      { url: 'https://api.anvesh.travel/api/v1', description: 'Production' },
    ],
    tags: [...tags].sort().map((name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: { SuccessEnvelope: ENVELOPE_SUCCESS, ErrorEnvelope: ENVELOPE_ERROR },
      parameters: {
        RequestId: {
          name: 'X-Request-Id',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Correlation id. Generated when absent and echoed on every response.',
        },
      },
    },
    paths,
  };
}

function buildOperation(route: RouteEntry, meta: OperationMeta): Record<string, unknown> {
  const parameters = [
    { $ref: '#/components/parameters/RequestId' },
    ...pathParameters(route.path),
  ];

  const responses: Record<string, unknown> = {
    '200': {
      description: 'Success',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } },
    },
    '422': errorResponse('Validation failed (VALIDATION_ERROR)'),
    '429': errorResponse('Rate limited (RATE_LIMITED)'),
    '500': errorResponse('Unexpected failure (INTERNAL_ERROR)'),
  };

  if (meta.portal !== null) {
    responses['401'] = errorResponse('Missing, invalid or expired token');
    responses['403'] = errorResponse(
      meta.portal === 'ANY'
        ? 'Role not allowed for this operation'
        : `Token was not minted for the ${meta.portal} portal (PORTAL_MISMATCH)`,
    );
  }

  return {
    summary: meta.summary,
    tags: [meta.tag],
    operationId: operationId(route),
    parameters,
    ...(meta.portal === null ? {} : { security: [{ bearerAuth: [] }] }),
    ...(['POST', 'PATCH', 'PUT'].includes(route.method)
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description:
                    'Validated with the shared Zod schema in @anvesh/validation. Unknown fields are rejected.',
                },
              },
            },
          },
        }
      : {}),
    responses,
  };
}

function errorResponse(description: string): Record<string, unknown> {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  };
}

function pathParameters(path: string): Record<string, unknown>[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function operationId(route: RouteEntry): string {
  const segments = route.path
    .replace('/api/v1', '')
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? `by-${segment.slice(1)}` : segment));
  return [route.method.toLowerCase(), ...segments]
    .join('-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-');
}
