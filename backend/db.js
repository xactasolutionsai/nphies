import pkg from 'pg';
const { Pool, types } = pkg;
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';

const transactionContext = new AsyncLocalStorage();

dotenv.config();

// Return DATE columns as raw "YYYY-MM-DD" strings instead of JS Date objects.
// pg normally creates Date at midnight local time, which JSON.stringify converts to UTC ISO —
// in UTC+ timezones the UTC date can be one day behind the stored date, causing a -1 day shift
// on every save/load cycle.
types.setTypeParser(1082, (val) => val);

const REQUIRED_DB_ENV = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];

/**
 * Build the pool configuration from the environment. There are no credential
 * defaults: DB_NAME, DB_USER and DB_PASSWORD must be set. Under NODE_ENV=test
 * (set by tests/setup.js) the pool may be created unconfigured because unit
 * tests stub pool.query and database tests set DB_* before importing this module.
 */
export function getDbConfig(env = process.env) {
  // DB_PASSWORD may be set to an empty string for local trust/peer authentication.
  const missing = REQUIRED_DB_ENV.filter(name => env[name] === undefined || (name !== 'DB_PASSWORD' && env[name] === ''));
  if (missing.length && env.NODE_ENV !== 'test') {
    throw new Error(`Database is not configured: set ${missing.join(', ')} (see env.example)`);
  }
  return {
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT || 5432,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  };
}

// SQL text is only logged when DB_LOG_QUERIES=true (it can contain identifiers of patients in literals).
const logQueries = () => process.env.DB_LOG_QUERIES === 'true';

// Create a new pool instance
const pool = new Pool(getDbConfig());

pool.on('connect', () => {
  if (logQueries()) console.log('Connected to PostgreSQL database');
});

// An idle client error (e.g. the database restarted) is recoverable: the pool
// discards the broken client and opens a new one on the next query.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await (transactionContext.getStore() || pool).query(text, params);
    if (logQueries()) console.log('Executed query', { text, duration: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error.message, error.code ? `(code ${error.code})` : '');
    throw error;
  }
};

// Helper function to get a client from the pool
export const getClient = async () => {
  return await pool.connect();
};

// Helper function to execute a transaction
export const transaction = async (callback) => {
  const current = transactionContext.getStore();
  if (current) return callback(current);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await transactionContext.run(client, () => callback(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

let closing;
/** Close the pool once; safe to call from several shutdown paths. */
export function closePool() {
  closing ||= pool.end().catch(error => console.error('Error closing database pool:', error.message));
  return closing;
}

export default pool;
