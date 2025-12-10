-- =====================================================
-- ICD-10 Codes Table Migration
-- Run this in pgAdmin to create the ICD-10 codes lookup table
-- Reference: WHO ICD-10 2019 Edition
-- =====================================================

-- =====================================================
-- 1. Create ICD-10 Codes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS icd10_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL,
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('chapter', 'block', 'category')),
    parent_code VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE icd10_codes IS 'ICD-10 diagnosis codes from WHO 2019 edition for Prior Authorization';
COMMENT ON COLUMN icd10_codes.code IS 'ICD-10 code (e.g., A00.1, K02.9)';
COMMENT ON COLUMN icd10_codes.description IS 'Full description of the diagnosis';
COMMENT ON COLUMN icd10_codes.code_type IS 'Type: chapter (I-XXII), block (A00-A09), or category (A00.1)';
COMMENT ON COLUMN icd10_codes.parent_code IS 'Parent code for hierarchical navigation';

-- =====================================================
-- 2. Create Indexes for Fast Lookups
-- =====================================================

-- Index for exact code lookups
CREATE INDEX IF NOT EXISTS idx_icd10_codes_code ON icd10_codes(code);

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_icd10_codes_type ON icd10_codes(code_type);

-- Index for parent code lookups (hierarchical navigation)
CREATE INDEX IF NOT EXISTS idx_icd10_codes_parent ON icd10_codes(parent_code);

-- Full-text search index for description searches
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_fts ON icd10_codes USING gin(to_tsvector('english', description));

-- Trigram index for partial/fuzzy matching (requires pg_trgm extension)
-- This enables fast LIKE '%search%' queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_icd10_codes_code_trgm ON icd10_codes USING gin(code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_trgm ON icd10_codes USING gin(description gin_trgm_ops);

-- =====================================================
-- 3. Verify Table Creation
-- =====================================================
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'icd10_codes'
ORDER BY ordinal_position;

