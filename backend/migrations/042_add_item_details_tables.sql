-- Migration: Add item details tables for package items
-- When is_package=true, items must include a detail array with sub-items per NPHIES BV-00036
-- This migration creates tables to store sub-items (details) for package items

-- ============================================================================
-- PRIOR AUTHORIZATION ITEM DETAILS - Sub-items for package PA items
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_item_details (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES prior_authorization_items(id) ON DELETE CASCADE,
    
    -- Detail Sequence (within the parent item)
    sequence INTEGER NOT NULL,
    
    -- Service/Product Information
    product_or_service_code VARCHAR(50) NOT NULL,
    product_or_service_system VARCHAR(255),
    product_or_service_display VARCHAR(255),
    
    -- Quantity and Pricing
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(12,2),
    factor DECIMAL(5,2) DEFAULT 1.0,
    net_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Service Date
    serviced_date DATE,
    
    -- Body Site (for procedures)
    body_site_code VARCHAR(50),
    body_site_system VARCHAR(255),
    sub_site_code VARCHAR(50),
    
    -- Additional Info
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure sequence is unique within an item
    UNIQUE(item_id, sequence)
);

COMMENT ON TABLE prior_authorization_item_details IS 'Sub-items (details) for package prior authorization items. Required when is_package=true per NPHIES BV-00036.';
COMMENT ON COLUMN prior_authorization_item_details.item_id IS 'Foreign key to parent prior_authorization_items record';
COMMENT ON COLUMN prior_authorization_item_details.sequence IS 'Sequence number within the parent item (1, 2, 3, ...)';
COMMENT ON COLUMN prior_authorization_item_details.product_or_service_code IS 'Service/procedure code for the sub-item';
COMMENT ON COLUMN prior_authorization_item_details.net_amount IS 'Calculated net amount (quantity * unit_price * factor)';

-- ============================================================================
-- CLAIM SUBMISSION ITEM DETAILS - Sub-items for package claim items
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_item_details (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES claim_submission_items(id) ON DELETE CASCADE,
    
    -- Detail Sequence (within the parent item)
    sequence INTEGER NOT NULL,
    
    -- Service/Product Information
    product_or_service_code VARCHAR(50) NOT NULL,
    product_or_service_system VARCHAR(255),
    product_or_service_display VARCHAR(255),
    
    -- Quantity and Pricing
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(12,2),
    factor DECIMAL(5,2) DEFAULT 1.0,
    net_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Service Date
    serviced_date DATE,
    
    -- Body Site (for procedures)
    body_site_code VARCHAR(50),
    body_site_system VARCHAR(255),
    sub_site_code VARCHAR(50),
    
    -- Additional Info
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure sequence is unique within an item
    UNIQUE(item_id, sequence)
);

COMMENT ON TABLE claim_submission_item_details IS 'Sub-items (details) for package claim items. Required when is_package=true per NPHIES BV-00036.';
COMMENT ON COLUMN claim_submission_item_details.item_id IS 'Foreign key to parent claim_submission_items record';
COMMENT ON COLUMN claim_submission_item_details.sequence IS 'Sequence number within the parent item (1, 2, 3, ...)';
COMMENT ON COLUMN claim_submission_item_details.product_or_service_code IS 'Service/procedure code for the sub-item';
COMMENT ON COLUMN claim_submission_item_details.net_amount IS 'Calculated net amount (quantity * unit_price * factor)';

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pa_item_details_item_id ON prior_authorization_item_details(item_id);
CREATE INDEX IF NOT EXISTS idx_pa_item_details_sequence ON prior_authorization_item_details(item_id, sequence);

CREATE INDEX IF NOT EXISTS idx_claim_item_details_item_id ON claim_submission_item_details(item_id);
CREATE INDEX IF NOT EXISTS idx_claim_item_details_sequence ON claim_submission_item_details(item_id, sequence);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Item Details Tables Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name IN ('prior_authorization_item_details', 'claim_submission_item_details')) as tables_created,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'prior_authorization_item_details' 
     AND column_name IN ('item_id', 'sequence', 'product_or_service_code', 'quantity', 'unit_price', 'net_amount')) as pa_details_columns,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'claim_submission_item_details' 
     AND column_name IN ('item_id', 'sequence', 'product_or_service_code', 'quantity', 'unit_price', 'net_amount')) as claim_details_columns;

