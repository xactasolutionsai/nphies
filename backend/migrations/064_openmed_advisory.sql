BEGIN;
CREATE SCHEMA IF NOT EXISTS openmed_advisory;
CREATE TABLE IF NOT EXISTS openmed_advisory.analyses (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual','prior_authorization','claim')),
  source_id INTEGER,
  mode TEXT NOT NULL CHECK (mode IN ('medications','diseases')),
  input_text TEXT NOT NULL CHECK (length(input_text) BETWEEN 1 AND 12000),
  result JSONB NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','reviewed','dismissed')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((source_type = 'manual' AND source_id IS NULL) OR (source_type <> 'manual' AND source_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS openmed_user_patient_created ON openmed_advisory.analyses(user_id,patient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS openmed_patient ON openmed_advisory.analyses(patient_id);
-- This group has no login or privileges to modify business/NPHIES tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nafes_openmed') THEN
    CREATE ROLE nafes_openmed NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public, openmed_advisory TO nafes_openmed;
GRANT SELECT (patient_id,name,identifier) ON public.patients TO nafes_openmed;
GRANT SELECT (id,patient_id,request_number,primary_diagnosis,diagnosis_codes) ON public.prior_authorizations TO nafes_openmed;
GRANT SELECT (id,patient_id,claim_number,primary_diagnosis,diagnosis_codes) ON public.claim_submissions TO nafes_openmed;
GRANT SELECT (prior_auth_id,value_string) ON public.prior_authorization_supporting_info TO nafes_openmed;
GRANT SELECT (claim_id,value_string) ON public.claim_submission_supporting_info TO nafes_openmed;
GRANT SELECT,INSERT ON openmed_advisory.analyses TO nafes_openmed;
GRANT UPDATE (review_status,review_note,reviewed_at) ON openmed_advisory.analyses TO nafes_openmed;
COMMIT;
