// NPHIES FS 1.0.0 payment profiles, retrieved 2026-09-14.
const base = 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/';
export const providerSystem = 'http://nphies.sa/license/provider-license';
export const payerSystem = 'http://nphies.sa/license/payer-license';
export function paymentError(message, status = 422) {
  return Object.assign(new Error(message), { status });
}
export function resolveIdentifier(bundle, reference, system) {
  if (reference?.identifier?.system === system && reference.identifier.value) return reference.identifier;
  const entry = bundle?.entry?.find(e => e.fullUrl === reference?.reference ||
    `${e.resource?.resourceType}/${e.resource?.id}` === reference?.reference);
  return entry?.resource?.identifier?.find(i => i.system === system && i.value);
}
export function originalPayment(record) {
  const bundle = typeof record.request_bundle === 'string' ? JSON.parse(record.request_bundle) : record.request_bundle;
  const pr = bundle?.entry?.find(e => e.resource?.resourceType === 'PaymentReconciliation')?.resource;
  const header = bundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
  if (!pr || !header) throw paymentError('Original PaymentReconciliation message is required.');
  const provider = resolveIdentifier(bundle, header.destination?.[0]?.receiver, providerSystem);
  if (!provider) throw paymentError('Original PaymentReconciliation destination provider is required (BV-00357).');
  return { bundle, pr, header, provider };
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function paymentResourceErrors(pr) {
  const errors = [];
  const required = ['id', 'created', 'period', 'paymentIssuer', 'requestor', 'paymentDate', 'paymentAmount'];
  for (const key of required) if (pr?.[key] == null || pr[key] === '') errors.push(`PaymentReconciliation.${key} is required`);
  if (!pr) return errors;
  if (!pr.meta?.profile?.some(p => p.split('|')[0] === `${base}payment-reconciliation`)) errors.push('PaymentReconciliation.meta.profile is required');
  if (pr.identifier?.length !== 1 || !pr.identifier[0].system || !pr.identifier[0].value) errors.push('PaymentReconciliation.identifier requires exactly one system and value');
  if (pr.status !== 'active') errors.push('PaymentReconciliation.status must be active (BV-00337)');
  if (pr.outcome !== 'complete') errors.push('PaymentReconciliation.outcome must be complete (BV-00338)');
  if (!Number.isFinite(Date.parse(pr.created)) || Date.parse(pr.created) > Date.now()) errors.push('PaymentReconciliation.created must be a valid date/time not in the future (BV-00361)');
  if (!validDate(pr.paymentDate)) errors.push('PaymentReconciliation.paymentDate must be a valid date');
  if (!pr.period?.start || !pr.period?.end || !Number.isFinite(Date.parse(pr.period.start)) ||
      !Number.isFinite(Date.parse(pr.period.end)) || Date.parse(pr.period.start) > Date.parse(pr.period.end)) errors.push('PaymentReconciliation.period requires ordered start and end dates');
  const money = (value, path, nonnegative = false) => {
    if (typeof value?.value !== 'number' || !Number.isFinite(value.value) || value.currency !== 'SAR' || (nonnegative && value.value < 0)) errors.push(`${path} requires a finite ${nonnegative ? 'nonnegative ' : ''}SAR amount`);
  };
  money(pr.paymentAmount, 'PaymentReconciliation.paymentAmount', true);
  if (!Array.isArray(pr.detail) || !pr.detail.length) errors.push('PaymentReconciliation.detail requires at least one entry');
  for (const [i, d] of (Array.isArray(pr.detail) ? pr.detail : []).entries()) {
    const path = `PaymentReconciliation.detail[${i}]`;
    if (!d.type?.coding?.some(c => c.code && c.system)) errors.push(`${path}.type is required`);
    if (!validDate(d.date)) errors.push(`${path}.date must be a valid date`);
    money(d.amount, `${path}.amount`);
    const components = (d.extension || []).filter(e => e.url === `${base}extension-component-payment`);
    if (components.length !== 1) errors.push(`${path} requires exactly one component-payment extension`);
    for (const e of d.extension || []) if (e.url?.startsWith(`${base}extension-component-`)) money(e.valueMoney, `${path}.${e.url.split('/').at(-1)}`);
    // request/response are 0..1: advances and adjustments need not refer to a claim.
    for (const key of ['request', 'response']) if (d[key] && (!d[key].identifier?.system || !d[key].identifier?.value)) errors.push(`${path}.${key} requires identifier.system and value`);
  }
  return errors;
}
export function reconciliationBundleErrors(bundle) {
  if (bundle?.resourceType !== 'Bundle' || bundle.type !== 'message' || !Array.isArray(bundle.entry)) return ['A FHIR message Bundle is required'];
  const errors = [];
  const header = bundle.entry[0]?.resource;
  if (header?.resourceType !== 'MessageHeader' || header.eventCoding?.code !== 'payment-reconciliation' ||
      header.eventCoding?.system !== 'http://nphies.sa/terminology/CodeSystem/ksa-message-events') errors.push('First entry must be the payment-reconciliation MessageHeader');
  if (!header?.id || !header.source?.endpoint) errors.push('MessageHeader.id and source.endpoint are required');
  if (header?.destination?.length !== 1 || !header.destination[0].endpoint || !resolveIdentifier(bundle, header.destination[0].receiver, providerSystem)) errors.push('MessageHeader requires one destination provider and endpoint');
  if (!resolveIdentifier(bundle, header?.sender, payerSystem)) errors.push('MessageHeader.sender requires the payer identifier');
  const entries = bundle.entry.filter(e => e.resource?.resourceType === 'PaymentReconciliation');
  if (entries.length !== 1) return [...errors, 'Exactly one PaymentReconciliation is required'];
  const pr = entries[0].resource;
  if (header?.focus?.length !== 1 || ![entries[0].fullUrl, `PaymentReconciliation/${pr.id}`].filter(Boolean).includes(header.focus[0].reference)) errors.push('MessageHeader.focus must reference PaymentReconciliation');
  for (const [field, system] of [['paymentIssuer', payerSystem], ['requestor', providerSystem]]) if (!resolveIdentifier(bundle, pr[field], system)) errors.push(`PaymentReconciliation.${field} does not resolve to a licensed organization`);
  return [...errors, ...paymentResourceErrors(pr)];
}
