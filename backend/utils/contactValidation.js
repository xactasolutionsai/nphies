// Server-side validation for the public contact form (POST /api/contacts).
// source_url is later shown to administrators, so only absolute http(s) URLs are stored.

export const CONTACT_LIMITS = Object.freeze({ name: 255, email: 255, company: 255, message: 5000, source_url: 500 });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSafeHttpUrl(value, maxLength = CONTACT_LIMITS.source_url) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\s<>"'`]/.test(trimmed)) return false;
  let url;
  try { url = new URL(trimmed); } catch { return false; }
  return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname) && !url.username && !url.password;
}

/**
 * Returns a list of { field, message } problems; an empty list means the body is acceptable.
 */
export function validateContactSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [{ field: 'body', message: 'Request body must be a JSON object' }];
  const text = (field, required) => {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      if (required) errors.push({ field, message: `${field} is required` });
      return;
    }
    if (typeof value !== 'string') return errors.push({ field, message: `${field} must be a string` });
    if (required && !value.trim()) return errors.push({ field, message: `${field} is required` });
    if (value.length > CONTACT_LIMITS[field]) errors.push({ field, message: `${field} must be at most ${CONTACT_LIMITS[field]} characters` });
  };
  text('name', true);
  text('email', true);
  text('company', false);
  text('message', true);
  if (typeof body.email === 'string' && body.email.trim() && !EMAIL.test(body.email.trim())) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }
  if (body.source_url !== undefined && body.source_url !== null && body.source_url !== '' && !isSafeHttpUrl(body.source_url)) {
    errors.push({ field: 'source_url', message: `source_url must be an absolute http(s) URL of at most ${CONTACT_LIMITS.source_url} characters` });
  }
  return errors;
}

/** Express middleware for the public contact submission endpoint. */
export function validateContactRequest(req, res, next) {
  const errors = validateContactSubmission(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation error', message: errors[0].message, details: errors });
  if (typeof req.body.source_url === 'string') req.body.source_url = req.body.source_url.trim() || undefined;
  // The controller falls back to the Referer header when source_url is absent; never store an unsafe one.
  if (!req.body.source_url && req.headers.referer !== undefined && !isSafeHttpUrl(req.headers.referer)) {
    delete req.headers.referer;
  }
  next();
}
