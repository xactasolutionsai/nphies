// Role model shared with the backend (see middleware/requireRole.js).
// Legacy 'user' rows are kept as-is and behave as 'submitter'.
export const ROLES = Object.freeze(['admin', 'submitter', 'reviewer', 'viewer']);

const ROLE_ALIASES = Object.freeze({ user: 'submitter' });

export const PERMISSIONS = Object.freeze({
  view: ['admin', 'submitter', 'reviewer', 'viewer'],
  // AI / validation / bundle preview endpoints (nothing persisted, nothing sent to NPHIES)
  validate: ['admin', 'submitter', 'reviewer'],
  preview: ['admin', 'submitter', 'reviewer'],
  create: ['admin', 'submitter'],
  edit: ['admin', 'submitter'],
  send: ['admin', 'submitter'],
  cancel: ['admin', 'submitter'],
  poll: ['admin', 'submitter'],
  // Admin-only operations (backend ADMIN_ONLY_OPERATIONS)
  delete: ['admin'],
  triggerSystemPoll: ['admin'],
  refreshCodes: ['admin'],
  manageUsers: ['admin']
});

export function normalizeRole(role) {
  return ROLE_ALIASES[role] || role || null;
}

export function hasAnyRole(role, roles) {
  const normalized = normalizeRole(role);
  return Boolean(normalized) && roles.some(r => normalizeRole(r) === normalized);
}

/** Unknown actions and unknown roles are denied (fail closed). */
export function roleCan(role, action) {
  const normalized = normalizeRole(role);
  return Boolean(normalized && PERMISSIONS[action]?.includes(normalized));
}
