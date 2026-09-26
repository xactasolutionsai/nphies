// Frontend AI service (frontend/src/services/aiApi.js), loaded like frontend-integration.test.js:
// only Vite's env and the '@/...' aliases are replaced; the real module code runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), key: () => null, length: 0 };
globalThis.window = globalThis.window || new EventTarget();
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = file => fs.readFileSync(new URL(`../../frontend/src/${file}`, import.meta.url), 'utf8');
const httpUrl = moduleUrl(source('services/http.js').replace('import.meta.env.VITE_API_URL', "'https://app.example.test/api'"));
const downloadUrl = moduleUrl(source('utils/download.js'));
const apiUrl = moduleUrl(source('services/api.js').replace("'@/services/http'", JSON.stringify(httpUrl)).replace("'@/utils/download'", JSON.stringify(downloadUrl)));
const ai = await import(moduleUrl(source('services/aiApi.js').replace("'@/services/api'", JSON.stringify(apiUrl))));

test('AI banner shows only when AI is enabled and Ollama is unreachable', () => {
  assert.equal(ai.AI_UNAVAILABLE_BANNER, 'AI features unavailable — forms still work; AI checks require manual review');
  assert.equal(ai.aiBannerVisible({ enabled: true, reachable: false }), true);
  assert.equal(ai.aiBannerVisible({ enabled: true, reachable: true }), false);
  assert.equal(ai.aiBannerVisible({ enabled: false, reachable: null }), false, 'hidden when AI is disabled');
  assert.equal(ai.aiBannerVisible(null), false, 'hidden while unknown');
  assert.equal(ai.aiActionsAvailable({ enabled: true, reachable: true, modelPresent: true }), true);
  assert.equal(ai.aiActionsAvailable({ enabled: true, reachable: true, modelPresent: false }), false);
  assert.equal(ai.aiActionsAvailable({ enabled: true, reachable: false }), false);
});

test('AI service calls the expected endpoints', async t => {
  localStorage.setItem('auth_token', 'tok');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  await ai.default.getHealth();
  await ai.default.sendFeedback(12, 'accepted');
  await ai.default.getRejectionAnalytics({ from: '2026-01-01', to: '', type: 'claim' });
  await ai.default.checkDuplicateIngredients([{ sequence: 1, code: 'A' }]);
  await ai.default.compareWithLastAccepted('claim-submissions', 7);
  await ai.default.explainComparison('prior-authorizations', 8);
  assert.deepEqual(calls.map(c => `${c.method} ${c.url.replace('https://app.example.test/api', '')}`), [
    'GET /ai/health',
    'POST /ai/feedback',
    'GET /ai/analytics/rejections?from=2026-01-01&type=claim',
    'POST /medication-safety/duplicate-ingredients',
    'GET /claim-submissions/7/compare-success',
    'POST /prior-authorizations/8/compare-success/explain'
  ]);
  assert.deepEqual(JSON.parse(calls[1].body), { auditId: 12, verdict: 'accepted' });
  assert.deepEqual(JSON.parse(calls[3].body), { codes: [{ sequence: 1, code: 'A' }] });
});
