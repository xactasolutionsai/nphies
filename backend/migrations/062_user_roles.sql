BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;
-- No email-based promotion: an operator must grant the admin role explicitly.
COMMIT;
