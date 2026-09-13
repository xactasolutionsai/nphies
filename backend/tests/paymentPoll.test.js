import test from 'node:test';
import assert from 'node:assert/strict';
import service from '../services/nphiesService.js';

test('Payment polling uses the accepted Task format and a 100-message filter', () => {
  const bundle = service.buildPaymentReconciliationPollBundle('test-provider');
  assert.equal(bundle.entry[0].resource.eventCoding.code, 'poll-request');
  const task = bundle.entry.find(e => e.resource.resourceType === 'Task').resource;
  assert.ok(task.input.some(i => i.valuePositiveInt === 100));
  assert.ok(task.input.some(i => i.valueCode === 'payment-reconciliation'));
});

test('Payment poll requires HTTP success and a correlated ok acknowledgement', async t => {
  for (const variant of ['accepted', 'http-error', 'wrong-id', 'fatal-error', 'outcome']) {
    const mock = t.mock.method(service, 'sendPoll', async request => ({
      success: true, status: variant === 'http-error' ? 400 : 200,
      data: variant === 'outcome' ? { resourceType: 'OperationOutcome' } : {
        resourceType: 'Bundle', entry: [{resource: {resourceType: 'MessageHeader', response: {
          code: variant === 'fatal-error' ? 'fatal-error' : 'ok',
          identifier: variant === 'wrong-id' ? 'wrong' : request.entry[0].resource.id
        }}}]
      }
    }));
    const result = await service.pollPaymentReconciliations('test-provider');
    assert.equal(result.success, variant === 'accepted');
    assert.equal(result.count, 0);
    mock.mock.restore();
  }
});
