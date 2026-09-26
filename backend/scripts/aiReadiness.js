// AI readiness checklist (read-only). Gate artefact for the retrieval / embedding phases.
//
// Usage:
//   npm run ai:readiness              human-readable checklist
//   npm run ai:readiness -- --json    same result as JSON
//
// Reads OLLAMA_* / EMBEDDING_DIM / DB_* from the environment (.env), like the server.
// It never writes: Ollama gets GET /api/tags and at most one POST /api/embed with the text
// "test"; the database only gets SELECTs inside a READ ONLY transaction. Nothing is deleted.
// Each check is PASS, FAIL or UNKNOWN (could not be determined). The exit code is always 0.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOllamaConfig, isLocalOrPrivateHost } from '../services/ollamaConfig.js';
import { aiModels } from '../services/ai/config.js';
import { modelIsPresent } from '../services/ai/health.js';

export const PROBE_TIMEOUT_MS = 3_000;
export const EMBEDDING_TABLES = ['medical_knowledge', 'medicines'];
export const BGE_M3_PATTERN = /^bge-m3/i;

const check = (id, label, status, detail, extra = {}) => ({ id, label, status, detail, ...extra });

const parseDim = env => {
  const value = parseInt(env.EMBEDDING_DIM, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
};

/** Short model name without registry namespace or tag: "library/bge-m3:latest" -> "bge-m3". */
const baseName = name => String(name || '').split('/').pop();

/** Base URL rule from services/ollamaConfig.js: https, or http only to loopback / private hosts. */
export function checkBaseUrl(env = process.env) {
  const { baseUrl, configError } = getOllamaConfig(env);
  if (configError) return check('ollama_base_url', 'Ollama base URL is https or loopback/private', 'FAIL', configError.message, { baseUrl: null });
  const url = new URL(baseUrl);
  if (url.protocol === 'https:') return check('ollama_base_url', 'Ollama base URL is https or loopback/private', 'PASS', `${url.host} over https`, { baseUrl });
  if (isLocalOrPrivateHost(url.hostname)) {
    return check('ollama_base_url', 'Ollama base URL is https or loopback/private', 'PASS', `${url.host} is loopback/private (plain http accepted)`, { baseUrl });
  }
  // Only reachable here when OLLAMA_ALLOW_INSECURE_REMOTE=true.
  return check('ollama_base_url', 'Ollama base URL is https or loopback/private', 'FAIL',
    `${url.host} is a public host over plain http (accepted only because OLLAMA_ALLOW_INSECURE_REMOTE=true)`, { baseUrl });
}

/**
 * Pure decision logic: turn probe results into the checklist.
 * @param {object} input
 * @param {object} input.env
 * @param {{reachable:boolean|null, names?:string[], error?:string}} input.tags - result of GET /api/tags (reachable null = not attempted)
 * @param {{dimension?:number, error?:string}|null} input.embed - result of POST /api/embed, null = not attempted
 * @param {object|null} input.db - { error } or { vectorAvailable, vectorInstalled, columns:{table:type|null}, counts:{table:number|null} }
 */
export function evaluateReadiness({ env = process.env, tags, embed = null, db = null }) {
  const checks = [checkBaseUrl(env)];
  const { model } = aiModels(env);
  const embedModel = String(env.OLLAMA_EMBED_MODEL || '').trim() || null;
  const reachable = tags?.reachable;
  const names = tags?.names || [];

  checks.push(reachable === true
    ? check('ollama_reachable', 'Ollama reachable (GET /api/tags)', 'PASS', `${names.length} model(s) installed`)
    : reachable === false
      ? check('ollama_reachable', 'Ollama reachable (GET /api/tags)', 'FAIL', tags?.error || 'no answer')
      : check('ollama_reachable', 'Ollama reachable (GET /api/tags)', 'UNKNOWN', tags?.error || 'not probed'));

  const unknownUnlessReachable = (id, label, fn) => checks.push(reachable === true
    ? fn()
    : check(id, label, 'UNKNOWN', 'Ollama not reachable'));

  unknownUnlessReachable('generation_model_present', `Generation model present (${model})`, () =>
    modelIsPresent(names, model)
      ? check('generation_model_present', `Generation model present (${model})`, 'PASS', 'installed')
      : check('generation_model_present', `Generation model present (${model})`, 'FAIL', `not installed; run: ollama pull ${model}`));

  checks.push(embedModel
    ? check('embedding_model_configured', 'Embedding model configured (OLLAMA_EMBED_MODEL)', 'PASS', embedModel)
    : check('embedding_model_configured', 'Embedding model configured (OLLAMA_EMBED_MODEL)', 'FAIL',
      `not set: embeddings would use the chat model ${model}`));

  const embedLabel = `Embedding model present (${embedModel || 'not configured'})`;
  if (!embedModel) checks.push(check('embedding_model_present', embedLabel, 'UNKNOWN', 'OLLAMA_EMBED_MODEL is not set'));
  else {
    unknownUnlessReachable('embedding_model_present', embedLabel, () => modelIsPresent(names, embedModel)
      ? check('embedding_model_present', embedLabel, 'PASS', 'installed')
      : check('embedding_model_present', embedLabel, 'FAIL', `not installed; run: ollama pull ${embedModel}`));
  }

  unknownUnlessReachable('bge_m3_installed', 'A bge-m3* model is installed', () => {
    const found = names.filter(name => BGE_M3_PATTERN.test(baseName(name)));
    return found.length
      ? check('bge_m3_installed', 'A bge-m3* model is installed', 'PASS', found.join(', '), { models: found })
      : check('bge_m3_installed', 'A bge-m3* model is installed', 'FAIL', 'no model named bge-m3* (run: ollama pull bge-m3)', { models: [] });
  });

  // Embedding dimension: model output vs EMBEDDING_DIM and the vector(N) columns.
  const expected = parseDim(env);
  const columnDims = [...new Set(Object.values(db?.columns || {})
    .map(type => /vector\((\d+)\)/.exec(type || '')?.[1]).filter(Boolean).map(Number))];
  const dimLabel = 'Embedding dimension matches EMBEDDING_DIM and the vector columns';
  if (!embed) {
    checks.push(check('embedding_dimension', dimLabel, 'UNKNOWN', 'no /api/embed call made (Ollama unreachable or embedding model not configured/installed)',
      { dimension: null, expected, columnDims }));
  } else if (!Number.isInteger(embed.dimension)) {
    checks.push(check('embedding_dimension', dimLabel, 'FAIL', `embedding call failed: ${embed.error || 'no vector returned'}`, { dimension: null, expected, columnDims }));
  } else {
    const problems = [];
    if (expected === null) problems.push('EMBEDDING_DIM is not set');
    else if (expected !== embed.dimension) problems.push(`EMBEDDING_DIM is ${expected}`);
    const mismatched = columnDims.filter(dim => dim !== embed.dimension);
    if (mismatched.length) problems.push(`vector column(s) are vector(${mismatched.join(', ')}) and need a migration`);
    checks.push(check('embedding_dimension', dimLabel, problems.length ? 'FAIL' : 'PASS',
      `model returned ${embed.dimension} dimensions${problems.length ? `; ${problems.join('; ')}` : ''}`,
      { dimension: embed.dimension, expected, columnDims }));
  }

  if (!db || db.error) {
    const why = db?.error ? `database not reachable: ${db.error}` : 'database not checked';
    checks.push(check('pgvector_available', 'pgvector extension available on the server', 'UNKNOWN', why));
    checks.push(check('pgvector_installed', 'pgvector extension installed in this database', 'UNKNOWN', why));
    for (const table of EMBEDDING_TABLES) {
      checks.push(check(`stored_embeddings_${table}`, `Existing embeddings in ${table}`, 'UNKNOWN', why, { count: null, countQuery: countQuery(table) }));
    }
  } else {
    checks.push(check('pgvector_available', 'pgvector extension available on the server', db.vectorAvailable ? 'PASS' : 'FAIL',
      db.vectorAvailable ? 'listed in pg_available_extensions' : 'not in pg_available_extensions (install the pgvector package on the database server)'));
    checks.push(check('pgvector_installed', 'pgvector extension installed in this database', db.vectorInstalled ? 'PASS' : 'FAIL',
      db.vectorInstalled ? `pg_extension vector ${db.vectorVersion || ''}`.trim() : 'not in pg_extension (CREATE EXTENSION vector; then npm run migrate)'));
    for (const table of EMBEDDING_TABLES) {
      const count = db.counts?.[table];
      const label = `Existing embeddings in ${table}`;
      const extra = { count: count ?? null, columnType: db.columns?.[table] ?? null, countQuery: countQuery(table) };
      if (count === null || count === undefined) checks.push(check(`stored_embeddings_${table}`, label, 'UNKNOWN', 'table or embedding column not present', extra));
      else if (count === 0) checks.push(check(`stored_embeddings_${table}`, label, 'PASS', 'no stored embeddings (nothing of unknown provenance)', extra));
      else {
        checks.push(check(`stored_embeddings_${table}`, label, 'UNKNOWN',
          `${count} row(s) have an embedding. Rows stored before the hash-fallback removal may hold hash-based vectors; ` +
          'they cannot be distinguished reliably from real ones. Re-embed them with the chosen model before trusting vector search. ' +
          'Nothing was deleted.', extra));
      }
    }
  }
  return checks;
}

export const countQuery = table => `SELECT count(*) FROM ${table} WHERE embedding IS NOT NULL;`;

export async function probeTags({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS }) {
  if (!baseUrl) return { reachable: null, error: 'Ollama configuration refused' };
  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { reachable: false, error: `HTTP ${response.status}` };
    const data = await response.json().catch(() => ({}));
    const names = (Array.isArray(data?.models) ? data.models : []).map(m => m?.name || m?.model).filter(Boolean);
    return { reachable: true, names };
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { reachable: false, error: timedOut ? `no answer within ${timeoutMs} ms` : error.message };
  }
}

export async function probeEmbedding({ baseUrl, model, fetchImpl = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS * 10 }) {
  try {
    const response = await fetchImpl(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: 'test' }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const data = await response.json().catch(() => ({}));
    const vector = data?.embeddings?.[0];
    return Array.isArray(vector) && vector.length ? { dimension: vector.length } : { error: 'no vector in the reply' };
  } catch (error) {
    return { error: error.message };
  }
}

/** Read-only database facts. queryFn(sql, params) -> { rows }. */
export async function probeDatabase(queryFn) {
  const available = await queryFn("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'");
  const installed = await queryFn("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
  const columns = {};
  const counts = {};
  for (const table of EMBEDDING_TABLES) {
    const column = await queryFn(`
      SELECT format_type(a.atttypid, a.atttypmod) AS column_type
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass($1) AND a.attname = 'embedding' AND NOT a.attisdropped`, [table]);
    columns[table] = column.rows[0]?.column_type ?? null;
    counts[table] = columns[table] === null
      ? null
      : Number((await queryFn(countQuery(table).replace(/;$/, ''))).rows[0].count);
  }
  return {
    vectorAvailable: available.rows.length > 0,
    vectorInstalled: installed.rows.length > 0,
    vectorVersion: installed.rows[0]?.extversion ?? null,
    columns,
    counts
  };
}

/** Run every probe (injectable for tests) and evaluate. */
export async function collectReadiness({ env = process.env, fetchImpl = globalThis.fetch, queryFn = null, dbError = null } = {}) {
  const { baseUrl } = getOllamaConfig(env);
  const tags = await probeTags({ baseUrl, fetchImpl });
  const embedModel = String(env.OLLAMA_EMBED_MODEL || '').trim();
  const embed = tags.reachable === true && embedModel && modelIsPresent(tags.names, embedModel)
    ? await probeEmbedding({ baseUrl, model: embedModel, fetchImpl })
    : null;
  let db = dbError ? { error: dbError } : null;
  if (queryFn && !db) {
    try { db = await probeDatabase(queryFn); } catch (error) { db = { error: error.message }; }
  }
  const checks = evaluateReadiness({ env, tags, embed, db });
  const summary = { PASS: 0, FAIL: 0, UNKNOWN: 0 };
  for (const item of checks) summary[item.status] += 1;
  return { generatedAt: new Date().toISOString(), summary, checks };
}

export function formatReport(report) {
  const lines = [`AI readiness (${report.generatedAt})`, ''];
  for (const item of report.checks) {
    lines.push(`[${item.status.padEnd(7)}] ${item.label}`);
    lines.push(`          ${item.detail}`);
    if (item.countQuery && item.count) lines.push(`          count query: ${item.countQuery}`);
  }
  lines.push('', `PASS ${report.summary.PASS} · FAIL ${report.summary.FAIL} · UNKNOWN ${report.summary.UNKNOWN}`);
  return lines.join('\n');
}

async function main(argv) {
  const { default: pool } = await import('../db.js');
  let client = null;
  let dbError = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
  } catch (error) {
    dbError = error.message;
  }
  try {
    const report = await collectReadiness({
      queryFn: client ? (sql, params) => client.query(sql, params) : null,
      dbError
    });
    console.log(argv.includes('--json') ? JSON.stringify(report, null, 2) : formatReport(report));
  } catch (error) {
    console.error(`AI readiness check could not complete: ${error.message}`);
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    await pool.end().catch(() => {});
  }
  process.exitCode = 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
