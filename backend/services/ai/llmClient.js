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
import { validateAgainstSchema, parseStructuredReply } from './structuredOutput.js';

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

export { validateAgainstSchema };

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
    const { ok, data, errors } = parseStructuredReply(reply, schema);
    if (!ok) {
      const auditId = await record({ feature, userId, inputHash: hash, latencyMs, available: false, error: `schema: ${errors.slice(0, 3).join('; ')}` });
      return { available: false, reason: 'The AI reply did not match the expected format', model, latencyMs, auditId, inputHash: hash };
    }
    const auditId = await record({ feature, userId, inputHash: hash, latencyMs, available: true, outputSummary: summarize(data) });
    return { available: true, data, model, latencyMs, auditId, inputHash: hash };
  }

  return { get model() { return currentModel(); }, generateJSON };
}

export default createLlmClient();
