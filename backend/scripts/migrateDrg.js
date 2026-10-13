import fs from 'node:fs/promises';
import pool from '../db.js';

try {
  await pool.query(await fs.readFile(new URL('../migrations/066_claim_drg.sql', import.meta.url), 'utf8'));
  console.log('Applied claim DRG migration');
} catch (error) {
  console.error('DRG migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
