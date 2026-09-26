/**
 * Parse a JSON string without throwing.
 * Non-string values are returned as-is (or the fallback when null/undefined).
 * @param {*} value
 * @param {*} fallback - returned for empty or malformed input
 */
export function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
