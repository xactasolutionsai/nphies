import fs from 'node:fs/promises';
import pool from '../db.js';

// Run only the two additive migrations required by the review fixes.
// Earlier application migrations must already have been applied.
try {
  for (const file of ['062_user_roles.sql', '063_selected_coverage.sql']) {
    const sql = await fs.readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
