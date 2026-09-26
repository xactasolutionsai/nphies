// Print an INSERT for an administrator account, for environments where the
// scripts cannot reach the database. Prefer scripts/createAdminUser.js.
// Usage: ADMIN_PASSWORD='<strong password>' node scripts/generateAdminUserSQL.js <email>
import bcrypt from 'bcryptjs';
import { readAdminEmail, readAdminPassword } from './adminCredentials.js';

try {
  const email = readAdminEmail();
  const passwordHash = await bcrypt.hash(readAdminPassword(), 12);
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  console.log(`INSERT INTO users (email, password_hash, role)
VALUES (${literal(email)}, ${literal(passwordHash)}, 'admin')
ON CONFLICT (email) DO NOTHING;`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
