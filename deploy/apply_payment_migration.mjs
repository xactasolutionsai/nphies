import fs from 'node:fs';
const root = process.argv[2];
if (!root?.startsWith('/opt/nafes/releases/')) throw Error('Explicit staged release path required');
const {default:pool} = await import(root+'/backend/db.js');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(fs.readFileSync(root+'/backend/migrations/065_payment_notice_attempts.sql','utf8'));
  await client.query('COMMIT');
  console.log('Payment migration applied successfully');
} catch (error) {
  await client.query('ROLLBACK'); throw error;
} finally {client.release();await pool.end();}
