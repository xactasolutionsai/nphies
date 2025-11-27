-- Migration: Add PolicyHolder support for NPHIES
-- Based on: https://portal.nphies.sa/ig/StructureDefinition-policyholder-organization.html
-- Example: Organization/13 in docs/example.json

-- 1. Create policy_holders table (for employer/company organizations that hold insurance policies)
CREATE TABLE IF NOT EXISTS policy_holders (
    policy_holder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(100),  -- NPHIES organization identifier (e.g., "5009")
    identifier_system VARCHAR(255) DEFAULT 'http://nphies.sa/identifiers/organization',
    is_active BOOLEAN DEFAULT true,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Saudi Arabia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add policy_holder_id column to patient_coverage table
ALTER TABLE patient_coverage 
ADD COLUMN IF NOT EXISTS policy_holder_id UUID REFERENCES policy_holders(policy_holder_id);

-- 3. Insert example policy holder from NPHIES documentation
INSERT INTO policy_holders (name, identifier, is_active)
VALUES ('Policy Holder Organization', '5009', true)
ON CONFLICT DO NOTHING;

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_policy_holders_identifier ON policy_holders(identifier);
CREATE INDEX IF NOT EXISTS idx_patient_coverage_policy_holder ON patient_coverage(policy_holder_id);

-- Verify the changes
SELECT 'policy_holders table created' as status;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'policy_holders';

