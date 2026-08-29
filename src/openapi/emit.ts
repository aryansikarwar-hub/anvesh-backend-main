#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseConfig } from '../lib/config';
import { createApp } from '../app';
import { createContainer } from '../container';
import { buildOpenApiDocument } from './document';

/**
 * Writes docs/openapi.json from the running application's real route table.
 * Run with `pnpm --filter @anvesh/api run openapi`.
 */
function main(): void {
  const secret = 'openapi-emit-placeholder-secret-value-32';
  const config = parseConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/anvesh-openapi',
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    TOTP_ENCRYPTION_KEY: secret,
    AI_PROVIDER: 'stub',
    RATE_LIMIT_ENABLED: 'false',
  });

  const document = buildOpenApiDocument(createApp(createContainer(config)));
  const target = resolve(__dirname, '../../../../docs/openapi.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const operations = Object.values(document.paths).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0,
  );
  process.stdout.write(`Wrote ${target} with ${operations} operations.\n`);
}

main();
