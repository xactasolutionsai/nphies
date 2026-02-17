-- Migration: Make product_or_service_code nullable
-- Items are not required to have a service code

ALTER TABLE prior_authorization_items 
  ALTER COLUMN product_or_service_code DROP NOT NULL;

ALTER TABLE claim_submission_items 
  ALTER COLUMN product_or_service_code DROP NOT NULL;
