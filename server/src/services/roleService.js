import { SYSTEM_ROLES } from '../config/roles.js';
import { upsertSystemRoles, syncSystemRolePermissions } from '../repositories/roleRepository.js';

export async function ensureSystemRoles() {
  await upsertSystemRoles(SYSTEM_ROLES);
  await syncSystemRolePermissions(SYSTEM_ROLES);
}
