-- 072: registry of hospital-approved reference sources for the clinical assistant, and
-- insert-only storage of evidence-backed summaries. Additive only.
BEGIN;
CREATE SCHEMA IF NOT EXISTS clinical_knowledge;

CREATE TABLE IF NOT EXISTS clinical_knowledge.sources (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 300),
  publisher TEXT NOT NULL CHECK (length(btrim(publisher)) BETWEEN 2 AND 300),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  license TEXT,                 -- licence under which the hospital holds the text
  usage_rights TEXT,            -- what the licence allows (e.g. internal decision support)
  version TEXT,
  published_on DATE,
  reviewed_on DATE,             -- publisher's last review date, as stated by the publisher
  next_review_due DATE,         -- hospital review date; overdue sources are not retrieved
  scope TEXT,                   -- population / setting the source applies to
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  approval_reference TEXT,      -- e.g. committee minute number
  precedence_rank INTEGER CHECK (precedence_rank >= 1),   -- hospital policy: 1 = highest
  supersedes_source_id UUID REFERENCES clinical_knowledge.sources(id),
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  retired_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  retired_at TIMESTAMPTZ,
  retire_reason TEXT,
  CHECK (status <> 'approved' OR (license IS NOT NULL AND usage_rights IS NOT NULL AND version IS NOT NULL
    AND published_on IS NOT NULL AND scope IS NOT NULL AND approval_reference IS NOT NULL
    AND precedence_rank IS NOT NULL AND approved_at IS NOT NULL AND language = 'en')),
  CHECK (status <> 'retired' OR (retired_at IS NOT NULL AND retire_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS clinical_knowledge.passages (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES clinical_knowledge.sources(id) ON DELETE CASCADE,
  section TEXT CHECK (section IS NULL OR length(section) <= 300),
  locator TEXT CHECK (locator IS NULL OR length(locator) <= 100),   -- page/section exactly as in the source
  text TEXT NOT NULL CHECK (length(btrim(text)) BETWEEN 20 AND 4000),
  content_sha256 TEXT NOT NULL,
  injection_flags TEXT[] NOT NULL DEFAULT '{}',
  injection_reviewed BOOLEAN NOT NULL DEFAULT false,
  injection_reviewed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, coalesce(section, '') || ' ' || text)) STORED,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, content_sha256)
);
CREATE INDEX IF NOT EXISTS clinical_knowledge_passages_tsv ON clinical_knowledge.passages USING GIN (tsv);

-- Passages of an approved or retired source are frozen: a new edition is a new source that
-- supersedes the old one.
CREATE OR REPLACE FUNCTION clinical_knowledge.freeze_passages() RETURNS trigger AS $$
DECLARE s TEXT;
BEGIN
  -- Only content is frozen; user deletions may still null created_by / injection_reviewed_by.
  IF TG_OP = 'UPDATE' AND (NEW.source_id, NEW.section, NEW.locator, NEW.text, NEW.content_sha256,
      NEW.injection_flags, NEW.injection_reviewed)
      IS NOT DISTINCT FROM (OLD.source_id, OLD.section, OLD.locator, OLD.text, OLD.content_sha256,
      OLD.injection_flags, OLD.injection_reviewed) THEN
    RETURN NEW;
  END IF;
  SELECT status INTO s FROM clinical_knowledge.sources
   WHERE id = COALESCE(NEW.source_id, OLD.source_id);
  IF s IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'passages of a % source cannot be changed', s USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS freeze_passages ON clinical_knowledge.passages;
CREATE TRIGGER freeze_passages BEFORE INSERT OR UPDATE OR DELETE ON clinical_knowledge.passages
  FOR EACH ROW EXECUTE FUNCTION clinical_knowledge.freeze_passages();

-- What retrieval may use: approved, not overdue for hospital review, and not superseded by
-- a source that was ever approved (retiring the new edition does not bring the old one back).
CREATE OR REPLACE VIEW clinical_knowledge.approved_passages AS
SELECT p.id AS passage_id, p.section, p.locator, p.text, p.tsv,
       s.id AS source_id, s.title, s.publisher, s.version, s.license, s.published_on, s.reviewed_on,
       s.precedence_rank, s.scope, s.approved_at
  FROM clinical_knowledge.passages p
  JOIN clinical_knowledge.sources s ON s.id = p.source_id
 WHERE s.status = 'approved'
   AND (s.next_review_due IS NULL OR s.next_review_due >= current_date)
   AND NOT EXISTS (SELECT 1 FROM clinical_knowledge.sources n
                    WHERE n.supersedes_source_id = s.id AND n.approved_at IS NOT NULL);

-- Evidence-backed summaries: each generation is a new version; reviews are insert-only.
CREATE TABLE IF NOT EXISTS openmed_advisory.summaries (
  id UUID PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES openmed_advisory.analyses(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_by INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  corpus JSONB NOT NULL,        -- source ids and versions available at generation time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, version)
);
CREATE TABLE IF NOT EXISTS openmed_advisory.summary_reviews (
  id UUID PRIMARY KEY,
  summary_id UUID NOT NULL REFERENCES openmed_advisory.summaries(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nafes_openmed') THEN
    CREATE ROLE nafes_openmed NOLOGIN;
  END IF;
END $$;
-- The advisory login reads only the approved view, never drafts or the registry tables.
GRANT USAGE ON SCHEMA clinical_knowledge TO nafes_openmed;
GRANT SELECT ON clinical_knowledge.approved_passages TO nafes_openmed;
GRANT SELECT, INSERT ON openmed_advisory.summaries, openmed_advisory.summary_reviews TO nafes_openmed;
COMMIT;
