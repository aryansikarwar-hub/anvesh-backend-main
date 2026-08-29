import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './index';

const SECRET = 'x'.repeat(40);

const base: NodeJS.ProcessEnv = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/anvesh?replicaSet=rs0',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: SECRET,
  TOTP_ENCRYPTION_KEY: SECRET,
};

describe('parseConfig', () => {
  it('applies sensible development defaults', () => {
    const cfg = parseConfig(base);
    expect(cfg.env.NODE_ENV).toBe('development');
    expect(cfg.env.API_PORT).toBe(4000);
    expect(cfg.env.PLATFORM_COMMISSION_BPS).toBe(1200);
    expect(cfg.isProduction).toBe(false);
  });

  it('reports every missing required variable at once', () => {
    try {
      parseConfig({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const issues = (err as ConfigError).issues.join('\n');
      expect(issues).toContain('MONGODB_URI');
      expect(issues).toContain('JWT_ACCESS_SECRET');
      expect(issues).toContain('TOTP_ENCRYPTION_KEY');
    }
  });

  it('rejects short JWT secrets', () => {
    expect(() => parseConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(ConfigError);
  });

  it('parses a comma separated CORS allowlist', () => {
    const cfg = parseConfig({ ...base, CORS_ORIGINS: 'https://a.dev, https://b.dev' });
    expect(cfg.env.CORS_ORIGINS).toEqual(['https://a.dev', 'https://b.dev']);
  });

  it('flags providers as unavailable when their keys are absent', () => {
    const cfg = parseConfig(base);
    expect(cfg.providers.payments).toBe(false);
    expect(cfg.providers.ai).toBe(false);
    expect(cfg.providers.storage).toBe(true);
  });

  it('refuses to boot production without provider keys', () => {
    expect(() => parseConfig({ ...base, NODE_ENV: 'production' })).toThrow(ConfigError);
  });

  it('refuses the stub AI provider in production', () => {
    expect(() =>
      parseConfig({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'stub',
        RAZORPAY_KEY_ID: 'k',
        RAZORPAY_KEY_SECRET: 's',
        RAZORPAY_WEBHOOK_SECRET: 'w',
        OLA_MAPS_API_KEY: 'm',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow(/stub/);
  });
});
