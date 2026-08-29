// migrate-mongo configuration. Plain CommonJS, so migrations never depend on
// a TypeScript build step.
require('dotenv').config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is required to run migrations. Copy .env.example to .env first.');
}

module.exports = {
  mongodb: {
    url: uri,
    databaseName: process.env.MONGODB_DB_NAME || 'anvesh',
    options: { serverSelectionTimeoutMS: 8000 },
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations_changelog',
  lockCollectionName: 'migrations_lock',
  lockTtl: 60,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
