// Self-service registration is opt-in: it is only reachable when
// ENABLE_PUBLIC_REGISTRATION=true. Otherwise accounts are created by an operator
// (scripts/createAdminUser.js, scripts/grantAdmin.js).
export function publicRegistrationEnabled(env = process.env) {
  return env.ENABLE_PUBLIC_REGISTRATION === 'true';
}

export function requirePublicRegistrationEnabled(req, res, next) {
  if (publicRegistrationEnabled()) return next();
  res.set('Cache-Control', 'no-store');
  return res.status(403).json({ error: 'Registration disabled', message: 'Public registration is disabled' });
}
