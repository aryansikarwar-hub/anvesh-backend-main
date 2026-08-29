import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const port = z.coerce.number().int().min(1).max(65535);
/** Comma separated list with a string-shaped default, e.g. "a,b,c". */
const csv = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // --- URLs ---------------------------------------------------------------
  API_PORT: port.default(4000),
  API_BASE_URL: z.url().default('http://localhost:4000'),
  // One React app serves all three portals; the guide and admin portals are
  // route prefixes inside it, which is why these share a host.
  WEB_APP_URL: z.url().default('http://localhost:5173'),
  GUIDE_APP_URL: z.url().default('http://localhost:5173/guide'),
  ADMIN_APP_URL: z.url().default('http://localhost:5173/admin'),
  CORS_ORIGINS: csv('http://localhost:5173,http://localhost:4173'),

  // --- data ---------------------------------------------------------------
  MONGODB_URI: z.string().min(10),
  MONGODB_DB_NAME: z.string().min(1).default('anvesh'),

  // --- auth ---------------------------------------------------------------
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).default(2_592_000),
  JWT_ISSUER: z.string().default('anvesh'),
  JWT_AUDIENCE: z.string().default('anvesh:api'),
  TOTP_ENCRYPTION_KEY: z.string().min(32, 'TOTP_ENCRYPTION_KEY must be at least 32 characters'),
  TOTP_ISSUER: z.string().default('Anvesh Admin'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(48),
  ADMIN_INVITE_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: bool.default(false),

  // --- commerce -----------------------------------------------------------
  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(1200),
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(2).max(120).default(15),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // --- providers ----------------------------------------------------------
  AI_PROVIDER: z.enum(['gemini', 'stub']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_BASE_URL: z.url().default('https://generativelanguage.googleapis.com'),
  AI_MONTHLY_REQUEST_LIMIT: z.coerce.number().int().min(1).default(200),

  MAPS_PROVIDER: z.enum(['ola', 'maptiler', 'maplibre-demo']).default('maplibre-demo'),
  OLA_MAPS_API_KEY: z.string().optional(),
  OLA_MAPS_BASE_URL: z.url().default('https://api.olamaps.io'),
  MAPTILER_API_KEY: z.string().optional(),
  MAPTILER_BASE_URL: z.url().default('https://api.maptiler.com'),

  // 'console' logs the email instead of sending it, so nothing extra has to
  // run locally. Set 'smtp' or 'resend' when you actually want delivery.
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'console']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Anvesh <hello@anvesh.travel>'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: port.default(1025),

  // Uploaded images are written here and served from GET /uploads/<key>.
  // Relative paths resolve against the backend folder.
  UPLOAD_DIR: z.string().default('uploads'),

  // --- limits -------------------------------------------------------------
  RATE_LIMIT_ENABLED: bool.default(true),
  BODY_LIMIT: z.string().default('256kb'),
  TRUST_PROXY: bool.default(false),
});

export type Env = z.infer<typeof envSchema>;