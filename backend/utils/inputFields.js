export function selectInputFields(data, allowed, ignored = []) {
  const fields = new Set(allowed);
  const skip = new Set(['id', 'created_at', 'updated_at', ...ignored]);
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key)) continue;
    if (!fields.has(key)) {
      const error = new Error(`Unknown field: ${key}`);
      error.status = 400;
      throw error;
    }
    result[key] = value;
  }
  return result;
}

export function validateNestedArrays(body, names) {
  for (const name of names) {
    if (Object.hasOwn(body, name) && !Array.isArray(body[name])) {
      const error = new Error(`${name} must be an array (use [] to clear it)`);
      error.status = 400;
      throw error;
    }
  }
}
