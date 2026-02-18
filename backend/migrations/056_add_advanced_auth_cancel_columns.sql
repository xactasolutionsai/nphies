-- Add cancellation columns to advanced_authorizations table
ALTER TABLE advanced_authorizations ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;
ALTER TABLE advanced_authorizations ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(100);
ALTER TABLE advanced_authorizations ADD COLUMN IF NOT EXISTS cancel_outcome VARCHAR(50);
ALTER TABLE advanced_authorizations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
