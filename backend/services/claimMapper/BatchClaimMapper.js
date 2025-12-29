/**
 * NPHIES Batch Claim Mapper
 * Builds batch claim bundles for submitting multiple claims
 * 
 * Reference: https://portal.nphies.sa/ig/usecase-claim-batch.html
 * 
 * CRITICAL NPHIES RULE (discovered from BV-00221 error):
 * - Batch Claim is a LOGICAL GROUPING mechanism only
 * - Each Claim MUST be sent in a SEPARATE Bundle
 * - MessageHeader.focus MUST contain EXACTLY ONE Claim reference
 * - Claims are grouped by batch extensions inside each Claim (not by MessageHeader)
 * 
 * Key Requirements:
 * - All claims in batch MUST be for the same insurer
 * - Batch size MUST NOT exceed 200 claims
 * - Each claim MUST have batch extensions: batch-identifier, batch-number, batch-period
 * - Each Bundle has eventCoding = 'claim-request' with focus pointing to ONE Claim only
 * 
 * FORBIDDEN PATTERNS:
 * - Sending multiple Claims in a single MessageHeader (causes BV-00221)
 * - Using batch-request for Claims (causes BV-00167)
 * - Using claim-request with multiple focus references (causes BV-00221)
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
   * 
   * Per NPHIES Batch Claim requirements:
   * - Minimum 2 claims, maximum 200 claims
   * - All claims must be for the same insurer (payer)
   * - All claims must be for the same provider
   * - All claims must be of the same claim type
   * 
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

    if (claims && claims.length > 0) {
      // Check all claims are for the same insurer (NPHIES requirement)
      const insurerIds = new Set(claims.map(c => 
        c.insurer?.insurer_id || c.insurer?.nphies_id || c.insurer_id || c.claim?.insurer_id
      ).filter(Boolean));
      if (insurerIds.size > 1) {
        errors.push('All claims in a batch must be for the same insurer (payer)');
      }

      // Check all claims are for the same provider (NPHIES requirement)
      const providerIds = new Set(claims.map(c => 
        c.provider?.provider_id || c.provider?.nphies_id || c.provider_id || c.claim?.provider_id
      ).filter(Boolean));
      if (providerIds.size > 1) {
        errors.push('All claims in a batch must be for the same provider');
      }

      // Check all claims are of the same type (NPHIES requirement)
      const claimTypes = new Set(claims.map(c => {
        const type = c.claim?.claim_type || c.claim_type || c.type;
        // Normalize claim types
        if (!type) return null;
        const normalized = type.toLowerCase();
        // Map similar types
        if (['institutional', 'inpatient', 'daycase'].includes(normalized)) return 'institutional';
        if (['dental', 'oral'].includes(normalized)) return 'oral';
        return normalized;
      }).filter(Boolean));
      if (claimTypes.size > 1) {
        errors.push(`All claims in a batch must be of the same type. Found: ${[...claimTypes].join(', ')}`);
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
   * Build SEPARATE bundles for each claim in the batch
   * 
   * CORRECT STRUCTURE per NPHIES (fixes BV-00221):
   * - Each Claim is sent in its OWN Bundle
   * - MessageHeader.focus points to EXACTLY ONE Claim
   * - Claims are logically grouped by batch extensions only
   * 
   * @param {Object} data - Batch data
   * @param {string} data.batchIdentifier - Unique batch identifier
   * @param {Date} data.batchPeriodStart - Batch period start date
   * @param {Date} data.batchPeriodEnd - Batch period end date
   * @param {Array} data.claims - Array of claim data objects
   * @param {Object} data.provider - Provider organization
   * @param {Object} data.insurer - Insurer organization
   * @returns {Array} - Array of FHIR Bundles (one per claim)
   */
  buildBatchClaimBundles(data) {
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

    const bundles = [];

    // Build a separate bundle for each claim
    claims.forEach((claimData, index) => {
      const batchNumber = index + 1;
      
      // Get the appropriate claim mapper based on claim type
      const claimType = claimData.claim?.claim_type || claimData.claim_type || 'institutional';
      const claimMapper = getClaimMapper(claimType);

      // Build the claim bundle using existing mapper
      const claimBundle = claimMapper.buildClaimRequestBundle(claimData);

      // Find and update the Claim resource with batch extensions
      const claimEntry = claimBundle.entry?.find(e => e.resource?.resourceType === 'Claim');
      if (claimEntry?.resource) {
        this.addBatchExtensionsToClaimResource(claimEntry.resource, {
          batchIdentifier,
          batchNumber,
          batchPeriodStart,
          batchPeriodEnd
        });
      }

      // Add batch metadata to the bundle for tracking
      claimBundle._batchMetadata = {
        batchIdentifier,
        batchNumber,
        totalInBatch: claims.length
      };

      bundles.push(claimBundle);
    });

    return bundles;
  }

  /**
   * @deprecated Use buildBatchClaimBundles instead
   * This method creates a single bundle with multiple claims which causes BV-00221 error
   * 
   * Build a batch claim request bundle (LEGACY - DO NOT USE)
   * 
   * @param {Object} data - Batch data
   * @returns {Object} - FHIR Bundle for batch claim request
   */
  buildBatchClaimRequestBundle(data) {
    console.warn('[BatchClaimMapper] buildBatchClaimRequestBundle is DEPRECATED. Use buildBatchClaimBundles instead.');
    console.warn('[BatchClaimMapper] Single bundle with multiple claims causes BV-00221 error in NPHIES.');
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

    // Collect all resources and focus references
    const allEntries = [];
    const focusReferences = [];
    
    // Track unique resources to avoid duplicates (Patient, Coverage, Organizations, etc.)
    const addedResources = new Map(); // key: resourceType/id, value: fullUrl

    // Process each claim
    claims.forEach((claimData, index) => {
      const batchNumber = index + 1;
      
      // Get the appropriate claim mapper based on claim type
      const claimType = claimData.claim?.claim_type || claimData.claim_type || 'institutional';
      const claimMapper = getClaimMapper(claimType);

      // Build the claim bundle using existing mapper (to get all resources)
      const claimBundle = claimMapper.buildClaimRequestBundle(claimData);

      // Extract resources from the claim bundle
      if (claimBundle.entry) {
        claimBundle.entry.forEach(entry => {
          if (!entry.resource) return;
          
          const resourceType = entry.resource.resourceType;
          const resourceId = entry.resource.id;
          const resourceKey = `${resourceType}/${resourceId}`;
          
          // Skip MessageHeader - we'll create our own batch MessageHeader
          if (resourceType === 'MessageHeader') return;
          
          // For Claim resources, add batch extensions and always include
          if (resourceType === 'Claim') {
            // Add batch extensions
            this.addBatchExtensionsToClaimResource(entry.resource, {
              batchIdentifier,
              batchNumber,
              batchPeriodStart,
              batchPeriodEnd
            });
            
            // Add focus reference to this claim
            focusReferences.push({ reference: entry.fullUrl });
            
            // Add to entries
            allEntries.push(entry);
          } 
          // For other resources, only add if not already added (avoid duplicates)
          else if (!addedResources.has(resourceKey)) {
            addedResources.set(resourceKey, entry.fullUrl);
            allEntries.push(entry);
          }
        });
      }
    });

    // Build the single batch bundle with all resources directly inside
    const batchBundle = {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp,
      entry: [
        // Single MessageHeader for the batch (event = batch-claim)
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
              code: 'claim-request' // Batch Claim uses claim-request with multiple Claims in focus
            },
            destination: [{
              endpoint: `http://nphies.sa/license/payer-license/${insurer.nphies_id || 'INS-FHIR'}`,
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
            // Focus references point directly to Claims
            focus: focusReferences
          }
        },
        // All Claims and supporting resources directly in the bundle
        ...allEntries
      ]
    };

    return batchBundle;
  }

  /**
   * Add batch-specific extensions directly to a Claim resource
   * 
   * @param {Object} claim - The Claim resource object
   * @param {Object} batchInfo - Batch information
   */
  addBatchExtensionsToClaimResource(claim, batchInfo) {
    const { batchIdentifier, batchNumber, batchPeriodStart, batchPeriodEnd } = batchInfo;

    if (!claim) return;

    // Initialize extensions array if not present
    if (!claim.extension) {
      claim.extension = [];
    }

    // Remove any existing batch extensions
    claim.extension = claim.extension.filter(ext => 
      !ext.url?.includes('extension-batch-')
    );

    // Add batch-identifier extension
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier',
      valueIdentifier: {
        system: 'http://provider.com/batch',
        value: batchIdentifier
      }
    });

    // Add batch-number extension (unique per claim in batch)
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number',
      valuePositiveInt: batchNumber
    });

    // Add batch-period extension
    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period',
      valuePeriod: {
        start: this.formatDate(batchPeriodStart),
        end: this.formatDate(batchPeriodEnd)
      }
    });

    // Ensure priority is normal for batch claims
    if (!claim.priority) {
      claim.priority = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: 'normal'
        }]
      };
    }
  }

  /**
   * Add batch-specific extensions and modifications to the Claim resource within a bundle
   * (Legacy method - delegates to addBatchExtensionsToClaimResource)
   * 
   * @param {Object} claimBundle - The claim request bundle
   * @param {Object} batchInfo - Batch information
   */
  addBatchExtensionsToClaim(claimBundle, batchInfo) {
    // Find the Claim resource in the bundle
    const claimEntry = claimBundle.entry?.find(
      e => e.resource?.resourceType === 'Claim'
    );

    if (!claimEntry?.resource) {
      console.warn('[BatchClaimMapper] No Claim resource found in bundle');
      return;
    }

    // Use the new method
    this.addBatchExtensionsToClaimResource(claimEntry.resource, batchInfo);
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

