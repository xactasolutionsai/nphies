import pg from 'pg';
import 'dotenv/config';

let pool;
export function getAdvisoryPool() {
  if (!process.env.OPENMED_DATABASE_URL) throw Object.assign(new Error('OpenMed database is not configured'), { status: 503 });
  pool ||= new pg.Pool({ connectionString: process.env.OPENMED_DATABASE_URL, max: 2,
    connectionTimeoutMillis: 2000, statement_timeout: 5000, idleTimeoutMillis: 10000 });
  return pool;
}

export async function advisoryQuery(sql, values = []) {
  // A separate, restricted login is required; do not fall back to the application's privileged pool.
  return getAdvisoryPool().query(sql, values);
}
