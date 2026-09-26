// Role-based access control. Roles come from the database via authenticateToken
// (req.user.role), never from JWT claims.

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Administrator role required' });
    }
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

export function normalizeApiPath(path) {
  const normalized = String(path || '/').toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

export function isAdminOnlyOperation(method, path) {
  const normalizedPath = normalizeApiPath(path);
  const normalizedMethod = String(method || '').toUpperCase();
  return ADMIN_ONLY_OPERATIONS.some(([m, pattern]) => (m === '*' || m === normalizedMethod) && pattern.test(normalizedPath));
}

/** Mount after authenticateToken on '/api': rejects admin-only operations for other roles. */
export function restrictAdminOperations(req, res, next) {
  if (!isAdminOnlyOperation(req.method, req.path)) return next();
  return requireRole('admin')(req, res, next);
}
