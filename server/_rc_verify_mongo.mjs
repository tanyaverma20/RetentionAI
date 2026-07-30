import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, ip: '127.0.0.1', dbName: 'retentionai' },
});
console.log('MONGO_READY', mongod.getUri());

// Keep process alive
await new Promise(() => {});
