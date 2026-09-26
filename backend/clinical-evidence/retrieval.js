/**
 * Lexical retrieval over hospital-approved passages (PostgreSQL full-text search on the
 * clinical_knowledge.approved_passages view, migration 072). No embeddings and no model.
 * Terms are passed as bind parameters to plainto_tsquery, so note text cannot inject query
 * operators or SQL.
 */
export const RETRIEVAL = Object.freeze({ method: 'postgres_fulltext', config: 'english', per_term: 3 });

export async function retrieveForTerms(query, terms, { perTerm = RETRIEVAL.per_term } = {}) {
  const results = [];
  for (const term of terms) {
    const { rows } = await query(`SELECT passage_id, section, locator, text, source_id, title, publisher, version, license,
        published_on, reviewed_on, precedence_rank, ts_rank_cd(tsv, q) AS rank
      FROM clinical_knowledge.approved_passages, plainto_tsquery('english', $1) q
      WHERE tsv @@ q ORDER BY precedence_rank, rank DESC, passage_id LIMIT $2`, [term, perTerm]);
    results.push({ term, passages: rows.map(r => ({
      passage_id: r.passage_id, text: r.text, section: r.section, locator: r.locator, rank: Number(r.rank),
      source: { id: r.source_id, title: r.title, publisher: r.publisher, version: r.version, license: r.license,
        published_on: r.published_on, reviewed_on: r.reviewed_on, precedence_rank: r.precedence_rank }
    })) });
  }
  return results;
}

/** Sources that were retrievable at generation time (recorded with every summary). */
export async function corpusSnapshot(query) {
  const { rows } = await query(`SELECT DISTINCT source_id, version, approved_at FROM clinical_knowledge.approved_passages
    ORDER BY source_id`);
  return { method: RETRIEVAL.method, sources: rows.map(r => ({ id: r.source_id, version: r.version, approved_at: r.approved_at })) };
}
