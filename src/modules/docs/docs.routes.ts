import { Router, type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from '../../openapi/document';

/**
 * Serves the OpenAPI document and a browsable UI.
 *
 * The document is generated at request time from the live router, so it is
 * never stale and can never describe an endpoint the service does not serve.
 * It contains no secrets: only paths, parameter names and error codes.
 */
export function docsRoutes(getApp: () => Express): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(buildOpenApiDocument(getApp()));
  });

  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: '/api/v1/docs/openapi.json' },
      customSiteTitle: 'Anvesh API',
    }),
  );

  return router;
}
