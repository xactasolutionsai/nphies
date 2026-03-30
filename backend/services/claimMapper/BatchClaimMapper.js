/**
 * NPHIES Batch Claim Mapper
 * Builds batch claim bundles for submitting multiple claims
 * 
 * Reference: https://portal.nphies.sa/ig/usecase-claim-batch.html
 * 
 * NPHIES Batch Claim Bundle Structure (per docs):
 * 
 *   Nphies Bundle (.type = message)
 *     Nphies MessageHeader (.eventCoding = batch-request)
 *     Nphies Claim Request Bundle #1 (.type = message, claim-request)
 *     Nphies Claim Request Bundle #2 (.type = message, claim-request)
 *     ...up to 200
 * 
 * Key Requirements:
 * - Outer bundle: type=message, event=batch-request
 * - Each nested entry is a FULL claim request bundle (type=message, event=claim-request)
 * - All claims must be for the same insurer/TPA
 * - Max 200 claims per batch
 * - Each Claim resource MUST have batch extensions: batch-identifier, batch-number, batch-period
 * - Batch response comes as batch-response with nested ClaimResponse bundles
 * - Valid claims are queued for background delivery; responses retrieved via Polling
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
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
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
   * Validate batch constraints before building.
   * @param {Array} claims - Array of claim data objects
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateBatchConstraints(claims) {
    const errors = [];

    if (!claims || claims.length < 2) {
      errors.push('Batch must contain at least 2 claims');
    }

    if (claims && claims.length > this.MAX_BATCH_SIZE) {
      errors.push(`Batch cannot exceed ${this.MAX_BATCH_SIZE} claims. Current: ${claims.length}`);
    }

    if (claims && claims.length > 0) {
      const insurerIds = new Set(claims.map(c => 
        c.insurer?.insurer_id || c.insurer?.nphies_id || c.insurer_id || c.claim?.insurer_id
      ).filter(Boolean));
      if (insurerIds.size > 1) {
        errors.push('All claims in a batch must be for the same insurer (payer)');
      }

      const providerIds = new Set(claims.map(c => 
        c.provider?.provider_id || c.provider?.nphies_id || c.provider_id || c.claim?.provider_id
      ).filter(Boolean));
      if (providerIds.size > 1) {
        errors.push('All claims in a batch must be for the same provider');
      }

      const claimTypes = new Set(claims.map(c => {
        const type = c.claim?.claim_type || c.claim_type || c.type;
        if (!type) return null;
        const normalized = type.toLowerCase();
        if (['institutional', 'inpatient', 'daycase'].includes(normalized)) return 'institutional';
        if (['dental', 'oral'].includes(normalized)) return 'oral';
        return normalized;
      }).filter(Boolean));
      if (claimTypes.size > 1) {
        errors.push(`All claims in a batch must be of the same type. Found: ${[...claimTypes].join(', ')}`);
      }
    }

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

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // REFERENCE TRANSFORMATION FOR NESTED BUNDLES
  // ============================================

  /**
   * Rewrite all fullUrl and reference values in a claim bundle from the
   * hardcoded http://provider.com domain to the actual registered provider
   * endpoint (e.g. http://PR-FHIR.com.sa).  Relative references like
   * "Patient/xxx" are converted to absolute "http://PR-FHIR.com.sa/Patient/xxx"
   * so that every reference exactly matches a fullUrl entry.
   *
   * Entries that already use urn:uuid: (e.g. MessageHeader) are left untouched.
   *
   * @param {Object} bundle - A FHIR Bundle built by an individual claim mapper
   * @param {string} providerEndpoint - e.g. "http://PR-FHIR.com.sa"
   * @returns {Object} - The same bundle, mutated in place
   */
  transformBundleRefsToProviderUrl(bundle, providerEndpoint) {
    if (!bundle?.entry) return bundle;

    const refMap = new Map();

    for (const entry of bundle.entry) {
      const oldFullUrl = entry.fullUrl;
      const resourceId = entry.resource?.id;
      const resourceType = entry.resource?.resourceType;
      if (!oldFullUrl || !resourceId || !resourceType) continue;

      if (oldFullUrl.startsWith('urn:uuid:')) continue;

      const newFullUrl = `${providerEndpoint}/${resourceType}/${resourceId}`;

      if (oldFullUrl !== newFullUrl) {
        refMap.set(oldFullUrl, newFullUrl);
      }
      refMap.set(`${resourceType}/${resourceId}`, newFullUrl);

      entry.fullUrl = newFullUrl;
    }

    if (refMap.size === 0) return bundle;

    const rewriteRefs = (obj) => {
      if (obj == null || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const item of obj) rewriteRefs(item);
        return;
      }
      if (typeof obj.reference === 'string') {
        const mapped = refMap.get(obj.reference);
        if (mapped) {
          obj.reference = mapped;
        }
      }
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') rewriteRefs(val);
      }
    };

    for (const entry of bundle.entry) {
      rewriteRefs(entry.resource);
    }

    return bundle;
  }

  // ============================================
  // BATCH BUNDLE BUILDER (CORRECT NPHIES STRUCTURE)
  // ============================================

  /**
   * Build a SINGLE outer batch bundle containing nested claim bundles.
   * 
   * Structure per NPHIES docs (https://portal.nphies.sa/ig/usecase-claim-batch.html):
   *   Bundle (type=message)
   *     MessageHeader (event=batch-request)
   *     Bundle (type=message) ← Claim Request #1
   *     Bundle (type=message) ← Claim Request #2
   *     ...
   * 
   * @param {Object} data - Batch data
   * @returns {Object} - Single FHIR Bundle (the outer batch-request bundle)
   */
  buildBatchRequestBundle(data) {
    const { 
      batchIdentifier, 
      batchPeriodStart, 
      batchPeriodEnd, 
      claims, 
      provider, 
      insurer 
    } = data;

    const validation = this.validateBatchConstraints(claims);
    if (!validation.valid) {
      throw new Error(`Batch validation failed: ${validation.errors.join('; ')}`);
    }

    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || `http://${NPHIES_CONFIG.PROVIDER_DOMAIN}.com.sa`;
    const batchIdentifierSystem = `${providerEndpoint}/identifiers/batch`;

    const nestedBundles = [];
    const focusReferences = [];

    claims.forEach((claimData, index) => {
      const batchNumber = index + 1;

      const claimType = claimData.claim?.claim_type || claimData.claim_type || 'institutional';
      const claimMapper = getClaimMapper(claimType);
      const claimBundle = claimMapper.buildClaimRequestBundle(claimData);

      this.transformBundleRefsToProviderUrl(claimBundle, providerEndpoint);

      const innerMsgHeader = claimBundle.entry?.find(e => e.resource?.resourceType === 'MessageHeader');
      if (innerMsgHeader?.resource?.source) {
        innerMsgHeader.resource.source.endpoint = providerEndpoint;
      }

      const claimEntry = claimBundle.entry?.find(e => e.resource?.resourceType === 'Claim');
      if (claimEntry?.resource) {
        this.addBatchExtensionsToClaimResource(claimEntry.resource, {
          batchIdentifier,
          batchNumber,
          batchPeriodStart,
          batchPeriodEnd,
          identifierSystem: batchIdentifierSystem
        });
      }

      const nestedBundleFullUrl = `${providerEndpoint}/Bundle/${claimBundle.id}`;
      focusReferences.push({ reference: nestedBundleFullUrl });

      nestedBundles.push({
        fullUrl: nestedBundleFullUrl,
        resource: claimBundle
      });
    });

    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const timestamp = this.formatDateTimeWithTimezone(new Date());

    const batchBundle = {
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
              code: 'batch-request'
            },
            destination: [{
              endpoint: 'https://nphies.sa/fhir/$process-message',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/payer-license',
                  value: insurer.nphies_id || NPHIES_CONFIG.DEFAULT_INSURER_ID
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
              endpoint: providerEndpoint
            },
            focus: focusReferences
          }
        },
        ...nestedBundles
      ]
    };

    return batchBundle;
  }

  /**
   * Build individual bundles for each claim (for preview / copy-paste testing).
   * Each bundle is a standalone claim-request with batch extensions.
   * 
   * @param {Object} data - Batch data
   * @returns {Array} - Array of FHIR Bundles (one per claim)
   */
  buildIndividualClaimBundles(data) {
    const { 
      batchIdentifier, 
      batchPeriodStart, 
      batchPeriodEnd, 
      claims, 
      provider 
    } = data;

    const validation = this.validateBatchConstraints(claims);
    if (!validation.valid) {
      throw new Error(`Batch validation failed: ${validation.errors.join('; ')}`);
    }

    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || `http://${NPHIES_CONFIG.PROVIDER_DOMAIN}.com.sa`;
    const batchIdentifierSystem = `${providerEndpoint}/identifiers/batch`;
    const bundles = [];

    claims.forEach((claimData, index) => {
      const batchNumber = index + 1;

      const claimType = claimData.claim?.claim_type || claimData.claim_type || 'institutional';
      const claimMapper = getClaimMapper(claimType);
      const claimBundle = claimMapper.buildClaimRequestBundle(claimData);

      const claimEntry = claimBundle.entry?.find(e => e.resource?.resourceType === 'Claim');
      if (claimEntry?.resource) {
        this.addBatchExtensionsToClaimResource(claimEntry.resource, {
          batchIdentifier,
          batchNumber,
          batchPeriodStart,
          batchPeriodEnd,
          identifierSystem: batchIdentifierSystem
        });
      }

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
   * @deprecated Use buildBatchRequestBundle for submission.
   * Kept only for backwards-compat; delegates to buildIndividualClaimBundles.
   */
  buildBatchClaimBundles(data) {
    console.warn('[BatchClaimMapper] buildBatchClaimBundles is deprecated. Use buildBatchRequestBundle for submission or buildIndividualClaimBundles for preview.');
    return this.buildIndividualClaimBundles(data);
  }

  // ============================================
  // BATCH EXTENSIONS
  // ============================================

  /**
   * Add batch-specific extensions directly to a Claim resource.
   * Per NPHIES docs each claim in a batch SHALL supply:
   *   - extension-batch-identifier (valueIdentifier)
   *   - extension-batch-number (valuePositiveInt)
   *   - extension-batch-period (valuePeriod)
   * 
   * @param {Object} claim - The Claim resource object
   * @param {Object} batchInfo - Batch information
   */
  addBatchExtensionsToClaimResource(claim, batchInfo) {
    const { batchIdentifier, batchNumber, batchPeriodStart, batchPeriodEnd, identifierSystem } = batchInfo;

    if (!claim) return;

    if (!claim.extension) {
      claim.extension = [];
    }

    claim.extension = claim.extension.filter(ext => 
      !ext.url?.includes('extension-batch-')
    );

    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || `http://${NPHIES_CONFIG.PROVIDER_DOMAIN}.com.sa`;
    const system = identifierSystem || `${providerEndpoint}/identifiers/batch`;

    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier',
      valueIdentifier: {
        system,
        value: batchIdentifier
      }
    });

    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number',
      valuePositiveInt: batchNumber
    });

    claim.extension.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period',
      valuePeriod: {
        start: this.formatDate(batchPeriodStart),
        end: this.formatDate(batchPeriodEnd)
      }
    });

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
   * Legacy wrapper - delegates to addBatchExtensionsToClaimResource.
   */
  addBatchExtensionsToClaim(claimBundle, batchInfo) {
    const claimEntry = claimBundle.entry?.find(
      e => e.resource?.resourceType === 'Claim'
    );
    if (!claimEntry?.resource) {
      console.warn('[BatchClaimMapper] No Claim resource found in bundle');
      return;
    }
    this.addBatchExtensionsToClaimResource(claimEntry.resource, batchInfo);
  }

  // ============================================
  // RESPONSE PARSING
  // ============================================

  /**
   * Parse batch claim response from NPHIES.
   * 
   * Response structure:
   *   Bundle (type=message, event=batch-response)
   *     MessageHeader
   *     Claim Response Bundle #1
   *     Claim Response Bundle #2
   *     ... or OperationOutcome for errors
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

      for (const entry of responseBundle.entry) {
        if (entry.resource?.resourceType === 'MessageHeader') continue;
        if (entry.resource?.resourceType === 'OperationOutcome') continue;

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

        if (entry.resource?.resourceType === 'ClaimResponse') {
          const claimResponseResult = this.parseClaimResponseResource(entry.resource);
          result.claimResponses.push(claimResponseResult);

          if (claimResponseResult.outcome === 'queued') {
            result.hasQueuedClaims = true;
          }
        }
      }

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

  parseClaimResponseResource(claimResponse) {
    const adjudicationOutcome = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    )?.valueCodeableConcept?.coding?.[0]?.code;

    const outcome = claimResponse.outcome || 'complete';
    const success = (outcome === 'complete' || outcome === 'partial' || outcome === 'queued') && 
                    adjudicationOutcome !== 'rejected';

    const batchIdentifier = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-identifier')
    )?.valueIdentifier?.value;

    const batchNumber = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-number')
    )?.valuePositiveInt;

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
  // RESPONSE VALIDATION
  // ============================================

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

    const firstEntry = response.entry[0];
    if (!firstEntry || firstEntry.resource?.resourceType !== 'MessageHeader') {
      errors.push('First entry must be MessageHeader');
    }

    const messageHeader = firstEntry?.resource;
    if (messageHeader?.eventCoding?.code !== 'batch-response') {
      if (messageHeader?.eventCoding?.code !== 'claim-response') {
        errors.push('MessageHeader event should be batch-response or claim-response');
      }
    }

    const hasClaimResponses = response.entry.some(
      e => e.resource?.resourceType === 'ClaimResponse' || 
           (e.resource?.resourceType === 'Bundle' && e.resource?.entry?.some(
             ne => ne.resource?.resourceType === 'ClaimResponse'
           ))
    );

    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    if (!hasClaimResponses && !hasOperationOutcome) {
      errors.push('Bundle must contain ClaimResponse(s) or OperationOutcome');
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // POLL REQUEST BUILDER
  // ============================================

  /**
   * Build a poll request bundle for retrieving deferred batch claim responses.
   */
  buildBatchPollRequestBundle(provider, batchIdentifier = null) {
    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const taskId = this.generateId();
    const timestamp = this.formatDateTimeWithTimezone(new Date());
    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || `http://${NPHIES_CONFIG.PROVIDER_DOMAIN}.com.sa`;

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
              endpoint: 'https://nphies.sa/fhir/$process-message',
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
                value: provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID
              }
            },
            source: {
              endpoint: providerEndpoint
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
            priority: 'routine',
            code: {
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/task-code',
                code: 'poll'
              }]
            },
            authoredOn: timestamp,
            lastModified: timestamp,
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
                system: 'http://nphies.sa/license/nphies',
                value: 'NPHIES'
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
