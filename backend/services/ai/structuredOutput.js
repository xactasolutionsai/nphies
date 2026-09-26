/**
 * Structured LLM output (owner item C5).
 *
 * Every model reply that feeds a validation or clinical result is requested with Ollama
 * structured outputs (`format` = a JSON Schema) and read here: strict JSON.parse of the whole
 * reply (no regex extraction of a JSON object out of prose), then validation against the same
 * schema. Anything else is `{ ok: false }`, and callers fail closed with the shape their UI
 * already understands (isValid:null / analysisIncomplete / requiresManualReview).
 */

const typeOf = value => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

/**
 * Small JSON-Schema subset validator: type (string or list), enum, properties, required, items,
 * minimum/maximum, minLength (counted after trimming, so blank text fails)/maxLength, pattern,
 * minItems/maxItems. Returns a list of errors.
 */
export function validateAgainstSchema(schema, value, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  const actual = typeOf(value);
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some(t => t === actual || (t === 'number' && actual === 'integer'));
    if (!ok) return [`${path}: expected ${allowed.join('|')}, got ${actual}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (actual === 'number' || actual === 'integer') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}: above ${schema.maximum}`);
  }
  if (actual === 'string') {
    if (schema.maxLength && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (actual === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${path}.${key}: required`);
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validateAgainstSchema(sub, value[key], `${path}.${key}`));
    }
  }
  if (actual === 'array') {
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validateAgainstSchema(schema.items, item, `${path}[${i}]`)));
  }
  return errors;
}

/**
 * Parse a model reply that was requested with `format: schema`.
 * @returns {{ ok: true, data: any, errors: [] } | { ok: false, data: null, errors: string[] }}
 */
export function parseStructuredReply(reply, schema) {
  if (typeof reply !== 'string' || reply.trim() === '') {
    return { ok: false, data: null, errors: ['reply is empty'] };
  }
  let data;
  try {
    data = JSON.parse(reply);
  } catch {
    return { ok: false, data: null, errors: ['reply is not JSON'] };
  }
  const errors = validateAgainstSchema(schema, data);
  return errors.length ? { ok: false, data: null, errors } : { ok: true, data, errors: [] };
}

/** User-facing reason used by every fail-closed result built from an invalid reply. */
export const INVALID_REPLY_MESSAGE = 'The AI reply did not match the expected format. It was not used; manual review is required.';
