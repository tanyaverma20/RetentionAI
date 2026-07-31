const { MongoMemoryServer } = require('mongodb-memory-server');
(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27017, ip: '127.0.0.1' } });
  console.log('READY', mongod.getUri());
  await new Promise(() => {});
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
