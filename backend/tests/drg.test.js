import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateDrg, requiresDrg, assertDrgReady, drgFingerprint } from '../services/drgValidation.js';
import { validateClaimInput } from '../models/claimInput.js';
import { getClaimMapper } from '../services/claimMapper/index.js';
import claimController from '../controllers/claimSubmissionsController.js';
import batchController from '../controllers/claimBatchesController.js';
import pool from '../db.js';
import nphiesService from '../services/nphiesService.js';
import { clinicalInput } from './fixtures/clinicalInput.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function validInput() {
  const data = clinicalInput('institutional');
  Object.assign(data.claim, { drg_code: 'E62B', drg_description: 'Synthetic test episode', drg_code_system: 'https://example.test/ardrg', drg_version: '9.0', drg_grouper_name: 'Synthetic grouper', drg_grouper_version: '1', drg_grouper_certified: true, drg_mds_confirmed: true, drg_grouper_output: { adrg: 'E62', mdc: 4, eccs: 0, dcl: [], error_flags: [] }, discharge_disposition: 'home', drg_leave_days: 0, drg_ventilation_used: false, ventilation_hours: 0, drg_no_procedures: true, drg_procedures: [] });
  data.claim.drg_mds_fingerprint = drgFingerprint(data.claim, data.patient);
  return data;
}
test('DRG applies automatically to admitted and same-day encounters, excluding ambulatory care', () => {
  for (const encounter_class of ['inpatient', 'daycase', 'IMP', 'SS']) assert.equal(requiresDrg({ encounter_class }), true);
  for (const encounter_class of ['outpatient', 'ambulatory', 'emergency', 'home', 'telemedicine']) assert.equal(validateDrg({ encounter_class }).required, false);
  assert.equal(requiresDrg({ sub_type: 'ip' }), true);
  assert.equal(requiresDrg({ sub_type: 'daycase' }), true);
});
test('Complete admitted episode passes and missing DRG is rejected', () => {
  const { claim, patient } = validInput();
  assert.equal(validateDrg(claim, patient).valid, true);
  assert.throws(() => assertDrgReady({ ...claim, drg_code: null }, patient), e => e.status === 422 && e.validation.errors.some(i => i.field === 'drg_code'));
});
test('A later patient-record edit invalidates the grouping confirmation', () => {
  const { claim, patient } = validInput();
  const edited = validateDrg(claim, { ...patient, birth_date: '1991-01-01' });
  assert.ok(edited.errors.some(issue => issue.code === 'DRG_MDS_CHANGED'));
});
test('Wrong version, multiple principal diagnoses and missing source metadata are rejected', () => {
  const { claim, patient } = validInput();
  const invalid = validateDrg({ ...claim, drg_version: '10.0', drg_grouper_certified: false, drg_grouper_output: {}, diagnoses: [...claim.diagnoses, { ...claim.diagnoses[0], sequence: 2 }] }, patient);
  for (const code of ['DRG_VERSION', 'DRG_CERTIFICATION', 'DRG_OUTPUT', 'MDS_PRINCIPAL']) assert.ok(invalid.errors.some(i => i.code === code));
});
test('Neonatal birth weight is required by age at admission even without newborn toggle', () => {
  const { claim, patient } = validInput();
  patient.birth_date = '2026-07-10';
  assert.ok(validateDrg(claim, patient).errors.some(i => i.code === 'MDS_BIRTH_WEIGHT'));
  claim.birth_weight = 3200;
  claim.drg_mds_fingerprint = drgFingerprint(claim, patient);
  assert.equal(validateDrg(claim, patient).valid, true);
  const mapped = getClaimMapper('institutional').buildClaimRequestBundle({ ...validInput(), patient, claim }).entry.find(e => e.resource.resourceType === 'Claim').resource;
  assert.equal(mapped.supportingInfo.find(i => i.category.coding[0].code === 'birth-weight').valueQuantity.value, 3.2);
});
test('Date ordering, Saudi same-day boundaries, leave days and age use the admission date', () => {
  const { claim, patient } = validInput();
  let result = validateDrg({ ...claim, encounter_end: '2026-07-31T08:00:00+03:00' }, patient);
  assert.ok(result.errors.some(i => i.code === 'MDS_DATE_ORDER'));
  result = validateDrg({ ...claim, encounter_class: 'daycase', encounter_start: '2026-08-01T20:30:00Z', encounter_end: '2026-08-01T21:30:00Z' }, patient);
  assert.ok(result.errors.some(i => i.code === 'MDS_SAME_DAY'));
  result = validateDrg({ ...claim, encounter_end: '2026-08-04T08:00:00+03:00', drg_leave_days: 1 }, patient);
  assert.equal(result.lengthOfStayDays, 2);
  assert.ok(result.ageDays > 13000);
  assert.ok(validateDrg({ ...claim, drg_leave_days: 1 }, patient).errors.some(i => i.code === 'MDS_LEAVE'));
});
test('Conditional ventilation and procedures require explicit consistent records', () => {
  const { claim, patient } = validInput();
  assert.ok(validateDrg({ ...claim, drg_ventilation_used: true }, patient).errors.some(i => i.code === 'MDS_VENTILATION'));
  assert.ok(validateDrg({ ...claim, ventilation_hours: 12 }, patient).errors.some(i => i.code === 'MDS_VENTILATION_CONFLICT'));
  assert.ok(validateDrg({ ...claim, drg_no_procedures: null }, patient).errors.some(i => i.code === 'MDS_PROCEDURES'));
  const procedure = { code: 'TEST', system: 'http://nphies.sa/terminology/CodeSystem/procedures', version: '3', date: claim.encounter_start };
  const withProcedure = { ...claim, drg_no_procedures: false, drg_procedures: [procedure] };
  withProcedure.drg_mds_fingerprint = drgFingerprint(withProcedure, patient);
  assert.equal(validateDrg(withProcedure, patient).valid, true);
  assert.ok(validateDrg({ ...claim, drg_no_procedures: false, drg_procedures: [{ ...procedure, date: '2026-08-02T08:00:00+03:00' }] }, patient).errors.some(i => i.code === 'MDS_PROCEDURE_DATE'));
});
test('Error DRGs require an explanatory flag and retain a warning', () => {
  const { claim, patient } = validInput();
  for (const drg_code of ['960Z', '961Z', '963Z', '801A']) {
    assert.ok(validateDrg({ ...claim, drg_code }, patient).errors.some(i => i.code === 'DRG_ERROR_FLAG'));
    const explained = validateDrg({ ...claim, drg_code, drg_error_explanation: 'Documented data issue under remediation' }, patient);
    assert.equal(explained.valid, true);
    assert.ok(explained.warnings.some(i => i.code === 'DRG_GROUPING_ERROR'));
  }
});
test('FHIR carries DRG on principal diagnosis plus structured attachment and preserves FFS', () => {
  const input = validInput();
  const original = structuredClone(input);
  const resource = getClaimMapper('institutional').buildClaimRequestBundle(input).entry.find(e => e.resource.resourceType === 'Claim').resource;
  assert.equal(resource.diagnosis[0].packageCode.coding[0].code, 'E62B');
  const attachment = resource.supportingInfo.find(i => i.valueAttachment?.contentType === 'application/json').valueAttachment;
  const payload = JSON.parse(Buffer.from(attachment.data, 'base64').toString('utf8'));
  assert.equal(payload.drg.version, '9.0');
  assert.equal(payload.mds.leaveDays, 0);
  assert.equal(resource.total.value, 100);
  assert.equal(resource.item.length, 1);
  assert.deepEqual(input, original);
});
test('Draft input accepts DRG fields and rejects negative leave days and arbitrary keys', () => {
  assert.equal(validateClaimInput({ claim_type: 'institutional', drg_code: 'e62b', drg_leave_days: 0 }).drg_code, 'E62B');
  assert.throws(() => validateClaimInput({ drg_leave_days: -1 }, true), /greater than or equal/);
  assert.throws(() => validateClaimInput({ drg_skip_validation: true }, true), /not allowed/);
});
test('Server blocks send before reservation and upstream transport when MDS is incomplete', async t => {
  const data = validInput();
  data.claim.drg_code = null;
  t.mock.method(claimController, 'getByIdInternal', async () => data.claim);
  const db = t.mock.method(pool, 'query', async sql => ({ rows: sql.includes('FROM patients') ? [data.patient] : sql.includes('FROM providers') ? [data.provider] : [data.insurer] }));
  const transport = t.mock.method(nphiesService, 'submitClaim', () => assert.fail('Must not send incomplete DRG'));
  const res = response();
  await claimController.sendToNphies({ params: { id: 1 } }, res);
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.validation.errors.some(i => i.code === 'DRG_CODE'));
  assert.equal(transport.mock.callCount(), 0);
  assert.ok(db.mock.calls.every(c => !c.arguments[0].includes('UPDATE')));
});
test('Changing saved DRG without clinical reviewers fails before updating the row', async t => {
  const data = validInput();
  t.mock.method(claimController, 'getByIdInternal', async () => data.claim);
  const statements = [];
  t.mock.method(pool, 'connect', async () => ({ query: async sql => { statements.push(sql); return { rows: [] }; }, release() {} }));
  const res = response();
  await claimController.update({ params: { id: 1 }, body: { drg_code: 'E62A' } }, res);
  assert.equal(res.statusCode, 400);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.some(sql => sql.startsWith('UPDATE')));
});
test('Legacy per-item batch cannot bypass the DRG episode workflow', async t => {
  const data = validInput();
  t.mock.method(batchController, 'getAuthItemDataForBundle', async () => data);
  t.mock.method(batchController, '_extractItemIds', () => [1, 2]);
  t.mock.method(pool, 'query', async sql => ({ rows: sql.includes('providers') ? [data.provider] : [data.insurer] }));
  await assert.rejects(() => batchController.prepareBatchBundleData({ provider_id: data.provider.provider_id, insurer_id: data.insurer.insurer_id }), e => e.status === 422);
});
test('DRG SQL migration and reviewed claim update persist correctly without changing FFS', { skip: !process.env.DRG_PGLITE_MODULE }, async t => {
  const { PGlite } = await import(pathToFileURL(process.env.DRG_PGLITE_MODULE).href);
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE claim_submissions (id SERIAL PRIMARY KEY, total_amount NUMERIC); INSERT INTO claim_submissions(total_amount) VALUES (100);');
    const sql = await fs.readFile(new URL('../migrations/066_claim_drg.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.query('UPDATE claim_submissions SET drg_code=$1, drg_procedures=$2, drg_grouper_output=$3 WHERE id=1', ['E62B', JSON.stringify([]), JSON.stringify(validInput().claim.drg_grouper_output)]);
    const row = (await db.query('SELECT * FROM claim_submissions WHERE id=1')).rows[0];
    assert.equal(Number(row.total_amount), 100);
    assert.equal(row.drg_code, 'E62B');
    assert.deepEqual(row.drg_grouper_output, validInput().claim.drg_grouper_output);
    await db.query('INSERT INTO claim_drg_audit(claim_id,new_code,snapshot) VALUES(1,$1,$2)', ['E62B', JSON.stringify(row)]);
    assert.equal((await db.query('SELECT * FROM claim_drg_audit')).rows.length, 1);
    const input = validInput();
    await db.exec(`ALTER TABLE claim_submissions ADD updated_at TIMESTAMPTZ DEFAULT NOW(), ADD status TEXT DEFAULT 'draft', ADD claim_type TEXT DEFAULT 'institutional', ADD patient_id UUID, ADD encounter_start TIMESTAMPTZ, ADD encounter_end TIMESTAMPTZ, ADD encounter_class TEXT, ADD is_newborn BOOLEAN, ADD birth_weight NUMERIC;
      CREATE TABLE patients(patient_id UUID PRIMARY KEY, gender TEXT, birth_date DATE);`);
    await db.query('INSERT INTO patients VALUES($1,$2,$3)', [input.patient.patient_id, input.patient.gender, input.patient.birth_date]);
    const execute = async (sql, params) => { const result = await db.query(sql, params); return { ...result, rowCount: result.affectedRows ?? result.rows.length }; };
    t.mock.method(pool, 'connect', async () => ({ query: execute, release() {} }));
    t.mock.method(claimController, 'getByIdInternal', async () => {
      const stored = (await db.query('SELECT * FROM claim_submissions WHERE id=1')).rows[0];
      const claim = { ...input.claim, ...stored, coverage_id: null, diagnoses: input.claim.diagnoses, patient_gender: input.patient.gender, patient_birth_date: input.patient.birth_date };
      return { ...claim, drg_validation: validateDrg(claim, input.patient) };
    });
    const payload = Object.fromEntries(Object.entries(input.claim).filter(([key]) => key.startsWith('drg_') || ['discharge_disposition', 'patient_id', 'encounter_start', 'encounter_end', 'encounter_class', 'ventilation_hours'].includes(key)));
    payload.drg_code = 'E62A';
    payload.drg_review = { justification: 'Reviewed clinical correction from certified output', cds_reviewer: 'Synthetic CDS', coding_reviewer: 'Synthetic coder' };
    const res = response();
    await claimController.update({ params: { id: 1 }, body: payload, user: { id: 7 } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.drg_validation.valid, true, JSON.stringify(res.body.data.drg_validation));
    assert.equal(Number(res.body.data.total_amount), 100);
    const savedAudit = (await db.query('SELECT * FROM claim_drg_audit ORDER BY id DESC LIMIT 1')).rows[0];
    assert.equal(savedAudit.previous_code, 'E62B');
    assert.equal(savedAudit.new_code, 'E62A');
    assert.equal(savedAudit.changed_by, '7');
    assert.equal(savedAudit.cds_reviewer, 'Synthetic CDS');
  } finally { await db.close(); }
});
