// PaymentNotice must acknowledge the original reconciliation, not a guessed id.
export function paymentNoticeContext(record, providerId) {
  const bundle = typeof record.request_bundle === 'string' ? JSON.parse(record.request_bundle) : record.request_bundle;
  const resources = (bundle?.entry || []).map(e => e.resource);
  const reconciliation = resources.find(r => r?.resourceType === 'PaymentReconciliation');
  const header = resources.find(r => r?.resourceType === 'MessageHeader');
  const identifier = reconciliation?.identifier?.[0];
  if (!identifier?.system || !identifier?.value) {
    throw new Error('PaymentNotice requires the original PaymentReconciliation identifier.system and identifier.value (BV-00193).');
  }
  const receivers = (header?.destination || []).map(d => {
    if (d.receiver?.identifier) return d.receiver.identifier;
    const entry = bundle.entry.find(e => e.fullUrl === d.receiver?.reference ||
      `${e.resource?.resourceType}/${e.resource?.id}` === d.receiver?.reference);
    return entry?.resource?.identifier?.find(i => i.system === 'http://nphies.sa/license/provider-license');
  });
  if (!providerId || !receivers.some(i => i?.system === 'http://nphies.sa/license/provider-license' && i.value === String(providerId))) {
    throw new Error('PaymentNotice sender must match the original PaymentReconciliation destination provider (BV-00357).');
  }
  return { system: identifier.system, value: identifier.value };
}
