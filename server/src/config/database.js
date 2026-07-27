import mongoose from 'mongoose';
import { env } from './env.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function connectDatabase() {
  let uri = env.mongodbUri;
  
  if (env.nodeEnv === 'development' && (uri.includes('localhost') || uri.includes('127.0.0.1'))) {
    try {
      await mongoose.connect(uri, { dbName: env.mongodbDbName, serverSelectionTimeoutMS: 2000 });
      console.log('Connected to local MongoDB');
      return;
    } catch (err) {
      console.log('Local MongoDB not running. Starting in-memory MongoDB server...');
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      env.mongodbUri = uri;
    }
  }
  
  await mongoose.connect(uri, { dbName: env.mongodbDbName });
  if (mongoServer) {
    console.log(`Connected to in-memory MongoDB`);
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}
