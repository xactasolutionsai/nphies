import 'dotenv/config';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET must be a private random value of at least 32 characters');
  }
  return secret;
}
