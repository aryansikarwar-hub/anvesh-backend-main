import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { type AppConfig } from './lib/config';
import { type Container } from './container';
import { buildRoutes } from './routes';
import { requestId } from './common/middleware/request-id';
import { httpLogger } from './common/middleware/logging';
import { mongoSanitize } from './common/middleware/sanitize';
import { errorHandler } from './common/middleware/error-handler';
import { notFoundHandler } from './common/middleware/not-found';
import { configureRateLimiting } from './common/middleware/rate-limit';

export const API_PREFIX = '/api/v1';

/**
 * Builds the Express application. Middleware order matters and is documented in
 * docs/architecture.md section 2.
 */
export function createApp(container: Container): Express {
  const { env } = container.config;
  configureRateLimiting(env.RATE_LIMIT_ENABLED);

  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(requestId());
  app.use(
    helmet({
      contentSecurityPolicy: false, // the API serves JSON, not documents
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server calls arrive without an Origin.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // The Razorpay webhook needs the exact bytes to verify its HMAC, so its raw
  // body is captured before JSON parsing rewrites it.
  app.use(
    express.json({
      limit: env.BODY_LIMIT,
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }));

  app.use(httpLogger());
  app.use(mongoSanitize());

  // Uploaded images. In production these would sit behind a CDN; served
  // directly here so the project needs no object storage to run.
  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), {
      maxAge: '7d',
      index: false,
      dotfiles: 'ignore',
      fallthrough: false,
    }),
  );

  app.use(API_PREFIX, buildRoutes(container, () => app));

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}

export function createAppFromConfig(config: AppConfig, container: Container): Express {
  void config;
  return createApp(container);
}
