import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import nphiesService from '../services/nphiesService.js';

const bundle = { resourceType: 'Bundle', id: 'request-1', type: 'message', entry: [] };

function useInvalidHost(t) {
  const originalUrl = nphiesService.baseURL;
  nphiesService.baseURL = 'https://nphies.invalid';
  t.after(() => { nphiesService.baseURL = originalUrl; });
  t.mock.method(nphiesService, 'sleep', async () => {});
}

const failures = {
  timeout: () => Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED', request: {} }),
  reset: () => Object.assign(new Error('socket hang up'), { code: 'ECONNRESET', request: {} }),
  http503: () => Object.assign(new Error('Service Unavailable'), { response: { status: 503, statusText: 'Service Unavailable', data: '' } })
};

// Non-idempotent messages must never be POSTed twice once NPHIES may have received them.
for (const method of ['submitPriorAuth', 'submitClaim', 'submitCancelRequest', 'submitBatchClaim']) {
  for (const [name, makeError] of Object.entries(failures)) {
    test(`${method} is not re-sent after ${name}`, async t => {
      useInvalidHost(t);
      const post = t.mock.method(axios, 'post', async () => { throw makeError(); });
      const result = await nphiesService[method](bundle);
      assert.equal(result.success, false);
      assert.equal(post.mock.callCount(), 1);
      assert.equal(result.deliveryState, 'unknown');
    });
  }

  test(`${method} is not re-sent after a 200 carrying an error`, async t => {
    useInvalidHost(t);
    const post = t.mock.method(axios, 'post', async () => ({ status: 200, headers: {}, data: '<html>gateway error</html>' }));
    const result = await nphiesService[method](bundle);
    assert.equal(result.success, false);
    assert.equal(post.mock.callCount(), 1);
    // formatError keeps the real reason instead of "HTTP_200: OK"
    assert.match(result.error.message, /HTML|unexpected|Invalid/);
    assert.notEqual(result.error.message, 'OK');
  });

  test(`${method} retries only when the connection proves nothing was sent`, async t => {
    useInvalidHost(t);
    let calls = 0;
    t.mock.method(axios, 'post', async () => {
      calls++;
      throw Object.assign(new Error('getaddrinfo ENOTFOUND nphies.invalid'), { code: 'ENOTFOUND' });
    });
    const result = await nphiesService[method](bundle);
    assert.equal(result.success, false);
    assert.equal(calls, nphiesService.retryAttempts);
    assert.equal(result.deliveryState, 'not-sent');
  });
}

test('Eligibility (idempotent) retries after 503 and succeeds', async t => {
  useInvalidHost(t);
  let calls = 0;
  const response = { resourceType: 'Bundle', type: 'message', entry: [
    { resource: { resourceType: 'MessageHeader' } }, { resource: { resourceType: 'CoverageEligibilityResponse' } }] };
  t.mock.method(axios, 'post', async () => {
    if (++calls === 1) throw failures.http503();
    return { status: 200, headers: {}, data: response };
  });
  const result = await nphiesService.checkEligibility(bundle);
  assert.equal(result.success, true);
  assert.equal(calls, 2);
});

test('Eligibility still stops on 4xx and on transport configuration errors', async t => {
  useInvalidHost(t);
  const post = t.mock.method(axios, 'post', async () => ({ status: 400, headers: {}, data: { resourceType: 'OperationOutcome', issue: [] } }));
  assert.equal((await nphiesService.checkEligibility(bundle)).success, false);
  assert.equal(post.mock.callCount(), 1);

  nphiesService.baseURL = 'http://nphies.invalid'; // HTTP without the sandbox opt-in
  const result = await nphiesService.checkEligibility(bundle);
  assert.equal(result.success, false);
  assert.equal(result.deliveryState, 'not-sent');
  assert.equal(post.mock.callCount(), 1);
});

test('formatError reports HTTP status text only for real HTTP failures', () => {
  const invalidBody = Object.assign(new Error('Invalid NPHIES response: Bundle must contain ClaimResponse'), {
    response: { status: 200, statusText: 'OK', data: { resourceType: 'Bundle' } }
  });
  assert.equal(nphiesService.formatError(invalidBody).message, 'Invalid NPHIES response: Bundle must contain ClaimResponse');
  const gateway = Object.assign(new Error('Request failed'), { response: { status: 502, statusText: 'Bad Gateway', data: '' } });
  assert.equal(nphiesService.formatError(gateway).message, 'Bad Gateway');
});

test('Batch poll bundle is built inside the error handler', async t => {
  t.mock.method(axios, 'post', async () => { throw new Error('must not be called'); });
  const result = await nphiesService.pollBatchClaimResponses(null);
  assert.equal(result.success, false);
  assert.equal(result.count, 0);
});
