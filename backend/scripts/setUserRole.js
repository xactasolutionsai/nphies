// Set the role of an existing user account.
//
// Usage: node scripts/setUserRole.js <existing-user-email> <admin|submitter|reviewer|viewer>
//
// Accounts are never created here (see scripts/createAdminUser.js). The legacy 'user' role
// is not assignable; existing 'user' rows keep submitter rights (middleware/requireRole.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSIGNABLE_ROLES } from '../middleware/requireRole.js';

const USAGE = `Usage: node scripts/setUserRole.js <existing-user-email> <${ASSIGNABLE_ROLES.join('|')}>`;

export function parseSetUserRoleArgs(argv) {
  const email = argv[2]?.trim().toLowerCase();
  const role = argv[3]?.trim().toLowerCase();
  if (!email || !role) throw new Error(USAGE);
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
  return { email, role };
}

export async function setUserRole(email, role, run) {
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
  const result = await run('UPDATE users SET role = $1 WHERE email = $2 RETURNING id', [role, email]);
  if (!result.rowCount) throw new Error('User not found; no account was created');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { default: pool, query } = await import('../db.js');
  try {
    const { email, role } = parseSetUserRoleArgs(process.argv);
    await setUserRole(email, role, query);
    console.log(`Role set to ${role}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
