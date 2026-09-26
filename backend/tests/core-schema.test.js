import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { getDbConfig } from '../db.js';
import { destructiveSeedRefusal } from '../scripts/seedGuard.js';
import { readAdminEmail, readAdminPassword } from '../scripts/adminCredentials.js';
import { validationSchemas } from '../models/schema.js';
import { queries } from '../db/queries.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

const localRegressionUrl = () => {
  if (!process.env.TEST_DATABASE_URL) return null;
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith('_regression') || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must point to a local dedicated *_regression database');
  }
  return url;
};

test('Database configuration has no credential defaults outside tests', () => {
  assert.throws(() => getDbConfig({ NODE_ENV: 'production' }), /DB_NAME, DB_USER, DB_PASSWORD/);
  assert.throws(() => getDbConfig({ NODE_ENV: 'development', DB_NAME: 'x', DB_USER: 'y' }), /DB_PASSWORD/);
  const config = getDbConfig({ NODE_ENV: 'development', DB_NAME: 'x', DB_USER: 'y', DB_PASSWORD: '' });
  assert.equal(config.password, '');
  const testConfig = getDbConfig({ NODE_ENV: 'test' });
  assert.equal(testConfig.password, undefined);
  assert.equal(testConfig.user, undefined);
});

test('NPHIES base URL must be configured explicitly', t => {
  const previous = process.env.NPHIES_BASE_URL;
  t.after(() => { process.env.NPHIES_BASE_URL = previous; });
  delete process.env.NPHIES_BASE_URL;
  assert.throws(() => NPHIES_CONFIG.BASE_URL, /NPHIES_BASE_URL/);
  process.env.NPHIES_BASE_URL = 'https://nphies.invalid';
  assert.equal(NPHIES_CONFIG.BASE_URL, 'https://nphies.invalid');
});

test('Destructive seeds require an explicit opt-in and never run in production', () => {
  assert.match(destructiveSeedRefusal({}), /ALLOW_DESTRUCTIVE_SEED/);
  assert.match(destructiveSeedRefusal({ NODE_ENV: 'production', ALLOW_DESTRUCTIVE_SEED: 'true' }), /production/);
  assert.equal(destructiveSeedRefusal({ NODE_ENV: 'development', ALLOW_DESTRUCTIVE_SEED: 'true' }), null);
});

test('Admin scripts refuse missing, published or weak credentials', () => {
  assert.throws(() => readAdminEmail(['node', 'script'], {}));
  assert.throws(() => readAdminEmail(['node', 'script', 'admin@admin.com'], {}));
  assert.equal(readAdminEmail(['node', 'script', ' Ops@Example.Test '], {}), 'ops@example.test');
  assert.throws(() => readAdminPassword(['node', 'script'], {}));
  assert.throws(() => readAdminPassword(['node', 'script'], { ADMIN_PASSWORD: '123123' }));
  assert.throws(() => readAdminPassword(['node', 'script'], { ADMIN_PASSWORD: 'short' }));
  assert.equal(readAdminPassword(['node', 'script'], { ADMIN_PASSWORD: 'a-long-private-passphrase' }), 'a-long-private-passphrase');
});

test('Migration 049 no longer contains credentials', async () => {
  const sql = await fs.readFile(new URL('../migrations/049_create_admin_user.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /INSERT\s+INTO|UPDATE\s+users|\$2[aby]\$|Password:\s*\S/i);
});

test('Legacy CRUD schemas accept UUID keys and map to real columns', () => {
  const id = crypto.randomUUID();
  const refs = { patient_id: id, provider_id: id, insurer_id: id };
  const auth = validationSchemas.authorization.validate({ status: 'Approved', purpose: 'Synthetic', ...refs });
  assert.equal(auth.error, undefined);
  assert.equal(auth.value.auth_status, 'Approved');
  assert.equal(auth.value.status, undefined);
  assert.equal(validationSchemas.eligibility.validate({ purpose: 'Synthetic', status: 'Pending', ...refs }).error, undefined);
  assert.equal(validationSchemas.claim.validate({ claim_number: 'CLM-1', status: 'Pending', amount: 10, ...refs }).error, undefined);
  assert.equal(validationSchemas.claimBatch.validate({ batch_identifier: 'BATCH-1', provider_id: id, insurer_id: id }).error, undefined);
  for (const schema of ['authorization', 'eligibility', 'claim']) {
    assert.ok(validationSchemas[schema].validate({ purpose: 'Synthetic', status: 'Pending', claim_number: 'CLM-1', amount: 1, patient_id: 1, provider_id: 1, insurer_id: 1 }).error, schema);
  }
  const payment = validationSchemas.payment.validate({ payment_ref_number: 'PAY-1', provider_id: id, insurer_id: id,
    payment_date: '2026-01-01', total_amount: 5, total_paid_amount: 6 });
  assert.equal(payment.error, undefined);
  assert.equal(payment.value.amount, 6);
  assert.equal(payment.value.payment_ref, 'PAY-1');
});

test('Dashboard queries aggregate before joining and count only real approvals', () => {
  for (const name of ['GET_INSURER_PERFORMANCE', 'GET_PROVIDER_FULL_PERFORMANCE', 'GET_INSURER_FULL_PERFORMANCE']) {
    assert.match(queries.DASHBOARD[name], /GROUP BY insurer_id|GROUP BY provider_id/, name);
  }
  assert.match(queries.CLAIMS.GET_STATS, /status = 'Approved' THEN 1 END\) as approved_claims/);
  assert.doesNotMatch(queries.DASHBOARD.GET_RECENT_ACTIVITY, /CURRENT_TIMESTAMP/);
  assert.equal(typeof queries.ELIGIBILITY.GET_BY_ID_WITH_JOINS, 'string');
  assert.doesNotMatch(queries.DASHBOARD.GET_COUNTS.CLAIM_BATCHES, /claims_batch/);
});

test('Migrations build a fresh database, re-run cleanly, and dashboard totals are not inflated', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = localRegressionUrl();
  const dbName = `${url.pathname.slice(1)}_migrate_${crypto.randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const target = new URL(url.href);
  target.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: target.href });
  await client.connect();
  t.after(async () => {
    await client.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });
  const { runMigrations, MIGRATIONS } = await import('../scripts/migrate.js');
  const log = () => {};
  const first = await runMigrations(client, {}, log);
  assert.ok(first.applied.length > 0);
  assert.equal(first.applied.length + first.skipped.length, MIGRATIONS.length);
  for (const file of first.skipped) assert.ok(MIGRATIONS.find(m => m.file === file).requires, file);
  assert.equal((await runMigrations(client, {}, log)).applied.length, 0);
  // Every listed migration must also be safe to execute a second time.
  await client.query('DELETE FROM schema_migrations');
  const rerun = await runMigrations(client, {}, log);
  assert.equal(rerun.applied.length, first.applied.length);

  const columns = async table => new Set((await client.query(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table])).rows.map(r => r.column_name));
  const pa = await columns('prior_authorizations');
  for (const c of ['ventilation_hours', 'triage_category', 'triage_date', 'encounter_priority', 'eligibility_offline_ref',
    'eligible_amount', 'benefit_amount', 'copay_amount', 'sub_type', 'eligibility_response_id', 'eligibility_response_system', 'adjudication_outcome']) {
    assert.ok(pa.has(c), `prior_authorizations.${c}`);
  }
  assert.ok((await columns('payments')).has('payment_ref'));
  assert.ok((await columns('authorizations')).has('auth_id'));
  assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n, 0, 'no seeded admin account');

  // Every static SQL string in db/queries.js must be valid against the migrated schema.
  const statements = [];
  const walk = (obj, name) => { for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^\s*(SELECT|UPDATE|INSERT|DELETE)/i.test(v)) statements.push([`${name}.${k}`, v]);
    else if (v && typeof v === 'object') walk(v, `${name}.${k}`);
  } };
  walk(queries, 'queries');
  for (const [name, sql] of statements) {
    await assert.doesNotReject(client.query(`PREPARE core_check AS ${sql}`), name);
    await client.query('DEALLOCATE core_check');
  }

  // Migration 067: treating practitioner columns on both request tables.
  for (const table of ['prior_authorizations', 'claim_submissions']) {
    const cols = await columns(table);
    for (const c of ['practitioner_license', 'practitioner_name', 'practitioner_specialty_code', 'practitioner_identifier_type']) {
      assert.ok(cols.has(c), `${table}.${c}`);
    }
  }
  // Migration 068: the new roles are accepted, legacy 'user' stays valid, anything else is rejected.
  for (const [n, role] of ['user', 'admin', 'submitter', 'reviewer', 'viewer'].entries()) {
    await client.query("INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', $2)", [`role${n}@example.test`, role]);
  }
  await assert.rejects(client.query("INSERT INTO users (email, password_hash, role) VALUES ('bad@example.test', 'x', 'superuser')"), /users_role_check/);
  await client.query("DELETE FROM users WHERE email LIKE 'role%@example.test'");

  // Every static INSERT/UPDATE/SELECT/DELETE in the NPHIES messaging services must name real
  // tables and columns (e.g. messageUpdater's Communication writes).
  const sqlLiterals = source => [...source.matchAll(/`([^`]*)`|'((?:SELECT|INSERT|UPDATE|DELETE)[^'\n]*)'/g)]
    .map(m => m[1] ?? m[2]).filter(sql => /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) && !sql.includes('${'));
  let prepared = 0;
  for (const file of ['services/messageUpdater.js', 'services/communicationService.js', 'services/claimCommunicationService.js',
    'services/advancedAuthCommunicationService.js', 'services/communicationOutbox.js', 'services/messageCorrelator.js',
    'services/systemPollService.js']) {
    for (const sql of sqlLiterals(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'))) {
      await assert.doesNotReject(client.query(`PREPARE service_check AS ${sql}`), `${file}: ${sql.trim().slice(0, 80)}`);
      await client.query('DEALLOCATE service_check');
      prepared++;
    }
  }
  assert.ok(prepared > 50, `prepared ${prepared} statements`);

  // Response viewer list queries, with and without every filter and sort.
  const { buildResponseViewerQuery } = await import('../controllers/responseViewerController.js');
  for (const tab of ['claims', 'authorizations', 'eligibility', 'payments']) {
    for (const params of [{}, { search: 'x', status: 'Approved', dateRange: 'quarter', sortBy: 'amount', sortOrder: 'ASC' },
      { sortBy: 'patient_name' }, { sortBy: 'status', dateRange: 'today' }]) {
      const built = buildResponseViewerQuery(tab, params);
      await assert.doesNotReject(client.query(built.dataSql, built.dataParams), `${tab} ${JSON.stringify(params)}`);
      await assert.doesNotReject(client.query(built.countSql, built.countParams), `${tab} count ${JSON.stringify(params)}`);
    }
  }

  // One insurer with 3 claims (100 each, one Paid) and 2 payments (50 each).
  const [insurer, provider, patient] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await client.query("INSERT INTO insurers (insurer_id, insurer_name) VALUES ($1, 'Synthetic Insurer')", [insurer]);
  await client.query("INSERT INTO providers (provider_id, provider_name) VALUES ($1, 'Synthetic Provider')", [provider]);
  await client.query("INSERT INTO patients (patient_id, name) VALUES ($1, 'Synthetic Patient')", [patient]);
  for (const [n, status] of [[1, 'Paid'], [2, 'Pending'], [3, 'Pending']]) {
    await client.query('INSERT INTO claims (claim_number, patient_id, provider_id, insurer_id, status, amount, submission_date) VALUES ($1, $2, $3, $4, $5, 100, CURRENT_DATE)',
      [`SYN-${n}`, patient, provider, insurer, status]);
  }
  for (const n of [1, 2]) {
    await client.query("INSERT INTO payments (payment_ref, insurer_id, provider_id, amount, payment_date) VALUES ($1, $2, $3, 50, CURRENT_DATE)", [`PAY-${n}`, insurer, provider]);
    await client.query("INSERT INTO eligibility (patient_id, provider_id, insurer_id, status) VALUES ($1, $2, $3, 'eligible')", [patient, provider, insurer]);
  }
  const performance = (await client.query(queries.DASHBOARD.GET_INSURER_PERFORMANCE)).rows.find(r => r.insurer_id === insurer);
  assert.equal(Number(performance.total_claims), 3);
  assert.equal(Number(performance.total_amount), 300);
  assert.equal(Number(performance.paid_claims), 1);
  assert.equal(Number(performance.total_payments), 100);
  const full = (await client.query(queries.DASHBOARD.GET_INSURER_FULL_PERFORMANCE)).rows.find(r => r.insurer_id === insurer);
  assert.equal(Number(full.claims_amount), 300);
  assert.equal(Number(full.eligibility_checks), 2);
  assert.equal(Number(full.total_payments), 100);
  const providerRow = (await client.query(queries.DASHBOARD.GET_PROVIDER_FULL_PERFORMANCE)).rows.find(r => r.provider_id === provider);
  assert.equal(Number(providerRow.claims_amount), 300);
  const activity = (await client.query(queries.DASHBOARD.GET_RECENT_ACTIVITY)).rows;
  assert.ok(activity.every(row => row.created_at !== null));
});
