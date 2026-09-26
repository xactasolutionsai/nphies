/**
 * Minimal LLM client for the advisory AI features. It does not add a second Ollama
 * configuration: base URL, timeout and the HTTPS rule come from services/ollamaConfig.js.
 *
 * generateJSON() asks for Ollama structured output (format = JSON schema), validates the
 * parsed reply against the same schema, writes an ai_audit_log row (hash + summary only),
 * and fails closed: { available: false, reason } whenever AI is disabled, unreachable or the
 * reply does not match. It never throws for model problems. Prompts must already be redacted.
 */
import crypto from 'node:crypto';
import { getOllamaConfig, createOllamaClient, isTimeoutError } from '../ollamaConfig.js';
import { isAIFeatureEnabled, aiModels } from './config.js';
import { writeAudit } from './audit.js';

const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
};

export function hashInput(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

const typeOf = value => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

/** Small JSON-schema subset validator: type, properties, required, items, enum, maxLength, maxItems. */
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
  if (actual === 'string' && schema.maxLength && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
  if (actual === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${path}.${key}: required`);
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validateAgainstSchema(sub, value[key], `${path}.${key}`));
    }
  }
  if (actual === 'array') {
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validateAgainstSchema(schema.items, item, `${path}[${i}]`)));
  }
  return errors;
}

export function createLlmClient({ client = null, env = process.env, audit = writeAudit, now = () => Date.now() } = {}) {
  // Read at call time: dotenv may load after this module is imported.
  const currentModel = () => aiModels(env).model;

  async function record(entry) {
    try {
      return await audit({ source: 'llm', model: currentModel(), ...entry });
    } catch (error) {
      console.error('[AI] Audit log write failed:', error.message);
      return null;
    }
  }

  async function generateJSON({ feature, system, prompt, schema, timeoutMs, userId = null, inputHash, summarize = data => data }) {
    const model = currentModel();
    const hash = inputHash || hashInput({ feature, system, prompt, schema, model });
    if (!isAIFeatureEnabled(feature, env)) {
      return { available: false, reason: 'AI features are disabled', model, auditId: null, inputHash: hash };
    }
    let transport = client;
    if (!transport) {
      const config = getOllamaConfig(env);
      if (config.configError) {
        return { available: false, reason: `Ollama configuration refused: ${config.configError.message}`, model, auditId: null, inputHash: hash };
      }
      transport = createOllamaClient({ baseUrl: config.baseUrl, timeoutMs: timeoutMs || config.timeoutMs });
    }

    const started = now();
    let reply;
    try {
      const response = await transport.generate({
        model, system, prompt, stream: false, format: schema, options: { temperature: 0 }
      });
      reply = response?.response;
    } catch (error) {
      const latencyMs = now() - started;
      const reason = isTimeoutError(error) ? 'The AI model is unavailable (timed out)' : 'The AI model is unavailable';
      const auditId = await record({ feature, userId, inputHash: hash, latencyMs, available: false, error: error.message });
      return { available: false, reason, model, latencyMs, auditId, inputHash: hash };
    }

    const latencyMs = now() - started;
    let data = null;
    try { data = JSON.parse(reply); } catch { data = null; }
    const errors = data === null ? ['reply is not JSON'] : validateAgainstSchema(schema, data);
    if (errors.length) {
      const auditId = await record({ feature, userId, inputHash: hash, latencyMs, available: false, error: `schema: ${errors.slice(0, 3).join('; ')}` });
      return { available: false, reason: 'The AI reply did not match the expected format', model, latencyMs, auditId, inputHash: hash };
    }
    const auditId = await record({ feature, userId, inputHash: hash, latencyMs, available: true, outputSummary: summarize(data) });
    return { available: true, data, model, latencyMs, auditId, inputHash: hash };
  }

  return { get model() { return currentModel(); }, generateJSON };
}

export default createLlmClient();
