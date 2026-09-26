// Create an administrator account.
// Usage: ADMIN_PASSWORD='<strong password>' node scripts/createAdminUser.js <email>
// To promote an existing account instead, use: npm run grant-admin -- <email>
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

  const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new Error('User already exists; use scripts/updateAdminPassword.js or npm run grant-admin instead.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id, email, role, created_at",
    [email, passwordHash]
  );
  const user = result.rows[0];
  console.log(`Administrator created: id=${user.id} email=${user.email} role=${user.role}`);
} catch (error) {
  console.error('Error creating admin user:', error.message);
  if (error.code === '42P01') console.error('The users table does not exist; run the migrations first (npm run migrate).');
  if (error.code === '42703') console.error('users.role is missing; run the migrations first (062_user_roles.sql).');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
