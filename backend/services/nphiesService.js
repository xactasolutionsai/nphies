import { validateNphiesTransport } from '../config/nphiesTransport.js';
import { operationOutcomeErrors } from '../utils/nphiesErrors.js';
import { originalPayment, paymentError, validDate } from '../utils/paymentValidation.js';
import { paymentNoticeContext } from '../utils/paymentNoticeContext.js';
/**
 * NPHIES API Service
 * Handles communication with NPHIES OBA test environment
 * Endpoint: ${NPHIES_BASE_URL}/$process-message
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import { NPHIES_CONFIG } from '../config/nphies.js';
import CommunicationMapper from './communicationMapper.js';
import batchClaimMapper from './claimMapper/BatchClaimMapper.js';

// Connection errors raised before any byte of the request left this host. Only these
// prove NPHIES never received a message, so only these allow a non-idempotent re-send.
const NOT_SENT_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

// Full request/response bundles contain patient data; log them only when explicitly enabled.
import { debugBundlesEnabled, providerTypeCoding } from './priorAuthMapper/nphiesIdentity.js';

function describeOutcomeIssues(issues = []) {
  return issues.map(i => {
    const code = i.details?.coding?.[0]?.code || i.code || 'UNKNOWN';
    const display = i.details?.coding?.[0]?.display || i.diagnostics || i.details?.text || 'Unknown error';
    const expression = i.expression ? ` [${i.expression.join(', ')}]` : '';
    return `${i.severity?.toUpperCase() || 'ERROR'}: ${code} - ${display}${expression}`;
  }).join('; ');
}

class NphiesService {
  constructor() {
    this._baseURLOverride = null;
    this.timeout = parseInt(process.env.NPHIES_TIMEOUT || '60000');
    this.retryAttempts = parseInt(process.env.NPHIES_RETRY_ATTEMPTS || '3');
  }

  // Read from config at call time so a missing NPHIES_BASE_URL fails clearly
  // instead of silently targeting a hardcoded host. Tests may override it.
  get baseURL() {
    return this._baseURLOverride || NPHIES_CONFIG.BASE_URL;
  }

  set baseURL(value) {
    this._baseURLOverride = value;
  }

  /**
   * Whether a failed attempt may be sent again.
   * - 4xx: never (the request itself is wrong).
   * - Idempotent messages (eligibility): retry on timeouts, 5xx and invalid bodies.
   * - Non-idempotent messages (prior auth, claim, cancel, batch): retry only when the
   *   connection error proves nothing was sent. A timeout, a 5xx or a 200 carrying an
   *   error may mean NPHIES already processed the message, so re-POSTing it could
   *   create a duplicate submission.
   */
  canRetry(error, idempotent) {
    const status = error?.response?.status;
    if (error?.transportConfigError) return false;
    if (status >= 400 && status < 500) return false;
    if (idempotent) return true;
    return !error?.response && NOT_SENT_ERROR_CODES.has(error?.code);
  }

  /**
   * POST a message bundle to $process-message, applying the retry policy above.
   * handleResponse receives the axios response and returns the success result, or throws.
   */
  async postMessage(label, requestBundle, handleResponse, { idempotent = false, timeout = this.timeout } = {}) {
    const attempts = Math.max(1, Number.isFinite(this.retryAttempts) ? this.retryAttempts : 1);
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let httpResponse;
      try {
        console.log(`[NPHIES] Sending ${label} (attempt ${attempt}/${attempts})`);
        try {
          validateNphiesTransport(this.baseURL);
        } catch (configError) {
          configError.transportConfigError = true;
          throw configError;
        }
        httpResponse = await axios.post(
          `${this.baseURL}/$process-message`,
          requestBundle,
          {
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            timeout,
            validateStatus: (status) => status < 500 // Accept 4xx responses as valid
          }
        );
        console.log(`[NPHIES] ${label} response received: ${httpResponse.status}`);
        return await handleResponse(httpResponse);
      } catch (error) {
        if (httpResponse && !error.response) error.response = httpResponse;
        lastError = error;
        console.error(`[NPHIES] ${label} attempt ${attempt} failed:`, error.message);

        if (!this.canRetry(error, idempotent)) {
          if (!idempotent && !error.transportConfigError && !NOT_SENT_ERROR_CODES.has(error.code)) {
            console.log(`[NPHIES] ${label} may have reached NPHIES; not re-sending (reconcile via poll/status-check)`);
          } else {
            console.log('[NPHIES] Error is not retryable');
          }
          break;
        }

        if (attempt < attempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[NPHIES] Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    const notSent = lastError?.transportConfigError || (!lastError?.response && NOT_SENT_ERROR_CODES.has(lastError?.code));
    return {
      success: false,
      // 'unknown' means the message may have been processed; do not blindly resubmit.
      deliveryState: notSent ? 'not-sent' : (lastError?.response?.status >= 400 && lastError.response.status < 500 ? 'rejected' : 'unknown'),
      error: this.formatError(lastError)
    };
  }

  /**
   * Send eligibility request to NPHIES (idempotent: safe to retry)
   */
  async checkEligibility(requestBundle) {
    return this.postMessage('eligibility request', requestBundle, response => {
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
    }, { idempotent: true });
  }

  /**
   * Submit prior authorization request to NPHIES (not idempotent)
   */
  async submitPriorAuth(requestBundle) {
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    const claim = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource;
    console.log('[NPHIES] Outgoing prior authorization:', JSON.stringify({
      bundleId: requestBundle?.id, entries: requestBundle?.entry?.length,
      event: msgHeader?.eventCoding?.code, claimIdentifier: claim?.identifier?.[0]?.value
    }));

    return this.postMessage('prior authorization request', requestBundle, response => {
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

      const claimResp = response.data?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      console.log('[NPHIES] Incoming prior authorization response:', JSON.stringify({
        resourceType: response.data?.resourceType, bundleId: response.data?.id, entries: response.data?.entry?.length,
        claimResponseId: claimResp?.id, outcome: claimResp?.outcome
      }));

      // IMPORTANT: Check if NPHIES returned an OperationOutcome directly (not in a Bundle)
      // This happens when there's a validation error with the request
      if (response.data?.resourceType === 'OperationOutcome') {
        console.error('[NPHIES] Received direct OperationOutcome (validation error)');
        throw new Error(`NPHIES Validation Error: ${describeOutcomeIssues(response.data.issue) || 'Unknown validation error'}`);
      }

      // Check for OperationOutcome errors inside the Bundle
      const operationOutcome = response.data?.entry?.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;
      if (operationOutcome?.issue) {
        console.log('[NPHIES] OperationOutcome issues in Bundle:', describeOutcomeIssues(operationOutcome.issue));
      }

      // Validate response for prior auth (expects ClaimResponse)
      const validationResult = this.validatePriorAuthResponse(response.data);
      if (!validationResult.valid) {
        console.error('[NPHIES] Invalid prior auth response structure:', validationResult.errors);
        if (debugBundlesEnabled()) {
          console.error('[NPHIES] Full response data:', JSON.stringify(response.data, null, 2).substring(0, 2000));
        }

        // If we got an OperationOutcome inside the bundle, include those errors
        if (operationOutcome?.issue) {
          throw new Error(`NPHIES Error: ${describeOutcomeIssues(operationOutcome.issue)}`);
        }

        throw new Error(`Invalid NPHIES response: ${validationResult.errors.join(', ')}. Response type: ${response.data?.resourceType || 'unknown'}`);
      }

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    });
  }

  /**
   * Submit cancel request to NPHIES (not idempotent)
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   *
   * Cancel requests use Task resource and expect Task response
   * MessageHeader.eventCoding = cancel-request
   * Response: Task.status = 'completed' or 'error'
   */
  async submitCancelRequest(requestBundle) {
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    const task = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Task')?.resource;
    console.log('[NPHIES] Outgoing cancel request:', JSON.stringify({
      bundleId: requestBundle?.id, entries: requestBundle?.entry?.length, event: msgHeader?.eventCoding?.code,
      taskCode: task?.code?.coding?.[0]?.code, focus: task?.focus?.identifier?.value
    }));

    return this.postMessage('cancel request', requestBundle, response => {
      const taskResp = response.data?.entry?.find(e => e.resource?.resourceType === 'Task')?.resource;
      console.log('[NPHIES] Incoming cancel response:', JSON.stringify({
        bundleId: response.data?.id, entries: response.data?.entry?.length, taskId: taskResp?.id, taskStatus: taskResp?.status
      }));

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
        reissueReason: parsedResponse.reissueReason,
        errors: parsedResponse.errors
      };
    });
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

      // Extract reissue_reason from ClaimResponse if present
      let reissueReason = null;
      const claimResponseResource = responseBundle?.entry?.find(
        e => e.resource?.resourceType === 'ClaimResponse'
      )?.resource;
      if (claimResponseResource?.extension) {
        const reissueExt = claimResponseResource.extension.find(
          e => e.url?.includes('extension-adjudication-reissue')
        );
        reissueReason = reissueExt?.valueCodeableConcept?.coding?.[0]?.code || null;
      }

      return {
        success: isSuccess,
        taskStatus,
        taskId: taskResource.id,
        reissueReason,
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
   * Submit claim request to NPHIES (use: "claim"; not idempotent)
   * Same endpoint as prior auth, but with eventCoding = claim-request
   */
  async submitClaim(requestBundle) {
    const msgHeader = requestBundle?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    const claim = requestBundle?.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource;
    console.log('[NPHIES] Outgoing claim request:', JSON.stringify({
      bundleId: requestBundle?.id, entries: requestBundle?.entry?.length, event: msgHeader?.eventCoding?.code,
      claimIdentifier: claim?.identifier?.[0]?.value, use: claim?.use
    }));

    return this.postMessage('claim request', requestBundle, response => {
      const claimResp = response.data?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      console.log('[NPHIES] Incoming claim response:', JSON.stringify({
        bundleId: response.data?.id, entries: response.data?.entry?.length, claimResponseId: claimResp?.id, outcome: claimResp?.outcome
      }));

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
    });
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
      const payload = error.response.data;
      const outcome = payload?.resourceType === 'OperationOutcome' ? payload :
        payload?.entry?.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;
      const issues = operationOutcomeErrors(outcome);
      const status = error.response.status;
      // A 2xx whose body failed validation (HTML page, missing ClaimResponse, ...) is reported
      // with the error that was thrown, not the HTTP status text ("OK").
      const fallback = status >= 200 && status < 300
        ? (error.message || error.response.statusText || 'Invalid NPHIES response')
        : (error.response.statusText || error.message || 'HTTP Error');
      return {
        code: `HTTP_${status}`,
        message: issues.length ? issues.map(i => `${i.code}: ${i.message}${i.location ? ` [${i.location}]` : ''}`).join('; ') : fallback,
        errors: issues,
        details: error.response.data,
        status
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
   * Poll NPHIES for pending PaymentReconciliation messages
   * This sends a poll request to check for any queued payment messages
   * @param {string} providerId - The provider's nphies ID
   * @returns {Object} - Response containing any pending PaymentReconciliation bundles
   */
  async pollPaymentReconciliations(providerId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID) {
    const pollBundle = this.buildPaymentReconciliationPollBundle(providerId);
    const result = await this.sendPoll(pollBundle);
    const header = result.data?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    const success = result.success && result.status >= 200 && result.status < 300 &&
      header?.response?.code === 'ok' && header.response.identifier === pollBundle.entry[0].resource.id;
    const paymentReconciliations = success ? this.extractPaymentReconciliationsFromPollResponse(result.data) : [];
    return { ...result, success: Boolean(success), paymentReconciliations,
      count: paymentReconciliations.length, pollRequestBundle: pollBundle,
      error: success ? undefined : (result.error || 'Payment poll rejected or response correlation failed') };
  }

  buildPaymentReconciliationPollBundle(providerId) {
    return new CommunicationMapper().buildPollRequestBundle(providerId, 'Healthcare Provider', '1', {
      input: { count: 100, includeMessageTypes: ['payment-reconciliation'] }
    });
  }
  /**
   * Extract PaymentReconciliation resources from poll response
   */
  extractPaymentReconciliationsFromPollResponse(responseData) {
    const bundles = [];
    const visit = bundle => {
      if (bundle?.resourceType !== 'Bundle') return;
      if (bundle.entry?.some(e => e.resource?.resourceType === 'PaymentReconciliation')) bundles.push(bundle);
      for (const entry of bundle.entry || []) if (entry.resource?.resourceType === 'Bundle') visit(entry.resource);
    };
    visit(responseData);
    return bundles;
  }

  async sendPaymentNotice(paymentNoticeBundle) {
    let response;
    try {
      validateNphiesTransport(this.baseURL);
      response = await axios.post(this.baseURL+'/$process-message', paymentNoticeBundle, {
        headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' },
        timeout: this.timeout, maxRedirects: 0, validateStatus: () => true
      });
    } catch (error) {
      return { success: false, deliveryState: 'unknown', error: this.formatError(error), data: error.response?.data,
        status: error.response?.status, requestBundle: paymentNoticeBundle };
    }
    const data = response.data;
    const header = data?.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    const requestHeader = paymentNoticeBundle.entry?.[0]?.resource;
    const correlated = !!requestHeader?.id && header?.response?.identifier === requestHeader.id;
    const outcomes = data?.resourceType === 'OperationOutcome' ? [data] : (data?.entry || []).filter(e => e.resource?.resourceType === 'OperationOutcome').map(e => e.resource);
    const errors = outcomes.flatMap(operationOutcomeErrors).filter(e => ['error','fatal'].includes(e.severity));
    const success = response.status >= 200 && response.status < 300 && data?.type === 'message' && correlated && header?.response?.code === 'ok' && !errors.length;
    const rejected = (correlated && ['fatal-error','transient-error'].includes(header?.response?.code)) ||
      (response.status >= 400 && response.status < 500 && errors.length > 0);
    if (!success && !errors.length) errors.push({code:'ACKNOWLEDGEMENT_NOT_CONFIRMED',message:'Expected a correlated ok acknowledgement; reconcile this attempt before resending.'});
    return { success, deliveryState: success?'accepted':rejected?'rejected':'unknown', status:response.status, data,
      nphiesErrors: errors, nphiesResponseCode: header?.response?.code || null, requestBundle: paymentNoticeBundle };
  }

  buildPaymentNoticeBundle(reconciliation, providerId, provider = {}, paymentStatus = 'paid', receipt = {}) {
    const paymentIdentifier = paymentNoticeContext(reconciliation, providerId);
    const { pr: original, header: originalHeader } = originalPayment(reconciliation);
    const amount = original.paymentAmount;
    if (typeof amount?.value !== 'number' || !Number.isFinite(amount.value) || amount.value < 0 || amount.currency !== 'SAR') throw paymentError('Original reconciliation must contain a nonnegative SAR payment amount');
    const paymentDate = receipt.receivedDate || original.paymentDate;
    if (!validDate(paymentDate) || paymentDate > new Date().toISOString().slice(0, 10)) throw paymentError('Payment receipt date must be valid and not in the future');

    const validStatuses = ['paid', 'cleared'];
    if (!validStatuses.includes(paymentStatus)) throw paymentError('Invalid payment status', 400);
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    const paymentNoticeId = randomUUID();
    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || originalHeader.destination[0].endpoint;
    
    const providerOrgId = provider.provider_id?.toString() || randomUUID();
    const providerOrgFullUrl = `${providerEndpoint}/Organization/${providerOrgId}`;
    const paymentNoticeFullUrl = `${providerEndpoint}/PaymentNotice/${paymentNoticeId}`;
    
    const { code: providerTypeCode, display: providerTypeDisplay } = providerTypeCoding(provider.provider_type);
    
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
              code: 'payment-notice'
            },
            destination: [{
              endpoint: 'http://nphies.sa',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies',
                  value: 'NPHIES'
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
            source: {
              endpoint: providerEndpoint
            },
            focus: [{
              reference: paymentNoticeFullUrl
            }]
          }
        },
        {
          fullUrl: paymentNoticeFullUrl,
          resource: {
            resourceType: 'PaymentNotice',
            id: paymentNoticeId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/payment-notice|1.0.0']
            },
            identifier: [{
              system: `http://provider.nphies.sa/${providerId}/paymentnotice`,
              value: `PN-${paymentNoticeId}`
            }],
            status: 'active',
            created: new Date().toISOString(),
            provider: {
              reference: providerOrgFullUrl
            },
            payment: {
              identifier: {
                system: paymentIdentifier.system,
                value: paymentIdentifier.value
              }
            },
            paymentDate,
            payee: {
              reference: providerOrgFullUrl
            },
            recipient: {
              type: 'Organization',
              identifier: {
                type: {
                  coding: [{
                    system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                    code: 'other'
                  }]
                },
                system: 'http://nphies.sa/license/nphies',
                value: 'NPHIES'
              }
            },
            amount: {
              value: amount.value,
              currency: amount.currency
            },
            paymentStatus: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/paymentstatus',
                code: paymentStatus
              }]
            }
          }
        },
        {
          fullUrl: providerOrgFullUrl,
          resource: {
            resourceType: 'Organization',
            id: providerOrgId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0']
            },
            extension: [{
              url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type',
              valueCodeableConcept: {
                coding: [{
                  system: 'http://nphies.sa/terminology/CodeSystem/provider-type',
                  code: providerTypeCode,
                  display: providerTypeDisplay
                }]
              }
            }],
            identifier: [{
              system: 'http://nphies.sa/license/provider-license',
              value: providerId
            }],
            active: true,
            type: [{
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                code: 'prov'
              }]
            }],
            name: provider.provider_name || 'Provider Organization'
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
    const communication = communicationBundle?.entry?.find(
      e => e.resource?.resourceType === 'Communication'
    )?.resource;
    // Ids and counts only: subject/about/payloads carry patient data.
    console.log('[NPHIES] Sending communication:', JSON.stringify({
      bundleId: communicationBundle?.id, communicationId: communication?.id, status: communication?.status,
      solicited: !!communication?.basedOn, payloadCount: communication?.payload?.length || 0
    }));
    if (debugBundlesEnabled()) {
      console.log('[NPHIES] Communication bundle:', JSON.stringify(communicationBundle));
    }
    
    try {
      validateNphiesTransport(this.baseURL);
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
      // Capture error response data (e.g. from 5xx responses) so it can be saved as response_bundle
      const errorResponseData = error.response?.data || null;
      if (errorResponseData) {
        console.log('[NPHIES] Error response data available, status:', error.response?.status);
      }
      return {
        success: false,
        status: error.response?.status || null,
        data: errorResponseData,
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
    // Poll bundles are Task-based; log the Task inputs rather than legacy Parameters.
    const pollTask = pollBundle?.entry?.find(
      e => e.resource?.resourceType === 'Task'
    )?.resource;
    const messageHeader = pollBundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    console.log('[NPHIES] Sending poll request:', JSON.stringify({
      bundleId: pollBundle?.id, event: messageHeader?.eventCoding?.code,
      taskInputs: (pollTask?.input || []).map(i => i.type?.coding?.[0]?.code).filter(Boolean)
    }));
    
    try {
      validateNphiesTransport(this.baseURL);
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
      validateNphiesTransport(this.baseURL);
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
   * Extract ClaimResponses paired with their containing message bundles from poll response.
   * Returns { claimResponse, messageBundle } pairs so callers can store the full bundle
   * (which includes Patient, Coverage, Organization resources alongside ClaimResponse).
   * 
   * @param {Object} responseData - Poll response data
   * @returns {Array<{claimResponse: Object, messageBundle: Object|null}>}
   */
  extractClaimResponsesWithBundlesFromPoll(responseData) {
    const results = [];

    if (!responseData || responseData.resourceType !== 'Bundle') {
      return results;
    }

    for (const entry of responseData.entry || []) {
      const resource = entry.resource;

      if (resource?.resourceType === 'ClaimResponse') {
        results.push({ claimResponse: resource, messageBundle: null });
      }

      if (resource?.resourceType === 'Bundle' && resource.type === 'message') {
        const nestedCR = resource.entry?.find(
          e => e.resource?.resourceType === 'ClaimResponse'
        )?.resource;
        if (nestedCR) {
          results.push({ claimResponse: nestedCR, messageBundle: resource });
        }
      }
    }

    return results;
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
    const msgHeader = batchRequestBundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    const nestedBundles = batchRequestBundle?.entry?.filter(
      e => e.resourceType === 'Bundle' || e.resource?.resourceType === 'Bundle'
    );
    console.log('[NPHIES] Outgoing batch claim request:', JSON.stringify({
      bundleId: batchRequestBundle?.id, entries: batchRequestBundle?.entry?.length, event: msgHeader?.eventCoding?.code,
      focusCount: msgHeader?.focus?.length, nestedBundles: nestedBundles?.length || 0
    }));

    const result = await this.postMessage('batch claim request', batchRequestBundle, response => {
      const respMsgHeader = response.data?.entry?.find(
        e => e.resource?.resourceType === 'MessageHeader'
      )?.resource;
      console.log('[NPHIES] Incoming batch claim response:', JSON.stringify({
        bundleId: response.data?.id, type: response.data?.type, entries: response.data?.entry?.length,
        event: respMsgHeader?.eventCoding?.code
      }));

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
        throw new Error(`NPHIES Validation Error: ${describeOutcomeIssues(response.data.issue)}`);
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
          throw new Error(`NPHIES Error: ${describeOutcomeIssues(operationOutcome.issue)}`);
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
    }, { timeout: this.timeout * 2 }); // Double timeout for batch requests

    if (result.success === false && result.error && !result.parsedResponse) {
      return {
        ...result,
        claimResponses: [],
        errors: [{ code: 'SUBMIT_FAILED', message: result.error.message || 'Batch submission failed' }]
      };
    }
    return result;
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
    
    let pollBundle = null;
    try {
      // Build poll request bundle (inside try so builder errors are reported, not thrown)
      pollBundle = batchClaimMapper.buildBatchPollRequestBundle(provider, batchIdentifier);
      validateNphiesTransport(this.baseURL);
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
