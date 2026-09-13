import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
globalThis.window = new EventTarget();
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = file => fs.readFileSync(new URL(`../../frontend/src/${file}`, import.meta.url), 'utf8');
// Only replace Vite's compile-time environment/alias; execute the real service code.
const httpUrl = moduleUrl(source('services/http.js').replace('import.meta.env.VITE_API_URL', "'https://app.example.test/api'"));
const http = await import(httpUrl);
const { default: api } = await import(moduleUrl(source('services/api.js').replace("'@/services/http'", JSON.stringify(httpUrl))));
const chat = await import(moduleUrl(source('services/chatService.js').replace("'@/services/http'", JSON.stringify(httpUrl))));
const draft = await import('../../frontend/src/utils/draftManager.js');

beforeEach(() => { values.clear(); window.dispatchEvent(new Event('auth:changed')); });

test('One normalized API base prevents duplicate /api and supports same-origin TLS', () => {
  assert.equal(http.normalizeApiBase('https://example.test'), 'https://example.test/api');
  assert.equal(http.normalizeApiBase('https://example.test/api/'), 'https://example.test/api');
  assert.equal(http.normalizeApiBase(), '/api');
});

test('Authenticated fetch merges headers and clears an expired session', async t => {
  localStorage.setItem('auth_token', 'token-A');
  localStorage.setItem('auth_user', JSON.stringify({ id: 1 }));
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer token-A');
    assert.equal(options.headers.get('X-Test'), 'yes');
    return new Response('{}', { status: 401 });
  });
  await http.apiFetch('https://app.example.test/api/users', { headers: { 'X-Test': 'yes' } });
  assert.equal(localStorage.getItem('auth_token'), null);
  assert.equal(localStorage.getItem('auth_user'), null);
});

test('API cache is invalidated by writes and isolated by account', async t => {
  let requests = 0;
  localStorage.setItem('auth_token', 'A');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ owner: localStorage.getItem('auth_token'), version: ++requests })));
  const first = await api.getPatient(1);
  assert.deepEqual(await api.getPatient(1), first);
  await api.updatePatient(1, { name: 'Changed' });
  const updated = await api.getPatient(1);
  assert.notEqual(updated.version, first.version);
  localStorage.setItem('auth_token', 'B');
  assert.equal((await api.getPatient(1)).owner, 'B');
});

test('Drafts cannot cross accounts and logout removes legacy unowned drafts', () => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1 }));
  assert.equal(draft.saveDraft({ patient: { name: 'Test A' } }), true);
  localStorage.setItem('auth_user', JSON.stringify({ id: 2 }));
  assert.equal(draft.loadDraft(), null);
  localStorage.setItem('generalRequestDraft', '{"old":"unowned"}');
  http.clearSession();
  assert.equal(localStorage.getItem('generalRequestDraft'), null);
});

test('Chat uses the normalized authenticated endpoint and reports truncated streams', async t => {
  localStorage.setItem('auth_token', 'chat-token');
  let resolveError;
  const errorReceived = new Promise(resolve => { resolveError = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://app.example.test/api/chat/stream');
    assert.equal(options.headers.get('Authorization'), 'Bearer chat-token');
    return new Response('data: {"type":"chunk","content":"partial"}\n\n');
  });
  const chunks = [];
  await chat.streamChatMessage('test', 'general', [], chunk => chunks.push(chunk), () => assert.fail('Unexpected completion'), resolveError);
  const error = await errorReceived;
  assert.match(error.message, /before the response was complete/);
  assert.deepEqual(chunks, ['partial']);
});
