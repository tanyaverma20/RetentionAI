import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { ensureSystemRoles } from './services/roleService.js';
import { findUserByEmail, createUser } from './repositories/userRepository.js';
import { findRoleByName } from './repositories/roleRepository.js';
import { hashPassword } from './utils/password.js';
import { seedDemoData } from './seeders/seedDemoData.js';

async function seedAdminUser() {
  const adminEmail = 'admin@example.test';
  const existing = await findUserByEmail(adminEmail);
  if (!existing) {
    const adminRole = await findRoleByName('ADMIN');
    if (adminRole) {
      await createUser({
        name: 'System Admin',
        email: adminEmail,
        passwordHash: await hashPassword('Admin#12345'),
        roleId: adminRole.id,
        status: 'ACTIVE'
      });
      console.log('Seeded demo admin account: admin@example.test');
    }
  }
}

async function startServer() {
  await connectDatabase();
  await ensureSystemRoles();
  await seedAdminUser();
  await seedDemoData();
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
