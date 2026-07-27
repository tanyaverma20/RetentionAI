import { SYSTEM_ROLES } from '../config/roles.js';
import { upsertSystemRoles } from '../repositories/roleRepository.js';

export function ensureSystemRoles() {
  return upsertSystemRoles(SYSTEM_ROLES);
}
