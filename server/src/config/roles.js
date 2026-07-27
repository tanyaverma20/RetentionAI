export const ROLE_NAMES = Object.freeze({
  ADMIN: 'ADMIN',
  HR_MANAGER: 'HR_MANAGER',
  HR_ANALYST: 'HR_ANALYST',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
});

export const SYSTEM_ROLES = Object.freeze([
  { name: ROLE_NAMES.ADMIN, permissions: ['*'] },
  {
    name: ROLE_NAMES.HR_MANAGER,
    permissions: ['employee.read', 'prediction.read', 'intervention.write'],
  },
  { name: ROLE_NAMES.HR_ANALYST, permissions: ['employee.read', 'prediction.read'] },
  { name: ROLE_NAMES.DEPARTMENT_MANAGER, permissions: ['employee.read', 'intervention.write'] },
  { name: ROLE_NAMES.EMPLOYEE, permissions: ['profile.read', 'profile.write'] },
]);
