// Shared input handling for the admin account scripts. Nothing is defaulted:
// the email comes from the first CLI argument or ADMIN_EMAIL, the password from
// ADMIN_PASSWORD (preferred: it stays out of shell history) or the second argument.

const PUBLISHED_EMAILS = new Set(['admin@admin.com']);
const WEAK_PASSWORDS = new Set(['123123', '123456', '12345678', 'password', 'admin', 'admin123', 'changeme', 'postgres']);
export const MIN_PASSWORD_LENGTH = 12;

export function readAdminEmail(argv = process.argv, env = process.env) {
  const email = (argv[2] || env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) throw new Error('Provide the account email as the first argument or ADMIN_EMAIL.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email address.');
  if (PUBLISHED_EMAILS.has(email)) throw new Error('This email was published in the repository; use a different account.');
  return email;
}

export function readAdminPassword(argv = process.argv, env = process.env) {
  const password = env.ADMIN_PASSWORD || argv[3] || '';
  if (!password) throw new Error('Provide the password via ADMIN_PASSWORD (recommended) or as the second argument.');
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (WEAK_PASSWORDS.has(password.toLowerCase())) throw new Error('Refusing a default or published password.');
  return password;
}
