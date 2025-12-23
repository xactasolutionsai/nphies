-- Migration: Add Chief Complaint SNOMED Code System
-- This creates the code system entry. The actual codes will be imported via script.

-- Insert the code system for Chief Complaints (SNOMED-CT)
INSERT INTO nphies_code_systems (code_system_id, code, name, description, source_url, is_active)
VALUES (
  gen_random_uuid(),
  'chief-complaint-snomed',
  'Chief Complaint (SNOMED-CT)',
  'SNOMED-CT codes for chief complaints in prior authorizations. Source: cheifComplaint8April2025.xlsx',
  'http://snomed.info/sct',
  true
)
ON CONFLICT (code) DO NOTHING;

