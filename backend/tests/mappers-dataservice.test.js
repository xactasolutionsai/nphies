import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db.js';
import nphiesDataService from '../services/nphiesDataService.js';

function recordQueries(t, existing) {
  const statements = [];
  t.mock.method(pool, 'connect', async () => ({
    query: async (sql, params) => {
      statements.push({ sql: sql.trim(), params });
      if (/^SELECT \w+_id FROM/.test(sql.trim())) return { rows: existing ? [{ patient_id: 'p1', insurer_id: 'i1', provider_id: 'pr1', coverage_id: 'c1' }] : [] };
      return { rows: [{ patient_id: 'p1', insurer_id: 'i1', provider_id: 'pr1', coverage_id: 'c1' }], rowCount: 1 };
    },
    release() {}
  }));
  return statements;
}

test('Patient update does not overwrite stored values with defaults (newborn flag, identifier type)', async t => {
  const statements = recordQueries(t, true);
  await nphiesDataService.upsertPatient({ identifier: '1000000001', name: 'Test Patient' });
  const update = statements.find(s => s.sql.startsWith('UPDATE patients'));
  assert.equal(update.params[1], null, 'identifier_type must be kept');
  assert.equal(update.params[8], null, 'country must be kept');
  assert.equal(update.params[10], null, 'is_newborn must be kept');
  // Atomic: BEGIN, per-key advisory lock, ..., COMMIT
  assert.equal(statements[0].sql, 'BEGIN');
  assert.match(statements[1].sql, /pg_advisory_xact_lock/);
  assert.equal(statements.at(-1).sql, 'COMMIT');
});

test('Insurer, provider and coverage updates keep stored values when fields are absent', async t => {
  const statements = recordQueries(t, true);
  await nphiesDataService.upsertInsurer({ nphiesId: 'TEST-INSURER' });
  await nphiesDataService.upsertProvider({ nphiesId: 'TEST-PROVIDER' });
  await nphiesDataService.upsertCoverage({ policyNumber: 'POL-1' }, 'p1', 'i1');
  const insurer = statements.find(s => s.sql.startsWith('UPDATE insurers'));
  assert.equal(insurer.params[1], null, 'status must not be reset to Active');
  const provider = statements.find(s => s.sql.startsWith('UPDATE providers'));
  assert.equal(provider.params[1], null, 'location_license must not be reset to GACH');
  assert.equal(provider.params[2], null, 'provider_type must not be reset');
  const coverage = statements.find(s => s.sql.startsWith('UPDATE patient_coverage'));
  assert.equal(coverage.params[1], null, 'member_id must not be replaced by the policy number');
  assert.equal(coverage.params[2], null, 'coverage_type must be kept');
  assert.equal(coverage.params[3], null, 'relationship must be kept');
  assert.equal(coverage.params[9], null, 'is_active must be kept');
});

test('New provider gets no placeholder location license', async t => {
  const statements = recordQueries(t, false);
  await nphiesDataService.upsertProvider({ nphiesId: 'TEST-PROVIDER', name: 'Test Hospital' });
  const insert = statements.find(s => s.sql.startsWith('INSERT INTO providers'));
  assert.equal(insert.params[2], null);
});

test('Response payer with another license does not create or link a different insurer', async t => {
  const statements = recordQueries(t, true);
  const response = { entry: [{ resource: { resourceType: 'Organization', name: 'Sandbox payer',
    identifier: [{ system: 'http://nphies.sa/license/payer-license', value: 'INS-FHIR' }] } }] };
  const requested = { insurer_id: 'i-requested', nphies_id: 'TEST-INSURER' };
  const result = await nphiesDataService.processNphiesResponse(response, { insurer: requested });
  assert.equal(result.insurer, requested);
  assert.equal(statements.filter(s => /insurers/.test(s.sql)).length, 0);
});
