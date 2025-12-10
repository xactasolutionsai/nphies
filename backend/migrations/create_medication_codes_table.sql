-- Migration: Create medication_codes table for NPHIES medication codes
-- Source: CodeSystem-medication-codes.json (NPHIES GTIN medication codes)

-- Create medication_codes table
CREATE TABLE IF NOT EXISTS medication_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,           -- GTIN code (e.g., "06281147005347")
    display VARCHAR(500),                        -- Medication name (e.g., "OLANA 5 MG ORODISPERSIBLE TABLET")
    strength VARCHAR(100),                       -- Strength (e.g., "5 MG")
    generic_name TEXT,                           -- Generic name with details
    route_of_administration VARCHAR(100),        -- ROA (e.g., "ORAL")
    dosage_form VARCHAR(100),                    -- Dosage form (e.g., "ORODISPERSIBLE TABLET")
    package_size VARCHAR(50),                    -- Package size (e.g., "28'S")
    unit_type VARCHAR(50),                       -- Unit type (e.g., "TABLET")
    price DECIMAL(10,2),                         -- Price in SAR
    ingredients TEXT,                            -- Active ingredients
    atc_code VARCHAR(20),                        -- ATC code for classification
    is_controlled BOOLEAN DEFAULT FALSE,         -- Whether it's a controlled substance
    reg_owner VARCHAR(200),                      -- Registration owner/manufacturer
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_medication_codes_code ON medication_codes(code);

-- Full-text search index on display name for fast searching
CREATE INDEX IF NOT EXISTS idx_medication_codes_display_gin ON medication_codes USING gin(to_tsvector('english', COALESCE(display, '')));

-- Index for generic name searches
CREATE INDEX IF NOT EXISTS idx_medication_codes_generic_gin ON medication_codes USING gin(to_tsvector('english', COALESCE(generic_name, '')));

-- Index for ingredients searches
CREATE INDEX IF NOT EXISTS idx_medication_codes_ingredients_gin ON medication_codes USING gin(to_tsvector('english', COALESCE(ingredients, '')));

-- Trigram indexes for partial/fuzzy matching (requires pg_trgm extension)
-- These enable ILIKE searches to be fast
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_medication_codes_display_trgm ON medication_codes USING gin(display gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medication_codes_generic_trgm ON medication_codes USING gin(generic_name gin_trgm_ops);

-- Add comments for documentation
COMMENT ON TABLE medication_codes IS 'NPHIES medication codes from CodeSystem-medication-codes.json';
COMMENT ON COLUMN medication_codes.code IS 'GTIN code - unique identifier for the medication';
COMMENT ON COLUMN medication_codes.display IS 'Display name of the medication';
COMMENT ON COLUMN medication_codes.strength IS 'Medication strength (e.g., 5 MG, 100 MG/ML)';
COMMENT ON COLUMN medication_codes.generic_name IS 'Generic/scientific name with full details';
COMMENT ON COLUMN medication_codes.route_of_administration IS 'Route of administration (ORAL, IV, etc.)';
COMMENT ON COLUMN medication_codes.dosage_form IS 'Dosage form (TABLET, CAPSULE, INJECTION, etc.)';
COMMENT ON COLUMN medication_codes.atc_code IS 'Anatomical Therapeutic Chemical classification code';
COMMENT ON COLUMN medication_codes.is_controlled IS 'Whether this is a controlled substance';

