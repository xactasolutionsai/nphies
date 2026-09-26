-- 071: patient access grants and versioned human reviews for the clinical AI (OpenMed) module.
-- Additive only: two new tables and grants. No existing row or column is changed.
BEGIN;

-- Which user may use clinical AI on which patient, why, until when, and who decided.
-- Rows are never deleted by the application: revoking sets revoked_at / revoked_by.
CREATE TABLE IF NOT EXISTS public.clinical_ai_patient_access (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  granted_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE INDEX IF NOT EXISTS clinical_ai_access_user_patient
  ON public.clinical_ai_patient_access(user_id, patient_id) WHERE revoked_at IS NULL;

-- Insert-only review history. The model/rule output in analyses.result is never edited;
-- each review (accept / reject / correct) is a new version with the reviewer's corrections.
CREATE SCHEMA IF NOT EXISTS openmed_advisory;
CREATE TABLE IF NOT EXISTS openmed_advisory.analysis_reviews (
  id UUID PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES openmed_advisory.analyses(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  reviewer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected', 'corrected')),
  corrections JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(corrections) = 'array'),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  engine_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, version),
  CHECK (decision = 'corrected' OR corrections = '[]'::jsonb)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nafes_openmed') THEN
    CREATE ROLE nafes_openmed NOLOGIN;
  END IF;
END $$;
-- The advisory login reads grants (to enforce them) but cannot create, extend or revoke them.
GRANT SELECT (user_id, patient_id, expires_at, revoked_at) ON public.clinical_ai_patient_access TO nafes_openmed;
GRANT SELECT, INSERT ON openmed_advisory.analysis_reviews TO nafes_openmed;
COMMIT;
