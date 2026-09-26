-- Migration 068: role model admin / submitter / reviewer / viewer.
-- Only the CHECK constraint is widened. Existing rows are NOT updated: the legacy
-- 'user' role stays valid and is treated as 'submitter' by middleware/requireRole.js.
-- Idempotent: the constraint is replaced with the same definition on every run.
BEGIN;
-- Same column definition as 062, for databases that were baselined without running it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'submitter', 'reviewer', 'viewer'));
COMMIT;
