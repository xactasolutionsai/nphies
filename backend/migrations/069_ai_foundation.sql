-- Migration 069: AI foundation (advisory AI features, Phase 2).
--   ai_audit_log  one row per AI/LLM call: feature, model, input hash, latency, availability and a
--                 PHI-free output summary (redacted with services/ai/phi.js). Prompts are never stored.
--                 A successful row is also the cache for identical inputs (feature + input_hash + model).
--   ai_feedback   a user's verdict on one AI output.
-- ai_knowledge (retrieval) is added in a later phase.
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS ai_audit_log (
    id BIGSERIAL PRIMARY KEY,
    feature VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'llm',
    model VARCHAR(255),
    input_hash CHAR(64),
    latency_ms INTEGER,
    available BOOLEAN NOT NULL DEFAULT false,
    error TEXT,
    output_summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_audit_log DROP CONSTRAINT IF EXISTS ai_audit_log_source_check;
ALTER TABLE ai_audit_log ADD CONSTRAINT ai_audit_log_source_check
    CHECK (source IN ('rules', 'statistics', 'retrieval', 'llm'));

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_cache ON ai_audit_log (feature, input_hash, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON ai_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS ai_feedback (
    id BIGSERIAL PRIMARY KEY,
    audit_id BIGINT NOT NULL REFERENCES ai_audit_log(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verdict VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_feedback DROP CONSTRAINT IF EXISTS ai_feedback_verdict_check;
ALTER TABLE ai_feedback ADD CONSTRAINT ai_feedback_verdict_check
    CHECK (verdict IN ('accepted', 'rejected', 'edited'));

CREATE INDEX IF NOT EXISTS idx_ai_feedback_audit_id ON ai_feedback (audit_id);

COMMENT ON TABLE ai_audit_log IS 'Advisory AI calls: hashes, models, latency and PHI-free summaries only (no prompts).';
COMMENT ON TABLE ai_feedback IS 'User verdicts (accepted/rejected/edited) on AI outputs.';
