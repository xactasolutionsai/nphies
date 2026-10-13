// Run on the platform host with node --env-file=/etc/nafes/app.env.
// Back up the configured application database before the additive migration.
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const backend = process.env.DRG_ACTIVATION_BACKEND || '/opt/nafes/current/backend';
for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing configured ${key}; refusing to use database defaults`);
}
const { default: pool } = await import(pathToFileURL(path.join(backend, 'db.js')).href);
const columns = ['drg_code', 'drg_description', 'drg_code_system', 'drg_version', 'drg_grouper_name', 'drg_grouper_version', 'drg_grouper_certified', 'drg_mds_confirmed', 'drg_mds_fingerprint', 'drg_grouper_output', 'drg_error_explanation', 'drg_leave_days', 'drg_ventilation_used', 'drg_no_procedures', 'drg_procedures', 'discharge_disposition', 'ventilation_hours'];
const report = { startedAt: new Date().toISOString(), success: false };
let client;
try {
  const migration = await fs.readFile(path.join(backend, 'migrations/066_claim_drg.sql'), 'utf8');
  report.migrationSha256 = createHash('sha256').update(migration).digest('hex');
  const directory = path.join(process.env.DRG_BACKUP_DIR || '/var/backups/nafes', 'drg-' + report.startedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  report.backupPath = path.join(directory, 'before-drg.dump');
  const dumpTool = process.env.DRG_PG_DUMP || '/usr/lib/postgresql/18/bin/pg_dump';
  if (process.env.DRG_BACKUP_AS_POSTGRES === 'true') {
    if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) throw new Error('Local postgres backup requires a local database');
    const fd = openSync(report.backupPath, 'wx', 0o600);
    try {
      execFileSync('sudo', ['-u', 'postgres', dumpTool, '--format=custom', '--port', process.env.DB_PORT, '--dbname', process.env.DB_NAME], { stdio: ['ignore', fd, 'pipe'] });
    } finally { closeSync(fd); }
  } else {
    execFileSync(dumpTool, ['--format=custom', '--host', process.env.DB_HOST, '--port', process.env.DB_PORT, '--username', process.env.DB_USER, '--dbname', process.env.DB_NAME, '--file', report.backupPath], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, stdio: ['ignore', 'ignore', 'pipe'] });
  }
  await fs.chmod(report.backupPath, 0o600);
  if ((await fs.stat(report.backupPath)).size === 0) throw new Error('Empty backup; migration was not applied');
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SET LOCAL lock_timeout = \'10s\'');
  await client.query('LOCK TABLE claim_submissions IN SHARE ROW EXCLUSIVE MODE');
  const totalsSql = 'SELECT COUNT(*)::int AS claims, COALESCE(SUM(total_amount),0)::text AS ffs_total FROM claim_submissions';
  report.before = (await client.query(totalsSql)).rows[0];
  await client.query(migration.replace(/^\s*BEGIN\s*;/i, '').replace(/COMMIT\s*;\s*$/i, ''));
  const actual = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='claim_submissions'")).rows.map(row => row.column_name);
  const missing = columns.filter(column => !actual.includes(column));
  if (missing.length) throw new Error('Missing DRG columns: ' + missing.join(', '));
  await client.query('SELECT id FROM claim_drg_audit LIMIT 0');
  report.after = (await client.query(totalsSql)).rows[0];
  if (JSON.stringify(report.before) !== JSON.stringify(report.after)) throw new Error('Claim count or FFS total changed; rolling back');
  await client.query('COMMIT');
  report.migrationCommitted = true;
  report.success = true;
  report.verifiedColumns = columns.length;
  report.finishedAt = new Date().toISOString();
  report.evidencePath = path.join(directory, 'verification.json');
  await fs.writeFile(report.evidencePath, JSON.stringify(report, null, 2), { mode: 0o600 });
} catch (error) {
  if (client && !report.migrationCommitted) await client.query('ROLLBACK').catch(() => {});
  // No connection URL, password, backup contents or clinical rows are printed.
  report.error = error.code || error.message;
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
console.log(JSON.stringify(report));
