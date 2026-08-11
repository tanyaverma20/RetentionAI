/**
 * @file materializeDemoOrganization.js
 * @description Idempotently materializes the single Demo Organization document
 * corresponding to DEFAULT_ORGANIZATION_ID and associates seeded demo accounts.
 */

import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { DEFAULT_ORGANIZATION_ID } from '../config/tenancy.js';
import { logger } from '../utils/logger.js';

export async function materializeDemoOrganization() {
  const existingOrg = await Organization.findById(DEFAULT_ORGANIZATION_ID);
  if (existingOrg) {
    logger.info('demo_organization_exists', { organizationId: DEFAULT_ORGANIZATION_ID });
    return existingOrg;
  }

  logger.info('materializing_demo_organization', { organizationId: DEFAULT_ORGANIZATION_ID });

  // Create single legitimate Organization document using existing schema
  const demoOrg = await Organization.create({
    _id: DEFAULT_ORGANIZATION_ID,
    name: 'RetentionAI Demo Organization',
    slug: 'retentionai-demo-organization',
    status: 'ACTIVE',
    plan: 'FREE',
    employeeLimit: 5000,
  });

  // Only backfill demonstrably legacy/demo seeded users
  const DEMO_EMAILS = [
    'admin@example.test',
    'employee@example.test',
    'hr.manager@example.test',
    'hr.director@example.test',
    'chro@example.test',
    'ceo@example.test',
    'dept.manager@example.test',
  ];

  await User.updateMany(
    {
      $or: [
        { email: { $in: DEMO_EMAILS } },
        { email: { $regex: /@example\.test$/i } },
      ],
      $and: [
        {
          $or: [
            { organizationId: { $exists: false } },
            { organizationId: null },
          ],
        },
      ],
    },
    { $set: { organizationId: DEFAULT_ORGANIZATION_ID } },
  );

  const empCount = await Employee.countDocuments({ organizationId: DEFAULT_ORGANIZATION_ID });
  logger.info('demo_organization_materialized', {
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCount: empCount,
  });

  return demoOrg;
}
