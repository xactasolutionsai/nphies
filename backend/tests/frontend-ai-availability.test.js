// Frontend services loaded like frontend.test.js (only Vite's env and '@/...' aliases are replaced):
// AI availability comes from GET /api/ai/health at runtime, never from a build-time constant, and an
// unavailable AI is reported ("AI unavailable — manual review required"), never silently skipped.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), key: () => null, length: 0 };
globalThis.window = globalThis.window || new EventTarget();
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = file => fs.readFileSync(new URL(`../../frontend/src/${file}`, import.meta.url), 'utf8');
const httpUrl = moduleUrl(source('services/http.js').replace('import.meta.env.VITE_API_URL', "'https://app.example.test/api'"));
const downloadUrl = moduleUrl(source('utils/download.js'));
const apiModule = await import(moduleUrl(source('services/api.js').replace("'@/services/http'", JSON.stringify(httpUrl)).replace("'@/utils/download'", JSON.stringify(downloadUrl))));
const api = apiModule.default;
const dates = await import('../../frontend/src/utils/date.js');

beforeEach(() => { values.clear(); window.dispatchEvent(new Event('auth:changed')); });

const mockBackend = (t, health) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const path = url.replace('https://app.example.test/api', '');
    calls.push(`${options.method || 'GET'} ${path}`);
    const body = path === '/ai/health' ? health : { success: true, analysis: { overallRiskAssessment: 'low' } };
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
};

test('api.js has no build-time AI switch', () => {
  assert.equal('AI_FEATURES_ENABLED' in apiModule, false);
  assert.equal(apiModule.AI_UNAVAILABLE_MESSAGE, 'AI unavailable — manual review required');
});

test('medication safety analysis always reaches the backend (it returns the rule check and an explicit AI status)', async t => {
  const calls = mockBackend(t, { enabled: false, reachable: null });
  const result = await api.analyzeMedicationSafety([{ medicationName: 'Synthetic', medicationCode: 'X' }], {});
  assert.ok(calls.includes('POST /medication-safety/analyze'), calls.join(', '));
  assert.equal(result.success, true);
});

test('LLM-only calls run when /api/ai/health says AI is enabled', async t => {
  const calls = mockBackend(t, { enabled: true, reachable: true, modelPresent: true });
  await api.getMedicationSuggestions('synthetic diagnosis', 40, 'male');
  await api.validatePriorAuth({ auth_type: 'professional' });
  assert.deepEqual(calls.filter(c => c.startsWith('POST')), ['POST /medication-safety/suggest', 'POST /ai-validation/validate-prior-auth']);
});

test('LLM-only calls report AI unavailable when it is disabled, unreachable or the health check fails', async t => {
  for (const health of [{ enabled: false, reachable: null }, { enabled: true, reachable: false }, new Error('network down')]) {
    window.dispatchEvent(new Event('auth:changed'));
    t.mock.restoreAll();
    const calls = mockBackend(t, health);
    for (const call of [
      () => api.getMedicationSuggestions('synthetic diagnosis', 40, 'male'),
      () => api.checkDrugInteractions([{ name: 'A' }, { name: 'B' }]),
      () => api.validatePriorAuth({ auth_type: 'professional' }),
      () => api.enhanceClinicalText('text', 'patient_history')
    ]) {
      assert.deepEqual(await call(), { success: false, disabled: true, message: 'AI unavailable — manual review required' });
    }
    assert.deepEqual(calls.filter(c => c.startsWith('POST')), [], String(health?.message || JSON.stringify(health)));
  }
});

test('date-only values are shown without a time; timestamps keep their time', () => {
  const dateOnly = dates.formatDisplayDateTime('2026-09-26');
  assert.equal(dateOnly, new Date(2026, 8, 26).toLocaleDateString());
  assert.ok(!/AM|PM|:\d\d/.test(dateOnly), dateOnly);
  assert.equal(dates.formatDisplayDateTime('2026-09-26T13:41:53.000Z'), new Date('2026-09-26T13:41:53.000Z').toLocaleString());
  assert.equal(dates.formatDisplayDateTime(null), '-');
  assert.equal(dates.formatDisplayDate('2026-09-26'), new Date(2026, 8, 26).toLocaleDateString());
});
