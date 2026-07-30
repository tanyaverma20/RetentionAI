import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { ensureSystemRoles } from './services/roleService.js';
import { findUserByEmail, createUser } from './repositories/userRepository.js';
import { findRoleByName } from './repositories/roleRepository.js';
import { hashPassword } from './utils/password.js';
import { seedDemoData } from './seeders/seedDemoData.js';
import { Employee } from './models/Employee.js';

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

/**
 * Seeds one demo self-service EMPLOYEE login, bidirectionally linked to a
 * real seeded Employee record (User.employeeId + Employee.userId both set)
 * — without this link, self-service endpoints (an employee viewing their
 * own profile/attendance/surveys) have no way to resolve "which employee is
 * this user", so they always 403 even for legitimately-scoped requests.
 */
async function seedEmployeeDemoUser() {
  const demoEmail = 'employee@example.test';
  const existing = await findUserByEmail(demoEmail);
  if (existing) return;

  const employeeRole = await findRoleByName('EMPLOYEE');
  const linkedEmployee = await Employee.findOne({ isDeleted: { $ne: true } }).sort({ employeeCode: 1 });
  if (!employeeRole || !linkedEmployee) return;

  const demoUser = await createUser({
    name: `${linkedEmployee.firstName} ${linkedEmployee.lastName}`,
    email: demoEmail,
    passwordHash: await hashPassword('Employee#12345'),
    roleId: employeeRole.id,
    departmentId: linkedEmployee.departmentId,
    employeeId: linkedEmployee._id,
    status: 'ACTIVE',
  });

  linkedEmployee.userId = demoUser._id;
  await linkedEmployee.save();

  console.log(`Seeded demo employee account: ${demoEmail} (linked to ${linkedEmployee.employeeCode})`);
}

async function startServer() {
  await connectDatabase();
  await ensureSystemRoles();
  await seedAdminUser();
  await seedDemoData();
  await seedEmployeeDemoUser();
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
