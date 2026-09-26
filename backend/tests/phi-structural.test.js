// PHI redaction must only touch free-text values: FHIR paths, keys, codes and systems are
// structural and are never redacted (a patient called "Demo Patient" turned the supportingInfo
// category "patient-history" into "[NAME]-history" in the compare-with-accepted diff).
import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactDeep } from '../services/ai/phi.js';
import { diffBundles, normalizeBundle } from '../services/bundleDiff.js';

const bundle = (sequence, { code = 'patient-history', productCode = 'SVC-1' } = {}) => ({
  resourceType: 'Bundle',
  entry: [
    { resource: { resourceType: 'Patient', name: [{ text: 'Demo Patient', family: 'Patient', given: ['Demo'] }],
      identifier: [{ system: 'http://nphies.sa/identifier/nationalid', value: '1000000004' }] } },
    { resource: { resourceType: 'Claim',
      supportingInfo: [{ sequence, category: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category', code }] },
        valueString: 'Demo Patient reports pain' }],
      item: [{ sequence: 1, productOrService: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/services', code: productCode }] } }] } }
  ]
});

test('compare-with-accepted diff keeps FHIR paths and codes that contain a patient name part', () => {
  const { diff } = diffBundles(bundle(1), bundle(2));
  const paths = diff.map(d => d.path);
  assert.ok(paths.includes('Claim.supportingInfo[category=patient-history].sequence'), JSON.stringify(paths));
  assert.ok(!JSON.stringify(diff).includes('[NAME]'), JSON.stringify(diff));

  const flat = normalizeBundle(bundle(1));
  const codes = flat.get('Claim.supportingInfo[category=patient-history].category.coding[http://nphies.sa/terminology/CodeSystem/claim-information-category].code');
  assert.deepEqual([...codes], ['patient-history']);
  // Free text is still never carried.
  assert.ok(![...flat.values()].some(set => [...set].some(v => v.includes('Demo'))));
});

test('a code value that is exactly the patient identifier or name is still redacted', () => {
  const byId = normalizeBundle(bundle(1, { productCode: '1000000004' }));
  const byName = normalizeBundle(bundle(1, { productCode: 'demo patient' }));
  const key = 'Claim.item[].productOrService.coding[http://nphies.sa/terminology/CodeSystem/services].code';
  assert.deepEqual([...byId.get(key)], ['[ID]']);
  assert.deepEqual([...byName.get(key)], ['[NAME]']);
});

test('redactDeep leaves structural fields alone and redacts free-text values', () => {
  const names = ['Demo Patient'];
  const out = redactDeep({
    path: 'Claim.supportingInfo[category=patient-history].sequence',
    code: 'patient-history', system: 'http://nphies.sa/terminology/CodeSystem/patient-history', url: 'http://x/patient', key: 'patient',
    explanation: 'Demo Patient was seen; call +966 50 123 4567', items: [{ path: 'Patient.name', note: 'Patient Demo' }]
  }, { names });
  assert.equal(out.path, 'Claim.supportingInfo[category=patient-history].sequence');
  assert.equal(out.code, 'patient-history');
  assert.equal(out.system, 'http://nphies.sa/terminology/CodeSystem/patient-history');
  assert.equal(out.url, 'http://x/patient');
  assert.equal(out.key, 'patient');
  assert.equal(out.items[0].path, 'Patient.name');
  assert.equal(out.explanation, '[NAME] was seen; call [PHONE]');
  assert.equal(out.items[0].note, '[NAME] [NAME]');
  // Plain text keeps full name and name-part redaction (length >= 3).
  assert.equal(redactText('patient-history of Demo Patient', { names }), '[NAME]-history of [NAME]');
});
