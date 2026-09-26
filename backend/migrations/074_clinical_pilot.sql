-- 074: limited internal pilot of the clinical assistant, and error reporting during it.
-- Additive only. The assistant runs (model analyses, summaries) only for participants of an
-- active, hospital-approved pilot whose evaluated build matches the deployed build, and
-- stops by itself while a serious error report is unresolved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS clinical_pilot;

CREATE TABLE IF NOT EXISTS clinical_pilot.pilots (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 200),
  scope TEXT NOT NULL CHECK (length(btrim(scope)) BETWEEN 3 AND 1000),      -- department / setting / use
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  starts_on DATE,
  ends_on DATE,
  max_participants INTEGER CHECK (max_participants BETWEEN 1 AND 500),
  approval_reference TEXT,          -- hospital decision (e.g. committee minute)
  approved_by_name TEXT,            -- hospital approver, as recorded by the hospital
  approved_by_role TEXT,
  evaluation_report_ref TEXT,       -- the independent evaluation this pilot relies on
  evaluation_build_sha256 TEXT CHECK (evaluation_build_sha256 IS NULL OR evaluation_build_sha256 ~ '^[0-9a-f]{64}$'),
  criteria_ref TEXT,                -- pre-registered success criteria that were met
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  status_reason TEXT,               -- why it was last paused / resumed / closed
  status_changed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  status_changed_at TIMESTAMPTZ,
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CHECK (status = 'draft' OR (starts_on IS NOT NULL AND ends_on IS NOT NULL AND approval_reference IS NOT NULL
    AND approved_by_name IS NOT NULL AND approved_by_role IS NOT NULL AND evaluation_report_ref IS NOT NULL
    AND evaluation_build_sha256 IS NOT NULL AND criteria_ref IS NOT NULL AND activated_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS clinical_pilot.participants (
  pilot_id UUID NOT NULL REFERENCES clinical_pilot.pilots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL CHECK (length(btrim(role_label)) BETWEEN 2 AND 100),   -- e.g. physician, pharmacist, coder
  added_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  PRIMARY KEY (pilot_id, user_id)
);

-- Error reports from users. The description must not contain identifiers (checked by the API).
CREATE TABLE IF NOT EXISTS clinical_pilot.issue_reports (
  id UUID PRIMARY KEY,
  pilot_id UUID REFERENCES clinical_pilot.pilots(id) ON DELETE SET NULL,
  analysis_id UUID REFERENCES openmed_advisory.analyses(id) ON DELETE SET NULL,
  summary_id UUID REFERENCES openmed_advisory.summaries(id) ON DELETE SET NULL,
  reporter_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('wrong_assertion', 'wrong_experiencer', 'wrong_temporality',
    'wrong_medication_status', 'missed_entity', 'wrong_entity', 'wrong_medication_detail', 'wrong_reference',
    'unsupported_statement', 'access_or_privacy', 'performance', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'serious')),
  entity_index INTEGER CHECK (entity_index IS NULL OR entity_index >= 0),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  build_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'fixed', 'wont_fix', 'duplicate')),
  triage_note TEXT,
  fixed_in_build TEXT CHECK (fixed_in_build IS NULL OR fixed_in_build ~ '^[0-9a-f]{64}$'),
  resolved_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (analysis_id IS NOT NULL OR summary_id IS NOT NULL OR category IN ('performance', 'access_or_privacy', 'other'))
);
CREATE INDEX IF NOT EXISTS clinical_pilot_open_serious ON clinical_pilot.issue_reports (pilot_id)
  WHERE severity = 'serious' AND status IN ('open', 'triaged');

-- Which pilot an analysis ran under (NULL outside a pilot, e.g. before enforcement).
ALTER TABLE openmed_advisory.analyses ADD COLUMN IF NOT EXISTS pilot_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nafes_openmed') THEN
    CREATE ROLE nafes_openmed NOLOGIN;
  END IF;
END $$;
-- The advisory login checks eligibility and files reports; it cannot create, change or
-- resolve pilots or reports.
GRANT USAGE ON SCHEMA clinical_pilot TO nafes_openmed;
GRANT SELECT (id, status, starts_on, ends_on, evaluation_build_sha256, name, scope) ON clinical_pilot.pilots TO nafes_openmed;
GRANT SELECT (pilot_id, user_id, removed_at) ON clinical_pilot.participants TO nafes_openmed;
GRANT SELECT (id, pilot_id, analysis_id, summary_id, reporter_id, category, severity, status, triage_note,
  created_at, updated_at) ON clinical_pilot.issue_reports TO nafes_openmed;
GRANT INSERT (id, pilot_id, analysis_id, summary_id, reporter_id, category, severity, entity_index, description, build_sha256)
  ON clinical_pilot.issue_reports TO nafes_openmed;
COMMIT;
