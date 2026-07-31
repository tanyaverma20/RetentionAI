import mongoose from 'mongoose';
import { env } from './env.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../utils/logger.js';

let mongoServer;

// Connection pooling — Sprint 10 Part 7. Mongoose/the MongoDB driver default
// to maxPoolSize=100, which is generous for a single Node process talking to
// a managed cluster with its own connection ceiling; capping it here is a
// deliberate, explicit choice rather than relying on the driver default.
const CONNECTION_OPTIONS = {
  maxPoolSize: 20,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
};

export async function connectDatabase() {
  let uri = env.mongodbUri;

  if (env.nodeEnv === 'development' && (uri.includes('localhost') || uri.includes('127.0.0.1'))) {
    try {
      await mongoose.connect(uri, { dbName: env.mongodbDbName, serverSelectionTimeoutMS: 2000, ...CONNECTION_OPTIONS });
      logger.info('mongo_connected', { mode: 'local' });
      return;
    } catch {
      logger.warn('mongo_local_unavailable', { message: 'Local MongoDB not running — starting in-memory MongoDB server for development.' });
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      env.mongodbUri = uri;
    }
  }

  await mongoose.connect(uri, { dbName: env.mongodbDbName, ...CONNECTION_OPTIONS });
  logger.info('mongo_connected', { mode: mongoServer ? 'in-memory' : 'configured' });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}
