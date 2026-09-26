// Ordered schema migration runner.
//
// Usage (DB_* settings come from the environment / .env, like the server):
//   npm run migrate                 apply every pending migration in MIGRATIONS order
//   npm run migrate -- --status     list applied / pending / skipped migrations
//   npm run migrate -- --dry-run    show what would be applied
//   npm run migrate -- --baseline   record every listed migration as applied WITHOUT running it, except
//                                   those marked `afterBaseline` (added with this runner, 066 and later), which are
//                                   applied. Use it once on a database built by hand before this runner
//                                   existed; later runs of `npm run migrate` apply new files. Some older files touch
//                                   data (e.g. add_nphies_integration_uuid.sql fills a NULL provider
//                                   nphies_id), so an existing database should be baselined, not re-run.
//
// Applied migrations are recorded in the schema_migrations table. Each file runs as a single
// simple-protocol query, so its statements are atomic unless the file manages its own
// BEGIN/COMMIT. Every listed file is written to be safe to re-run.
//
// ORDER: the order is the MIGRATIONS array below, not the file name. The unnumbered files
// predate numbering and have dependencies between them, so they are listed explicitly:
//   1. 000 baseline core tables, then column additions to them;
//   2. code tables, prior authorization and claim submission tables and their column additions;
//   3. feature tables (advanced authorizations, general requests, exams, approval forms);
//   4. pgvector-based tables (skipped with a warning when the `vector` extension is not
//      available; they stay pending and run once it is installed);
//   5. data standardization, then the numbered migrations 029..068 in numeric order.
// Files in migrations/ that are NOT listed are one-off data scripts or superseded files; they
// are reported by --status with the reason (see NOT_MANAGED) and are never run automatically.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MIGRATIONS = [
  // 1. Core tables and their columns
  { file: 'migrations/000_baseline_core_tables.sql' },
  { file: '../database_migration_add_missing_columns.sql' },
  { file: 'migrations/add_nphies_integration_uuid.sql' },
  { file: 'migrations/add_nphies_required_columns.sql' },
  { file: 'migrations/add_eligibility_extensions.sql' },
  { file: 'migrations/add_missing_nphies_columns.sql' },
  { file: 'migrations/add_policy_holders.sql' },
  // 2. Code tables, prior authorizations, claim submissions
  { file: 'migrations/create_nphies_code_tables.sql' },
  { file: 'migrations/create_icd10_codes_table.sql' },
  { file: 'migrations/create_medication_codes_table.sql' },
  { file: 'migrations/create_prior_authorization_tables.sql' },
  { file: 'migrations/create_claim_submissions_tables.sql' },
  { file: 'migrations/add_admit_source_column.sql' },
  { file: 'migrations/add_chief_complaint_code_system.sql' },
  { file: 'migrations/add_drug_interaction_justification_column.sql' },
  { file: 'migrations/add_manual_entry_fields.sql' },
  { file: 'migrations/add_medication_safety_analysis_column.sql' },
  { file: 'migrations/add_newborn_extension_fields.sql' },
  { file: 'migrations/add_nphies_response_fields.sql' },
  { file: 'migrations/add_practice_code_column.sql' },
  { file: 'migrations/add_vision_prescription_column.sql' },
  // 3. Feature tables
  { file: 'migrations/create_advanced_authorizations.sql' },
  { file: 'migrations/create_general_requests_table.sql' },
  { file: 'migrations/create_medical_exams_table.sql' },
  { file: 'migration_standard_approvals.sql' },
  { file: 'migration_eye_approvals.sql' },
  { file: 'migration_dental_approvals.sql' },
  // 4. pgvector
  { file: 'migrations/add_pgvector_extension.sql', requires: 'vector' },
  { file: 'fix-embedding-dimensions.sql', requires: 'vector' },
  { file: 'migrations/create_medicines_tables.sql', requires: 'vector' },
  { file: 'migrations/fix_column_lengths.sql', requires: 'vector' },
  { file: 'migrations/fix_embedding_dimensions_4096.sql', requires: 'vector' },
  // 5. Standardization and numbered migrations
  { file: 'migrations/standardize_identifier_types.sql' },
  { file: 'migrations/standardize_gender_values.sql' },
  { file: 'migrations/029_payment_reconciliation.sql' },
  { file: 'migrations/030_payment_notice_columns.sql' },
  { file: 'migrations/031_fix_pr_linking.sql' },
  { file: 'migrations/032_nphies_communications.sql' },
  { file: 'migrations/033_add_lab_observations_column.sql' },
  { file: 'migrations/034_add_resubmission_columns.sql' },
  { file: 'migrations/035_add_pharmacy_claim_enhancements.sql' },
  { file: 'migrations/036_fix_adjudication_outcome_constraint.sql' },
  { file: 'migrations/037_add_claim_cancellation_reason.sql' },
  { file: 'migrations/038_add_claim_newborn_fields.sql' },
  { file: 'migrations/039_add_mother_patient_id.sql' },
  { file: 'migrations/040_add_icu_hours_column.sql' },
  { file: 'migrations/041_add_icu_hours_to_claim_submissions.sql' },
  { file: 'migrations/042_add_item_details_tables.sql' },
  { file: 'migrations/047_batch_claims_enhancement.sql' },
  { file: 'migrations/048_create_users_table.sql' },
  { file: 'migrations/049_create_admin_user.sql' },
  { file: 'migrations/050_create_contacts_table.sql' },
  { file: 'migrations/051_add_shadow_billing_fields.sql' },
  { file: 'migrations/052_add_communication_request_identifiers.sql' },
  { file: 'migrations/053_create_poll_tables.sql' },
  { file: 'migrations/054_add_message_header_id_columns.sql' },
  { file: 'migrations/055_add_advanced_auth_id_to_communications.sql' },
  { file: 'migrations/056_add_advanced_auth_cancel_columns.sql' },
  { file: 'migrations/057_add_shadow_billing_to_claim_items.sql' },
  { file: 'migrations/058_add_vision_safety_to_claims.sql' },
  { file: 'migrations/059_add_emergency_department_disposition.sql' },
  { file: 'migrations/060_add_authorization_offline_fields.sql' },
  { file: 'migrations/061_add_code_entry_mode.sql' },
  { file: 'migrations/062_user_roles.sql' },
  { file: 'migrations/063_selected_coverage.sql' },
  { file: 'migrations/064_openmed_advisory.sql' },
  { file: 'migrations/065_payment_notice_attempts.sql' },
  { file: 'migrations/066_schema_consistency.sql', afterBaseline: true },
  { file: 'migrations/067_practitioner_fields.sql', afterBaseline: true },
  { file: 'migrations/068_user_roles_extended.sql', afterBaseline: true }
];

// Files in migrations/ that the runner deliberately does not apply.
export const NOT_MANAGED = {
  'add_nphies_integration.sql': 'superseded by add_nphies_integration_uuid.sql (INTEGER keys do not match the UUID schema)',
  'query_update_identifier_types.sql': 'interactive query tool, not a migration',
  'fix_all_nphies_ids.sql': 'one-off data change of provider/insurer NPHIES IDs; run manually only if intended',
  'fix_nphies_test_ids.sql': 'one-off data change of provider/insurer NPHIES IDs; run manually only if intended',
  'update_nphies_test_ids.sql': 'one-off data change of provider/insurer NPHIES IDs; run manually only if intended',
  'update_pr_fhir_to_new_provider.sql': 'optional one-off data change; the file itself says not to run it by default',
  'seed_nphies_test_data.sql': 'test data seed, not schema',
  'add_nphies_example_providers.sql': 'example provider data, not schema'
};

function parseArgs(argv) {
  return { status: argv.includes('--status'), dryRun: argv.includes('--dry-run'), baseline: argv.includes('--baseline') };
}

export async function readMigration(entry) {
  const sql = await fs.readFile(path.resolve(backendDir, entry.file), 'utf8');
  return { sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

export async function runMigrations(client, options = {}, log = console.log) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const applied = new Map((await client.query('SELECT filename, checksum FROM schema_migrations')).rows.map(r => [r.filename, r.checksum]));
  const available = new Set((await client.query('SELECT name FROM pg_available_extensions')).rows.map(r => r.name));
  const summary = { applied: [], marked: [], skipped: [], pending: [], changed: [] };

  for (const entry of MIGRATIONS) {
    const { sql, checksum } = await readMigration(entry);
    if (applied.has(entry.file)) {
      if (applied.get(entry.file) !== checksum) summary.changed.push(entry.file);
      continue;
    }
    if (entry.requires && !available.has(entry.requires)) {
      summary.skipped.push(entry.file);
      log(`SKIP    ${entry.file} (PostgreSQL extension "${entry.requires}" is not available; it stays pending)`);
      continue;
    }
    if (options.status || options.dryRun) { summary.pending.push(entry.file); log(`PENDING ${entry.file}`); continue; }
    if (options.baseline && !entry.afterBaseline) {
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [entry.file, checksum]);
      summary.marked.push(entry.file);
      log(`MARKED  ${entry.file}`);
      continue;
    }
    try {
      await client.query(sql);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw Object.assign(new Error(`${entry.file}: ${error.message}`), { cause: error, file: entry.file });
    }
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [entry.file, checksum]);
    summary.applied.push(entry.file);
    log(`APPLIED ${entry.file}`);
  }
  for (const file of summary.changed) log(`WARNING ${file} changed after it was applied; review whether it must be re-run manually`);
  if (options.status) {
    const listed = new Set(MIGRATIONS.map(m => path.basename(m.file)));
    for (const file of (await fs.readdir(path.join(backendDir, 'migrations'))).filter(f => f.endsWith('.sql')).sort()) {
      if (!listed.has(file)) log(`MANUAL  migrations/${file}: ${NOT_MANAGED[file] || 'not listed in scripts/migrate.js'}`);
    }
  }
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { default: pool } = await import('../db.js');
  const client = await pool.connect();
  try {
    // Only one runner at a time.
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['nafes:schema_migrations']);
    const summary = await runMigrations(client, parseArgs(process.argv.slice(2)));
    console.log(`Done: ${summary.applied.length} applied, ${summary.marked.length} marked, ${summary.pending.length} pending, ${summary.skipped.length} skipped.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['nafes:schema_migrations']).catch(() => {});
    client.release();
    await pool.end();
  }
}
