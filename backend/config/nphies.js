// NPHIES Configuration
// This file centralizes NPHIES-related configuration values
// Change DEFAULT_PROVIDER_ID here or via NPHIES_PROVIDER_ID environment variable

export const NPHIES_CONFIG = {
  // Default Provider ID - Used for NPHIES provider identifier in FHIR resources
  // Current: 1010613708 (was: PR-FHIR)
  DEFAULT_PROVIDER_ID: process.env.NPHIES_PROVIDER_ID || '1010613708',
  
  // Provider Domain for URL construction (e.g., http://PR-FHIR.com.sa/...)
  // This should remain as 'PR-FHIR' for URL construction, separate from the provider ID
  PROVIDER_DOMAIN: process.env.NPHIES_PROVIDER_DOMAIN || 'PR-FHIR',
  
  // Default Insurer ID for fallback
  DEFAULT_INSURER_ID: process.env.NPHIES_INSURER_ID || 'INS-FHIR',
  
  // NPHIES API Configuration
  BASE_URL: process.env.NPHIES_BASE_URL || 'http://176.105.150.83',
  PRODUCTION_URL: process.env.NPHIES_PRODUCTION_URL || 'https://hsb.nphies.sa',
  OAUTH_URL: process.env.NPHIES_OAUTH_URL || 'https://hsb.nphies.sa/oauth/token',
  TIMEOUT: parseInt(process.env.NPHIES_TIMEOUT || '60000'),
  RETRY_ATTEMPTS: parseInt(process.env.NPHIES_RETRY_ATTEMPTS || '3'),
  
  // Auto-Poll Configuration (Steps 7-8)
  // Automatically poll for final authorization response after communication acknowledgment
  AUTO_POLL_AFTER_ACKNOWLEDGMENT: process.env.AUTO_POLL_AFTER_ACKNOWLEDGMENT !== 'false', // Default: true
  AUTO_POLL_DELAY_MS: parseInt(process.env.AUTO_POLL_DELAY_MS || '3000'), // Default: 3 seconds
};

export default NPHIES_CONFIG;

