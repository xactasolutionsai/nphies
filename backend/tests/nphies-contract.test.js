import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import nphiesService from '../services/nphiesService.js';
import { validateNphiesTransport } from '../config/nphiesTransport.js';
import { formatSaudiDateTime } from '../utils/dateTime.js';
import messageUpdater from '../services/messageUpdater.js';
import messageCorrelator from '../services/messageCorrelator.js';
import systemPollService from '../services/systemPollService.js';
import pool from '../db.js';

const expected = JSON.parse(fs.readFileSync(new URL('./fixtures/nphies-bundles.json', import.meta.url)));
const actual = JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'fixtures/renderBundles.js')], {
  cwd: path.resolve(import.meta.dirname, '../..'), encoding: 'utf8', maxBuffer: 5 * 1024 * 1024
}));
for (const name of Object.keys(expected)) {
  test(`NPHIES wire contract unchanged: ${name}`, () => assert.deepEqual(actual[name], expected[name]));
}

test('Saudi timestamps preserve the instant across host timezones', () => {
  assert.equal(formatSaudiDateTime('2026-08-01T23:30:00Z'), '2026-08-02T02:30:00+03:00');
  assert.equal(Date.parse(formatSaudiDateTime('2026-08-01T23:30:00Z')), Date.parse('2026-08-01T23:30:00Z'));
});

test('TLS is required except explicitly configured OBA sandbox', () => {
  assert.doesNotThrow(() => validateNphiesTransport('https://nphies.invalid', {}));
  assert.throws(() => validateNphiesTransport('http://nphies.invalid', {}));
  assert.throws(() => validateNphiesTransport('http://nphies.invalid', { NPHIES_ENVIRONMENT: 'production', NPHIES_ALLOW_INSECURE_SANDBOX: 'true' }));
  assert.doesNotThrow(() => validateNphiesTransport('http://nphies.invalid', { NPHIES_ENVIRONMENT: 'sandbox', NPHIES_ALLOW_INSECURE_SANDBOX: 'true' }));
});

test('HTTP 400 is not retried; FHIR request and content type are preserved', async t => {
  const originalUrl = nphiesService.baseURL;
  nphiesService.baseURL = 'https://nphies.invalid';
  t.after(() => { nphiesService.baseURL = originalUrl; });
  const post = t.mock.method(axios, 'post', async (url, body, options) => {
    assert.equal(url, 'https://nphies.invalid/$process-message');
    assert.deepEqual(body, expected['priorauth-pharmacy']);
    assert.equal(options.headers['Content-Type'], 'application/fhir+json');
    assert.equal(options.headers.Authorization, undefined); // App JWT never leaves for NPHIES.
    return { status: 400, headers: {}, data: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] } };
  });
  t.mock.method(nphiesService, 'sleep', async () => {});
  const result = await nphiesService.submitPriorAuth(expected['priorauth-pharmacy']);
  assert.equal(result.success, false);
  assert.equal(post.mock.callCount(), 1);
});

test('Transient upstream failure still retries the identical message', async t => {
  let count = 0;
  const originalUrl = nphiesService.baseURL;
  nphiesService.baseURL = 'https://nphies.invalid';
  t.after(() => { nphiesService.baseURL = originalUrl; });
  const response = { resourceType: 'Bundle', type: 'message', entry: [{ resource: { resourceType: 'ClaimResponse', outcome: 'queued' } }] };
  t.mock.method(nphiesService, 'validatePriorAuthResponse', () => ({ valid: true }));
  t.mock.method(axios, 'post', async (url, body) => {
    assert.deepEqual(body, expected['priorauth-professional']);
    if (++count === 1) { const e = new Error('Temporary failure'); e.response = { status: 503 }; throw e; }
    return { status: 200, headers: {}, data: response };
  });
  t.mock.method(nphiesService, 'sleep', async () => {});
  const result = await nphiesService.submitPriorAuth(expected['priorauth-professional']);
  assert.equal(result.success, true);
  assert.equal(count, 2);
});

for (const method of ['updatePriorAuthorization', 'updateClaimSubmission']) {
  test(`${method} preserves zero benefit and does not substitute eligible amount`, async t => {
    const writes = [];
    t.mock.method(pool, 'connect', async () => ({
      query: async (sql, params) => { writes.push({ sql, params }); return { rows: [], rowCount: 1 }; }, release() {}
    }));
    const response = { resourceType: 'ClaimResponse', id: 'response-1', outcome: 'complete',
      total: [{ category: { coding: [{ code: 'benefit' }] }, amount: { value: 0 } },
        { category: { coding: [{ code: 'eligible' }] }, amount: { value: 100 } }],
      item: [{ itemSequence: 1, adjudication: [{ category: { coding: [{ code: 'benefit' }] }, amount: { value: 0 } }] }] };
    await messageUpdater[method](1, response, { resourceType: 'Bundle' }, 'public');
    const financialUpdate = writes.find(write => write.sql.includes('approved_amount ='));
    const placeholder = /approved_amount = COALESCE\(\$(\d+)/.exec(financialUpdate.sql);
    assert.equal(financialUpdate.params[Number(placeholder[1]) - 1], 0);
    const itemUpdate = writes.find(write => write.sql.includes('adjudication_amount ='));
    assert.equal(itemUpdate.params[1], 0);
  });
}

test('MessageHeader response identifier still correlates to the original request', async t => {
  const identifier = 'original-outbound-message';
  t.mock.method(pool, 'connect', async () => ({ query: async (sql, values) => {
    if (sql.includes('outbound_message_header_id')) {
      assert.deepEqual(values, [identifier]);
      return { rows: [{ id: 42 }] };
    }
    return { rows: [] };
  }, release() {} }));
  const match = await messageCorrelator.correlateToOutboundRequest(identifier, { resourceType: 'ClaimResponse' }, 'public');
  assert.equal(match.table, 'prior_authorizations');
  assert.equal(match.recordId, 42);
});

test('Poll processing failures are not reported as success', async t => {
  t.mock.method(systemPollService, 'resolveProvider', async () => ({ nphiesId: 'TEST-PROVIDER' }));
  t.mock.method(systemPollService, 'createPollLog', async () => 1);
  t.mock.method(nphiesService, 'sendPoll', async () => ({ success: true, data: {} }));
  let saved;
  t.mock.method(systemPollService, 'updatePollLog', async (_, value) => { saved = value; });
  t.mock.method(systemPollService, 'processResponseBundle', async () => ({ messagesReceived: 1, messagesProcessed: 0,
    messagesMatched: 0, messagesUnmatched: 0, errors: [{ message: 'DB write failed' }], summary: {} }));
  const result = await systemPollService.executePoll();
  assert.equal(result.success, false);
  assert.equal(saved.status, 'error');
  assert.equal(result.stats.processed, 0);
});
