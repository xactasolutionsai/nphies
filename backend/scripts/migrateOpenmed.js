import fs from 'node:fs/promises';
import pool from '../db.js';
try {
  for (const file of ['064_openmed_advisory.sql', '071_clinical_ai_access_and_reviews.sql',
    '072_clinical_knowledge_sources.sql', '073_openmed_idempotency.sql']) {
    await pool.query(await fs.readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  console.log('OpenMed advisory schema and restricted group created. Configure a separate login in nafes_openmed.');
} catch {
  console.error('OpenMed migration failed. Verify migration privileges and prerequisite tables.');
  process.exitCode = 1;
} finally { await pool.end(); }
