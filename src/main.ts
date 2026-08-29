import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { loadConfig, describeMissingProviders } from './lib/config';
import { connectDatabase, disconnectDatabase, supportsTransactions } from './lib/database';
import { createApp } from './app';
import { createContainer } from './container';
import { createLogger, getLogger } from './common/logger';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const { env } = config;
  createLogger(env.LOG_LEVEL, env.NODE_ENV !== 'production');
  const log = getLogger();

  await connectDatabase({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME, autoIndex: false });
  if (!(await supportsTransactions())) {
    log.warn(
      'MongoDB is not a replica set, so multi-document transactions are unavailable. ' +
        'Booking and payment still work but lose atomicity. MongoDB Atlas is a replica set ' +
        'by default; a local mongod needs --replSet to become one.',
    );
  }

  // Uploaded images live on this server's disk and are served from /uploads.
  await mkdir(env.UPLOAD_DIR, { recursive: true });

  const missing = describeMissingProviders(config);
  if (missing.length) {
    log.warn(
      { missing },
      'some external providers are not configured; their endpoints will report it explicitly',
    );
  }

  const container = createContainer(config);
  const app = createApp(container);
  const server = createServer(app);

  // Background work runs in this process — there is no separate worker.
  container.jobs.startSchedulers();

  await new Promise<void>((resolve) => server.listen(env.API_PORT, resolve));
  log.info({ port: env.API_PORT, env: env.NODE_ENV }, 'anvesh api listening');

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    server.close();
    container.jobs.stop();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Failed to start API: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
