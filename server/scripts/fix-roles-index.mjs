/**
 * One-time fix: drops the stale unique index on roles collection that causes
 * E11000 duplicate key error on startup seeding, then lets Mongoose rebuild it
 * correctly on next server start.
 *
 * Run once from the server/ directory:
 *   node --env-file=.env scripts/fix-roles-index.mjs
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'retentionai';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set — run with: node --env-file=.env scripts/fix-roles-index.mjs');
  process.exit(1);
}

console.log('Connecting to MongoDB...');
await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
const db = mongoose.connection.db;

try {
  const indexes = await db.collection('roles').indexes();
  console.log('Current roles indexes:', indexes.map(i => i.name));
  await db.collection('roles').dropIndex('organizationId_1_name_1');
  console.log('SUCCESS: Dropped stale compound index organizationId_1_name_1');
} catch (e) {
  if (e.code === 27 || e.message.includes('index not found')) {
    console.log('Index does not exist — nothing to drop, already clean.');
  } else {
    console.error('Unexpected error:', e.message);
  }
}

await mongoose.disconnect();
console.log('Done. Now start the server normally with: npm run dev');
process.exit(0);
