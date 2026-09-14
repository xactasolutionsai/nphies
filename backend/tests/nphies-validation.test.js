import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import service from '../services/nphiesService.js';
import { getMapper } from '../services/priorAuthMapper/index.js';
import { getClaimMapper } from '../services/claimMapper/index.js';
import { clinicalInput } from './fixtures/clinicalInput.js';
import { operationOutcomeErrors } from '../utils/nphiesErrors.js';

for (const type of ['professional', 'institutional', 'dental', 'vision', 'pharmacy']) {
  for (const factor of [0, 0.5, 1]) {
    test(`${type} serializes factor ${factor} used for net in claims and authorizations`, () => {
      for (const use of ['claim', 'priorauth']) {
        const input = clinicalInput(type);
        input.claim.items.forEach(item => { item.factor = factor; });
        input.priorAuth.items.forEach(item => { item.factor = factor; });
        const bundle = use === 'claim' ? getClaimMapper(type).buildClaimRequestBundle(input) : getMapper(type).buildPriorAuthRequestBundle(input);
        const claim = bundle.entry.find(e => e.resource.resourceType === 'Claim').resource;
        for (const item of claim.item) {
          assert.equal(item.factor, factor);
          const tax = item.extension?.find(e => e.url.endsWith('extension-tax'))?.valueMoney?.value || 0;
          assert.ok(Math.abs(item.net.value - (item.quantity.value * item.unitPrice.value * factor + tax)) < 0.01);
        }
      }
    });
  }
}

test('Unknown upstream codes retain text, diagnostics, coding and FHIR expression', () => {
  const outcome = { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'business-rule',
    details: { text: 'Exact requirement', coding: [{ code: 'BV-99999', system: 'test' }] },
    diagnostics: 'Additional context', expression: ['Bundle.entry[1].resource.payment'] }] };
  const error = operationOutcomeErrors(outcome)[0];
  assert.equal(error.code, 'BV-99999');
  assert.equal(error.message, 'Exact requirement');
  assert.equal(error.diagnostics, 'Additional context');
  assert.equal(error.location, 'Bundle.entry[1].resource.payment');
  const formatted = service.formatError({ response: { status: 400, data: outcome } });
  assert.match(formatted.message, /BV-99999: Exact requirement/);
  assert.equal(formatted.errors[0].location, error.location);
  assert.equal(getClaimMapper('professional').parseClaimResponse(outcome).errors[0].code, 'BV-99999');
  assert.equal(getMapper('professional').parsePriorAuthResponse(outcome).errors[0].code, 'BV-99999');
});

test('Business errors survive ClaimResponse parsing even with complete outcome', () => {
  const bundle = { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'ClaimResponse', outcome: 'complete',
    error: [{ itemSequence: 2, code: { text: 'Missing factor', coding: [{ code: 'TEST-NEW' }] } }] } }] };
  for (const parsed of [getClaimMapper('professional').parseClaimResponse(bundle), getMapper('professional').parsePriorAuthResponse(bundle)]) {
    assert.equal(parsed.success, false);
    assert.equal(parsed.errors[0].code, 'TEST-NEW');
    assert.equal(parsed.errors[0].itemSequence, 2);
  }
});

function reconciliation() {
  return { identifier_system: 'stale', identifier_value: 'stale', payment_amount: 10, request_bundle: {
    resourceType: 'Bundle', entry: [
      { resource: { resourceType: 'MessageHeader', destination: [{ endpoint: 'https://provider.test', receiver: { identifier: {
        system: 'http://nphies.sa/license/provider-license', value: 'test-provider'
      } } }] } },
      { resource: { resourceType: 'PaymentReconciliation', paymentDate: '2026-01-01', paymentAmount: { value: 10, currency: 'SAR' }, identifier: [{ system: 'https://payer.test/reconciliation', value: 'exact-id' }] } }
    ]
  } };
}

test('Payment notice uses exact original reconciliation and refuses unrelated senders or missing evidence', () => {
  const bundle = service.buildPaymentNoticeBundle(reconciliation(), 'test-provider');
  const payment = bundle.entry.find(e => e.resource.resourceType === 'PaymentNotice').resource.payment;
  assert.deepEqual(payment.identifier, { system: 'https://payer.test/reconciliation', value: 'exact-id' });
  assert.throws(() => service.buildPaymentNoticeBundle(reconciliation(), 'wrong-provider'), /BV-00357/);
  assert.throws(() => service.buildPaymentNoticeBundle({ fhir_id: 'not-business-id' }, 'test-provider'), /BV-00193/);
});

test('Payment acknowledgement requires correlated ok, including HTTP 200 responses', async t => {
  const request = service.buildPaymentNoticeBundle(reconciliation(), 'test-provider');
  const id = request.entry[0].resource.id;
  for (const variant of ['ok', 'wrong-id', 'empty', 'fatal-error']) {
    const mock = t.mock.method(axios, 'post', async () => ({ status: 200, data: {
      resourceType: 'Bundle', type: 'message', entry: variant === 'empty' ? [] : [{ resource: { resourceType: 'MessageHeader', response: {
        identifier: variant === 'wrong-id' ? 'other' : id, code: variant === 'fatal-error' ? 'fatal-error' : 'ok'
      } } }]
    } }));
    assert.equal((await service.sendPaymentNotice(request)).success, variant === 'ok');
    mock.mock.restore();
  }
});
