-- Add code_entry_mode column to prior_authorization_items and claim_submission_items
-- Tracks how the user selected the code: 'nphies', 'shadow_billing', or 'manual'
-- Used by shadow billing service to skip auto-detection for explicitly chosen codes

ALTER TABLE prior_authorization_items
  ADD COLUMN IF NOT EXISTS code_entry_mode VARCHAR(20) DEFAULT NULL;

ALTER TABLE prior_authorization_item_details
  ADD COLUMN IF NOT EXISTS code_entry_mode VARCHAR(20) DEFAULT NULL;

-- Also add to claim tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_submission_items') THEN
    ALTER TABLE claim_submission_items ADD COLUMN IF NOT EXISTS code_entry_mode VARCHAR(20) DEFAULT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_submission_item_details') THEN
    ALTER TABLE claim_submission_item_details ADD COLUMN IF NOT EXISTS code_entry_mode VARCHAR(20) DEFAULT NULL;
  END IF;
END $$;
