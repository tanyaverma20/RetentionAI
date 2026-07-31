import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Connection pooling — Sprint 10 Part 7. Mongoose/the MongoDB driver default
// to maxPoolSize=100, which is generous for a single Node process talking to
// a managed cluster with its own connection ceiling; capping it here is a
// deliberate, explicit choice rather than relying on the driver default.
const CONNECTION_OPTIONS = {
  maxPoolSize: 20,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
};

// Always connects to MONGODB_URI as configured — no silent fallback to an
// ephemeral in-memory database. An earlier version of this function started
// a throwaway mongodb-memory-server instance whenever the configured URI was
// unreachable, which meant a crashed/never-started local MongoDB failed
// silently into a working-looking server backed by a database that vanished
// on every restart. Fail loudly instead: if this rejects, server.js's
// startServer().catch() logs it and exits, which is the correct behavior for
// a real (Atlas or otherwise persistent) database.
//
// mongodb-memory-server is still a direct dependency and still used by the
// test suite (tests/*.integration.test.js) and scripts/seedHrData.js, which
// each spin up their own isolated instance — unrelated to this function.
export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDbName, ...CONNECTION_OPTIONS });
  logger.info('mongo_connected', { mode: 'configured' });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
