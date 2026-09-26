/**
 * Shared Ollama connection settings for every AI client in the backend
 * (ollamaService, medbotService, chatService).
 *
 * - One base URL, taken from OLLAMA_BASE_URL (default: a local Ollama).
 * - Plain HTTP is only accepted for loopback / private (RFC 1918) hosts. Clinical
 *   text is sent to this endpoint, so a public host must use HTTPS unless an
 *   operator explicitly opts in with OLLAMA_ALLOW_INSECURE_REMOTE=true.
 * - Every request carries an AbortSignal timeout, so a timed-out generation is
 *   actually cancelled instead of being left running while a retry starts.
 */

import { Ollama } from 'ollama';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_TIMEOUT_MS = 120000;

const isPrivateIPv4 = (host) => {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

/** True for loopback and private-network hosts, where plain HTTP is acceptable. */
export function isLocalOrPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
  // IPv6 unique-local (fc00::/7)
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  return isPrivateIPv4(host);
}

/**
 * Resolve and validate the Ollama base URL. Throws a descriptive Error when the
 * URL is malformed or is a public host over plain HTTP without the opt-in.
 */
export function resolveOllamaBaseUrl(env = process.env) {
  const raw = String(env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('OLLAMA_BASE_URL is not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`OLLAMA_BASE_URL must use http or https (got ${url.protocol})`);
  }
  if (url.protocol === 'http:' && !isLocalOrPrivateHost(url.hostname) &&
      env.OLLAMA_ALLOW_INSECURE_REMOTE !== 'true') {
    throw new Error(
      `Refusing to send clinical data to ${url.host} over plain HTTP. ` +
      'Use an https:// OLLAMA_BASE_URL, or set OLLAMA_ALLOW_INSECURE_REMOTE=true to accept the risk.'
    );
  }
  return raw;
}

export function resolveOllamaTimeout(env = process.env) {
  const value = parseInt(env.OLLAMA_TIMEOUT, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_OLLAMA_TIMEOUT_MS;
}

/**
 * Read the shared configuration without throwing: an invalid endpoint is returned
 * as `configError` so each service can refuse requests with a clear message while
 * the rest of the API keeps starting normally.
 */
export function getOllamaConfig(env = process.env) {
  const timeoutMs = resolveOllamaTimeout(env);
  try {
    return { baseUrl: resolveOllamaBaseUrl(env), timeoutMs, configError: null };
  } catch (error) {
    return { baseUrl: null, timeoutMs, configError: error };
  }
}

/** True when an error was produced by our request timeout. */
export function isTimeoutError(error) {
  return error?.name === 'TimeoutError' || error?.cause?.name === 'TimeoutError' ||
    /timed out|aborted due to timeout/i.test(error?.message || '');
}

/**
 * Create an Ollama client whose every HTTP request is aborted after `timeoutMs`.
 * The ollama library does not pass a signal for non-streamed calls, so the
 * timeout is enforced in the fetch it uses; for streamed calls the library's own
 * signal is combined with ours.
 */
export function createOllamaClient({ baseUrl, timeoutMs }) {
  return new Ollama({
    host: baseUrl || DEFAULT_OLLAMA_BASE_URL,
    fetch: (input, init = {}) => {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
      return fetch(input, { ...init, signal });
    }
  });
}
