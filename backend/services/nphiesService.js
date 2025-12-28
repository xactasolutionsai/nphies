/**
 * NPHIES API Service
 * Handles communication with NPHIES OBA test environment
 * Reference: http://176.105.150.83/$process-message
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import { NPHIES_CONFIG } from '../config/nphies.js';
import CommunicationMapper from './communicationMapper.js';
import batchClaimMapper from './claimMapper/BatchClaimMapper.js';

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
        
        // Debug: Log the raw response for troubleshooting
        console.log('[NPHIES] ===== INCOMING RESPONSE =====');
        console.log('[NPHIES] Response Status:', response.status);
        console.log('[NPHIES] Response Headers:', JSON.stringify(response.headers, null, 2));
        
        // Check if response is valid JSON/Bundle
        if (!response.data) {
          console.error('[NPHIES] Empty response received');
          throw new Error('NPHIES returned an empty response');
        }
        
        // Check if response is HTML (usually indicates auth error or server error)
        if (typeof response.data === 'string') {
          console.error('[NPHIES] Received string response instead of JSON:', response.data.substring(0, 500));
          if (response.data.includes('<html') || response.data.includes('<!DOCTYPE')) {
            throw new Error('NPHIES returned an HTML error page. This usually indicates an authentication or server error. Check your NPHIES credentials and connectivity.');
          }
          throw new Error(`NPHIES returned unexpected response: ${response.data.substring(0, 200)}`);
        }
        
        console.log('[NPHIES] Response resourceType:', response.data?.resourceType);
        console.log('[NPHIES] Response Bundle ID:', response.data?.id);
        console.log('[NPHIES] Response Bundle Type:', response.data?.type);
        console.log('[NPHIES] Response Bundle Entries:', response.data?.entry?.length);
        
        // IMPORTANT: Check if NPHIES returned an OperationOutcome directly (not in a Bundle)
        // This happens when there's a validation error with the request
        if (response.data?.resourceType === 'OperationOutcome') {
          console.error('[NPHIES] Received direct OperationOutcome (validation error)');
          console.error('[NPHIES] OperationOutcome:', JSON.stringify(response.data, null, 2));
          
          const issues = response.data.issue || [];
          const nphiesErrors = issues.map(i => {
            const code = i.details?.coding?.[0]?.code || i.code || 'UNKNOWN';
            const display = i.details?.coding?.[0]?.display || i.diagnostics || i.details?.text || 'Unknown error';
            const expression = i.expression ? ` [${i.expression.join(', ')}]` : '';
            return `${i.severity?.toUpperCase() || 'ERROR'}: ${code} - ${display}${expression}`;
          }).join('; ');
          
          throw new Error(`NPHIES Validation Error: ${nphiesErrors || 'Unknown validation error'}`);
        }
        
        // Log ClaimResponse details if present
        const claimResp = response.data?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
        if (claimResp) {
          console.log('[NPHIES] ClaimResponse ID:', claimResp?.id);
          console.log('[NPHIES] ClaimResponse outcome:', claimResp?.outcome);
          console.log('[NPHIES] ClaimResponse preAuthRef:', claimResp?.preAuthRef);
          console.log('[NPHIES] ClaimResponse has extensions:', !!claimResp?.extension, 'count:', claimResp?.extension?.length);
        }
        
        // Check for OperationOutcome errors inside the Bundle
        const operationOutcome = response.data?.entry?.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;
        if (operationOutcome?.issue) {
          console.log('[NPHIES] OperationOutcome issues in Bundle:', JSON.stringify(operationOutcome.issue, null, 2));
        }
        console.log('[NPHIES] ==============================');
        
        // Validate response for prior auth (expects ClaimResponse)
        const validationResult = this.validatePriorAuthResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid prior auth response structure:', validationResult.errors);
          console.error('[NPHIES] Full response data:', JSON.stringify(response.data, null, 2).substring(0, 2000));
          
          // If we got an OperationOutcome inside the bundle, include those errors
          if (operationOutcome?.issue) {
            const nphiesErrors = operationOutcome.issue.map(i => {
              const code = i.details?.coding?.[0]?.code || i.code || 'UNKNOWN';
              const display = i.details?.coding?.[0]?.display || i.diagnostics || i.details?.text || 'Unknown error';
              const expression = i.expression ? ` [${i.expression.join(', ')}]` : '';
              return `${i.severity?.toUpperCase() || 'ERROR'}: ${code} - ${display}${expression}`;
            }).join('; ');
            throw new Error(`NPHIES Error: ${nphiesErrors}`);
          }
          
          throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}. Response type: ${response.data?.resourceType || 'unknown'}`);
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
   * Submit cancel request to NPHIES
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   * 
   * Cancel requests use Task resource and expect Task response
   * MessageHeader.eventCoding = cancel-request
   * Response: Task.status = 'completed' or 'error'
   */
  async submitCancelRequest(requestBundle) {
    let lastError = null;
    
    // Debug: Log the request bundle being sent
    console.log('[NPHIES] ===== OUTGOING CANCEL REQUEST =====');
    console.log('[NPHIES] Request Bundle ID:', requestBundle?.id);
    console.log('[NPHIES] Request Bundle Type:', requestBundle?.type);
    console.log('[NPHIES] Request Bundle Entries:', requestBundle?.entry?.length);
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    console.log('[NPHIES] MessageHeader event:', msgHeader?.eventCoding?.code);
    const task = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Task')?.resource;
    console.log('[NPHIES] Task code:', task?.code?.coding?.[0]?.code);
    console.log('[NPHIES] Task focus:', task?.focus?.identifier?.value);
    console.log('[NPHIES] ======================================');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[NPHIES] Sending cancel request (attempt ${attempt}/${this.retryAttempts})`);
        
        const response = await axios.post(
          `${this.baseURL}/$process-message`,
          requestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout: this.timeout,
            validateStatus: (status) => status < 500
          }
        );

        console.log(`[NPHIES] Cancel response received: ${response.status}`);
        
        // Debug: Log the response bundle received
        console.log('[NPHIES] ===== INCOMING CANCEL RESPONSE =====');
        console.log('[NPHIES] Response Bundle ID:', response.data?.id);
        console.log('[NPHIES] Response Bundle Type:', response.data?.type);
        console.log('[NPHIES] Response Bundle Entries:', response.data?.entry?.length);
        const taskResp = response.data?.entry?.find(e => e.resource?.resourceType === 'Task')?.resource;
        console.log('[NPHIES] Task ID:', taskResp?.id);
        console.log('[NPHIES] Task status:', taskResp?.status);
        console.log('[NPHIES] Task has output:', !!taskResp?.output);
        console.log('[NPHIES] ========================================');
        
        // Validate response for cancel (expects Task)
        const validationResult = this.validateCancelResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid cancel response structure:', validationResult.errors);
          throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}`);
        }

        // Parse the cancel response
        const parsedResponse = this.parseCancelResponse(response.data);

        return {
          success: parsedResponse.success,
          status: response.status,
          data: response.data,
          taskStatus: parsedResponse.taskStatus,
          errors: parsedResponse.errors
        };

      } catch (error) {
        lastError = error;
        console.error(`[NPHIES] Cancel attempt ${attempt} failed:`, error.message);

        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log('[NPHIES] Client error detected, not retrying');
          break;
        }

        if (attempt < this.retryAttempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[NPHIES] Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    return {
      success: false,
      error: this.formatError(lastError)
    };
  }

  /**
   * Parse Cancel Response
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   * 
   * Task.status = 'completed' means cancellation was successful
   * Task.status = 'error' means cancellation failed
   * Task.output with type='error' contains error details
   */
  parseCancelResponse(responseBundle) {
    try {
      const taskResource = responseBundle?.entry?.find(
        e => e.resource?.resourceType === 'Task'
      )?.resource;

      if (!taskResource) {
        return {
          success: false,
          taskStatus: 'error',
          errors: [{ code: 'NO_TASK', message: 'No Task resource in cancel response' }]
        };
      }

      const taskStatus = taskResource.status;
      const isSuccess = taskStatus === 'completed';

      // Extract errors if status is 'error'
      const errors = [];
      if (taskStatus === 'error' && taskResource.output) {
        for (const output of taskResource.output) {
          if (output.type?.coding?.[0]?.code === 'error') {
            const errorCode = output.valueCodeableConcept?.coding?.[0]?.code;
            const errorMessage = output.valueCodeableConcept?.coding?.[0]?.display || 
                                 output.valueCodeableConcept?.text;
            errors.push({
              code: errorCode || 'CANCEL_ERROR',
              message: errorMessage || 'Cancellation failed'
            });
          }
        }
      }

      return {
        success: isSuccess,
        taskStatus,
        taskId: taskResource.id,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        taskStatus: 'error',
        errors: [{ code: 'PARSE_ERROR', message: error.message }]
      };
    }
  }

  /**
   * Submit claim request to NPHIES (use: "claim")
   * Same endpoint as prior auth, but with eventCoding = claim-request
   */
  async submitClaim(requestBundle) {
    let lastError = null;
    
    // Debug: Log the request bundle being sent
    console.log('[NPHIES] ===== OUTGOING CLAIM REQUEST =====');
    console.log('[NPHIES] Request Bundle ID:', requestBundle?.id);
    console.log('[NPHIES] Request Bundle Type:', requestBundle?.type);
    console.log('[NPHIES] Request Bundle Entries:', requestBundle?.entry?.length);
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    console.log('[NPHIES] MessageHeader event:', msgHeader?.eventCoding?.code);
    const claim = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource;
    console.log('[NPHIES] Claim identifier:', claim?.identifier?.[0]?.value);
    console.log('[NPHIES] Claim use:', claim?.use); // Should be "claim"
    console.log('[NPHIES] ====================================');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[NPHIES] Sending claim request (attempt ${attempt}/${this.retryAttempts})`);
        
        const response = await axios.post(
          `${this.baseURL}/$process-message`,
          requestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout: this.timeout,
            validateStatus: (status) => status < 500
          }
        );

        console.log(`[NPHIES] Claim response received: ${response.status}`);
        
        // Debug: Log the response bundle received
        console.log('[NPHIES] ===== INCOMING CLAIM RESPONSE =====');
        console.log('[NPHIES] Response Bundle ID:', response.data?.id);
        console.log('[NPHIES] Response Bundle Type:', response.data?.type);
        console.log('[NPHIES] Response Bundle Entries:', response.data?.entry?.length);
        const claimResp = response.data?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
        console.log('[NPHIES] ClaimResponse ID:', claimResp?.id);
        console.log('[NPHIES] ClaimResponse outcome:', claimResp?.outcome);
        console.log('[NPHIES] ======================================');
        
        // Validate response (expects ClaimResponse - same as prior auth)
        const validationResult = this.validatePriorAuthResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid claim response structure:', validationResult.errors);
          throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}`);
        }

        return {
          success: true,
          status: response.status,
          data: response.data
        };

      } catch (error) {
        lastError = error;
        console.error(`[NPHIES] Claim attempt ${attempt} failed:`, error.message);

        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log('[NPHIES] Client error detected, not retrying');
          break;
        }

        if (attempt < this.retryAttempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[NPHIES] Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

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
   * Validate FHIR response bundle structure for Cancel Request
   * Cancel responses contain Task resource (not ClaimResponse)
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   */
  validateCancelResponse(response) {
    return this.validateBundleResponse(response, ['Task']);
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
  
  /**
   * Poll NPHIES for pending PaymentReconciliation messages
   * This sends a poll request to check for any queued payment messages
   * @param {string} providerId - The provider's nphies ID
   * @returns {Object} - Response containing any pending PaymentReconciliation bundles
   */
  async pollPaymentReconciliations(providerId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID) {
    console.log('[NPHIES] Polling for PaymentReconciliation messages...');
    
    // Build the poll request bundle
    const pollBundle = this.buildPaymentReconciliationPollBundle(providerId);
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,
        pollBundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Poll response received: ${response.status}`);
      
      // Check if we got any PaymentReconciliation bundles
      const paymentReconciliations = this.extractPaymentReconciliationsFromPollResponse(response.data);
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        paymentReconciliations,
        count: paymentReconciliations.length,
        message: paymentReconciliations.length > 0 
          ? `Found ${paymentReconciliations.length} pending payment reconciliation(s)`
          : 'No pending payment reconciliations found',
        pollRequestBundle: pollBundle // Include the poll request bundle
      };
      
    } catch (error) {
      console.error('[NPHIES] Poll error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        paymentReconciliations: [],
        count: 0,
        pollRequestBundle: pollBundle // Include even on error
      };
    }
  }
  
  /**
   * Build a poll request bundle for PaymentReconciliation messages
   */
  buildPaymentReconciliationPollBundle(providerId) {
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    
    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'poll'
            },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
            },
            destination: [{
              endpoint: 'http://nphies.sa',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies-license',
                  value: 'nphies'
                }
              }
            }],
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            }
          }
        },
        // Parameters resource to specify we want PaymentReconciliation messages
        {
          fullUrl: `urn:uuid:${randomUUID()}`,
          resource: {
            resourceType: 'Parameters',
            parameter: [
              {
                name: 'message-type',
                valueCode: 'payment-reconciliation'
              },
              {
                name: 'count',
                valueInteger: 50
              }
            ]
          }
        }
      ]
    };
  }
  
  /**
   * Extract PaymentReconciliation resources from poll response
   */
  extractPaymentReconciliationsFromPollResponse(responseData) {
    const paymentReconciliations = [];
    
    if (!responseData) return paymentReconciliations;
    
    // Response could be a single bundle or a collection of bundles
    if (responseData.resourceType === 'Bundle') {
      // Check if this bundle contains PaymentReconciliation
      const pr = responseData.entry?.find(
        e => e.resource?.resourceType === 'PaymentReconciliation'
      );
      if (pr) {
        paymentReconciliations.push(responseData);
      }
      
      // Or it might be a searchset/collection containing multiple bundles
      if (responseData.type === 'searchset' || responseData.type === 'collection') {
        for (const entry of responseData.entry || []) {
          if (entry.resource?.resourceType === 'Bundle') {
            const nestedPr = entry.resource.entry?.find(
              e => e.resource?.resourceType === 'PaymentReconciliation'
            );
            if (nestedPr) {
              paymentReconciliations.push(entry.resource);
            }
          } else if (entry.resource?.resourceType === 'PaymentReconciliation') {
            // Wrap single PaymentReconciliation in a bundle
            paymentReconciliations.push({
              resourceType: 'Bundle',
              type: 'collection',
              entry: [{ resource: entry.resource }]
            });
          }
        }
      }
    }
    
    return paymentReconciliations;
  }
  
  /**
   * Send Payment Notice (acknowledgement) to NPHIES
   * This is sent by the provider after receiving a PaymentReconciliation
   * @param {Object} paymentNoticeBundle - The PaymentNotice FHIR bundle
   * @returns {Object} - Response from NPHIES
   */
  async sendPaymentNotice(paymentNoticeBundle) {
    console.log('[NPHIES] Sending Payment Notice...');
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,
        paymentNoticeBundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Payment Notice response: ${response.status}`);
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        requestBundle: paymentNoticeBundle
      };
      
    } catch (error) {
      console.error('[NPHIES] Payment Notice error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        requestBundle: paymentNoticeBundle
      };
    }
  }
  
  /**
   * Build a Payment Notice bundle to acknowledge receipt of PaymentReconciliation
   * @param {Object} reconciliation - The payment reconciliation data
   * @param {string} providerId - The provider's NPHIES ID
   * @returns {Object} - FHIR Bundle containing PaymentNotice
   */
  buildPaymentNoticeBundle(reconciliation, providerId) {
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    const paymentNoticeId = randomUUID();
    const today = new Date().toISOString().split('T')[0];
    
    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: new Date().toISOString(),
      entry: [
        // MessageHeader
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'payment-notice'
            },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
            },
            destination: [{
              endpoint: 'http://nphies.sa',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies-license',
                  value: 'nphies'
                }
              }
            }],
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            },
            focus: [{
              reference: `PaymentNotice/${paymentNoticeId}`
            }]
          }
        },
        // PaymentNotice
        {
          fullUrl: `urn:uuid:${paymentNoticeId}`,
          resource: {
            resourceType: 'PaymentNotice',
            id: paymentNoticeId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/payment-notice|1.0.0']
            },
            identifier: [{
              system: `http://provider.nphies.sa/${providerId}/paymentnotice`,
              value: `PN-${Date.now()}`
            }],
            status: 'active',
            created: new Date().toISOString(),
            provider: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            },
            payment: {
              reference: `PaymentReconciliation/${reconciliation.fhir_id}`,
              type: 'PaymentReconciliation',
              identifier: {
                system: reconciliation.identifier_system,
                value: reconciliation.identifier_value
              }
            },
            paymentDate: reconciliation.payment_date ? 
              new Date(reconciliation.payment_date).toISOString().split('T')[0] : today,
            recipient: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: reconciliation.insurer_nphies_id || 'INS-FHIR'
              }
            },
            amount: {
              value: parseFloat(reconciliation.payment_amount) || 0,
              currency: reconciliation.payment_currency || 'SAR'
            },
            paymentStatus: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/paymentstatus',
                code: 'paid'
              }]
            }
          }
        }
      ]
    };
  }

  // ============================================================================
  // COMMUNICATION METHODS
  // ============================================================================

  /**
   * Send Communication to NPHIES
   * Used for both unsolicited (Test Case #1) and solicited (Test Case #2) communications
   * 
   * @param {Object} communicationBundle - FHIR Bundle containing Communication
   * @returns {Object} Response with success status and data
   */
  async sendCommunication(communicationBundle) {
    console.log('[NPHIES] ===== SENDING COMMUNICATION =====');
    console.log('[NPHIES] Bundle ID:', communicationBundle?.id);
    
    const communication = communicationBundle?.entry?.find(
      e => e.resource?.resourceType === 'Communication'
    )?.resource;
    console.log('[NPHIES] Communication ID:', communication?.id);
    console.log('[NPHIES] Communication status:', communication?.status);
    console.log('[NPHIES] About reference:', communication?.about?.[0]?.reference);
    console.log('[NPHIES] BasedOn:', communication?.basedOn?.[0]?.reference || 'None (unsolicited)');
    console.log('[NPHIES] Payload count:', communication?.payload?.length);
    console.log('[NPHIES] ====================================');
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,
        communicationBundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Communication response status: ${response.status}`);
      
      // Log response details
      if (response.data) {
        console.log('[NPHIES] Response Bundle ID:', response.data.id);
        const msgHeader = response.data.entry?.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        console.log('[NPHIES] Response event:', msgHeader?.eventCoding?.code);
        console.log('[NPHIES] Response code:', msgHeader?.response?.code);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        requestBundle: communicationBundle
      };
      
    } catch (error) {
      console.error('[NPHIES] Communication error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        requestBundle: communicationBundle
      };
    }
  }

  /**
   * Send Poll Request to NPHIES
   * 
   * NPHIES Poll is a FHIR Message sent to $process-message:
   * - Endpoint: POST {{baseUrl}}/$process-message
   * - Body: Bundle with MessageHeader (eventCoding: 'poll-request') + Parameters
   * - Returns: Bundle containing queued messages (poll-response)
   * 
   * @param {Object} pollBundle - FHIR Bundle with MessageHeader and Parameters
   * @returns {Object} Response with success status and data
   */
  async sendPoll(pollBundle) {
    console.log('[NPHIES] ===== SENDING POLL REQUEST =====');
    console.log('[NPHIES] Bundle ID:', pollBundle?.id);
    
    // Extract message types for logging
    const params = pollBundle?.entry?.find(
      e => e.resource?.resourceType === 'Parameters'
    )?.resource;
    const messageTypes = params?.parameter
      ?.filter(p => p.name === 'message-type')
      ?.map(p => p.valueCode);
    console.log('[NPHIES] Polling for message types:', messageTypes);
    
    // Verify eventCoding
    const messageHeader = pollBundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    console.log('[NPHIES] EventCoding:', messageHeader?.eventCoding?.code);
    console.log('[NPHIES] Endpoint: $process-message');
    console.log('[NPHIES] =====================================');
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,  // Poll uses $process-message
        pollBundle,                           // Full Bundle with MessageHeader
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Poll response status: ${response.status}`);
      
      // Log what we received
      if (response.data) {
        console.log('[NPHIES] Response type:', response.data.resourceType);
        if (response.data.resourceType === 'Bundle') {
          console.log('[NPHIES] Bundle type:', response.data.type);
          console.log('[NPHIES] Response entries:', response.data.entry?.length || 0);
          
          // Count resource types in response
          const resourceCounts = {};
          for (const entry of response.data.entry || []) {
            const type = entry.resource?.resourceType;
            if (type) {
              resourceCounts[type] = (resourceCounts[type] || 0) + 1;
            }
          }
          console.log('[NPHIES] Resources received:', resourceCounts);
        }
      }
      
      // IMPORTANT: HTTP 200 doesn't mean success - check for errors in response body
      let nphiesSuccess = response.status >= 200 && response.status < 300;
      let responseCode = null;
      let errors = [];
      
      if (response.data?.resourceType === 'Bundle' && response.data?.entry) {
        // Find MessageHeader to check response code
        const respMessageHeader = response.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (respMessageHeader?.response?.code) {
          responseCode = respMessageHeader.response.code;
          // fatal-error or transient-error means failure
          if (responseCode === 'fatal-error' || responseCode === 'transient-error') {
            nphiesSuccess = false;
            console.log(`[NPHIES] Response code indicates error: ${responseCode}`);
          }
        }
        
        // Find Task to extract errors from output
        const respTask = response.data.entry.find(
          e => e.resource?.resourceType === 'Task'
        )?.resource;
        
        if (respTask?.status === 'failed' || respTask?.output) {
          // Extract errors from Task.output
          const errorOutputs = respTask.output?.filter(
            o => o.type?.coding?.some(c => c.code === 'error')
          ) || [];
          
          errors = errorOutputs.map(eo => {
            const coding = eo.valueCodeableConcept?.coding?.[0];
            const expression = coding?.extension?.find(
              ext => ext.url?.includes('error-expression')
            )?.valueString;
            return {
              code: coding?.code || 'unknown',
              message: coding?.display || 'Unknown error',
              expression: expression || null
            };
          });
          
          if (errors.length > 0) {
            nphiesSuccess = false;
            console.log(`[NPHIES] Task contains ${errors.length} error(s):`, errors.map(e => e.code).join(', '));
          }
        }
        
        // Also check for OperationOutcome
        const operationOutcome = response.data.entry.find(
          e => e.resource?.resourceType === 'OperationOutcome'
        )?.resource;
        
        if (operationOutcome?.issue) {
          const ooErrors = operationOutcome.issue
            .filter(issue => issue.severity === 'error' || issue.severity === 'fatal')
            .map(issue => {
              const coding = issue.details?.coding?.[0];
              const expression = coding?.extension?.find(
                ext => ext.url?.includes('error-expression')
              )?.valueString;
              return {
                code: coding?.code || issue.code?.code || 'unknown',
                message: coding?.display || issue.details?.text || issue.diagnostics || 'Unknown error',
                expression: expression || issue.location?.join(', ') || null
              };
            });
          
          if (ooErrors.length > 0) {
            errors.push(...ooErrors);
            nphiesSuccess = false;
            console.log(`[NPHIES] OperationOutcome contains ${ooErrors.length} error(s):`, ooErrors.map(e => e.code).join(', '));
          }
        }
      }
      
      return {
        success: nphiesSuccess,
        status: response.status,
        responseCode: responseCode,
        errors: errors,
        data: response.data,
        pollBundle: pollBundle  // Include the poll bundle for debugging
      };
      
    } catch (error) {
      console.error('[NPHIES] Poll error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        pollBundle: pollBundle
      };
    }
  }

  /**
   * Send Poll Request (alias for backward compatibility)
   */
  async sendPriorAuthPoll(pollBundle) {
    return this.sendPoll(pollBundle);
  }

  /**
   * Send Status Check message to NPHIES
   * 
   * Status Check is used to check the processing status of a prior submission
   * (e.g., a claim that is queued/pended).
   * 
   * Uses the same $process-message endpoint as poll, but with:
   * - eventCoding: 'status-check' (instead of 'poll-request')
   * - Task with 'status-request' profile
   * 
   * @param {Object} statusCheckBundle - FHIR Bundle with status-check message
   * @returns {Object} Response with success status and data
   */
  async sendStatusCheck(statusCheckBundle) {
    console.log('[NPHIES] ===== SENDING STATUS CHECK =====');
    console.log('[NPHIES] Bundle ID:', statusCheckBundle?.id);
    
    // Verify eventCoding
    const messageHeader = statusCheckBundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    console.log('[NPHIES] EventCoding:', messageHeader?.eventCoding?.code);
    
    // Extract focus (the resource we're checking status for)
    const task = statusCheckBundle?.entry?.find(
      e => e.resource?.resourceType === 'Task'
    )?.resource;
    if (task?.focus) {
      console.log('[NPHIES] Checking status for:', task.focus.type, '-', task.focus.identifier?.value);
    }
    console.log('[NPHIES] Endpoint: $process-message');
    console.log('[NPHIES] =====================================');
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,
        statusCheckBundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Status check response status: ${response.status}`);
      
      // Log response details
      if (response.data) {
        console.log('[NPHIES] Response type:', response.data.resourceType);
        if (response.data.resourceType === 'Bundle') {
          console.log('[NPHIES] Bundle type:', response.data.type);
          console.log('[NPHIES] Response entries:', response.data.entry?.length || 0);
        }
      }
      
      // NPHIES FIX: Check for errors in response even if HTTP 200
      // The response code in MessageHeader.response.code indicates actual success/failure
      const responseData = response.data;
      let nphiesSuccess = response.status >= 200 && response.status < 300;
      let responseCode = null;
      let errors = [];
      
      if (responseData?.resourceType === 'Bundle' && responseData?.entry) {
        // Find MessageHeader to check response code
        const respMessageHeader = responseData.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (respMessageHeader?.response?.code) {
          responseCode = respMessageHeader.response.code;
          // fatal-error or transient-error means failure
          if (responseCode === 'fatal-error' || responseCode === 'transient-error') {
            nphiesSuccess = false;
            console.log(`[NPHIES] Response code indicates error: ${responseCode}`);
          }
        }
        
        // Find Task to extract errors from output
        const respTask = responseData.entry.find(
          e => e.resource?.resourceType === 'Task'
        )?.resource;
        
        if (respTask?.status === 'failed' || respTask?.output) {
          // Extract errors from Task.output
          const errorOutputs = respTask.output?.filter(
            o => o.type?.coding?.some(c => c.code === 'error')
          ) || [];
          
          errors = errorOutputs.map(eo => {
            const coding = eo.valueCodeableConcept?.coding?.[0];
            const expression = coding?.extension?.find(
              ext => ext.url?.includes('error-expression')
            )?.valueString;
            return {
              code: coding?.code || 'unknown',
              message: coding?.display || 'Unknown error',
              expression: expression || null
            };
          });
          
          if (errors.length > 0) {
            nphiesSuccess = false;
            console.log(`[NPHIES] Task contains ${errors.length} error(s):`, errors.map(e => e.code).join(', '));
          }
        }
      }
      
      return {
        success: nphiesSuccess,
        status: response.status,
        responseCode: responseCode,
        data: responseData,
        errors: errors,
        statusCheckBundle: statusCheckBundle,
        // Include error message for display
        error: !nphiesSuccess && errors.length > 0 
          ? errors.map(e => `${e.code}: ${e.message}`).join('; ')
          : (!nphiesSuccess ? `NPHIES returned ${responseCode || 'error'}` : null)
      };
      
    } catch (error) {
      console.error('[NPHIES] Status check error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        statusCheckBundle: statusCheckBundle
      };
    }
  }

  /**
   * Build a Poll Request bundle for Prior Authorization messages
   * 
   * @deprecated This method used the wrong structure (Parameters instead of Task).
   * Use CommunicationMapper.buildPollRequestBundle() instead, which follows NPHIES specification.
   * 
   * This method now delegates to CommunicationMapper for backwards compatibility.
   * 
   * @param {string} providerId - Provider NPHIES ID
   * @param {Array} messageTypes - Message types to poll for (ignored - not in Task structure)
   * @param {string} requestIdentifier - Optional: filter by request identifier (ignored - not in Task structure)
   * @param {number} count - Max messages to retrieve (ignored - not in Task structure)
   * @param {string} providerName - Provider organization name (optional)
   * @returns {Object} FHIR Bundle for poll request
   */
  buildPriorAuthPollBundle(providerId, messageTypes = ['priorauth-response', 'communication-request', 'communication'], requestIdentifier = null, count = 50, providerName = 'Healthcare Provider') {
    // Delegate to CommunicationMapper which uses the correct Task-based structure
    // Note: messageTypes, requestIdentifier, and count are not part of the Task-based poll structure
    // They were from the old Parameters-based approach which was incorrect
    const mapper = new CommunicationMapper();
    return mapper.buildPollRequestBundle(providerId, providerName);
  }

  /**
   * Extract ClaimResponses from poll response
   * 
   * @param {Object} responseData - Poll response data
   * @returns {Array} Array of ClaimResponse resources
   */
  extractClaimResponsesFromPoll(responseData) {
    const claimResponses = [];
    
    if (!responseData || responseData.resourceType !== 'Bundle') {
      return claimResponses;
    }

    for (const entry of responseData.entry || []) {
      const resource = entry.resource;
      
      // Direct ClaimResponse
      if (resource?.resourceType === 'ClaimResponse') {
        claimResponses.push(resource);
      }
      
      // Nested in message bundle
      if (resource?.resourceType === 'Bundle' && resource.type === 'message') {
        const nestedCR = resource.entry?.find(
          e => e.resource?.resourceType === 'ClaimResponse'
        )?.resource;
        if (nestedCR) {
          claimResponses.push(nestedCR);
        }
      }
    }
    
    return claimResponses;
  }

  /**
   * Extract CommunicationRequests from poll response
   * 
   * @param {Object} responseData - Poll response data
   * @returns {Array} Array of CommunicationRequest resources
   */
  extractCommunicationRequestsFromPoll(responseData) {
    const communicationRequests = [];
    
    if (!responseData || responseData.resourceType !== 'Bundle') {
      return communicationRequests;
    }

    for (const entry of responseData.entry || []) {
      const resource = entry.resource;
      
      // Direct CommunicationRequest
      if (resource?.resourceType === 'CommunicationRequest') {
        communicationRequests.push(resource);
      }
      
      // Nested in message bundle
      if (resource?.resourceType === 'Bundle' && resource.type === 'message') {
        const nestedCR = resource.entry?.find(
          e => e.resource?.resourceType === 'CommunicationRequest'
        )?.resource;
        if (nestedCR) {
          communicationRequests.push(nestedCR);
        }
      }
    }
    
    return communicationRequests;
  }

  /**
   * Extract Communication acknowledgments from poll response
   * 
   * @param {Object} responseData - Poll response data
   * @returns {Array} Array of Communication resources (acknowledgments)
   */
  extractCommunicationsFromPoll(responseData) {
    const communications = [];
    
    if (!responseData || responseData.resourceType !== 'Bundle') {
      return communications;
    }

    for (const entry of responseData.entry || []) {
      const resource = entry.resource;
      
      // Direct Communication
      if (resource?.resourceType === 'Communication') {
        communications.push(resource);
      }
      
      // Nested in message bundle
      if (resource?.resourceType === 'Bundle' && resource.type === 'message') {
        const nestedComm = resource.entry?.find(
          e => e.resource?.resourceType === 'Communication'
        )?.resource;
        if (nestedComm) {
          communications.push(nestedComm);
        }
      }
    }
    
    return communications;
  }

  // ============================================================================
  // BATCH CLAIM METHODS
  // ============================================================================

  /**
   * Submit Batch Claim Request to NPHIES
   * 
   * Reference: https://portal.nphies.sa/ig/usecase-claim-batch.html
   * 
   * Key points:
   * - All claims in batch must be for the same insurer
   * - Maximum 200 claims per batch
   * - MessageHeader eventCoding = 'batch-request'
   * - Processing is non-real-time - claims are queued for insurer
   * - Responses retrieved via polling
   * 
   * @param {Object} batchRequestBundle - FHIR Bundle with batch-request message
   * @returns {Object} Response with success status and parsed data
   */
  async submitBatchClaim(batchRequestBundle) {
    let lastError = null;
    
    // Debug: Log the request bundle being sent
    console.log('[NPHIES] ===== OUTGOING BATCH CLAIM REQUEST =====');
    console.log('[NPHIES] Bundle ID:', batchRequestBundle?.id);
    console.log('[NPHIES] Bundle Type:', batchRequestBundle?.type);
    console.log('[NPHIES] Bundle Entries:', batchRequestBundle?.entry?.length);
    
    const msgHeader = batchRequestBundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    console.log('[NPHIES] MessageHeader event:', msgHeader?.eventCoding?.code);
    console.log('[NPHIES] Focus references:', msgHeader?.focus?.length);
    
    // Count nested claim bundles
    const nestedBundles = batchRequestBundle?.entry?.filter(
      e => e.resourceType === 'Bundle' || e.resource?.resourceType === 'Bundle'
    );
    console.log('[NPHIES] Nested claim bundles:', nestedBundles?.length || 0);
    console.log('[NPHIES] ==========================================');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[NPHIES] Sending batch claim request (attempt ${attempt}/${this.retryAttempts})`);
        
        const response = await axios.post(
          `${this.baseURL}/$process-message`,
          batchRequestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout: this.timeout * 2, // Double timeout for batch requests
            validateStatus: (status) => status < 500
          }
        );

        console.log(`[NPHIES] Batch claim response received: ${response.status}`);
        
        // Debug: Log the response
        console.log('[NPHIES] ===== INCOMING BATCH CLAIM RESPONSE =====');
        console.log('[NPHIES] Response Status:', response.status);
        console.log('[NPHIES] Response Bundle ID:', response.data?.id);
        console.log('[NPHIES] Response Bundle Type:', response.data?.type);
        console.log('[NPHIES] Response Entries:', response.data?.entry?.length);
        
        // Check for MessageHeader event in response
        const respMsgHeader = response.data?.entry?.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        console.log('[NPHIES] Response event:', respMsgHeader?.eventCoding?.code);
        console.log('[NPHIES] ============================================');
        
        // Handle empty response
        if (!response.data) {
          console.error('[NPHIES] Empty batch response received');
          throw new Error('NPHIES returned an empty response');
        }
        
        // Handle HTML error response
        if (typeof response.data === 'string') {
          console.error('[NPHIES] Received string response instead of JSON');
          if (response.data.includes('<html') || response.data.includes('<!DOCTYPE')) {
            throw new Error('NPHIES returned an HTML error page');
          }
          throw new Error(`NPHIES returned unexpected response: ${response.data.substring(0, 200)}`);
        }
        
        // Handle direct OperationOutcome (validation error)
        if (response.data?.resourceType === 'OperationOutcome') {
          console.error('[NPHIES] Received direct OperationOutcome (validation error)');
          const issues = response.data.issue || [];
          const nphiesErrors = issues.map(i => {
            const code = i.details?.coding?.[0]?.code || i.code || 'UNKNOWN';
            const display = i.details?.coding?.[0]?.display || i.diagnostics || 'Unknown error';
            return `${i.severity?.toUpperCase()}: ${code} - ${display}`;
          }).join('; ');
          throw new Error(`NPHIES Validation Error: ${nphiesErrors}`);
        }
        
        // Validate batch response structure
        const validationResult = this.validateBatchClaimResponse(response.data);
        if (!validationResult.valid) {
          console.error('[NPHIES] Invalid batch response structure:', validationResult.errors);
          
          // Check for OperationOutcome in bundle
          const operationOutcome = response.data?.entry?.find(
            e => e.resource?.resourceType === 'OperationOutcome'
          )?.resource;
          
          if (operationOutcome?.issue) {
            const nphiesErrors = operationOutcome.issue.map(i => {
              const code = i.details?.coding?.[0]?.code || i.code || 'UNKNOWN';
              const display = i.details?.coding?.[0]?.display || i.diagnostics || 'Unknown error';
              return `${i.severity?.toUpperCase()}: ${code} - ${display}`;
            }).join('; ');
            throw new Error(`NPHIES Error: ${nphiesErrors}`);
          }
          
          throw new Error(`Invalid batch response: ${validationResult.errors.join(', ')}`);
        }
        
        // Parse the batch response
        const parsedResponse = batchClaimMapper.parseBatchClaimResponse(response.data);
        
        return {
          success: parsedResponse.success,
          status: response.status,
          data: response.data,
          parsedResponse,
          hasQueuedClaims: parsedResponse.hasQueuedClaims,
          hasPendedClaims: parsedResponse.hasPendedClaims,
          claimResponses: parsedResponse.claimResponses,
          errors: parsedResponse.errors
        };

      } catch (error) {
        lastError = error;
        console.error(`[NPHIES] Batch claim attempt ${attempt} failed:`, error.message);

        // Don't retry on 4xx errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log('[NPHIES] Client error detected, not retrying');
          break;
        }

        // Wait before retrying
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
      error: this.formatError(lastError),
      claimResponses: [],
      errors: [{ code: 'SUBMIT_FAILED', message: lastError?.message || 'Batch submission failed' }]
    };
  }

  /**
   * Validate Batch Claim Response structure
   * 
   * Expected structure:
   * - Bundle (type: message, eventCoding: batch-response)
   *   - MessageHeader
   *   - ClaimResponse bundles or OperationOutcome
   * 
   * @param {Object} response - NPHIES response bundle
   * @returns {Object} Validation result with valid flag and errors
   */
  validateBatchClaimResponse(response) {
    return batchClaimMapper.validateBatchClaimResponse(response);
  }

  /**
   * Poll for deferred batch claim responses
   * 
   * After submitting a batch, claims are queued for insurer processing.
   * Use this method to poll for the adjudicated responses.
   * 
   * @param {Object} provider - Provider organization with nphies_id
   * @param {string} batchIdentifier - Optional: filter by batch identifier
   * @returns {Object} Response with claim responses
   */
  async pollBatchClaimResponses(provider, batchIdentifier = null) {
    console.log('[NPHIES] ===== POLLING FOR BATCH CLAIM RESPONSES =====');
    console.log('[NPHIES] Provider ID:', provider?.nphies_id);
    console.log('[NPHIES] Batch Identifier:', batchIdentifier || 'All');
    console.log('[NPHIES] ================================================');
    
    // Build poll request bundle
    const pollBundle = batchClaimMapper.buildBatchPollRequestBundle(provider, batchIdentifier);
    
    try {
      const response = await axios.post(
        `${this.baseURL}/$process-message`,
        pollBundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          },
          timeout: this.timeout,
          validateStatus: (status) => status < 500
        }
      );
      
      console.log(`[NPHIES] Poll response received: ${response.status}`);
      
      // Debug response
      console.log('[NPHIES] Response Bundle ID:', response.data?.id);
      console.log('[NPHIES] Response entries:', response.data?.entry?.length);
      
      // Extract ClaimResponses from poll response
      const claimResponses = this.extractClaimResponsesFromPoll(response.data);
      console.log('[NPHIES] ClaimResponses found:', claimResponses.length);
      
      // Parse each claim response
      const parsedResponses = claimResponses.map(cr => 
        batchClaimMapper.parseClaimResponseResource(cr)
      );
      
      // Check for errors in response
      let success = response.status >= 200 && response.status < 300;
      let errors = [];
      
      // Check MessageHeader response code
      const respMsgHeader = response.data?.entry?.find(
        e => e.resource?.resourceType === 'MessageHeader'
      )?.resource;
      
      if (respMsgHeader?.response?.code === 'fatal-error' || 
          respMsgHeader?.response?.code === 'transient-error') {
        success = false;
        errors.push({ code: respMsgHeader.response.code, message: 'Poll request failed' });
      }
      
      // Check for OperationOutcome errors
      const operationOutcome = response.data?.entry?.find(
        e => e.resource?.resourceType === 'OperationOutcome'
      )?.resource;
      
      if (operationOutcome?.issue) {
        const ooErrors = batchClaimMapper.parseOperationOutcome(operationOutcome);
        const fatalErrors = ooErrors.filter(e => e.severity === 'error' || e.severity === 'fatal');
        if (fatalErrors.length > 0) {
          success = false;
          errors.push(...fatalErrors);
        }
      }
      
      return {
        success,
        status: response.status,
        data: response.data,
        claimResponses: parsedResponses,
        count: parsedResponses.length,
        errors,
        pollBundle,
        message: parsedResponses.length > 0
          ? `Found ${parsedResponses.length} claim response(s)`
          : 'No pending claim responses found'
      };
      
    } catch (error) {
      console.error('[NPHIES] Poll error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        claimResponses: [],
        count: 0,
        pollBundle
      };
    }
  }
}

export default new NphiesService();

