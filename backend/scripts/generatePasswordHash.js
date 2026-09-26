// Print a bcrypt hash for a password without touching the database.
// Usage: ADMIN_PASSWORD='<strong password>' node scripts/generatePasswordHash.js
import bcrypt from 'bcryptjs';
import { readAdminPassword } from './adminCredentials.js';

try {
  // The password is read from ADMIN_PASSWORD or the first argument (argv[2]).
  const password = readAdminPassword([process.argv[0], process.argv[1], undefined, process.argv[2]]);
  console.log(await bcrypt.hash(password, 12));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
