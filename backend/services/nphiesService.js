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
  async pollPaymentReconciliations(providerId = 'PR-FHIR') {
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
   * Send Poll Request to NPHIES for Prior Authorization messages
   * Polls for: priorauth-response, communication-request, communication
   * 
   * @param {Object} pollBundle - FHIR Bundle containing poll request
   * @returns {Object} Response with success status and data
   */
  async sendPriorAuthPoll(pollBundle) {
    console.log('[NPHIES] ===== SENDING POLL REQUEST =====');
    console.log('[NPHIES] Bundle ID:', pollBundle?.id);
    
    const params = pollBundle?.entry?.find(
      e => e.resource?.resourceType === 'Parameters'
    )?.resource;
    const messageTypes = params?.parameter
      ?.filter(p => p.name === 'message-type')
      ?.map(p => p.valueCode);
    console.log('[NPHIES] Polling for message types:', messageTypes);
    console.log('[NPHIES] ==================================');
    
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
      
      console.log(`[NPHIES] Poll response status: ${response.status}`);
      
      // Log what we received
      if (response.data) {
        console.log('[NPHIES] Response Bundle type:', response.data.type);
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
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        requestBundle: pollBundle
      };
      
    } catch (error) {
      console.error('[NPHIES] Poll error:', error.message);
      return {
        success: false,
        error: this.formatError(error),
        requestBundle: pollBundle
      };
    }
  }

  /**
   * Build a Poll Request bundle for Prior Authorization messages
   * 
   * @param {string} providerId - Provider NPHIES ID
   * @param {Array} messageTypes - Message types to poll for
   * @param {string} requestIdentifier - Optional: filter by request identifier
   * @param {number} count - Max messages to retrieve
   * @returns {Object} FHIR Bundle for poll request
   */
  buildPriorAuthPollBundle(providerId, messageTypes = ['priorauth-response', 'communication-request', 'communication'], requestIdentifier = null, count = 50) {
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    const parametersId = randomUUID();

    const parameters = [
      ...messageTypes.map(type => ({
        name: 'message-type',
        valueCode: type
      })),
      {
        name: 'count',
        valueInteger: count
      }
    ];

    // Add request identifier filter if provided
    if (requestIdentifier) {
      parameters.push({
        name: 'request-identifier',
        valueIdentifier: {
          system: 'http://provider.com/prior-auth',
          value: requestIdentifier
        }
      });
    }

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
        {
          fullUrl: `urn:uuid:${parametersId}`,
          resource: {
            resourceType: 'Parameters',
            id: parametersId,
            parameter: parameters
          }
        }
      ]
    };
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
}

export default new NphiesService();

