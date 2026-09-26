// P2.3 rejection analytics per insurer and P2.5 poll timing statistics (SQL + code only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import { parseCsv, loadCodeSystemIndex, describeCodes, UNKNOWN_CODE_NOTE } from '../services/ai/codeDescriptions.js';
import { rejectionAnalytics, pollTimingStats, recommendedIntervalBand, AnalyticsInputError } from '../services/ai/analytics.js';

console.error = () => {};

test('CSV parser handles BOM, quotes, escaped quotes and newlines inside fields', () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, ""y""",z\n2,"multi\nline",\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, "y"', 'z'], ['2', 'multi\nline', '']]);
});

test('Codes are described from the official CodeSystems.csv, then nphies_codes, else the fragment note', async () => {
  const index = await loadCodeSystemIndex();
  assert.ok(index.size > 400, 'CSV loaded');
  const lookups = [];
  const queryFn = async (sql, params) => {
    lookups.push(params[0]);
    return { rows: [{ code: 'LOCAL-1', display_en: 'Locally known code' }] };
  };
  const described = await describeCodes([
    { code: 'op', system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype' },
    { code: 'LOCAL-1', system: null },
    { code: 'BV-99999', system: 'http://nphies.sa/terminology/CodeSystem/adjudication-error' }
  ], { queryFn, index });
  assert.deepEqual(described.get('http://nphies.sa/terminology/CodeSystem/claim-subtype|op'),
    { description: 'OutPatient', descriptionSource: 'nphies CodeSystems.csv (official)' });
  assert.deepEqual(described.get('|LOCAL-1'), { description: 'Locally known code', descriptionSource: 'nphies_codes (local table)' });
  assert.deepEqual(described.get('http://nphies.sa/terminology/CodeSystem/adjudication-error|BV-99999'), { description: null, descriptionSource: null, note: UNKNOWN_CODE_NOTE });
  assert.match(UNKNOWN_CODE_NOTE, /published fragment/);
  assert.deepEqual(lookups[0].sort(), ['BV-99999', 'LOCAL-1']);
  // A missing nphies_codes table does not break the description step.
  const noTable = await describeCodes([{ code: 'X-1' }], { queryFn: async () => { throw Object.assign(new Error('missing'), { code: '42P01' }); }, index });
  assert.equal(noTable.get('|X-1').note, UNKNOWN_CODE_NOTE);
});

const fakeRejectionQuery = ({ sample = 40 } = {}) => async (sql, params) => {
  if (sql.includes('AS sample_size')) {
    return { rows: [
      { request_type: 'prior_authorization', record_type: 'pharmacy', insurer_id: 'ins-a', insurer_name: 'Insurer A', sample_size: sample, affected_records: 12 },
      { request_type: 'claim', record_type: 'professional', insurer_id: 'ins-b', insurer_name: 'Insurer B', sample_size: 5, affected_records: 2 }
    ] };
  }
  if (sql.includes('AS occurrences')) {
    return { rows: [
      { request_type: 'prior_authorization', record_type: 'pharmacy', insurer_id: 'ins-a', kind: 'error', code: 'BV-00163', system: 'http://nphies.sa/terminology/CodeSystem/adjudication-error', sample_message: 'Patient 1023456789 not eligible', occurrences: 6, records: 5 },
      { request_type: 'prior_authorization', record_type: 'pharmacy', insurer_id: 'ins-a', kind: 'adjudication_reason', code: 'MN-1-1', system: null, sample_message: null, occurrences: 3, records: 3 },
      { request_type: 'prior_authorization', record_type: 'pharmacy', insurer_id: 'ins-a', kind: 'adjudication_reason', code: 'Service not covered', system: null, sample_message: null, occurrences: 1, records: 1 },
      { request_type: 'claim', record_type: 'professional', insurer_id: 'ins-b', kind: 'error', code: 'GE-00012', system: null, sample_message: null, occurrences: 2, records: 2 }
    ] };
  }
  if (sql.includes('nphies_codes')) return { rows: [] };
  throw new Error(`unexpected SQL ${sql.slice(0, 60)} ${params}`);
};

test('Rejection analytics: counts, shares, top N, sample size, refusal below the minimum, PHI-free', async () => {
  const result = await rejectionAnalytics({ from: '2026-01-01', to: '2026-06-30', top: '2' }, { queryFn: fakeRejectionQuery(), env: {} });
  assert.equal(result.source, 'statistics');
  assert.ok(result.basis.description);
  assert.equal(result.basis.minimumSampleSize, 30);
  assert.equal(result.range.from, '2026-01-01');
  const a = result.groups.find(g => g.insurerId === 'ins-a');
  assert.equal(a.sampleSize, 40);
  assert.equal(a.totalOccurrences, 10);
  assert.equal(a.insufficientData, false);
  assert.equal(a.codes.length, 2, 'top N');
  assert.deepEqual(a.codes.map(c => [c.code, c.count, c.share]), [['BV-00163', 6, 0.6], ['MN-1-1', 3, 0.3]]);
  assert.equal(a.codes[0].note, UNKNOWN_CODE_NOTE);
  assert.equal(a.codes[0].nphiesMessage, 'Patient [NATIONAL_ID] not eligible');
  const b = result.groups.find(g => g.insurerId === 'ins-b');
  assert.equal(b.insufficientData, true);
  assert.equal(b.sampleSize, 5);
  assert.equal(b.codes[0].count, 2, 'raw counts stay visible');
  assert.equal(b.codes[0].share, null, 'no share below the minimum sample');

  const all = await rejectionAnalytics({ top: '50' }, { queryFn: fakeRejectionQuery(), env: {} });
  const reasonText = all.groups[0].codes.find(c => c.code === 'Service not covered');
  assert.equal(reasonText.kind, 'adjudication_reason');
  assert.equal(reasonText.note, 'Stored as reason text (no code was kept for this item).');

  for (const bad of [{ from: 'yesterday' }, { from: '2026-05-01', to: '2026-01-01' }, { type: 'x' }, { top: '0' }, { insurerId: 'not-a-uuid' }]) {
    await assert.rejects(() => rejectionAnalytics(bad, { queryFn: fakeRejectionQuery(), env: {} }), AnalyticsInputError);
  }
});

test('The "per-insurer poll interval" premise is false: poll_logs has no insurer column', async () => {
  const sql = await fs.readFile(new URL('../migrations/053_create_poll_tables.sql', import.meta.url), 'utf8');
  const pollLogs = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS poll_logs'), sql.indexOf('CREATE TABLE IF NOT EXISTS poll_messages'));
  assert.ok(pollLogs.includes('provider_nphies_id'));
  assert.ok(!/insurer/i.test(pollLogs));
});

test('Recommended poll interval band follows the arrival rate and is clamped', () => {
  assert.deepEqual(recommendedIntervalBand(6), { minMinutes: 10, maxMinutes: 30 });
  assert.deepEqual(recommendedIntervalBand(600), { minMinutes: 1, maxMinutes: 1 });
  assert.deepEqual(recommendedIntervalBand(0.1), { minMinutes: 60, maxMinutes: 60 });
  assert.equal(recommendedIntervalBand(0), null);
});

test('Poll timing: endpoint-wide global stats, per-insurer P50/P90, refusal below n=30', async () => {
  const queryFn = async sql => {
    if (sql.includes('FROM poll_logs')) {
      return { rows: [{ polls: 100, completed: 96, empty_polls: 72, messages: 48, span_seconds: 96 * 300, median_gap_seconds: 300 }] };
    }
    if (sql.includes('first_seconds')) {
      return { rows: [
        { request_type: 'prior_authorization', insurer_id: 'ins-a', insurer_name: 'Insurer A', n_first: 45, p50_first: 4, p90_first: 9, n_final: 40, p50_final: 1800, p90_final: 7200 },
        { request_type: 'claim', insurer_id: 'ins-b', insurer_name: 'Insurer B', n_first: 12, p50_first: 3, p90_first: 5, n_final: 12, p50_final: 60, p90_final: 90 }
      ] };
    }
    throw new Error('unexpected SQL');
  };
  const result = await pollTimingStats({}, { queryFn, env: { POLL_INTERVAL_MINUTES: '5' } });
  assert.equal(result.source, 'statistics');
  assert.equal(result.scope, 'endpoint-wide');
  assert.equal(result.perInsurerPollInterval, false);
  assert.match(result.note, /no insurer column/);
  assert.match(result.note, /scheduler is not changed/);
  assert.equal(result.global.insufficientData, false);
  assert.equal(result.global.messagesPerPoll, 0.5);
  assert.equal(result.global.emptyPollRatio, 0.75);
  assert.equal(result.global.arrivalRatePerHour, 6);
  assert.deepEqual(result.global.recommendedIntervalMinutes, { minMinutes: 10, maxMinutes: 30 });
  assert.equal(result.global.currentIntervalMinutes, 5);
  const a = result.perInsurer.find(r => r.insurerId === 'ins-a');
  assert.equal(a.firstResponse.n, 45);
  assert.equal(a.firstResponse.p50Seconds, 4);
  assert.equal(a.finalResponse.p90Seconds, 7200);
  const b = result.perInsurer.find(r => r.insurerId === 'ins-b');
  assert.deepEqual(b.firstResponse, { insufficientData: true, count: 12, minimum: 30 });

  const few = await pollTimingStats({}, { queryFn: async sql => sql.includes('FROM poll_logs')
    ? { rows: [{ polls: 10, completed: 10, empty_polls: 5, messages: 5, span_seconds: 3000, median_gap_seconds: 300 }] }
    : { rows: [] }, env: {} });
  assert.equal(few.global.insufficientData, true);
  assert.equal(few.global.count, 10);
  assert.equal(few.global.recommendedIntervalMinutes, undefined);
});

test('Analytics SQL runs on PostgreSQL and computes real counts and percentiles', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  const schema = `aian_${crypto.randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url.href, options: `-c search_path=${schema}` });
  await client.connect();
  t.after(async () => { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); });
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`
    CREATE TABLE patients (patient_id UUID PRIMARY KEY);
    CREATE TABLE providers (provider_id UUID PRIMARY KEY);
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT);
  `);
  for (const file of ['migrations/create_prior_authorization_tables.sql', 'migrations/create_claim_submissions_tables.sql', 'migrations/053_create_poll_tables.sql']) {
    await client.query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  const queryFn = (sql, params) => client.query(sql, params);
  const insA = crypto.randomUUID();
  await client.query('INSERT INTO insurers VALUES ($1, $2)', [insA, 'Insurer A']);
  // 31 prior authorizations; response i arrives i minutes after the request; every third is denied with an error.
  for (let i = 1; i <= 31; i++) {
    const denied = i % 3 === 0;
    const pa = await client.query(`INSERT INTO prior_authorizations (request_number, auth_type, insurer_id, status, request_date)
      VALUES ($1, 'pharmacy', $2, $3, TIMESTAMP '2026-03-01 08:00' + ($4 || ' hours')::interval) RETURNING id, request_date`,
    [`PA-${i}`, insA, denied ? 'denied' : 'approved', i]);
    const id = pa.rows[0].id;
    await client.query(`INSERT INTO prior_authorization_items (prior_auth_id, sequence, product_or_service_code, adjudication_status, adjudication_reason)
      VALUES ($1, 1, 'X', $2, $3)`, [id, denied ? 'denied' : 'approved', denied ? 'MN-1-1' : null]);
    await client.query(`INSERT INTO prior_authorization_responses (prior_auth_id, response_type, outcome, bundle_json, has_errors, errors, received_at)
      VALUES ($1, 'initial', $2, '{}', $3, $4, $5::timestamp + ($6 || ' minutes')::interval)`,
    [id, denied ? 'error' : 'complete', denied, denied ? JSON.stringify([{ code: 'BV-00163', message: 'x' }]) : null, pa.rows[0].request_date, i]);
  }
  const rejections = await rejectionAnalytics({ from: '2026-01-01', to: '2026-12-31' }, { queryFn, env: {} });
  const group = rejections.groups.find(g => g.insurerId === insA);
  assert.equal(group.insurerName, 'Insurer A');
  assert.equal(group.recordType, 'pharmacy');
  assert.equal(group.sampleSize, 31);
  assert.equal(group.affectedRecords, 10);
  assert.deepEqual(group.codes.map(c => [c.kind, c.code, c.count]).sort(), [['adjudication_reason', 'MN-1-1', 10], ['error', 'BV-00163', 10]]);
  assert.equal(group.codes[0].share, 0.5);

  const empty = await rejectionAnalytics({ from: '2020-01-01', to: '2020-02-01' }, { queryFn, env: {} });
  assert.deepEqual(empty.groups, []);

  for (let i = 0; i < 40; i++) {
    await client.query(`INSERT INTO poll_logs (status, messages_received, started_at, created_at)
      VALUES ($1, $2, TIMESTAMP '2026-03-01 00:00' + ($3 || ' minutes')::interval, TIMESTAMP '2026-03-01 00:00' + ($3 || ' minutes')::interval)`,
    [i % 4 === 0 ? 'success' : 'no_messages', i % 4 === 0 ? 1 : 0, i * 5]);
  }
  const timing = await pollTimingStats({ from: '2026-01-01', to: '2026-12-31' }, { queryFn, env: {} });
  assert.equal(timing.global.polls, 40);
  assert.equal(timing.global.emptyPollRatio, 0.75);
  assert.equal(timing.global.medianSecondsBetweenPolls, 300);
  const a = timing.perInsurer.find(r => r.insurerId === insA && r.requestType === 'prior_authorization');
  assert.equal(a.firstResponse.n, 31);
  assert.equal(a.firstResponse.p50Seconds, 16 * 60);
  assert.equal(a.finalResponse.n, 31, 'error outcomes count as final; only queued responses are skipped');
  assert.equal(a.finalResponse.p90Seconds, 28 * 60);
});
