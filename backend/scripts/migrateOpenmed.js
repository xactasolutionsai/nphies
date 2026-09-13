import fs from 'node:fs/promises';
import pool from '../db.js';
try {
  await pool.query(await fs.readFile(new URL('../migrations/064_openmed_advisory.sql', import.meta.url), 'utf8'));
  console.log('OpenMed advisory schema and restricted group created. Configure a separate login in nafes_openmed.');
} catch {
  console.error('OpenMed migration failed. Verify migration privileges and prerequisite tables.');
  process.exitCode = 1;
} finally { await pool.end(); }
