/**
 * Format a Date as YYYY-MM-DD using the local calendar date.
 * Unlike `date.toISOString().split('T')[0]`, this does not shift the date to UTC,
 * so a date picked at local midnight in UTC+3 stays on the same day.
 * @param {Date|string|number|null|undefined} date
 * @returns {string} '' when the value is empty or invalid
 */
export function toLocalISODate(date) {
  if (date === null || date === undefined || date === '') return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a 'YYYY-MM-DD' (optionally followed by a time) string into a local Date at midnight.
 * `new Date('YYYY-MM-DD')` is parsed as UTC, which shows the previous day west of UTC.
 * Other inputs fall back to the Date constructor. Returns null for empty/invalid values.
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
export function parseLocalISODate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalise a backend date value for an <input type="date"> / form state.
 * Plain 'YYYY-MM-DD' strings (how the API returns DATE columns) are kept as-is;
 * other values are formatted with the local calendar date.
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export function toDateInputValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return toLocalISODate(value);
}
