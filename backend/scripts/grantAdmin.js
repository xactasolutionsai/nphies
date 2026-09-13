import { query } from '../db.js';
import pool from '../db.js';

try {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: node scripts/grantAdmin.js <existing-user-email>');
  const result = await query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id", [email]);
  if (!result.rowCount) throw new Error('User not found; no account was created');
  console.log('Administrator role granted');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
