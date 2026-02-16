-- Migration: Add shadow billing (dual coding) fields for NPHIES test case #5
-- Shadow billing allows unlisted/non-standard codes to include a secondary provider-specific code
-- in productOrService.coding array

-- Add shadow billing columns to prior_authorization_items
ALTER TABLE prior_authorization_items
  ADD COLUMN IF NOT EXISTS shadow_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shadow_code_system VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shadow_code_display VARCHAR(255);

-- Add shadow billing columns to prior_authorization_item_details (for package sub-items)
ALTER TABLE prior_authorization_item_details
  ADD COLUMN IF NOT EXISTS shadow_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shadow_code_system VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shadow_code_display VARCHAR(255);

COMMENT ON COLUMN prior_authorization_items.shadow_code IS 'Provider internal product/service code for dual coding (shadow billing)';
COMMENT ON COLUMN prior_authorization_items.shadow_code_system IS 'Code system URL for the shadow code (e.g., http://provider.example.sa/item-codes)';
COMMENT ON COLUMN prior_authorization_items.shadow_code_display IS 'Display text for the shadow code';

COMMENT ON COLUMN prior_authorization_item_details.shadow_code IS 'Provider internal product/service code for dual coding (shadow billing)';
COMMENT ON COLUMN prior_authorization_item_details.shadow_code_system IS 'Code system URL for the shadow code';
COMMENT ON COLUMN prior_authorization_item_details.shadow_code_display IS 'Display text for the shadow code';
