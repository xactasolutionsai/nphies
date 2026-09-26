/**
 * Parse a URL and return it only if it uses http or https.
 * Never throws; returns null for relative, malformed or non-web URLs
 * (e.g. `javascript:`), so the result is safe to use as an <a href>.
 * @param {string|null|undefined} value
 * @param {string} [base] - optional base for resolving relative URLs
 * @returns {URL|null}
 */
export function parseHttpUrl(value, base) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = base ? new URL(value.trim(), base) : new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
