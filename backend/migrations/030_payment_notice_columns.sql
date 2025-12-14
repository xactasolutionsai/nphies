-- Migration: Add Payment Notice (acknowledgement) columns to payment_reconciliations
-- This tracks when the provider sends a Payment Notice back to NPHIES

-- Add acknowledgement tracking columns
ALTER TABLE payment_reconciliations 
ADD COLUMN IF NOT EXISTS acknowledgement_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS acknowledgement_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS acknowledgement_bundle JSONB DEFAULT NULL;

-- Add index for acknowledgement status
CREATE INDEX IF NOT EXISTS idx_pr_acknowledgement_status 
ON payment_reconciliations(acknowledgement_status);

-- Add comment for documentation
COMMENT ON COLUMN payment_reconciliations.acknowledgement_status IS 'Status of Payment Notice: null=not sent, sent=sent to NPHIES, failed=send failed';
COMMENT ON COLUMN payment_reconciliations.acknowledgement_date IS 'Timestamp when Payment Notice was sent';
COMMENT ON COLUMN payment_reconciliations.acknowledgement_bundle IS 'The FHIR PaymentNotice bundle that was sent';

