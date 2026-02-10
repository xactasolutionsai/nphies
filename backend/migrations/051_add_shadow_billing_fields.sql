-- Migration: Add shadow billing fields for pharmacy items
-- Date: 2026-02-11
-- Description: Adds SFDA code and display fields for NPHIES shadow billing support.
--   When an unlisted medication code (e.g., 99999999999999) is used, the actual
--   SFDA/GTIN drug code must be sent as a second coding entry in
--   productOrService.coding[]. These fields store that secondary code.

-- Add sfda_code column (the actual SFDA/GTIN drug code for shadow billing)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS sfda_code VARCHAR(50);

-- Add sfda_display column (the display name for the SFDA drug)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS sfda_display VARCHAR(500);

-- Comment on columns
COMMENT ON COLUMN prior_authorization_items.sfda_code IS 'SFDA/GTIN code for shadow billing - the actual drug code when using an unlisted medication code';
COMMENT ON COLUMN prior_authorization_items.sfda_display IS 'Display name of the SFDA drug for shadow billing';
