import mongoose, { type Connection } from 'mongoose';

export interface ConnectOptions {
  uri: string;
  dbName: string;
  /** Never true outside tests: indexes are owned by migrate-mongo migrations. */
  autoIndex?: boolean;
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
}

let connection: Connection | null = null;

export class DatabaseError extends Error {}

/**
 * Opens the single shared Mongoose connection.
 *
 * A replica set is strongly preferred: booking and payment use multi-document
 * transactions, which a standalone mongod does not have. MongoDB Atlas is a
 * replica set out of the box. Against a plain local mongod the same code still
 * runs — see `withTransaction` for exactly what is given up.
 */
export async function connectDatabase(options: ConnectOptions): Promise<Connection> {
  if (connection && connection.readyState === 1) return connection;

  mongoose.set('strictQuery', true);
  // NOTE: `sanitizeFilter` is deliberately NOT set. It rewrites any filter value
  // that looks like an operator — `{ expiresAt: { $lt: now } }` becomes
  // `{ expiresAt: { $eq: { $lt: now } } }` — which breaks every legitimate range,
  // $in and $ne query this codebase writes, and fails as a confusing CastError at
  // runtime rather than at review time. NoSQL injection is already blocked one
  // layer earlier and more strictly: `mongoSanitize()` (src/common/middleware)
  // REJECTS any $-prefixed or dotted key in a request body, query or params
  // instead of silently mangling it, so no user-controlled operator ever reaches
  // a filter in the first place.
  mongoose.set('autoCreate', false);
  mongoose.set('autoIndex', options.autoIndex ?? false);

  await mongoose.connect(options.uri, {
    dbName: options.dbName,
    maxPoolSize: options.maxPoolSize ?? 20,
    serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 8000,
    retryWrites: true,
  });

  connection = mongoose.connection;
  return connection;
}

export function getConnection(): Connection {
  if (!connection) throw new DatabaseError('Database connection has not been opened yet');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  if (!connection) return;
  await mongoose.disconnect();
  connection = null;
}

export async function pingDatabase(): Promise<boolean> {
  if (!connection?.db) return false;
  const res = await connection.db.admin().ping();
  return res.ok === 1;
}

/** True when the server we are attached to is a replica-set member. */
export async function supportsTransactions(): Promise<boolean> {
  if (!connection?.db) return false;
  try {
    const info = await connection.db.admin().command({ hello: 1 });
    return Boolean(info.setName);
  } catch {
    return false;
  }
}

let transactionsAvailable: boolean | null = null;

/**
 * Runs `fn` inside a transaction when the server supports them.
 *
 * Against a standalone mongod there are no transactions, so the same writes
 * run in a plain session instead. Be clear about the cost: if the process dies
 * midway through a booking, seats could be reserved without the booking row to
 * match. Use a replica set (Atlas gives you one) for anything real.
 */
export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  transactionsAvailable ??= await supportsTransactions();

  const session = await mongoose.startSession();
  try {
    if (!transactionsAvailable) return await fn(session);

    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

/** Test-only: forces re-detection after the connection changes. */
export function resetTransactionSupportCache(): void {
  transactionsAvailable = null;
}

export { mongoose };