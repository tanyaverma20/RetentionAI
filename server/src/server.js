import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { ensureSystemRoles } from './services/roleService.js';

async function startServer() {
  await connectDatabase();
  await ensureSystemRoles();
  const server = app.listen(env.port, () => {
    console.log(`RetentionAI server listening on port ${env.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('RetentionAI server failed to start.', error);
  process.exit(1);
});
