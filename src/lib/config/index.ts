import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { envSchema, type Env } from './schema';

export { envSchema, type Env } from './schema';

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

let cached: AppConfig | null = null;

export interface AppConfig {
  env: Env;
  isProduction: boolean;
  isTest: boolean;
  /** Providers that are only usable once their keys are present. */
  providers: {
    payments: boolean;
    ai: boolean;
    maps: boolean;
    email: boolean;
    storage: boolean;
  };
}

function buildConfig(env: Env): AppConfig {
  return {
    env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    providers: {
      payments: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      ai: env.AI_PROVIDER === 'stub' ? true : Boolean(env.GEMINI_API_KEY),
      maps: env.MAPS_PROVIDER === 'maplibre-demo' ? true : Boolean(env.OLA_MAPS_API_KEY),
      email:
        env.EMAIL_PROVIDER === 'resend'
          ? Boolean(env.RESEND_API_KEY)
          : env.EMAIL_PROVIDER !== 'console',
      // Uploads go to local disk, which needs no credentials.
      storage: true,
    },
  };
}

/** Parses `source` (defaults to process.env) or throws a readable aggregate error. */
export function parseConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const cfg = buildConfig(result.data);
  assertProductionRequirements(cfg);
  return cfg;
}

function assertProductionRequirements(cfg: AppConfig): void {
  if (!cfg.isProduction) return;
  const missing: string[] = [];
  if (!cfg.providers.payments) missing.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
  if (cfg.env.AI_PROVIDER === 'stub') missing.push('AI_PROVIDER must not be "stub" in production');
  if (!cfg.providers.ai) missing.push('GEMINI_API_KEY');
  if (!cfg.providers.maps) missing.push('OLA_MAPS_API_KEY');
  if (!cfg.env.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
  if (!cfg.env.COOKIE_SECURE) missing.push('COOKIE_SECURE must be true in production');
  if (missing.length) throw new ConfigError(missing.map((m) => `${m} is required in production`));
}

/** Loads .env (once), validates, and memoises. Call this at process start. */
export function loadConfig(options: { dotenvPath?: string } = {}): AppConfig {
  if (cached) return cached;
  loadDotenv(options.dotenvPath ? { path: options.dotenvPath } : {});
  cached = parseConfig();
  return cached;
}

export function getConfig(): AppConfig {
  if (!cached) return loadConfig();
  return cached;
}

/** Test-only helper so suites can inject a config without touching process.env. */
export function setConfigForTesting(cfg: AppConfig | null): void {
  cached = cfg;
}

export function describeMissingProviders(cfg: AppConfig): string[] {
  const notes: string[] = [];
  if (!cfg.providers.payments) notes.push('payments (Razorpay keys missing)');
  if (!cfg.providers.ai) notes.push('ai (Gemini key missing)');
  if (!cfg.providers.maps) notes.push('maps (Ola Maps key missing)');
  return notes;
}

export const zodEnv = z;
