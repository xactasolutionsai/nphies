// Role-based access control. Roles come from the database via authenticateToken
// (req.user.role), never from JWT claims.
//
// Roles, from least to most privileged (migration 068):
//   viewer    - read only (GET/HEAD/OPTIONS), plus VIEWER_WRITE_OPERATIONS (AI feedback)
//   reviewer  - viewer + AI / validation / bundle-preview endpoints (REVIEW_OPERATIONS)
//   submitter - everything except the admin-only operations; the legacy 'user' role
//               (existing rows are not migrated) has exactly the same rights
//   admin     - everything
// A forbidden request gets 403 { error: 'forbidden', requiredRole }.

export const ROLES = Object.freeze(['admin', 'submitter', 'reviewer', 'viewer', 'user']);
/** Roles an administrator can assign (the legacy 'user' role is kept but not handed out). */
export const ASSIGNABLE_ROLES = Object.freeze(['admin', 'submitter', 'reviewer', 'viewer']);

const ROLE_RANK = Object.freeze({ viewer: 1, reviewer: 2, submitter: 3, user: 3, admin: 4 });

/** True when `role` includes the rights of `requiredRole`. Unknown roles have no rights. */
export function roleSatisfies(role, requiredRole) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[requiredRole] || Infinity);
}

function forbidden(res, requiredRole) {
  return res.status(403).json({ error: 'forbidden', requiredRole });
}

/** Allow only the listed roles (exact match, e.g. requireRole('admin')). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return forbidden(res, roles[0]);
    next();
  };
}

// Operations reserved for administrators, as [method or '*', path pattern] relative to /api.
// Patterns match the normalized path (lower case, single slashes, no trailing slash),
// because Express routing itself is case-insensitive and ignores a trailing slash.
export const ADMIN_ONLY_OPERATIONS = Object.freeze([
  ['DELETE', /^\/.*/],                                   // every delete under /api
  ['POST', /^\/system-poll(\/.*)?$/],                    // manual system-wide poll trigger
  ['POST', /^\/nphies-codes\/refresh$/],                 // code cache refresh
  ['POST', /^\/eligibility\/check-nphies-direct$/],      // raw bundle relay to NPHIES
  ['*', /^\/users(\/.*)?$/]                              // user administration
]);

// Non-GET operations a reviewer may call: they build or check data but never create,
// change or send a record.
export const REVIEW_OPERATIONS = Object.freeze([
  /\/preview$/,                                          // POST .../preview (bundle previews)
  /^\/ai-validation(\/.*)?$/,
  /^\/medication-safety(\/.*)?$/,
  /^\/general-request\/validate$/,
  /^\/chat(\/.*)?$/,
  /^\/openmed(\/.*)?$/,
  /^\/(prior-authorizations|claim-submissions)\/[^/]+\/compare-success\/explain$/   // advisory AI explanation
]);

// Non-GET operations every authenticated role (viewer included) may call.
// They record an opinion about advisory AI output and never touch a clinical record.
export const VIEWER_WRITE_OPERATIONS = Object.freeze([
  ['POST', /^\/ai\/feedback$/]                             // POST /api/ai/feedback
]);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function normalizeApiPath(path) {
  const normalized = String(path || '/').toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

export function isAdminOnlyOperation(method, path) {
  const normalizedPath = normalizeApiPath(path);
  const normalizedMethod = String(method || '').toUpperCase();
  return ADMIN_ONLY_OPERATIONS.some(([m, pattern]) => (m === '*' || m === normalizedMethod) && pattern.test(normalizedPath));
}

/** Least role allowed to perform `method path` (path relative to /api). */
export function requiredRoleFor(method, path) {
  if (isAdminOnlyOperation(method, path)) return 'admin';
  const normalizedMethod = String(method || '').toUpperCase();
  if (READ_METHODS.has(normalizedMethod)) return 'viewer';
  const normalizedPath = normalizeApiPath(path);
  if (VIEWER_WRITE_OPERATIONS.some(([m, pattern]) => m === normalizedMethod && pattern.test(normalizedPath))) return 'viewer';
  if (REVIEW_OPERATIONS.some(pattern => pattern.test(normalizedPath))) return 'reviewer';
  return 'submitter';
}

/** Mount after authenticateToken on '/api': enforces the role required by each operation. */
export function enforceRoles(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const requiredRole = requiredRoleFor(req.method, req.path);
  if (!roleSatisfies(req.user.role, requiredRole)) return forbidden(res, requiredRole);
  next();
}

/** Kept for existing imports: role enforcement now covers every role, not only admin. */
export const restrictAdminOperations = enforceRoles;
