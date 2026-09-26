import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapper } from '../services/priorAuthMapper/index.js';
import { getClaimMapper, batchClaimMapper } from '../services/claimMapper/index.js';
import CommunicationMapper from '../services/communicationMapper.js';
import advancedAuthParser from '../services/advancedAuthParser.js';
import { clinicalInput } from './fixtures/clinicalInput.js';

const resource = (bundle, type) => bundle.entry.find(e => e.resource?.resourceType === type)?.resource;
const claimOf = bundle => resource(bundle, 'Claim');
const TYPES = ['professional', 'institutional', 'dental', 'vision', 'pharmacy'];

test('No placeholder clinical data: missing required values fail with a named field', () => {
  const noComplaint = clinicalInput('institutional');
  noComplaint.priorAuth.supporting_info = [];
  assert.throws(() => getMapper('institutional').buildPriorAuthRequestBundle(noComplaint), /chief complaint/);

  const noStay = clinicalInput('institutional');
  delete noStay.priorAuth.estimated_length_of_stay;
  assert.throws(() => getMapper('institutional').buildPriorAuthRequestBundle(noStay), /length of stay/);

  for (const type of ['professional', 'dental']) {
    const data = clinicalInput(type);
    data.priorAuth.supporting_info = [];
    delete data.priorAuth.chief_complaint;
    assert.throws(() => getMapper(type).buildPriorAuthRequestBundle(data), /chief complaint/, type);
  }

  const oral = clinicalInput('dental');
  oral.claim.supporting_info = [];
  assert.throws(() => getClaimMapper('dental').buildClaimRequestBundle(oral), /chief complaint/);

  const emergency = clinicalInput('professional');
  emergency.priorAuth.encounter_class = 'emergency';
  assert.throws(() => getMapper('professional').buildPriorAuthRequestBundle(emergency), /triage_category/);
  emergency.claim.encounter_class = 'emergency';
  emergency.claim.triage_category = 'U';
  assert.throws(() => getClaimMapper('professional').buildClaimRequestBundle(emergency), /emergency_arrival_code/);

  const lens = clinicalInput('vision');
  lens.priorAuth.vision_prescription = {};
  assert.throws(() => getMapper('vision').buildPriorAuthRequestBundle(lens), /lens specification/);
  lens.priorAuth.vision_prescription = { product_type: 'lens', right_eye: { cylinder: -1 } };
  assert.throws(() => getMapper('vision').buildPriorAuthRequestBundle(lens), /sphere/);

  const practitioner = clinicalInput('professional');
  delete practitioner.priorAuth.practitioner;
  assert.throws(() => getMapper('professional').buildPriorAuthRequestBundle(practitioner), /practitioner\.license_number/);

  const member = clinicalInput('vision');
  delete member.coverage.member_id;
  assert.throws(() => getMapper('vision').buildPriorAuthRequestBundle(member), /member_id/);

  const narrative = clinicalInput('professional');
  delete narrative.claim.treatment_plan;
  assert.throws(() => getClaimMapper('professional').buildClaimRequestBundle(narrative), /treatment-plan/);
  const investigation = clinicalInput('pharmacy');
  delete investigation.claim.investigation_result_code;
  assert.throws(() => getClaimMapper('pharmacy').buildClaimRequestBundle(investigation), /investigation-result/);

  const discharge = clinicalInput('institutional');
  delete discharge.claim.discharge_disposition;
  assert.throws(() => getClaimMapper('institutional').buildClaimRequestBundle(discharge), /discharge_disposition/);

  const daysSupply = clinicalInput('pharmacy');
  delete daysSupply.priorAuth.items[0].days_supply;
  assert.throws(() => getMapper('pharmacy').buildPriorAuthRequestBundle(daysSupply), /Days supply/);
});

test('Professional claim vitals: only measured values, timed at the encounter, no 120/80 defaults', () => {
  const data = clinicalInput('professional');
  data.claim.supporting_info.push({ category: 'vital-sign-systolic', value_quantity: null },
    { category: 'pulse', value_quantity: 88 });
  const info = claimOf(getClaimMapper('professional').buildClaimRequestBundle(data)).supportingInfo;
  assert.equal(info.find(i => i.category.coding[0].code === 'vital-sign-systolic'), undefined);
  const pulse = info.find(i => i.category.coding[0].code === 'pulse');
  assert.equal(pulse.valueQuantity.value, 88);
  assert.equal(pulse.timingPeriod.start, '2026-08-01T08:00:00+03:00');
  assert.doesNotMatch(JSON.stringify(info), /No systemic disease|Analgesic Drugs|Patient presenting for evaluation/);
});

test('Null payer share is omitted instead of serialising NaN', () => {
  for (const type of ['professional', 'institutional', 'dental', 'vision']) {
    const data = clinicalInput(type);
    data.priorAuth.items[0].payer_share = null;
    const item = claimOf(getMapper(type).buildPriorAuthRequestBundle(data)).item[0];
    assert.equal(item.extension.find(e => e.url.endsWith('extension-payer-share')), undefined, type);
    assert.doesNotMatch(JSON.stringify(item), /NaN|"value":null/);
  }
});

test('Item informationSequence follows supporting info after renumbering', () => {
  // Professional PA: chief complaint is injected at the front, shifting the caller's entries
  const data = clinicalInput('professional');
  data.priorAuth.chief_complaint = 'Headache';
  data.priorAuth.supporting_info = [
    { sequence: 7, category: 'patient-history', value_string: 'History' },
    { sequence: 9, category: 'treatment-plan', value_string: 'Plan' }
  ];
  data.priorAuth.items[0].information_sequences = [9];
  const claim = claimOf(getMapper('professional').buildPriorAuthRequestBundle(data));
  const target = claim.supportingInfo.find(i => i.sequence === claim.item[0].informationSequence[0]);
  assert.deepEqual(claim.item[0].informationSequence, [3]);
  assert.equal(target.category.coding[0].code, 'treatment-plan');

  // Pharmacy claim: caller's attachment keeps its link, plus the item's own days-supply
  const pharmacy = clinicalInput('pharmacy');
  pharmacy.claim.supporting_info.push({ sequence: 2, category: 'attachment',
    value_attachment: { contentType: 'application/pdf', data: 'AA==', title: 'report.pdf' } });
  pharmacy.claim.items[0].information_sequences = [2];
  const pharmacyClaim = claimOf(getClaimMapper('pharmacy').buildClaimRequestBundle(pharmacy));
  const linked = pharmacyClaim.item[0].informationSequence.map(seq => pharmacyClaim.supportingInfo.find(i => i.sequence === seq).category.coding[0].code);
  assert.deepEqual(linked, ['attachment', 'days-supply']);
});

test('Pharmacy keeps the user days supply from supporting info', () => {
  for (const [kind, mapper] of [['priorAuth', getMapper('pharmacy')], ['claim', getClaimMapper('pharmacy')]]) {
    const data = clinicalInput('pharmacy');
    delete data[kind].items[0].days_supply;
    data[kind].supporting_info.push({ sequence: 4, category: 'days-supply', value_quantity: 14 });
    data[kind].items[0].information_sequences = [4];
    const bundle = kind === 'claim' ? mapper.buildClaimRequestBundle(data) : mapper.buildPriorAuthRequestBundle(data);
    const claim = claimOf(bundle);
    const days = claim.supportingInfo.filter(i => i.category.coding[0].code === 'days-supply');
    assert.equal(days.length, 1, kind);
    assert.equal(days[0].valueQuantity.value, 14, kind);
    assert.ok(claim.item[0].informationSequence.includes(days[0].sequence), kind);
  }
});

test('Mappers never mutate the caller input', () => {
  for (const type of TYPES) {
    const data = clinicalInput(type);
    data.priorAuth.supporting_info.push({ category: 'onset', code: 'onset', value_string: '01-08-2026' });
    data.claim.supporting_info[0] = { sequence: 1, category: 'chief-complaint', code: '21522001', code_display: 'Abdominal pain' };
    const before = structuredClone(data);
    getMapper(type).buildPriorAuthRequestBundle(data);
    getClaimMapper(type).buildClaimRequestBundle(data);
    assert.deepEqual(data, before, type);
  }
});

test('Vision claim keeps quantity and attachment supporting info', () => {
  const data = clinicalInput('vision');
  data.claim.supporting_info.push(
    { sequence: 2, category: 'birth-weight', value_quantity: 3.2, value_quantity_unit: 'kg' },
    { sequence: 3, category: 'attachment', value_attachment: { contentType: 'application/pdf', data: 'AA==', title: 'rx.pdf' } }
  );
  const info = claimOf(getClaimMapper('vision').buildClaimRequestBundle(data)).supportingInfo;
  assert.equal(info.find(i => i.category.coding[0].code === 'birth-weight').valueQuantity.value, 3.2);
  assert.equal(info.find(i => i.category.coding[0].code === 'attachment').valueAttachment.title, 'rx.pdf');

  data.claim.vision_prescription = '{not json';
  assert.throws(() => getClaimMapper('vision').buildClaimRequestBundle(data), /vision_prescription is not valid JSON/);
});

test('Attachments are embedded, never unreferenced Binary entries', () => {
  for (const type of ['dental', 'vision', 'pharmacy']) {
    const data = clinicalInput(type);
    data.priorAuth.attachments = [{ content_type: 'application/pdf', base64_content: 'AA==', file_name: 'x.pdf' }];
    const bundle = getMapper(type).buildPriorAuthRequestBundle(data);
    assert.equal(resource(bundle, 'Binary'), undefined, type);
    assert.ok(claimOf(bundle).supportingInfo.some(i => i.valueAttachment?.title === 'x.pdf'), type);
  }
});

test('Oral claim items link to supporting info; professional facility is a Location', () => {
  const oral = claimOf(getClaimMapper('dental').buildClaimRequestBundle(clinicalInput('dental')));
  assert.deepEqual(oral.item[0].informationSequence, [1]);

  const withLicense = clinicalInput('professional');
  withLicense.provider.location_license = 'TEST-LOCATION';
  const bundle = getMapper('professional').buildPriorAuthRequestBundle(withLicense);
  const location = resource(bundle, 'Location');
  assert.equal(claimOf(bundle).facility.reference, `Location/${location.id}`);
  const withoutLicense = clinicalInput('professional');
  delete withoutLicense.provider.location_license;
  assert.equal(claimOf(getMapper('professional').buildPriorAuthRequestBundle(withoutLicense)).facility, undefined);
});

test('Totals are rounded to 2 decimals in every mapper', () => {
  for (const type of TYPES) {
    const data = clinicalInput(type);
    for (const record of [data.priorAuth, data.claim]) {
      record.total_amount = null;
      record.items = [0.1, 0.2].map((price, i) => ({ ...record.items[0], sequence: i + 1, unit_price: price }));
    }
    assert.equal(claimOf(getMapper(type).buildPriorAuthRequestBundle(data)).total.value, 0.3, type);
    assert.equal(claimOf(getClaimMapper(type).buildClaimRequestBundle(data)).total.value, 0.3, type);
  }
});

test('Dates use the Saudi calendar independent of the host timezone', () => {
  assert.equal(getMapper('professional').formatDate('2023-12-03T21:00:00Z'), '2023-12-04');
  assert.equal(getMapper('professional').formatDate('2023-12-03'), '2023-12-03');
  assert.equal(new CommunicationMapper().formatDate('2023-12-03T21:30:00Z'), '2023-12-04');
  assert.equal(new CommunicationMapper().formatDate('not a date'), null);
  assert.equal(batchClaimMapper.formatDate(new Date('2023-12-03T22:00:00Z')), '2023-12-04');
  const data = clinicalInput('professional');
  data.claim.service_date = '2026-08-31T22:00:00Z'; // 1 September in Riyadh
  const period = claimOf(getClaimMapper('professional').buildClaimRequestBundle(data)).extension
    .find(e => e.url.endsWith('extension-accountingPeriod')).valueDate;
  assert.equal(period, '2026-09-01');
});

test('Batch preview equals the submitted nested bundles', () => {
  const base = clinicalInput('professional');
  const data = {
    batchIdentifier: 'B-1', batchPeriodStart: '2026-08-01', batchPeriodEnd: '2026-08-01',
    provider: base.provider, insurer: base.insurer,
    claims: [base, { ...clinicalInput('professional'), claim: { ...base.claim, id: 2, claim_number: 'TEST-CLAIM-2' } }]
  };
  const normalize = value => {
    const ids = new Map();
    return JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      id => { if (!ids.has(id)) ids.set(id, `id-${ids.size}`); return ids.get(id); })
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})/g, 'instant')); // built milliseconds apart
  };
  const submitted = batchClaimMapper.buildBatchRequestBundle(data).entry.slice(1).map(e => e.resource);
  const preview = batchClaimMapper.buildIndividualClaimBundles(data);
  assert.deepEqual(normalize(preview), normalize(submitted));
  assert.equal(preview[0]._batchMetadata, undefined);
  assert.ok(preview[0].entry.every(e => e.fullUrl.startsWith('urn:uuid:') || !e.fullUrl.startsWith('http://provider.com')));
  assert.throws(() => batchClaimMapper.buildBatchRequestBundle({ ...data, batchIdentifier: undefined }), /batchIdentifier/);
});

test('Advanced authorization supporting info keeps the code next to its value; zero quantity survives', () => {
  const ext = (name, value) => ({ url: `http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-supportingInfo-${name}`, ...value });
  const parsed = advancedAuthParser.parseAdvancedAuthorization({
    resourceType: 'ClaimResponse',
    extension: [{ url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-supportingInfo', extension: [
      ext('sequence', { valuePositiveInt: 1 }),
      ext('category', { valueCodeableConcept: { coding: [{ code: 'lab-test' }] } }),
      ext('code', { valueCodeableConcept: { coding: [{ system: 'http://loinc.org', code: '2345-7' }] } }),
      ext('valueQuantity', { valueQuantity: { value: 5.4, code: 'mmol/L' } })
    ] }],
    addItem: [{ quantity: { value: 0 }, productOrService: { coding: [{ code: 'X' }] } }]
  });
  assert.equal(parsed.supporting_info[0].valueType, 'quantity');
  assert.equal(parsed.supporting_info[0].value, 5.4);
  assert.equal(parsed.supporting_info[0].code, '2345-7');
  assert.equal(parsed.add_items?.[0]?.quantity ?? parsed.addItems?.[0]?.quantity, 0);
});
