/**
 * Schema-scoped database access for the NPHIES messaging services.
 *
 * `search_path` used to be set by interpolating the schema name into a `SET search_path TO ...`
 * statement, and a plain SET inside BEGIN/COMMIT (or on a pooled
 * client) stayed on the connection after it went back to the pool. These helpers
 * validate the identifier, pass it as a bind parameter to set_config(), use the
 * transaction-local form inside transactions, and reset the session value before
 * a client is released.
 */

import pool from '../db.js';

const SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Validate a schema name (unquoted lower-case PostgreSQL identifier).
 * @returns {string} the name ('public' when none is given)
 * @throws {Error} for anything else
 */
export function validateSchemaName(schemaName) {
  const name = schemaName ?? 'public';
  if (typeof name !== 'string' || !SCHEMA_NAME_PATTERN.test(name)) {
    throw new Error('Invalid schema name');
  }
  return name;
}

/** Set search_path for the current transaction only (SET LOCAL semantics). */
export async function setLocalSearchPath(client, schemaName) {
  await client.query("SELECT set_config('search_path', $1, true)", [validateSchemaName(schemaName)]);
}

/**
 * Serialize check-then-insert of an advanced authorization by identifier for the
 * rest of the current transaction. advanced_authorizations has no unique key on
 * identifier_value, and both the manual poll (controller) and the system poll
 * (messageUpdater) insert into it, so both must take this same lock.
 */
export async function lockAdvancedAuthorizationIdentifier(client, identifierValue) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`advanced_authorizations:${identifierValue}`]
  );
}

/**
 * Check out a pooled client with search_path set for the session.
 * Always pair with releaseSchemaClient(), which restores the default.
 */
export async function connectWithSchema(schemaName) {
  const name = validateSchemaName(schemaName);
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('search_path', $1, false)", [name]);
  } catch (error) {
    client.release(true);
    throw error;
  }
  return client;
}

/**
 * Reset search_path and return the client to the pool. A client whose reset
 * fails (e.g. left in an aborted transaction) is destroyed instead of reused.
 */
export async function releaseSchemaClient(client) {
  let broken = false;
  try {
    await client.query('RESET search_path');
  } catch {
    broken = true;
  }
  client.release(broken || undefined);
}

/** Run `fn(client)` on a schema-scoped client that is always released. */
export async function withSchemaClient(schemaName, fn) {
  const client = await connectWithSchema(schemaName);
  try {
    return await fn(client);
  } finally {
    await releaseSchemaClient(client);
  }
}

/**
 * Run `fn(client)` inside BEGIN/COMMIT with a transaction-local search_path.
 * Rolls back on error.
 */
export async function withSchemaTransaction(schemaName, fn) {
  const name = validateSchemaName(schemaName);
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('search_path', $1, true)", [name]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken || undefined);
  }
}
