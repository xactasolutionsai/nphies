/**
 * NPHIES Batch Claim Mapper
 * Builds batch claim bundles for submitting multiple claims in a single request
 * 
 * Reference: https://portal.nphies.sa/ig/usecase-claim-batch.html
 * 
 * Key Requirements:
 * - All claims in batch MUST be for the same insurer
 * - Batch size MUST NOT exceed 200 claims
 * - Each claim MUST have batch extensions: batch-identifier, batch-number, batch-period
 * - MessageHeader eventCoding = 'batch-request' (not 'claim-request')
 * - Processing is non-real-time - claims are queued for insurer processing
 * - Responses are retrieved via Polling use case
 */

import { randomUUID } from 'crypto';
import { NPHIES_CONFIG } from '../../config/nphies.js';
import { getClaimMapper } from './index.js';

class BatchClaimMapper {
  constructor() {
    this.generateId = () => randomUUID();
    this.MAX_BATCH_SIZE = 200;
  }

  // ============================================
  // DATE FORMATTING UTILITIES
  // ============================================

  formatDate(date) {
    if (!date) return null;
    if (typeof date === 'string') {
      if (date.includes('T')) return date.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    }
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateTime(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  formatDateTimeWithTimezone(date) {
    if (!date) date = new Date();
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate batch constraints before building
   * @param {Array} claims - Array of claim data objects
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateBatchConstraints(claims) {
    const errors = [];

    // Check minimum claims (at least 2 for batch)
    if (!claims || claims.length < 2) {
      errors.push('Batch must contain at least 2 claims');
    }

    // Check maximum batch size
    if (claims && claims.length > this.MAX_BATCH_SIZE) {
      errors.push(`Batch cannot exceed ${this.MAX_BATCH_SIZE} claims. Current: ${claims.length}`);
    }

    // Check all claims are for the same insurer
    if (claims && claims.length > 0) {
      const insurerIds = new Set(claims.map(c => 
        c.insurer?.insurer_id || c.insurer_id || c.claim?.insurer_id
      ));
      if (insurerIds.size > 1) {
        errors.push('All claims in a batch must be for the same insurer');
      }
    }

    // Check all claims have required data
    if (claims) {
      claims.forEach((claim, idx) => {
        const claimData = claim.claim || claim;
        if (!claimData.patient_id && !claim.patient) {
          errors.push(`Claim ${idx + 1}: Missing patient`);
        }
        if (!claimData.provider_id && !claim.provider) {
          errors.push(`Claim ${idx + 1}: Missing provider`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============================================
  // BATCH BUNDLE BUILDER
  // ============================================

  /**
   * Build a batch claim request bundle
   * 
   * Structure:
   * - Outer Bundle (type: message, eventCoding: batch-request)
   *   - MessageHeader (focus references all inner claim bundles)
   *   - Claim Request Bundle #1 (type: message, eventCoding: claim-request)
   *   - Claim Request Bundle #2
   *   - ...
   * 
   * @param {Object} data - Batch data
   * @param {string} data.batchIdentifier - Unique batch identifier
   * @param {Date} data.batchPeriodStart - Batch period start date
   * @param {Date} data.batchPeriodEnd - Batch period end date
   * @param {Array} data.claims - Array of claim data objects (each with claim, patient, provider, insurer, coverage)
   * @param {Object} data.provider - Provider organization
   * @param {Object} data.insurer - Insurer organization
   * @returns {Object} - FHIR Bundle for batch claim request
   */
  buildBatchClaimRequestBundle(data) {
    const { 
      batchIdentifier, 
      batchPeriodStart, 
      batchPeriodEnd, 
      claims, 
      provider, 
      insurer 
    } = data;

    // Validate batch constraints
    const validation = this.validateBatchConstraints(claims);
    if (!validation.valid) {
      throw new Error(`Batch validation failed: ${validation.errors.join('; ')}`);
    }

    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const timestamp = this.formatDateTimeWithTimezone(new Date());

    // Build individual claim bundles with batch extensions
    const claimBundles = [];
    const focusReferences = [];

    claims.forEach((claimData, index) => {
      const batchNumber = index + 1;
      
      // Get the appropriate claim mapper based on claim type
      const claimType = claimData.claim?.claim_type || claimData.claim_type || 'institutional';
      const claimMapper = getClaimMapper(claimType);

      // Build the claim bundle using existing mapper
      const claimBundle = claimMapper.buildClaimRequestBundle(claimData);

      // Add batch extensions to the Claim resource within the bundle
      this.addBatchExtensionsToClaim(claimBundle, {
        batchIdentifier,
        batchNumber,
        batchPeriodStart,
        batchPeriodEnd
      });

      // Get the MessageHeader ID from the claim bundle for focus reference
      const claimMsgHeader = claimBundle.entry?.find(
        e => e.resource?.resourceType === 'MessageHeader'
      );
      if (claimMsgHeader) {
        focusReferences.push({ reference: claimMsgHeader.fullUrl });
      }

      claimBundles.push(claimBundle);
    });

    // Build outer batch bundle
    // 
    // IMPORTANT: After testing, NPHIES expects nested bundles to follow standard FHIR entry format:
    // { fullUrl: "urn:uuid:...", resource: { resourceType: "Bundle", ... } }
    // 
    // The sample file shows direct bundle objects, but NPHIES validation rejects this with:
    // - DT-00001: Incorrect data type used for Bundle entry
    // - FR-00027: The element does not exist in the base FHIR profile
    //
    // So we wrap nested bundles in standard { fullUrl, resource } format
    
    const formattedClaimBundleEntries = claimBundles.map(bundle => {
      // Generate a unique fullUrl for each nested bundle
      const nestedBundleId = bundle.id || this.generateId();
      return {
        fullUrl: `urn:uuid:${nestedBundleId}`,
        resource: {
          resourceType: 'Bundle',
          id: nestedBundleId,
          meta: bundle.meta,
          type: bundle.type,
          timestamp: bundle.timestamp,
          entry: bundle.entry
        }
      };
    });
    
    const batchBundle = {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp,
      entry: [
        // MessageHeader for batch request
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
              code: 'batch-request'
            },
            destination: [{
              endpoint: 'http://nphies.sa/license/payer-license/destinationLicense',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/payer-license',
                  value: insurer.nphies_id || 'INS-FHIR'
                }
              }
            }],
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID
              }
            },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
            },
            focus: focusReferences
          }
        },
        // Add all claim bundles wrapped in standard { fullUrl, resource } format
        ...formattedClaimBundleEntries
      ]
    };

    return batchBundle;
  }

  /**
   * Add batch-specific extensions and modifications to the Claim resource within a bundle
   * 
   * Required extensions:
   * - extension-batch-identifier: Provider-supplied unique batch ID
   * - extension-batch-number: Unique number for each claim within batch
   * - extension-batch-period: Creation period for claims in batch
   * 
   * IMPORTANT: Batch claims MUST have priority = "normal" (per NPHIES documentation)
   * 
   * @param {Object} claimBundle - The claim request bundle
   * @param {Object} batchInfo - Batch information
   */
  addBatchExtensionsToClaim(claimBundle, batchInfo) {
    const { batchIdentifier, batchNumber, batchPeriodStart, batchPeriodEnd } = batchInfo;

    // Find the Claim resource in the bundle
    const claimEntry = claimBundle.entry?.find(
      e => e.resource?.resourceType === 'Claim'
    );

    if (!claimEntry?.resource) {
      console.warn('[BatchClaimMapper] No Claim resource found in bundle');
      return;
    }

    const claim = claimEntry.resource;

    // Note: Priority should be set based on the claim data, not forced
    // The claim mappers already default to 'normal' if not specified
    // Per NPHIES documentation: Batch claims should have Claim.priority as "normal"
    // but we allow the original claim priority to pass through

    // Initialize extension array if not present
    if (!claim.extension) {
      claim.extension = [];
    }

    // Remove any existing batch extensions to avoid duplicates
    // This is important because claims may already have batch extensions from individual submission
    const batchExtensionUrls = [
      'extension-batch-identifier',
      'extension-batch-number', 
      'extension-batch-period'
    ];
    
    claim.extension = claim.extension.filter(ext => {
      if (!ext.url) return true;
      return !batchExtensionUrls.some(batchUrl => ext.url.includes(batchUrl));
    });

    // Add batch-identifier extension
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier',
      valueIdentifier: {
        system: 'http://provider.com/batch',
        value: batchIdentifier
      }
    });

    // Add batch-number extension
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number',
      valuePositiveInt: batchNumber
    });

    // Add batch-period extension
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period',
      valuePeriod: {
        start: this.formatDate(batchPeriodStart),
        end: this.formatDate(batchPeriodEnd || batchPeriodStart)
      }
    });
  }

  // ============================================
  // RESPONSE PARSING
  // ============================================

  /**
   * Parse batch claim response from NPHIES
   * 
   * Response structure:
   * - Bundle (type: message, eventCoding: batch-response)
   *   - MessageHeader
   *   - Claim Response Bundle #1
   *   - Claim Response Bundle #2
   *   - ... or OperationOutcome for errors
   * 
   * @param {Object} responseBundle - NPHIES response bundle
   * @returns {Object} - Parsed response with individual claim results
   */
  parseBatchClaimResponse(responseBundle) {
    try {
      if (!responseBundle?.entry) {
        throw new Error('Invalid response bundle');
      }

      const result = {
        success: true,
        batchId: responseBundle.id,
        timestamp: responseBundle.timestamp,
        claimResponses: [],
        errors: [],
        hasQueuedClaims: false,
        hasPendedClaims: false
      };

      // Check for OperationOutcome at batch level
      const batchOperationOutcome = responseBundle.entry.find(
        e => e.resource?.resourceType === 'OperationOutcome'
      )?.resource;

      if (batchOperationOutcome) {
        const batchErrors = this.parseOperationOutcome(batchOperationOutcome);
        if (batchErrors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          result.success = false;
          result.errors = batchErrors;
          return result;
        }
      }

      // Process each entry in the response
      for (const entry of responseBundle.entry) {
        // Skip MessageHeader and OperationOutcome
        if (entry.resource?.resourceType === 'MessageHeader') continue;
        if (entry.resource?.resourceType === 'OperationOutcome') continue;

        // Process nested bundles (claim response bundles)
        if (entry.resource?.resourceType === 'Bundle' || entry.resourceType === 'Bundle') {
          const nestedBundle = entry.resource || entry;
          const claimResponseResult = this.parseIndividualClaimResponse(nestedBundle);
          result.claimResponses.push(claimResponseResult);

          if (claimResponseResult.outcome === 'queued') {
            result.hasQueuedClaims = true;
          }
          if (claimResponseResult.adjudicationOutcome === 'pended') {
            result.hasPendedClaims = true;
          }
          if (!claimResponseResult.success) {
            result.errors.push(...(claimResponseResult.errors || []));
          }
        }

        // Direct ClaimResponse (alternative structure)
        if (entry.resource?.resourceType === 'ClaimResponse') {
          const claimResponseResult = this.parseClaimResponseResource(entry.resource);
          result.claimResponses.push(claimResponseResult);

          if (claimResponseResult.outcome === 'queued') {
            result.hasQueuedClaims = true;
          }
        }
      }

      // Determine overall success
      result.success = result.errors.filter(e => e.severity === 'error' || e.severity === 'fatal').length === 0;

      return result;

    } catch (error) {
      return {
        success: false,
        errors: [{ code: 'PARSE_ERROR', message: error.message, severity: 'error' }],
        claimResponses: []
      };
    }
  }

  /**
   * Parse individual claim response bundle
   */
  parseIndividualClaimResponse(responseBundle) {
    try {
      const claimResponse = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'ClaimResponse'
      )?.resource;

      const operationOutcome = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'OperationOutcome'
      )?.resource;

      if (operationOutcome) {
        const errors = this.parseOperationOutcome(operationOutcome);
        if (errors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          return {
            success: false,
            outcome: 'error',
            errors,
            bundleId: responseBundle.id
          };
        }
      }

      if (!claimResponse) {
        return {
          success: false,
          outcome: 'error',
          errors: [{ code: 'NO_CLAIM_RESPONSE', message: 'No ClaimResponse found in bundle', severity: 'error' }],
          bundleId: responseBundle.id
        };
      }

      return this.parseClaimResponseResource(claimResponse);

    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        errors: [{ code: 'PARSE_ERROR', message: error.message, severity: 'error' }]
      };
    }
  }

  /**
   * Parse a ClaimResponse resource
   */
  parseClaimResponseResource(claimResponse) {
    const adjudicationOutcome = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    )?.valueCodeableConcept?.coding?.[0]?.code;

    const outcome = claimResponse.outcome || 'complete';
    const success = (outcome === 'complete' || outcome === 'partial' || outcome === 'queued') && 
                    adjudicationOutcome !== 'rejected';

    // Extract batch extensions from response (they should be echoed back)
    const batchIdentifier = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-identifier')
    )?.valueIdentifier?.value;

    const batchNumber = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-number')
    )?.valuePositiveInt;

    // Get the claim identifier this response is for
    const claimIdentifier = claimResponse.request?.identifier?.value || 
                           claimResponse.request?.reference?.split('/').pop();

    return {
      success,
      outcome,
      adjudicationOutcome,
      disposition: claimResponse.disposition,
      nphiesClaimId: claimResponse.identifier?.[0]?.value || claimResponse.id,
      claimIdentifier,
      batchIdentifier,
      batchNumber,
      preAuthRef: claimResponse.preAuthRef,
      isNphiesGenerated: claimResponse.extension?.some(
        ext => ext.url?.includes('extension-is-nphies-generated') && ext.valueBoolean === true
      ),
      errors: []
    };
  }

  /**
   * Parse OperationOutcome issues
   */
  parseOperationOutcome(operationOutcome) {
    if (!operationOutcome?.issue) return [];

    return operationOutcome.issue.map(issue => ({
      severity: issue.severity,
      code: issue.details?.coding?.[0]?.code || issue.code,
      message: issue.details?.coding?.[0]?.display || issue.diagnostics || issue.details?.text,
      expression: issue.expression?.join(', ')
    }));
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate batch claim response structure
   */
  validateBatchClaimResponse(response) {
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

    // Check MessageHeader event is batch-response
    const messageHeader = firstEntry?.resource;
    if (messageHeader?.eventCoding?.code !== 'batch-response') {
      // Allow claim-response as fallback for individual responses
      if (messageHeader?.eventCoding?.code !== 'claim-response') {
        errors.push('MessageHeader event should be batch-response');
      }
    }

    // Check for ClaimResponse bundles or OperationOutcome
    const hasClaimResponses = response.entry.some(
      e => e.resource?.resourceType === 'ClaimResponse' || 
           (e.resource?.resourceType === 'Bundle' && e.resource?.entry?.some(
             ne => ne.resource?.resourceType === 'ClaimResponse'
           )) ||
           (e.resourceType === 'Bundle' && e.entry?.some(
             ne => ne.resource?.resourceType === 'ClaimResponse'
           ))
    );

    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    if (!hasClaimResponses && !hasOperationOutcome) {
      errors.push('Bundle must contain ClaimResponse(s) or OperationOutcome');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============================================
  // POLL REQUEST BUILDER
  // ============================================

  /**
   * Build a poll request bundle for retrieving deferred batch claim responses
   * 
   * @param {Object} provider - Provider organization
   * @param {string} batchIdentifier - Optional: filter by batch identifier
   * @returns {Object} - FHIR Bundle for poll request
   */
  buildBatchPollRequestBundle(provider, batchIdentifier = null) {
    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const taskId = this.generateId();
    const timestamp = this.formatDateTimeWithTimezone(new Date());

    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp,
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
              code: 'poll-request'
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
                value: provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID
              }
            },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
            },
            focus: [{ reference: `urn:uuid:${taskId}` }]
          }
        },
        {
          fullUrl: `urn:uuid:${taskId}`,
          resource: {
            resourceType: 'Task',
            id: taskId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/poll-request|1.0.0']
            },
            status: 'requested',
            intent: 'order',
            code: {
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/task-code',
                code: 'poll'
              }]
            },
            requester: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID
              }
            },
            owner: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/nphies-license',
                value: 'nphies'
              }
            },
            input: [
              {
                type: {
                  coding: [{
                    system: 'http://nphies.sa/terminology/CodeSystem/task-input-type',
                    code: 'message-type'
                  }]
                },
                valueCode: 'claim-response'
              }
            ]
          }
        }
      ]
    };

    // Add batch identifier filter if provided
    if (batchIdentifier) {
      const task = bundle.entry[1].resource;
      task.input.push({
        type: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/task-input-type',
            code: 'batch-identifier'
          }]
        },
        valueString: batchIdentifier
      });
    }

    return bundle;
  }
}

export default new BatchClaimMapper();
export { BatchClaimMapper };

