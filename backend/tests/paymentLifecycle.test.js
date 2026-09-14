import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import axios from 'axios';
import service from '../services/nphiesService.js';
import { reconciliationBundleErrors, paymentResourceErrors } from '../utils/paymentValidation.js';

export const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/payment-reconciliation-official.json', import.meta.url)));
test('Official reconciliation validates; optional claim references allow advances', () => {
  const bundle = fixture();
  assert.deepEqual(reconciliationBundleErrors(bundle), []);
  const pr = bundle.entry[1].resource;
  delete pr.detail[0].request;
  delete pr.detail[0].response;
  assert.deepEqual(reconciliationBundleErrors(bundle), []);
  pr.paymentAmount.value = 0;
  assert.deepEqual(paymentResourceErrors(pr), []);
  pr.paymentAmount.value = -1;
  assert.ok(paymentResourceErrors(pr).some(e => e.includes('paymentAmount')));
});
test('Reconciliation rejects missing mandatory fields, invalid currency, dates and wrong message', () => {
  for (const key of ['identifier', 'period', 'paymentIssuer', 'requestor', 'outcome', 'paymentDate', 'created', 'paymentAmount']) {
    const bundle = fixture(); delete bundle.entry[1].resource[key];
    assert.ok(reconciliationBundleErrors(bundle).length, key);
  }
  const bundle = fixture(); bundle.entry[1].resource.detail[0].amount.currency = 'USD';
  assert.ok(reconciliationBundleErrors(bundle).some(e => e.includes('SAR')));
  bundle.entry[1].resource.detail[0].date = '2026-02-31';
  assert.ok(reconciliationBundleErrors(bundle).some(e => e.includes('.date')));
  bundle.type = 'collection'; assert.ok(reconciliationBundleErrors(bundle).length);
});
test('Nested payment polling preserves original message context', () => {
  const original = fixture();
  const envelope = { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Bundle', entry: [{ resource: original }] } }] };
  assert.deepEqual(service.extractPaymentReconciliationsFromPollResponse(envelope), [original]);
});
test('Notice uses original financial amount and receipt date, not stale local values', () => {
  const bundle = service.buildPaymentNoticeBundle({request_bundle: fixture(), payment_amount: 999}, 'DC-FHIR', {}, 'paid', {receivedDate: '2026-01-01'});
  const notice = bundle.entry[1].resource;
  assert.equal(notice.amount.value, 239.55);
  assert.equal(notice.paymentDate, '2026-01-01');
  assert.throws(() => service.buildPaymentNoticeBundle({request_bundle:fixture()}, 'DC-FHIR', {}, 'unknown'), /Invalid payment status/);
});
test('Timeout leaves delivery unknown and is never retried', async t => {
  const post = t.mock.method(axios, 'post', async () => { throw Object.assign(new Error('timeout'), {request: {}, code:'ETIMEDOUT'}); });
  const result = await service.sendPaymentNotice({entry: []});
  assert.equal(result.deliveryState, 'unknown');
  assert.equal(result.success, false);
  assert.equal(post.mock.callCount(), 1);
});
