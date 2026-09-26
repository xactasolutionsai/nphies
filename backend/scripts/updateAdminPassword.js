// Set a new password for an existing account.
// Usage: ADMIN_PASSWORD='<strong password>' node scripts/updateAdminPassword.js <email>
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { readAdminEmail, readAdminPassword } from './adminCredentials.js';

dotenv.config();

let pool;
try {
  const email = readAdminEmail();
  const password = readAdminPassword();
  const db = await import('../db.js');
  pool = db.default;

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email, updated_at',
    [passwordHash, email]
  );
  if (!result.rowCount) throw new Error('User not found; no account was created.');
  console.log(`Password updated: id=${result.rows[0].id} email=${result.rows[0].email}`);
} catch (error) {
  console.error('Error updating password:', error.message);
  if (error.code === '42P01') console.error('The users table does not exist; run the migrations first (npm run migrate).');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
