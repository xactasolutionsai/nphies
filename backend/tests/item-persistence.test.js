// Round trip of prior authorization / claim items and encounter fields through the real
// controllers and PostgreSQL (isolated schema in the *_regression database, like postgres.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import crypto from 'node:crypto';
import { clinicalInput } from './fixtures/clinicalInput.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const MEDICATION_SYSTEM = 'http://nphies.sa/terminology/CodeSystem/medication-codes';

test('Item and encounter persistence (PostgreSQL)', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith('_regression') || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must point to a local dedicated *_regression database');
  }
  Object.assign(process.env, { DB_HOST: url.hostname, DB_PORT: url.port, DB_USER: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password), DB_NAME: url.pathname.slice(1) });
  const schema = `items_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { default: pool, query } = await import('../db.js');
  pool.options.options = `-c search_path=${schema}`;
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  await query(`
    CREATE TABLE patients (patient_id UUID PRIMARY KEY, name TEXT, identifier TEXT, gender TEXT, birth_date DATE);
    CREATE TABLE providers (provider_id UUID PRIMARY KEY, provider_name TEXT, nphies_id TEXT, provider_type TEXT, type TEXT);
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT, nphies_id TEXT);
    CREATE TABLE patient_coverage (coverage_id UUID PRIMARY KEY, patient_id UUID, insurer_id UUID, member_id TEXT, policy_number TEXT,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW());
  `);
  const migrate = async file => query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  for (const file of ['migrations/create_prior_authorization_tables.sql', 'migrations/create_claim_submissions_tables.sql',
    'migrations/add_manual_entry_fields.sql', 'migrations/035_add_pharmacy_claim_enhancements.sql',
    'migrations/042_add_item_details_tables.sql', 'migrations/051_add_shadow_billing_fields.sql',
    'migrations/057_add_shadow_billing_to_claim_items.sql', 'migrations/061_add_code_entry_mode.sql',
    'migrations/063_selected_coverage.sql', 'migrations/070_item_type_and_discharge_disposition.sql']) await migrate(file);

  const input = clinicalInput();
  await query('INSERT INTO patients VALUES ($1,$2,$3,$4,$5)', [input.patient.patient_id, input.patient.name, input.patient.identifier, input.patient.gender, input.patient.birth_date]);
  await query('INSERT INTO providers VALUES ($1,$2,$3,$4,$5)', Object.values(input.provider));
  await query('INSERT INTO insurers VALUES ($1,$2,$3)', Object.values(input.insurer));
  const parties = { patient_id: input.patient.patient_id, provider_id: input.provider.provider_id, insurer_id: input.insurer.insurer_id };

  const { getClaimMapper } = await import('../services/claimMapper/index.js');
  const { default: priorAuth } = await import('../controllers/priorAuthorizationsController.js');
  const { default: claims } = await import('../controllers/claimSubmissionsController.js');
  const readRow = table => async id => {
    const row = (await query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
    return row ? { ...row, items: [], supporting_info: [], diagnoses: [], attachments: [] } : null;
  };
  t.mock.method(priorAuth, 'getByIdInternal', readRow('prior_authorizations'));
  t.mock.method(claims, 'getByIdInternal', readRow('claim_submissions'));
  const paItems = async id => (await query('SELECT * FROM prior_authorization_items WHERE prior_auth_id=$1 ORDER BY sequence', [id])).rows;
  const claimItems = async id => (await query('SELECT * FROM claim_submission_items WHERE claim_id=$1 ORDER BY sequence', [id])).rows;

  // What PriorAuthorizationForm sends for a medication picked in 'NPHIES code' mode.
  const medicationItem = (code, name) => ({ sequence: 1, code_entry_mode: 'nphies', item_type: 'medication', medication_code: code,
    medication_name: name, product_or_service_system: MEDICATION_SYSTEM, quantity: 1, unit_price: 10, net_amount: 10, days_supply: 5 });

  await t.test('pharmacy PA: create and update keep the medication code and name', async () => {
    const res = response();
    await priorAuth.create({ params: {}, body: { auth_type: 'pharmacy', ...parties, items: [medicationItem('MED-A', 'Synthetic medication A')] } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const id = res.body.data.id;
    let [item] = await paItems(id);
    assert.equal(item.medication_code, 'MED-A');
    assert.equal(item.medication_name, 'Synthetic medication A');
    assert.equal(item.product_or_service_code, 'MED-A');
    assert.equal(item.item_type, 'medication');

    // Reopen and pick another medication: the reloaded item still carries the old product code.
    const edited = { ...item, medication_code: 'MED-B', medication_name: 'Synthetic medication B' };
    const upd = response();
    await priorAuth.update({ params: { id }, body: { items: [edited] } }, upd);
    assert.equal(upd.statusCode, 200, JSON.stringify(upd.body));
    [item] = await paItems(id);
    assert.equal(item.medication_code, 'MED-B');
    assert.equal(item.medication_name, 'Synthetic medication B');
    assert.equal(item.product_or_service_code, 'MED-B', 'the product code follows the selected medication');
  });

  await t.test('pharmacy claim: create keeps the medication code', async () => {
    const res = response();
    await claims.create({ params: {}, body: { claim_type: 'pharmacy', ...parties, items: [medicationItem('MED-C', 'Synthetic medication C')] } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const [item] = await claimItems(res.body.data.id);
    assert.equal(item.medication_code, 'MED-C');
    assert.equal(item.product_or_service_code, 'MED-C');
    assert.equal(item.item_type, 'medication');
  });

  const serviceItem = { sequence: 1, code_entry_mode: 'nphies', product_or_service_code: 'SVC-1', product_or_service_display: 'Synthetic service',
    product_or_service_system: 'http://nphies.sa/terminology/CodeSystem/services', quantity: 1, unit_price: 10, net_amount: 10 };

  await t.test('non-pharmacy items are not stored as medications', async () => {
    const pa = response();
    // The shadow-billing picker in the form sets item_type 'medication' for any auth type.
    await priorAuth.create({ params: {}, body: { auth_type: 'professional', ...parties, items: [{ ...serviceItem, item_type: 'medication' }] } }, pa);
    assert.equal(pa.statusCode, 201, JSON.stringify(pa.body));
    assert.equal((await paItems(pa.body.data.id))[0].item_type, null);
    const claim = response();
    await claims.create({ params: {}, body: { claim_type: 'professional', ...parties, items: [serviceItem] } }, claim);
    assert.equal(claim.statusCode, 201, JSON.stringify(claim.body));
    assert.equal((await claimItems(claim.body.data.id))[0].item_type, null);
    // Pharmacy items without an explicit type are still medications.
    const pharmacy = response();
    const { item_type: _omit, ...untyped } = medicationItem('MED-D', 'Synthetic medication D');
    await claims.create({ params: {}, body: { claim_type: 'pharmacy', ...parties, items: [untyped] } }, pharmacy);
    assert.equal((await claimItems(pharmacy.body.data.id))[0].item_type, 'medication');
  });

  await t.test('institutional discharge disposition is stored and sent', async () => {
    const encounter = { encounter_class: 'inpatient', encounter_start: '2026-08-01T08:00:00+03:00', encounter_end: '2026-08-03T10:00:00+03:00' };
    const pa = response();
    await priorAuth.create({ params: {}, body: { auth_type: 'institutional', ...parties, ...encounter, discharge_disposition: 'DTPH' } }, pa);
    assert.equal(pa.statusCode, 201, JSON.stringify(pa.body));
    assert.equal((await query('SELECT discharge_disposition FROM prior_authorizations WHERE id=$1', [pa.body.data.id])).rows[0].discharge_disposition, 'DTPH');

    const bad = response();
    await claims.create({ params: {}, body: { claim_type: 'institutional', ...parties, ...encounter, discharge_disposition: 'not-a-code' } }, bad);
    assert.equal(bad.statusCode, 400, 'codes outside the NPHIES discharge-disposition code system are refused');

    const res = response();
    await claims.create({ params: {}, body: { claim_type: 'institutional', ...parties, ...encounter, discharge_disposition: 'LAMA' } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const row = (await query('SELECT * FROM claim_submissions WHERE id=$1', [res.body.data.id])).rows[0];
    assert.equal(row.discharge_disposition, 'LAMA');

    // The stored row feeds the mapper (claims are sent from SELECT cs.*).
    const data = clinicalInput('institutional');
    const { discharge_disposition: _fixture, ...claimWithoutFixture } = data.claim;
    const bundle = getClaimMapper('institutional').buildClaimRequestBundle({ ...data, claim: { ...claimWithoutFixture, discharge_disposition: row.discharge_disposition } });
    const enc = bundle.entry.map(e => e.resource).find(r => r.resourceType === 'Encounter');
    assert.deepEqual(enc.hospitalization.dischargeDisposition.coding[0], {
      system: 'http://nphies.sa/terminology/CodeSystem/discharge-disposition', code: 'LAMA', display: 'Left Against Medical Advice'
    });
  });
});
