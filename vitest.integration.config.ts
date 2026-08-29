import { defineConfig } from 'vitest/config';

/**
 * Integration suites boot the real Express app against an in-memory MongoDB
 * replica set. They need to download a mongod binary on first run.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts', 'test/**/*.integration.spec.ts'],
    hookTimeout: 180_000,
    testTimeout: 60_000,
    fileParallelism: false,
    globalSetup: ['test/global-setup.ts'],
  },
});
