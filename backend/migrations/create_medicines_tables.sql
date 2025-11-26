-- Medicine Module Database Schema
-- Creates tables for storing medicine data with RAG vector search support

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Core medicines table (based on All_generic_v072124.csv)
CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    mrid VARCHAR(100) UNIQUE NOT NULL, -- Medicine Registration ID (e.g., 010101-0122-6401)
    active_ingredient TEXT NOT NULL,
    strength TEXT, -- TEXT to handle very complex medicine combinations (some exceed 200 chars)
    unit TEXT, -- TEXT to handle complex units
    dosage_form_parent VARCHAR(100),
    dosage_form_child VARCHAR(100),
    embedding vector(4096), -- Embedding vector for RAG search (4096 dimensions for cniongolo/biomistral)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medicine brands table (based on All_brand_v072124.csv)
CREATE TABLE IF NOT EXISTS medicine_brands (
    id SERIAL PRIMARY KEY,
    mrid VARCHAR(100) NOT NULL,
    mb_mrid VARCHAR(100) UNIQUE, -- Medicine Brand MRID (e.g., 010101-0122-6401-01-07)
    brand_name VARCHAR(255),
    package_form VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mrid) REFERENCES medicines(mrid) ON DELETE CASCADE
);

-- Medicine codes table (for all code types: MOH, NHIC, NUPCO, GTIN, Registration)
CREATE TABLE IF NOT EXISTS medicine_codes (
    id SERIAL PRIMARY KEY,
    mrid VARCHAR(100) NOT NULL,
    code_type VARCHAR(20) NOT NULL, -- 'MOH', 'NHIC', 'NUPCO', 'GTIN', 'REGISTRATION'
    code_value VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mrid) REFERENCES medicines(mrid) ON DELETE CASCADE,
    UNIQUE(code_type, code_value)
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_medicines_mrid ON medicines(mrid);
CREATE INDEX IF NOT EXISTS idx_medicines_active_ingredient ON medicines USING gin(to_tsvector('english', active_ingredient));
CREATE INDEX IF NOT EXISTS idx_medicines_dosage_form ON medicines(dosage_form_parent, dosage_form_child);

-- Note: For embeddings > 2000 dimensions, ivfflat cannot be used
-- Try HNSW if available (pgvector >= 0.5.0), otherwise continue without index
DO $$ 
BEGIN
    BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_medicines_embedding ON medicines USING hnsw (embedding vector_cosine_ops)';
        RAISE NOTICE 'Created HNSW index for embeddings';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'HNSW index not available, continuing without embedding index (search will still work)';
    END;
END $$;

CREATE INDEX IF NOT EXISTS idx_medicine_brands_mrid ON medicine_brands(mrid);
CREATE INDEX IF NOT EXISTS idx_medicine_brands_brand_name ON medicine_brands USING gin(to_tsvector('english', brand_name));
CREATE INDEX IF NOT EXISTS idx_medicine_brands_mb_mrid ON medicine_brands(mb_mrid);

CREATE INDEX IF NOT EXISTS idx_medicine_codes_mrid ON medicine_codes(mrid);
CREATE INDEX IF NOT EXISTS idx_medicine_codes_type ON medicine_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_medicine_codes_value ON medicine_codes(code_value);
CREATE INDEX IF NOT EXISTS idx_medicine_codes_type_value ON medicine_codes(code_type, code_value);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_medicines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for medicines table
DROP TRIGGER IF EXISTS medicines_updated_at_trigger ON medicines;
CREATE TRIGGER medicines_updated_at_trigger
    BEFORE UPDATE ON medicines
    FOR EACH ROW
    EXECUTE FUNCTION update_medicines_updated_at();

-- Add comments for documentation
COMMENT ON TABLE medicines IS 'Core medicines table with generic medicine information';
COMMENT ON TABLE medicine_brands IS 'Brand names and package information for medicines';
COMMENT ON TABLE medicine_codes IS 'Various identification codes (MOH, NHIC, NUPCO, GTIN, Registration) for medicines';
COMMENT ON COLUMN medicines.mrid IS 'Medicine Registration ID - primary identifier';
COMMENT ON COLUMN medicines.embedding IS 'Vector embedding (4096 dimensions) for RAG-based semantic search using cniongolo/biomistral';
COMMENT ON COLUMN medicine_brands.mb_mrid IS 'Medicine Brand MRID - unique identifier for brand+package combination';
COMMENT ON COLUMN medicine_codes.code_type IS 'Type of code: MOH, NHIC, NUPCO, GTIN, or REGISTRATION';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON medicines TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON medicine_brands TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON medicine_codes TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE medicines_id_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE medicine_brands_id_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE medicine_codes_id_seq TO your_app_user;

