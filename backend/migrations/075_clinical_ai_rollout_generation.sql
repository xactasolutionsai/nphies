-- 075: stage 5 of the clinical assistant: feature-level approval, rollout after a closed
-- pilot, verified generative drafts (disabled unless explicitly approved), and operating
-- alerts. Additive only: new columns with defaults, new tables, widened limits. No existing
-- row is changed.
BEGIN;

-- Pilots / rollouts ------------------------------------------------------------------------
ALTER TABLE clinical_pilot.pilots ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'pilot';
ALTER TABLE clinical_pilot.pilots ADD COLUMN IF NOT EXISTS approved_features TEXT[] NOT NULL DEFAULT '{analysis,summary}';
ALTER TABLE clinical_pilot.pilots ADD COLUMN IF NOT EXISTS prerequisite_pilot_id UUID REFERENCES clinical_pilot.pilots(id);
ALTER TABLE clinical_pilot.pilots ADD COLUMN IF NOT EXISTS outcome_ref TEXT;   -- hospital's review of a closed pilot

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilots_kind_check_075') THEN
    ALTER TABLE clinical_pilot.pilots ADD CONSTRAINT pilots_kind_check_075 CHECK (kind IN ('pilot', 'rollout'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilots_features_check_075') THEN
    ALTER TABLE clinical_pilot.pilots ADD CONSTRAINT pilots_features_check_075
      CHECK (approved_features <@ ARRAY['analysis', 'summary', 'generation']::text[] AND 'analysis' = ANY (approved_features));
  END IF;
  -- A rollout is activated only on top of a pilot (checked in full by the API).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilots_rollout_prerequisite_075') THEN
    ALTER TABLE clinical_pilot.pilots ADD CONSTRAINT pilots_rollout_prerequisite_075
      CHECK (kind = 'pilot' OR status = 'draft' OR prerequisite_pilot_id IS NOT NULL);
  END IF;
  -- Rollouts may include more users than a pilot.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilots_max_participants_check') THEN
    ALTER TABLE clinical_pilot.pilots DROP CONSTRAINT pilots_max_participants_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilots_max_participants_check_075') THEN
    ALTER TABLE clinical_pilot.pilots ADD CONSTRAINT pilots_max_participants_check_075 CHECK (max_participants BETWEEN 1 AND 5000);
  END IF;
END $$;

-- Generative drafts ------------------------------------------------------------------------
-- Every attempt is kept (what was asked, of which model, what came back, what the verifier
-- decided). Only verified attempts become drafts, and drafts are shown as "needs review".
CREATE TABLE IF NOT EXISTS openmed_advisory.generation_attempts (
  id UUID PRIMARY KEY,
  summary_id UUID NOT NULL REFERENCES openmed_advisory.summaries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pilot_id UUID,
  model TEXT,
  prompt_sha256 TEXT NOT NULL,
  input_fact_ids TEXT[] NOT NULL DEFAULT '{}',
  input_passage_ids TEXT[] NOT NULL DEFAULT '{}',
  raw_output JSONB,
  verification JSONB,
  accepted BOOLEAN NOT NULL,
  reason TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS openmed_advisory.generated_drafts (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL UNIQUE REFERENCES openmed_advisory.generation_attempts(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES openmed_advisory.summaries(id) ON DELETE CASCADE,
  sentences JSONB NOT NULL CHECK (jsonb_typeof(sentences) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS openmed_advisory.draft_reviews (
  id UUID PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES openmed_advisory.generated_drafts(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'edited', 'rejected')),
  edited_text TEXT CHECK (edited_text IS NULL OR length(edited_text) <= 8000),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((decision = 'edited') = (edited_text IS NOT NULL))
);

-- Operating alerts (aggregates only; written by the application, read by administrators) ---
CREATE TABLE IF NOT EXISTS clinical_pilot.alerts (
  id BIGSERIAL PRIMARY KEY,
  pilot_id UUID REFERENCES clinical_pilot.pilots(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('warning', 'critical')),
  observed NUMERIC,
  threshold NUMERIC,
  window_minutes INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS clinical_pilot_alerts_open ON clinical_pilot.alerts (created_at DESC) WHERE acknowledged_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nafes_openmed') THEN
    CREATE ROLE nafes_openmed NOLOGIN;
  END IF;
END $$;
GRANT SELECT (kind, approved_features) ON clinical_pilot.pilots TO nafes_openmed;
GRANT SELECT, INSERT ON openmed_advisory.generation_attempts, openmed_advisory.generated_drafts,
  openmed_advisory.draft_reviews TO nafes_openmed;
-- Shared, instance-independent rate limit counts stored analyses per user (index for it).
CREATE INDEX IF NOT EXISTS openmed_analyses_user_created ON openmed_advisory.analyses (user_id, created_at DESC);
COMMIT;
