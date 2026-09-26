import { resolveIdentifier, providerSystem } from './paymentValidation.js';

// PaymentNotice must acknowledge the original reconciliation, not a guessed id.
// Receiver lookup reuses resolveIdentifier (shared with originalPayment) instead of a copy.
export function paymentNoticeContext(record, providerId) {
  const bundle = typeof record.request_bundle === 'string' ? JSON.parse(record.request_bundle) : record.request_bundle;
  const resources = (bundle?.entry || []).map(e => e.resource);
  const reconciliation = resources.find(r => r?.resourceType === 'PaymentReconciliation');
  const header = resources.find(r => r?.resourceType === 'MessageHeader');
  const identifier = reconciliation?.identifier?.[0];
  if (!identifier?.system || !identifier?.value) {
    throw new Error('PaymentNotice requires the original PaymentReconciliation identifier.system and identifier.value (BV-00193).');
  }
  const receivers = (header?.destination || []).map(d => resolveIdentifier(bundle, d.receiver, providerSystem));
  if (!providerId || !receivers.some(i => i?.value === String(providerId))) {
    throw new Error('PaymentNotice sender must match the original PaymentReconciliation destination provider (BV-00357).');
  }
  return { system: identifier.system, value: identifier.value };
}
