-- Migration 000: baseline core tables.
--
-- The original core tables were created by hand (see the pg_dump in /nafes_backup.sql)
-- and no migration created them, so a fresh database could not be built from the
-- repository. This file recreates exactly that structure, idempotently, so that
-- `npm run migrate` can build a new database. On an existing database every
-- statement is a no-op.
--
-- The legacy `claims_batch` table from the dump is intentionally not recreated:
-- the application uses `claim_batches` (migration 047); claims.batch_id is kept
-- as a plain UUID column for compatibility with dumped data.

CREATE TABLE IF NOT EXISTS patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) UNIQUE,
    gender VARCHAR(50),
    birth_date DATE,
    phone VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS providers (
    provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    nphies_id VARCHAR(255) UNIQUE,
    address TEXT,
    phone VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS insurers (
    insurer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_name VARCHAR(255) NOT NULL,
    nphies_id VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    contact_person VARCHAR(255),
    phone VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS authorizations (
    auth_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_status VARCHAR(50),
    purpose TEXT,
    patient_id UUID REFERENCES patients(patient_id),
    provider_id UUID REFERENCES providers(provider_id),
    insurer_id UUID REFERENCES insurers(insurer_id),
    amount NUMERIC(10,2),
    request_date DATE
);

CREATE TABLE IF NOT EXISTS eligibility (
    eligibility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purpose TEXT,
    patient_id UUID REFERENCES patients(patient_id),
    provider_id UUID REFERENCES providers(provider_id),
    insurer_id UUID REFERENCES insurers(insurer_id),
    status VARCHAR(50),
    coverage VARCHAR(50),
    request_date DATE
);

CREATE TABLE IF NOT EXISTS claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number VARCHAR(255) UNIQUE,
    patient_id UUID REFERENCES patients(patient_id),
    provider_id UUID REFERENCES providers(provider_id),
    insurer_id UUID REFERENCES insurers(insurer_id),
    status VARCHAR(50),
    amount NUMERIC(10,2),
    submission_date DATE,
    batch_id UUID
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_ref VARCHAR(255) UNIQUE,
    insurer_id UUID REFERENCES insurers(insurer_id),
    provider_id UUID REFERENCES providers(provider_id),
    amount NUMERIC(10,2),
    status VARCHAR(50),
    payment_date DATE
);

-- Shared trigger function used by later migrations.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
