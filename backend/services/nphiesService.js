/**
 * NPHIES API Service
 * Handles communication with NPHIES OBA test environment
 * Reference: http://176.105.150.83/$process-message
 */

import axios from 'axios';
import { randomUUID } from 'crypto';

class NphiesService {
  constructor() {
    this.baseURL = process.env.NPHIES_BASE_URL || 'http://176.105.150.83';
    this.timeout = parseInt(process.env.NPHIES_TIMEOUT || '60000');
    this.retryAttempts = parseInt(process.env.NPHIES_RETRY_ATTEMPTS || '3');
  }

  /**
   * Send eligibility request to NPHIES
   */
  async checkEligibility(requestBundle) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[NPHIES] Sending eligibility request (attempt ${attempt}/${this.retryAttempts})`);
        
        const response = await axios.post(
          `${this.baseURL}/$process-message`,
          requestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout: this.timeout,
            validateStatus: (status) => status < 500 // Accept 4xx responses as valid
          }
        );

        console.log(`[NPHIES] Response received: ${response.status}`);
        
        // Validate response
        const validationResult = this.validateResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid response structure:', validationResult.errors);
          throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}`);
        }

        return {
          success: true,
          status: response.status,
          data: response.data
        };

      } catch (error) {
        lastError = error;
        console.error(`[NPHIES] Attempt ${attempt} failed:`, error.message);

        // Don't retry on 4xx errors (client errors)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log('[NPHIES] Client error detected, not retrying');
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[NPHIES] Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: this.formatError(lastError)
    };
  }

  /**
   * Submit prior authorization request to NPHIES
   */
  async submitPriorAuth(requestBundle) {
    let lastError = null;
    
    // Debug: Log the request bundle being sent
    console.log('[NPHIES] ===== OUTGOING REQUEST =====');
    console.log('[NPHIES] Request Bundle ID:', requestBundle?.id);
    console.log('[NPHIES] Request Bundle Type:', requestBundle?.type);
    console.log('[NPHIES] Request Bundle Entries:', requestBundle?.entry?.length);
    // Log the MessageHeader event type
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    console.log('[NPHIES] MessageHeader event:', msgHeader?.eventCoding?.code);
    // Log the Claim identifier
    const claim = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource;
    console.log('[NPHIES] Claim identifier:', claim?.identifier?.[0]?.value);
    console.log('[NPHIES] =============================');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[NPHIES] Sending prior authorization request (attempt ${attempt}/${this.retryAttempts})`);
        
        const response = await axios.post(
          `${this.baseURL}/$process-message`,
          requestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout: this.timeout,
            validateStatus: (status) => status < 500 // Accept 4xx responses as valid
          }
        );

        console.log(`[NPHIES] Response received: ${response.status}`);
        
        // Debug: Log the response bundle received
        console.log('[NPHIES] ===== INCOMING RESPONSE =====');
        console.log('[NPHIES] Response Bundle ID:', response.data?.id);
        console.log('[NPHIES] Response Bundle Type:', response.data?.type);
        console.log('[NPHIES] Response Bundle Entries:', response.data?.entry?.length);
        // Log ClaimResponse details
        const claimResp = response.data?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
        console.log('[NPHIES] ClaimResponse ID:', claimResp?.id);
        console.log('[NPHIES] ClaimResponse outcome:', claimResp?.outcome);
        console.log('[NPHIES] ClaimResponse preAuthRef:', claimResp?.preAuthRef);
        console.log('[NPHIES] ClaimResponse has extensions:', !!claimResp?.extension, 'count:', claimResp?.extension?.length);
        console.log('[NPHIES] ==============================');
        
        // Validate response for prior auth (expects ClaimResponse)
        const validationResult = this.validatePriorAuthResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid prior auth response structure:', validationResult.errors);
          throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}`);
        }

        return {
          success: true,
          status: response.status,
          data: response.data
        };

      } catch (error) {
        lastError = error;
        console.error(`[NPHIES] Attempt ${attempt} failed:`, error.message);

        // Don't retry on 4xx errors (client errors)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log('[NPHIES] Client error detected, not retrying');
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[NPHIES] Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: this.formatError(lastError)
    };
  }

  /**
   * Validate FHIR response bundle structure for Eligibility
   */
  validateResponse(response) {
    return this.validateBundleResponse(response, ['CoverageEligibilityResponse']);
  }

  /**
   * Validate FHIR response bundle structure for Prior Authorization
   */
  validatePriorAuthResponse(response) {
    return this.validateBundleResponse(response, ['ClaimResponse']);
  }

  /**
   * Generic FHIR response bundle validation
   * @param {Object} response - The FHIR bundle response
   * @param {Array<string>} expectedResourceTypes - Array of expected resource types (e.g., ['ClaimResponse', 'CoverageEligibilityResponse'])
   */
  validateBundleResponse(response, expectedResourceTypes = []) {
    const errors = [];

    if (!response) {
      errors.push('Response is empty');
      return { valid: false, errors };
    }

    if (response.resourceType !== 'Bundle') {
      errors.push('Response is not a FHIR Bundle');
      return { valid: false, errors };
    }

    if (response.type !== 'message') {
      errors.push('Bundle type is not "message"');
    }

    if (!response.entry || !Array.isArray(response.entry)) {
      errors.push('Bundle has no entries');
      return { valid: false, errors };
    }

    // Check for MessageHeader (must be first)
    const firstEntry = response.entry[0];
    if (!firstEntry || firstEntry.resource?.resourceType !== 'MessageHeader') {
      errors.push('First entry must be MessageHeader');
    }

    // Check for OperationOutcome (always valid for error responses)
    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    // Check for expected resource types
    const hasExpectedResource = expectedResourceTypes.length === 0 || expectedResourceTypes.some(
      resourceType => response.entry.some(e => e.resource?.resourceType === resourceType)
    );

    if (!hasExpectedResource && !hasOperationOutcome) {
      errors.push(`Bundle must contain ${expectedResourceTypes.join(' or ')} or OperationOutcome`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format error for consistent error handling
   */
  formatError(error) {
    if (!error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        details: null
      };
    }

    if (error.response) {
      // HTTP error response
      return {
        code: `HTTP_${error.response.status}`,
        message: error.response.statusText || 'HTTP Error',
        details: error.response.data,
        status: error.response.status
      };
    }

    if (error.request) {
      // Request was made but no response received
      return {
        code: 'NO_RESPONSE',
        message: 'No response received from NPHIES',
        details: error.message
      };
    }

    // Other errors
    return {
      code: 'REQUEST_ERROR',
      message: error.message || 'Request failed',
      details: error.stack
    };
  }

  /**
   * Extract error details from OperationOutcome
   */
  extractOperationOutcomeErrors(operationOutcome) {
    if (!operationOutcome || !operationOutcome.issue) {
      return [];
    }

    return operationOutcome.issue.map(issue => ({
      severity: issue.severity,
      code: issue.code,
      details: issue.details?.text || issue.diagnostics,
      location: issue.location?.join(', ') || null
    }));
  }

  /**
   * Check if response indicates queued status
   */
  isQueuedResponse(responseBundle) {
    const eligibilityResponse = responseBundle.entry?.find(
      e => e.resource?.resourceType === 'CoverageEligibilityResponse'
    )?.resource;

    return eligibilityResponse?.outcome === 'queued';
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId() {
    return randomUUID();
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to NPHIES
   */
  async testConnection() {
    try {
      const response = await axios.get(this.baseURL, {
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });

      return {
        success: true,
        status: response.status,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new NphiesService();

