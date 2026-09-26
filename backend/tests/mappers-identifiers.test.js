import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapper } from '../services/priorAuthMapper/index.js';
import { getClaimMapper } from '../services/claimMapper/index.js';
import CommunicationMapper from '../services/communicationMapper.js';
import eligibilityMapper from '../services/nphiesMapper.js';
import { clinicalInput } from './fixtures/clinicalInput.js';

const resource = (bundle, type) => bundle.entry.find(e => e.resource?.resourceType === type)?.resource;

// A name with punctuation used to produce different domains in the mappers and the communication mapper.
function input(type) {
  const data = clinicalInput(type);
  data.provider.provider_name = 'Al-Noor Hospital';
  return data;
}

const TYPES = ['professional', 'institutional', 'dental', 'vision', 'pharmacy'];

for (const type of TYPES) {
  test(`${type}: prior-auth cancel Task.focus equals the submitted Claim.identifier`, () => {
    const data = input(type);
    const submitted = resource(getMapper(type).buildPriorAuthRequestBundle(data), 'Claim').identifier[0];
    assert.equal(submitted.system, 'http://al-noorhospital.com.sa/identifiers/authorization');
    const task = resource(getMapper(type).buildCancelRequestBundle(data.priorAuth, data.provider, data.insurer, 'WI'), 'Task');
    assert.deepEqual(task.focus.identifier, submitted);
  });

  test(`${type}: claim cancel Task.focus equals the submitted Claim.identifier`, () => {
    const data = input(type);
    const submitted = resource(getClaimMapper(type).buildClaimRequestBundle(data), 'Claim').identifier[0];
    assert.equal(submitted.system, 'http://al-noorhospital.com.sa/identifiers/claim');
    // Same shape claimSubmissionsController passes to the cancel builder
    const cancelRecord = { request_number: data.claim.claim_number, provider_id: data.provider.provider_id };
    const task = resource(getClaimMapper(type).buildCancelRequestBundle(cancelRecord, data.provider, data.insurer, 'WI'), 'Task');
    assert.deepEqual(task.focus.identifier, submitted);
  });
}

test('Cancel Task identifier is unique per attempt and the header uses the insurer license', () => {
  const data = input('professional');
  const mapper = getMapper('professional');
  const first = mapper.buildCancelRequestBundle(data.priorAuth, data.provider, data.insurer, 'WI');
  const second = mapper.buildCancelRequestBundle(data.priorAuth, data.provider, data.insurer, 'WI');
  assert.notEqual(resource(first, 'Task').identifier[0].value, resource(second, 'Task').identifier[0].value);
  assert.equal(resource(first, 'MessageHeader').destination[0].receiver.identifier.value, 'TEST-INSURER');
  assert.equal(resource(first, 'MessageHeader').source.endpoint, 'http://provider.com');
});

test('Claim status-check Task.focus equals the submitted claim identifier; request has no response', () => {
  const data = input('professional');
  const submitted = resource(getClaimMapper('professional').buildClaimRequestBundle(data), 'Claim').identifier[0];
  const bundle = new CommunicationMapper().buildStatusCheckBundle({
    providerId: data.provider.nphies_id, providerName: data.provider.provider_name,
    insurerId: data.insurer.nphies_id, focalResourceIdentifier: data.claim.claim_number, originalRequestId: 'old-request'
  });
  assert.deepEqual(resource(bundle, 'Task').focus.identifier, submitted);
  assert.equal(resource(bundle, 'MessageHeader').response, undefined);
  assert.match(bundle.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/);
});

test('Communication about.identifier equals the submitted Claim.identifier for PAs and claims', () => {
  const mapper = new CommunicationMapper();
  const data = input('professional');
  const payloads = [{ contentType: 'string', contentString: 'Additional information' }];

  const paIdentifier = resource(getMapper('professional').buildPriorAuthRequestBundle(data), 'Claim').identifier[0];
  const paComm = resource(mapper.buildUnsolicitedCommunicationBundle({ ...data, payloads }), 'Communication');
  assert.deepEqual(paComm.about[0].identifier, paIdentifier);

  const claimIdentifier = resource(getClaimMapper('professional').buildClaimRequestBundle(data), 'Claim').identifier[0];
  const claimComm = resource(mapper.buildUnsolicitedCommunicationBundle({
    ...data, priorAuth: { request_number: data.claim.claim_number }, payloads, claimUse: 'claim'
  }), 'Communication');
  assert.deepEqual(claimComm.about[0].identifier, claimIdentifier);

  const solicited = resource(mapper.buildSolicitedCommunicationBundle({
    ...data, priorAuth: { request_number: data.claim.claim_number }, payloads, claimUse: 'claim',
    communicationRequest: { cr_identifier: 'CommReq_1' }
  }), 'Communication');
  assert.deepEqual(solicited.about[0].identifier, claimIdentifier);

  assert.equal(`http://${mapper.extractProviderDomain('Al-Noor Hospital')}/identifiers/claim`, claimIdentifier.system);
});

test('Claim poll focus built from extractProviderDomain matches the submitted claim', () => {
  const mapper = new CommunicationMapper();
  const data = input('institutional');
  const submitted = resource(getClaimMapper('institutional').buildClaimRequestBundle(data), 'Claim').identifier[0];
  const poll = mapper.buildPollRequestBundle(data.provider.nphies_id, data.provider.provider_name, '1', {
    focus: { type: 'Claim', identifier: { value: data.claim.claim_number }, claimUse: 'claim' }
  });
  assert.deepEqual(resource(poll, 'Task').focus.identifier, submitted);
  assert.match(poll.timestamp, /\+03:00$/);
});

test('Communication references the Patient and Organizations actually in the bundle', () => {
  const mapper = new CommunicationMapper();
  const data = input('professional');
  delete data.patient.patient_id;
  delete data.insurer.insurer_id;
  const bundle = mapper.buildUnsolicitedCommunicationBundle({
    ...data, payloads: [{ contentType: 'string', contentString: 'x' }]
  });
  const ids = new Set(bundle.entry.map(e => `${e.resource.resourceType}/${e.resource.id}`));
  const comm = resource(bundle, 'Communication');
  for (const ref of [comm.subject.reference, comm.sender.reference, comm.recipient[0].reference]) {
    assert.ok(ids.has(ref), `${ref} must resolve inside the bundle`);
    assert.doesNotMatch(ref, /undefined/);
  }
  const coverage = resource(bundle, 'Coverage');
  assert.ok(ids.has(coverage.beneficiary.reference));
  assert.ok(ids.has(coverage.payor[0].reference));
});

test('Provider type uses one NPHIES table everywhere', () => {
  const mapper = new CommunicationMapper();
  assert.equal(mapper.getProviderTypeCode('pharmacy'), '3');
  assert.equal(mapper.getProviderTypeCode('clinic'), '5');
  assert.equal(mapper.getProviderTypeDisplay('4'), 'Optical Shop');
  const org = mapper.buildProviderOrganizationResource({ provider_id: 'p', nphies_id: 'L', provider_type: 'pharmacy' }).resource;
  assert.equal(org.extension[0].valueCodeableConcept.coding[0].code, '3');
  const eligibilityOrg = eligibilityMapper.buildProviderOrganization({ provider_id: 'p', nphies_id: 'L', provider_type: 'pharmacy' }).resource;
  assert.deepEqual(eligibilityOrg.extension, org.extension);
});

test('Insurer and provider licenses come from the records and are required', () => {
  const data = input('professional');
  const bundle = getMapper('professional').buildPriorAuthRequestBundle(data);
  const payer = bundle.entry.find(e => e.resource.identifier?.[0]?.system === 'http://nphies.sa/license/payer-license').resource;
  assert.equal(payer.identifier[0].value, 'TEST-INSURER');
  assert.equal(resource(bundle, 'MessageHeader').destination[0].receiver.identifier.value, 'TEST-INSURER');
  assert.doesNotMatch(JSON.stringify(bundle), /INS-FHIR/);

  const eligibility = eligibilityMapper.buildEligibilityRequestBundle({ ...data, purpose: ['validation'] });
  assert.equal(resource(eligibility, 'MessageHeader').destination[0].receiver.identifier.value, 'TEST-INSURER');
  assert.equal(resource(eligibility, 'MessageHeader').sender.identifier.value, 'TEST-PROVIDER');

  assert.throws(() => getMapper('professional').buildPriorAuthRequestBundle({ ...data, insurer: { ...data.insurer, nphies_id: null } }),
    /insurer\.nphies_id/);
  assert.throws(() => getClaimMapper('vision').buildClaimRequestBundle({ ...data, provider: { ...data.provider, nphies_id: '' } }),
    /provider\.nphies_id/);
  assert.throws(() => eligibilityMapper.buildEligibilityRequestBundle({ ...data, insurer: { insurer_id: 'i' } }), /insurer\.nphies_id/);
  assert.throws(() => new CommunicationMapper().buildUnsolicitedCommunicationBundle({
    ...data, insurer: { insurer_id: 'i' }, payloads: []
  }), /insurer\.nphies_id/);
});

test('Eligibility ids are unique, created is the request date, warnings are not fatal', () => {
  const data = input('professional');
  const one = resource(eligibilityMapper.buildEligibilityRequestBundle({ ...data, servicedDate: '2099-01-01' }), 'CoverageEligibilityRequest');
  const two = resource(eligibilityMapper.buildEligibilityRequestBundle({ ...data, servicedDate: '2099-01-01' }), 'CoverageEligibilityRequest');
  assert.notEqual(one.id, two.id);
  assert.notEqual(one.identifier[0].value, two.identifier[0].value);
  assert.notEqual(one.created, '2099-01-01');
  assert.ok(one.created <= new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  const response = { resourceType: 'Bundle', entry: [
    { resource: { resourceType: 'MessageHeader', response: { code: 'ok' } } },
    { resource: { resourceType: 'CoverageEligibilityResponse', outcome: 'complete', insurance: [{ inforce: true }] } },
    { resource: { resourceType: 'OperationOutcome', issue: [{ severity: 'warning', code: 'informational', diagnostics: 'FYI' }] } }
  ] };
  const parsed = eligibilityMapper.parseEligibilityResponse(response);
  assert.equal(parsed.success, true);
  assert.equal(parsed.warnings[0].details, 'FYI');
  response.entry[2].resource.issue.push({ severity: 'error', code: 'invalid', diagnostics: 'Bad' });
  assert.equal(eligibilityMapper.parseEligibilityResponse(response).success, false);
});

test('Diagnoses use ICD-10-AM in every mapper', () => {
  for (const type of TYPES) {
    const data = input(type);
    data.claim.diagnoses[0].diagnosis_system = 'http://hl7.org/fhir/sid/icd-10';
    for (const bundle of [getMapper(type).buildPriorAuthRequestBundle(data), getClaimMapper(type).buildClaimRequestBundle(data)]) {
      for (const diagnosis of resource(bundle, 'Claim').diagnosis) {
        assert.equal(diagnosis.diagnosisCodeableConcept.coding[0].system, 'http://hl7.org/fhir/sid/icd-10-am', type);
      }
    }
  }
});
