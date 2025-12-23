-- Migration: Add Pharmacy Claim Enhancements
-- Adds support for:
-- 1. Multiple days-supply sequences (item_type to distinguish medication vs device)
-- 2. Per-item informationSequence linking (information_sequences array)
-- 3. Medical device items (item_type field)
-- 
-- Reference: Pharmacy Claim Usecase Requirements

-- ============================================================================
-- PRIOR AUTHORIZATION ITEMS - Add item_type and information_sequences
-- ============================================================================
ALTER TABLE prior_authorization_items
ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) CHECK (item_type IN ('medication', 'device')) DEFAULT 'medication',
ADD COLUMN IF NOT EXISTS information_sequences INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN prior_authorization_items.item_type IS 'Item type: medication or device (for pharmacy claims)';
COMMENT ON COLUMN prior_authorization_items.information_sequences IS 'Array of supporting info sequence numbers this item links to (for days-supply linking)';

-- ============================================================================
-- CLAIM SUBMISSION ITEMS - Add item_type and information_sequences
-- ============================================================================
ALTER TABLE claim_submission_items
ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) CHECK (item_type IN ('medication', 'device')) DEFAULT 'medication',
ADD COLUMN IF NOT EXISTS information_sequences INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN claim_submission_items.item_type IS 'Item type: medication or device (for pharmacy claims)';
COMMENT ON COLUMN claim_submission_items.information_sequences IS 'Array of supporting info sequence numbers this item links to (for days-supply linking)';

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_prior_auth_items_item_type ON prior_authorization_items(item_type) WHERE item_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_items_item_type ON claim_submission_items(item_type) WHERE item_type IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Pharmacy Claim Enhancements Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'prior_authorization_items' 
     AND column_name IN ('item_type', 'information_sequences')) as prior_auth_items_columns_added,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'claim_submission_items' 
     AND column_name IN ('item_type', 'information_sequences')) as claim_items_columns_added;

