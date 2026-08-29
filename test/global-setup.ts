import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Starts a single-node MongoDB replica set for the integration suite.
 *
 * A replica set — not a standalone server — because Anvesh uses multi-document
 * transactions for booking and payment, and those do not exist without one.
 *
 * NOTE: mongodb-memory-server downloads a mongod binary on first run. It must
 * be able to reach fastdl.mongodb.org, or MONGOMS_SYSTEM_BINARY must point at
 * a local mongod. See TODO.md.
 */
let replSet: MongoMemoryReplSet | undefined;

export async function setup(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = replSet.getUri('anvesh-integration');
  process.env.MONGODB_DB_NAME = 'anvesh-integration';
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}
