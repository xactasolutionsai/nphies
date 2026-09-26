/**
 * NPHIES Claim Communication Service
 * 
 * Business logic for handling NPHIES Communications for Claims.
 * Implements the Status Check flow for queued/pended claims:
 * 1. Status Check - Send status-check message to NPHIES
 * 2. Poll - Retrieve pending messages (CommunicationRequests, ClaimResponses)
 * 3. Communications - Handle solicited/unsolicited communications
 * 
 * Key difference from Prior Auth: Claims use status-check message first,
 * then poll for responses. CommunicationRequest is conditional - may or may not
 * be received depending on whether HIC needs additional info.
 */

import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';
import systemPollService from './systemPollService.js';
import { mapClaimResponseStatus } from './messageUpdater.js';
import { connectWithSchema, releaseSchemaClient, withSchemaClient } from './dbSchema.js';
import { sendAndRecordCommunication } from './communicationOutbox.js';
import { submittedClaimIdentifier } from './priorAuthMapper/nphiesIdentity.js';

/**
 * Identifier of the claim as it was submitted (Claim.identifier of the stored request
 * bundle), falling back to the claim number with the /claim system derived from the
 * provider, exactly as the claim mappers build Claim.identifier.
 */
function claimFocus(claim) {
  const submitted = submittedClaimIdentifier(claim.request_bundle);
  return {
    value: submitted?.value || claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id,
    system: submitted?.system || null
  };
}

/** `priorAuth` argument of the communication builders for a claim (Communication.about). */
function claimAboutRecord(claim) {
  const focus = claimFocus(claim);
  return {
    nphies_request_id: claim.nphies_request_id,
    request_number: focus.value,
    pre_auth_ref: focus.value,
    ...(focus.system && { about_identifier_system: focus.system })
  };
}

class ClaimCommunicationService {
  constructor() {
    this.mapper = new CommunicationMapper();
  }

  // ============================================================================
  // STATUS CHECK
  // ============================================================================

  /**
   * Preview Status Check bundle WITHOUT sending to NPHIES
   * Use this to view/copy the JSON before actually sending
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Status check bundle for preview
   */
  async previewStatusCheck(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      // Get Claim with related data
      const claimResult = await client.query(`
        SELECT 
          cs.*,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          pr.provider_type,
          pr.address as provider_address,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          i.address as insurer_address
        FROM claim_submissions cs
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        WHERE cs.id = $1
      `, [claimId]);

      if (claimResult.rows.length === 0) {
        throw new Error('Claim not found');
      }

      const claim = claimResult.rows[0];
      
      // Build address objects
      const providerAddress = claim.provider_address ? {
        text: claim.provider_address,
        country: 'Saudi Arabia'
      } : null;
      
      const insurerAddress = claim.insurer_address ? {
        text: claim.insurer_address,
        country: 'Saudi Arabia'
      } : null;

      // Build Status Check bundle (without sending); Task.focus = the submitted Claim.identifier
      const focus = claimFocus(claim);
      
      const statusCheckBundle = this.mapper.buildStatusCheckBundle({
        providerId: claim.provider_nphies_id,
        providerName: claim.provider_name || 'Healthcare Provider',
        insurerId: claim.insurer_nphies_id,
        insurerName: claim.insurer_name || 'Insurance Company',
        focalResourceIdentifier: focus.value,
        focalIdentifierSystem: focus.system,
        claimUse: 'claim',
        focalResourceType: 'Claim',
        originalRequestId: claim.nphies_request_id,
        providerType: claim.provider_type,
        providerAddress: providerAddress,
        insurerAddress: insurerAddress
      });

      return {
        success: true,
        statusCheckBundle,
        claimNumber: claim.claim_number,
        message: 'Status check bundle generated. Review and click Send to submit to NPHIES.'
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error generating status check preview:', error);
      throw error;
    } finally {
      await releaseSchemaClient(client);
    }
  }

  /**
   * Send Status Check message for a Claim
   * Used when claim is in queued/pended status to check current processing status
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Result with status check response
   */
  async sendStatusCheck(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      // 1. Get Claim with related data including provider/insurer details for NPHIES bundle
      const claimResult = await client.query(`
        SELECT 
          cs.*,
          p.patient_id,
          p.name as patient_name,
          p.identifier as patient_identifier,
          pr.provider_id,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          pr.provider_type,
          pr.address as provider_address,
          i.insurer_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          i.address as insurer_address
        FROM claim_submissions cs
        LEFT JOIN patients p ON cs.patient_id = p.patient_id
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        WHERE cs.id = $1
      `, [claimId]);

      if (claimResult.rows.length === 0) {
        throw new Error('Claim not found');
      }

      const claim = claimResult.rows[0];
      
      // Build provider address object from DB text field
      // The address field contains the full address as text
      const providerAddress = claim.provider_address ? {
        text: claim.provider_address,
        country: 'Saudi Arabia'
      } : null;
      
      // Build insurer address object from DB text field
      const insurerAddress = claim.insurer_address ? {
        text: claim.insurer_address,
        country: 'Saudi Arabia'
      } : null;

      // 2. Validate claim is in appropriate status for status check
      const validStatuses = ['queued', 'pending'];
      if (!validStatuses.includes(claim.status) && claim.outcome !== 'queued') {
        console.warn(`[ClaimCommunicationService] Status check for claim with status '${claim.status}' - proceeding anyway`);
      }

      // 3. Build Status Check bundle; Task.focus = the submitted Claim.identifier
      const focus = claimFocus(claim);
      
      const statusCheckBundle = this.mapper.buildStatusCheckBundle({
        providerId: claim.provider_nphies_id,
        providerName: claim.provider_name || 'Healthcare Provider',
        insurerId: claim.insurer_nphies_id,
        insurerName: claim.insurer_name || 'Insurance Company',
        focalResourceIdentifier: focus.value,
        focalIdentifierSystem: focus.system,
        claimUse: 'claim',
        focalResourceType: 'Claim',
        originalRequestId: claim.nphies_request_id,
        // Dynamic data from DB per NPHIES IG
        providerType: claim.provider_type,      // e.g., '1' for Hospital
        providerAddress: providerAddress,        // Full address object
        insurerAddress: insurerAddress           // Full address object
      });

      console.log(`[ClaimCommunicationService] Sending status-check for claim ${claim.claim_number}`);

      // 4. Send to NPHIES
      const nphiesResponse = await nphiesService.sendStatusCheck(statusCheckBundle);

      // 5. Extract detailed error information from NPHIES response
      const errors = nphiesResponse.errors || [];
      const responseCode = nphiesResponse.responseCode;
      const hasErrors = !nphiesResponse.success || errors.length > 0;
      
      // Build error details for storage and display
      let errorDetails = null;
      let errorMessage = null;
      
      if (hasErrors) {
        if (errors.length > 0) {
          errorDetails = {
            responseCode: responseCode,
            errors: errors
          };
          errorMessage = errors.map(e => `${e.code}: ${e.message}`).join('\n');
        } else if (nphiesResponse.error) {
          errorDetails = { message: nphiesResponse.error };
          errorMessage = nphiesResponse.error;
        }
      }

      // 6. Store the status check request/response for audit
      // Note: Using 'poll' as response_type since DB constraint only allows: initial, update, cancel, poll, final
      await client.query(`
        INSERT INTO claim_submission_responses (
          claim_id,
          response_type,
          outcome,
          disposition,
          bundle_json,
          has_errors,
          errors,
          received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        claimId,
        'poll',  // DB constraint: must be one of initial, update, cancel, poll, final
        hasErrors ? 'error' : 'queued',
        hasErrors ? `Status check failed: ${responseCode || 'error'}` : 'Status check sent',
        JSON.stringify({
          request: statusCheckBundle,
          response: nphiesResponse.data,
          type: 'status-check'  // Store actual type in JSON for reference
        }),
        hasErrors,
        errorDetails ? JSON.stringify(errorDetails) : null
      ]);

      return {
        success: !hasErrors,
        statusCheckBundle,
        response: nphiesResponse.data,
        responseCode: responseCode,
        errors: errors,
        error: errorMessage,
        message: !hasErrors 
          ? 'Status check sent successfully. Poll for response.' 
          : `Status check failed: ${errorMessage || responseCode || 'Unknown error'}`
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error sending status check:', error);
      throw error;
    } finally {
      await releaseSchemaClient(client);
    }
  }

  // ============================================================================
  // POLL FOR MESSAGES
  // ============================================================================

  /**
   * Poll NPHIES for messages related to a Claim
   * Polls for: ClaimResponse (conditional), CommunicationRequest (conditional)
   * 
   * After sending status-check, poll to get:
   * - ClaimResponse: Final adjudicated response (if HIC has enough info)
   * - CommunicationRequest: HIC needs more info (conditional - may not come)
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Poll results with categorized messages
   */
  async pollForMessages(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    // Messages NPHIES returned that belong to other records; handed to the system
    // poll path after this client is released.
    const otherMessages = [];
    let results;
    let pollBundle;
    let pollResponse;
    
    try {

      // 1. Get Claim with provider info
      const claimResult = await client.query(`
        SELECT 
          cs.*,
          pr.nphies_id as provider_nphies_id,
          pr.provider_name
        FROM claim_submissions cs
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        WHERE cs.id = $1
      `, [claimId]);

      if (claimResult.rows.length === 0) {
        throw new Error('Claim not found');
      }

      const claim = claimResult.rows[0];

      // 2. Build poll request with focus on this specific claim
      const providerDomain = this.mapper.extractProviderDomain(claim.provider_name || 'Healthcare Provider');
      const focus = claimFocus(claim);
      
      const pollOptions = {
        focus: {
          type: 'Claim',
          identifier: {
            system: focus.system || `http://${providerDomain}/identifiers/claim`,
            value: focus.value
          }
        }
      };

      pollBundle = this.mapper.buildPollRequestBundle(
        claim.provider_nphies_id,
        claim.provider_name || 'Healthcare Provider',
        undefined,
        pollOptions
      );

      console.log(`[ClaimCommunicationService] Polling for messages for claim ${claim.claim_number}`);

      // 3. Send poll request
      pollResponse = await nphiesService.sendPoll(pollBundle);

      // IMPORTANT: Check for errors even if HTTP status is 200
      if (!pollResponse.success || (pollResponse.errors && pollResponse.errors.length > 0)) {
        const errorMessage = pollResponse.errors && pollResponse.errors.length > 0
          ? pollResponse.errors.map(e => `${e.code}: ${e.message}${e.expression ? ` (${e.expression})` : ''}`).join('; ')
          : pollResponse.error || 'Poll request failed';
        
        return {
          success: false,
          error: errorMessage,
          errors: pollResponse.errors || [],
          responseCode: pollResponse.responseCode,
          pollBundle,
          responseBundle: pollResponse.data,
          message: 'Poll request failed with validation errors'
        };
      }

      // 4. Split the response into messages and keep only those about THIS claim
      //    (mirrors the prior-auth filter). Everything else is routed through the
      //    system poll correlator below instead of being written onto this claim.
      const claimIdentifiers = this.getClaimIdentifiers(claim);
      const messages = systemPollService.extractPollMessages(pollResponse.data);

      results = {
        success: true,
        claimResponses: [],
        communicationRequests: [],
        acknowledgments: [],
        pollBundle,
        responseBundle: pollResponse.data,
        errors: pollResponse.errors || [],
        responseCode: pollResponse.responseCode
      };

      for (const message of messages) {
        const resource = message.resource;
        switch (resource?.resourceType) {
          case 'ClaimResponse':
            if (this.claimResponseMatchesClaim(resource, claimIdentifiers)) {
              // 5. Final adjudicated response for this claim, with its full message bundle
              const processed = await this.inTransaction(client, () =>
                this.processClaimResponse(client, claimId, resource, message.direct ? null : message.messageBundle));
              results.claimResponses.push(processed);
            } else {
              otherMessages.push(message);
            }
            break;
          case 'CommunicationRequest':
            if (this.isAboutClaim(resource, claimIdentifiers)) {
              // 6. HIC asking for info about this claim (CONDITIONAL)
              results.communicationRequests.push(await this.storeCommunicationRequest(client, claimId, resource));
            } else {
              otherMessages.push(message);
            }
            break;
          case 'Communication': {
            // 7. Acknowledgments of our Communications
            const processed = await this.processAcknowledgment(client, resource);
            if (processed) {
              results.acknowledgments.push(processed);
            } else {
              otherMessages.push(message);
            }
            break;
          }
          default:
            otherMessages.push(message);
        }
      }

      results.hasClaimResponse = results.claimResponses.length > 0;
      results.hasCommunicationRequests = results.communicationRequests.length > 0;

      console.log(`[ClaimCommunicationService] Poll returned ${messages.length} message(s): ${results.claimResponses.length} ClaimResponse(s), ${results.communicationRequests.length} CommunicationRequest(s), ${results.acknowledgments.length} acknowledgment(s) for this claim; ${otherMessages.length} for other records`);

      // 8. Generate appropriate message based on what was received
      if (results.hasClaimResponse) {
        results.message = 'ClaimResponse received - claim has been adjudicated';
      } else if (results.hasCommunicationRequests) {
        results.message = 'CommunicationRequest received - insurer needs additional information';
      } else {
        results.message = 'No new messages. The insurer may still be processing.';
      }

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling for messages:', error);
      throw error;
    } finally {
      await releaseSchemaClient(client);
    }

    results.otherMessages = await this.routeOtherMessages(
      otherMessages, pollBundle, pollResponse?.data, schemaName, `claim #${claimId} poll`
    );
    return results;
  }

  /** Identifiers this claim may be referenced by in NPHIES messages. */
  getClaimIdentifiers(claim) {
    return new Set(
      [claim.claim_number, claim.nphies_claim_id, claim.nphies_request_id]
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(String)
    );
  }

  /** ClaimResponse.request.identifier must name this claim. */
  claimResponseMatchesClaim(claimResponse, claimIdentifiers) {
    const value = claimResponse?.request?.identifier?.value;
    return value !== undefined && value !== null && claimIdentifiers.has(String(value));
  }

  /** CommunicationRequest.about[] must reference this claim (identifier or reference). */
  isAboutClaim(commRequest, claimIdentifiers) {
    return (commRequest?.about || []).some(about => {
      const identifierValue = about.identifier?.value;
      if (identifierValue !== undefined && identifierValue !== null && claimIdentifiers.has(String(identifierValue))) return true;
      const refId = this.mapper.extractIdFromReference(about.reference);
      return !!refId && claimIdentifiers.has(String(refId));
    });
  }

  /** Run fn inside BEGIN/COMMIT on an already schema-scoped client. */
  async inTransaction(client, fn) {
    await client.query('BEGIN');
    try {
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  }

  /**
   * Hand messages that are not for this claim to the system poll processing path
   * (correlator + updater) so they are not lost after being taken off the queue.
   */
  async routeOtherMessages(messages, pollBundle, responseData, schemaName, source) {
    if (!messages.length) return { count: 0 };
    try {
      const routed = await systemPollService.processForeignMessages(messages, pollBundle, responseData, schemaName, source);
      return {
        count: messages.length,
        processed: routed.processed,
        matched: routed.matched,
        unmatched: routed.unmatched,
        pollLogId: routed.pollLogId,
        errors: routed.errors.length > 0 ? routed.errors : undefined
      };
    } catch (error) {
      console.error(`[ClaimCommunicationService] Could not route ${messages.length} message(s) from ${source}:`, error);
      return { count: messages.length, error: error.message };
    }
  }

  /**
   * Process ClaimResponse from poll
   * Updates Claim status based on outcome, extracts financial totals,
   * stores the full message bundle, and updates item-level adjudication.
   * 
   * @param {Object} client - Database client
   * @param {number} claimId - Claim submission ID
   * @param {Object} claimResponse - The FHIR ClaimResponse resource
   * @param {Object|null} messageBundle - The full message bundle containing related resources
   */
  async processClaimResponse(client, claimId, claimResponse, messageBundle = null) {
    // Same interpretation as the system poll: unclear responses stay 'pending' for
    // review, never defaulted to approved.
    const { status, outcome, adjudicationOutcome, needsReview } = mapClaimResponseStatus(claimResponse);

    // Extract all financial totals from ClaimResponse
    const benefitAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'benefit')?.amount?.value;
    const eligibleAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'eligible')?.amount?.value;
    const approvedAmount = benefitAmount ?? eligibleAmount;
    const copayAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'copay')?.amount?.value;
    const taxAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'tax')?.amount?.value;

    const nphiesClaimId = claimResponse.identifier?.[0]?.value || claimResponse.id;

    // Store the full message bundle when available (includes Patient, Coverage, Organizations)
    const bundleToStore = messageBundle || claimResponse;

    // Update Claim
    await client.query(`
      UPDATE claim_submissions
      SET status = $1,
          outcome = $2,
          adjudication_outcome = $3,
          disposition = $4,
          nphies_claim_id = COALESCE($5, nphies_claim_id),
          approved_amount = COALESCE($6, approved_amount),
          eligible_amount = COALESCE($7, eligible_amount),
          benefit_amount = COALESCE($8, benefit_amount),
          copay_amount = COALESCE($9, copay_amount),
          tax_amount = COALESCE($10, tax_amount),
          response_bundle = $11,
          response_date = NOW(),
          updated_at = NOW()
      WHERE id = $12
    `, [
      status,
      outcome,
      adjudicationOutcome,
      claimResponse.disposition,
      nphiesClaimId,
      approvedAmount ?? null,
      eligibleAmount ?? null,
      benefitAmount ?? null,
      copayAmount ?? null,
      taxAmount ?? null,
      JSON.stringify(bundleToStore),
      claimId
    ]);

    // Update item-level adjudication
    const items = claimResponse.item || [];
    for (const item of items) {
      const itemOutcome = item.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      )?.valueCodeableConcept?.coding?.[0]?.code;

      const adjudicationStatus = itemOutcome === 'approved' ? 'approved' :
                                 itemOutcome === 'rejected' ? 'denied' :
                                 itemOutcome === 'partial' ? 'partial' : 'pending';

      const itemBenefitAmount = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'benefit')?.amount?.value;
      const itemEligibleAmount = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'eligible')?.amount?.value;
      const itemCopayAmount = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'copay')?.amount?.value;
      const itemApprovedQty = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'approved-quantity')?.value;

      await client.query(`
        UPDATE claim_submission_items
        SET adjudication_status = $1,
            adjudication_amount = $2,
            adjudication_eligible_amount = $3,
            adjudication_copay_amount = $4,
            adjudication_approved_quantity = $5
        WHERE claim_id = $6 AND sequence = $7
      `, [
        adjudicationStatus,
        itemBenefitAmount ?? itemEligibleAmount ?? null,
        itemEligibleAmount ?? null,
        itemCopayAmount ?? null,
        itemApprovedQty ?? null,
        claimId,
        item.itemSequence
      ]);
    }

    // Store in responses table for history (full bundle)
    await client.query(`
      INSERT INTO claim_submission_responses (
        claim_id,
        response_type,
        outcome,
        disposition,
        nphies_claim_id,
        bundle_json,
        received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      claimId,
      'final',
      outcome,
      claimResponse.disposition,
      nphiesClaimId,
      JSON.stringify(bundleToStore)
    ]);

    return {
      id: claimResponse.id,
      outcome,
      status,
      adjudicationOutcome,
      needsReview,
      disposition: claimResponse.disposition,
      approvedAmount
    };
  }

  /**
   * Store CommunicationRequest from poll
   * HIC is asking for additional information (CONDITIONAL - may not always come)
   */
  async storeCommunicationRequest(client, claimId, commRequest) {
    // Check if already stored
    const existing = await client.query(`
      SELECT id FROM nphies_communication_requests WHERE request_id = $1
    `, [commRequest.id]);

    if (existing.rows.length > 0) {
      return { id: existing.rows[0].id, alreadyStored: true };
    }

    // Parse the CommunicationRequest
    const parsed = this.mapper.parseCommunicationRequest(commRequest);

    // Store in database with claim_id and identifier fields
    const result = await client.query(`
      INSERT INTO nphies_communication_requests (
        request_id,
        prior_auth_id,
        claim_id,
        status,
        category,
        priority,
        about_reference,
        about_type,
        about_identifier,
        about_identifier_system,
        cr_identifier,
        cr_identifier_system,
        payload_content_type,
        payload_content_string,
        sender_identifier,
        recipient_identifier,
        authored_on,
        request_bundle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (request_id) DO NOTHING
      RETURNING *
    `, [
      commRequest.id,
      null, // No prior_auth_id for claims
      claimId,
      parsed.status || 'active',
      parsed.category,
      parsed.priority,
      parsed.aboutReference,
      parsed.aboutType || 'Claim',
      parsed.aboutIdentifier || null,
      parsed.aboutIdentifierSystem || null,
      parsed.identifier || null,
      parsed.identifierSystem || null,
      parsed.payloadContentType,
      parsed.payloadContentString,
      parsed.senderIdentifier,
      parsed.recipientIdentifier,
      parsed.authoredOn,
      JSON.stringify(commRequest)
    ]);

    if (result.rows.length === 0) {
      // Stored concurrently by another poll
      const stored = await client.query(`SELECT id FROM nphies_communication_requests WHERE request_id = $1`, [commRequest.id]);
      return { id: stored.rows[0]?.id, alreadyStored: true };
    }

    return {
      id: result.rows[0].id,
      requestId: commRequest.id,
      claimId: claimId,
      category: parsed.category,
      priority: parsed.priority,
      payloadContentString: parsed.payloadContentString,
      alreadyStored: false
    };
  }

  /**
   * Process Communication acknowledgment from poll
   * Returns information about whether this was an unsolicited communication (for auto-poll)
   */
  async processAcknowledgment(client, communication) {
    const parsed = this.mapper.parseCommunication(communication);
    
    if (!parsed.inResponseTo) {
      return null;
    }

    const ourCommId = this.mapper.extractIdFromReference(parsed.inResponseTo);
    
    if (!ourCommId) {
      return null;
    }

    // Get communication details before updating (to check if it's unsolicited)
    const commBeforeUpdate = await client.query(`
      SELECT communication_type, prior_auth_id, claim_id
      FROM nphies_communications
      WHERE communication_id = $1
    `, [ourCommId]);

    if (commBeforeUpdate.rows.length === 0) {
      console.warn(`[ClaimCommunicationService] Acknowledgment for unknown Communication: ${ourCommId}`);
      return null;
    }

    const commData = commBeforeUpdate.rows[0];
    const isUnsolicited = commData.communication_type === 'unsolicited';

    // Update our Communication with acknowledgment
    const result = await client.query(`
      UPDATE nphies_communications
      SET acknowledgment_received = TRUE,
          acknowledgment_at = NOW(),
          acknowledgment_status = $1,
          acknowledgment_bundle = $2
      WHERE communication_id = $3
      RETURNING *
    `, [
      parsed.status,
      JSON.stringify(communication),
      ourCommId
    ]);

    if (result.rows.length === 0) {
      console.warn(`[ClaimCommunicationService] Acknowledgment for unknown Communication: ${ourCommId}`);
      return null;
    }

    return {
      communicationId: ourCommId,
      acknowledgmentStatus: parsed.status,
      acknowledgedAt: result.rows[0].acknowledgment_at,
      isUnsolicited: isUnsolicited,
      priorAuthId: commData.prior_auth_id,
      claimId: commData.claim_id
    };
  }

  // ============================================================================
  // SEND COMMUNICATIONS
  // ============================================================================

  /**
   * Send UNSOLICITED Communication for a Claim
   * HCP proactively sends additional information to HIC
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} schemaName - Database schema name
   * @returns {Object} Result with communication data
   */
  async sendUnsolicitedCommunication(claimId, payloads, schemaName) {
    try {
      // 1. Get Claim with related data and build the bundle (no transaction open)
      const { claim, communicationBundle, claimIdentifier } = await withSchemaClient(schemaName, async client => {
        const claimResult = await client.query(`
          SELECT 
            cs.*,
            p.patient_id,
            p.name as patient_name,
            p.identifier as patient_identifier,
            p.identifier_type as patient_identifier_type,
            p.gender as patient_gender,
            p.birth_date as patient_birth_date,
            p.phone as patient_phone,
            p.address as patient_address,
            pr.provider_id,
            pr.provider_name,
            pr.nphies_id as provider_nphies_id,
            pr.provider_type,
            pr.address as provider_address,
            i.insurer_id,
            i.insurer_name,
            i.nphies_id as insurer_nphies_id,
            i.address as insurer_address
          FROM claim_submissions cs
          LEFT JOIN patients p ON cs.patient_id = p.patient_id
          LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
          LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
          WHERE cs.id = $1
        `, [claimId]);

        if (claimResult.rows.length === 0) {
          throw new Error('Claim not found');
        }

        const claim = claimResult.rows[0];

        // 2. Build Communication bundle
        const claimIdentifier = claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id;
        
        const communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
          priorAuth: claimAboutRecord(claim),
          claimUse: 'claim',
          patient: {
            patient_id: claim.patient_id,
            identifier: claim.patient_identifier,
            identifier_type: claim.patient_identifier_type || 'national_id',
            name: claim.patient_name,
            gender: claim.patient_gender,
            birth_date: claim.patient_birth_date,
            phone: claim.patient_phone,
            address: claim.patient_address
          },
          provider: {
            provider_id: claim.provider_id,
            provider_name: claim.provider_name,
            nphies_id: claim.provider_nphies_id,
            provider_type: claim.provider_type,
            address: claim.provider_address
          },
          insurer: {
            insurer_id: claim.insurer_id,
            insurer_name: claim.insurer_name,
            nphies_id: claim.insurer_nphies_id,
            address: claim.insurer_address
          },
          coverage: null,
          payloads
        });
        return { claim, communicationBundle, claimIdentifier };
      });

      // 3. Record, send (outside any transaction) and store the outcome
      return await sendAndRecordCommunication({
        schemaName,
        communicationBundle,
        payloads,
        record: {
          claim_id: claimId,
          patient_id: claim.patient_id,
          communication_type: 'unsolicited',
          about_reference: `http://provider.com/Claim/${claimIdentifier}`,
          about_type: 'Claim',
          sender_identifier: claim.provider_nphies_id,
          recipient_identifier: claim.insurer_nphies_id
        },
        logPrefix: '[ClaimCommunicationService]'
      });

    } catch (error) {
      console.error('[ClaimCommunicationService] Error sending unsolicited communication:', error);
      throw error;
    }
  }

  /**
   * Send SOLICITED Communication for a Claim
   * HCP responds to CommunicationRequest from HIC
   * 
   * @param {number} communicationRequestId - CommunicationRequest ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} schemaName - Database schema name
   * @returns {Object} Result with communication data
   */
  async sendSolicitedCommunication(communicationRequestId, payloads, schemaName) {
    try {
      // 1. Get CommunicationRequest with claim data and build the bundle
      const { commRequest, communicationBundle } = await withSchemaClient(schemaName, async client => {
        const crResult = await client.query(`
          SELECT cr.*, 
                 cs.id as claim_id, 
                 cs.claim_number,
                 cs.nphies_request_id,
                 cs.nphies_claim_id,
                 cs.request_bundle,
                 cs.patient_id,
                 cs.provider_id,
                 cs.insurer_id,
                 p.identifier as patient_identifier,
                 p.identifier_type as patient_identifier_type,
                 p.name as patient_name,
                 p.gender as patient_gender,
                 p.birth_date as patient_birth_date,
                 p.phone as patient_phone,
                 p.address as patient_address,
                 pr.nphies_id as provider_nphies_id,
                 pr.provider_name,
                 pr.provider_type,
                 pr.address as provider_address,
                 i.nphies_id as insurer_nphies_id,
                 i.insurer_name,
                 i.address as insurer_address
          FROM nphies_communication_requests cr
          LEFT JOIN claim_submissions cs ON cr.claim_id = cs.id
          LEFT JOIN patients p ON cs.patient_id = p.patient_id
          LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
          LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
          WHERE cr.id = $1
        `, [communicationRequestId]);

        if (crResult.rows.length === 0) {
          throw new Error('CommunicationRequest not found');
        }

        const commRequest = crResult.rows[0];

        // Multiple solicited responses to the same CommunicationRequest are allowed
        // (responded_at is tracked for audit but does not block further responses)
        const communicationBundle = this.mapper.buildSolicitedCommunicationBundle({
          communicationRequest: {
            request_id: commRequest.request_id,
            about_reference: commRequest.about_reference,
            about_identifier: commRequest.about_identifier,
            about_identifier_system: commRequest.about_identifier_system,
            about_type: commRequest.about_type || 'Claim',
            cr_identifier: commRequest.cr_identifier,
            cr_identifier_system: commRequest.cr_identifier_system
          },
          priorAuth: claimAboutRecord(commRequest),
          claimUse: 'claim',
          patient: {
            patient_id: commRequest.patient_id,
            identifier: commRequest.patient_identifier,
            identifier_type: commRequest.patient_identifier_type || 'national_id',
            name: commRequest.patient_name,
            gender: commRequest.patient_gender,
            birth_date: commRequest.patient_birth_date,
            phone: commRequest.patient_phone,
            address: commRequest.patient_address
          },
          provider: {
            provider_id: commRequest.provider_id,
            provider_name: commRequest.provider_name,
            nphies_id: commRequest.provider_nphies_id,
            provider_type: commRequest.provider_type,
            address: commRequest.provider_address
          },
          insurer: {
            insurer_id: commRequest.insurer_id,
            insurer_name: commRequest.insurer_name,
            nphies_id: commRequest.insurer_nphies_id,
            address: commRequest.insurer_address
          },
          coverage: null,
          payloads
        });
        return { commRequest, communicationBundle };
      });

      // 2. Record, send (outside any transaction) and store the outcome
      return await sendAndRecordCommunication({
        schemaName,
        communicationBundle,
        payloads,
        communicationRequestId,
        record: {
          claim_id: commRequest.claim_id,
          patient_id: commRequest.patient_id,
          communication_type: 'solicited',
          about_reference: commRequest.about_reference,
          about_type: commRequest.about_type || 'Claim',
          sender_identifier: commRequest.provider_nphies_id,
          recipient_identifier: commRequest.insurer_nphies_id
        },
        logPrefix: '[ClaimCommunicationService]'
      });

    } catch (error) {
      console.error('[ClaimCommunicationService] Error sending solicited communication:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET METHODS
  // ============================================================================

  /**
   * Get pending CommunicationRequests for a Claim
   * These are requests from HIC that need responses
   */
  async getPendingCommunicationRequests(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT *
        FROM nphies_communication_requests
        WHERE claim_id = $1
          AND responded_at IS NULL
        ORDER BY received_at DESC
      `, [claimId]);

      return result.rows;

    } finally {
      await releaseSchemaClient(client);
    }
  }

  /**
   * Get all CommunicationRequests for a Claim
   */
  async getCommunicationRequests(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_uuid,
               c.sent_at as response_sent_at
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        WHERE cr.claim_id = $1
        ORDER BY cr.received_at DESC
      `, [claimId]);

      for (const row of result.rows) {
        row.payloads = this._extractPayloadsFromBundle(row.request_bundle);
      }

      return result.rows;

    } finally {
      await releaseSchemaClient(client);
    }
  }

  _extractPayloadsFromBundle(requestBundle) {
    if (!requestBundle) return [];
    const bundle = typeof requestBundle === 'string' ? JSON.parse(requestBundle) : requestBundle;
    const fhirPayloads = bundle.payload || [];
    return fhirPayloads.map((p, idx) => {
      if (p.contentString) {
        return { index: idx, content_type: 'string', content_string: p.contentString };
      }
      if (p.contentAttachment) {
        const att = p.contentAttachment;
        return {
          index: idx,
          content_type: 'attachment',
          attachment_title: att.title || 'Attachment',
          attachment_content_type: att.contentType || 'application/octet-stream',
          attachment_size: att.data ? Math.round((att.data.length * 3) / 4) : att.size || null,
          attachment_creation: att.creation || null,
          has_data: !!att.data
        };
      }
      if (p.contentReference) {
        return { index: idx, content_type: 'reference', reference: p.contentReference.reference || p.contentReference };
      }
      return { index: idx, content_type: 'unknown' };
    });
  }

  /**
   * Get all Communications sent for a Claim
   */
  async getCommunications(claimId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT c.*,
               cr.request_id as based_on_request_nphies_id,
               cr.payload_content_string as request_payload
        FROM nphies_communications c
        LEFT JOIN nphies_communication_requests cr ON c.based_on_request_id = cr.id
        WHERE c.claim_id = $1
        ORDER BY c.created_at DESC
      `, [claimId]);

      // Get payloads for each communication
      for (const comm of result.rows) {
        const payloadsResult = await client.query(`
          SELECT * FROM nphies_communication_payloads
          WHERE communication_id = $1
          ORDER BY sequence
        `, [comm.id]);
        comm.payloads = payloadsResult.rows;
      }

      return result.rows;

    } finally {
      await releaseSchemaClient(client);
    }
  }

  /**
   * Get a single CommunicationRequest by ID
   */
  async getCommunicationRequest(requestId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_uuid,
               c.sent_at as response_sent_at,
               cs.claim_number,
               cs.status as claim_status
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        LEFT JOIN claim_submissions cs ON cr.claim_id = cs.id
        WHERE cr.id = $1
      `, [requestId]);

      return result.rows[0] || null;

    } finally {
      await releaseSchemaClient(client);
    }
  }

  // ============================================================================
  // PREVIEW AND ACKNOWLEDGMENT POLLING
  // ============================================================================

  /**
   * Preview Communication bundle WITHOUT sending to NPHIES
   * Returns the exact FHIR bundle that would be sent
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} type - 'unsolicited' or 'solicited'
   * @param {number} communicationRequestId - For solicited type
   * @param {string} schemaName - Database schema name
   * @returns {Object} Preview bundle and metadata
   */
  async previewCommunicationBundle(claimId, payloads, type = 'unsolicited', communicationRequestId = null, schemaName = 'public') {
    const client = await connectWithSchema(schemaName);
    
    try {

      // Get Claim with related data
      const claimResult = await client.query(`
        SELECT 
          cs.*,
          p.patient_id,
          p.name as patient_name,
          p.identifier as patient_identifier,
          p.identifier_type as patient_identifier_type,
          p.gender as patient_gender,
          p.birth_date as patient_birth_date,
          p.phone as patient_phone,
          p.address as patient_address,
          pr.provider_id,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          pr.provider_type,
          pr.address as provider_address,
          i.insurer_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          i.address as insurer_address
        FROM claim_submissions cs
        LEFT JOIN patients p ON cs.patient_id = p.patient_id
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        WHERE cs.id = $1
      `, [claimId]);

      if (claimResult.rows.length === 0) {
        throw new Error('Claim not found');
      }

      const claim = claimResult.rows[0];

      let communicationBundle;
      let metadata = {
        type,
        claimId,
        claimNumber: claim.claim_number,
        payloadCount: payloads.length
      };

      if (type === 'solicited' && communicationRequestId) {
        // Get CommunicationRequest data
        const crResult = await client.query(`
          SELECT * FROM nphies_communication_requests WHERE id = $1
        `, [communicationRequestId]);

        if (crResult.rows.length === 0) {
          throw new Error('CommunicationRequest not found');
        }

        const commRequest = crResult.rows[0];
        metadata.communicationRequestId = communicationRequestId;
        metadata.respondingTo = commRequest.request_id;

        communicationBundle = this.mapper.buildSolicitedCommunicationBundle({
          communicationRequest: {
            request_id: commRequest.request_id,
            about_reference: commRequest.about_reference,
            about_identifier: commRequest.about_identifier,
            about_identifier_system: commRequest.about_identifier_system,
            about_type: commRequest.about_type || 'Claim',
            cr_identifier: commRequest.cr_identifier,
            cr_identifier_system: commRequest.cr_identifier_system
          },
          priorAuth: claimAboutRecord(claim),
          claimUse: 'claim',
          patient: {
            patient_id: claim.patient_id,
            identifier: claim.patient_identifier,
            identifier_type: claim.patient_identifier_type || 'national_id',
            name: claim.patient_name,
            gender: claim.patient_gender,
            birth_date: claim.patient_birth_date,
            phone: claim.patient_phone,
            address: claim.patient_address
          },
          provider: {
            provider_id: claim.provider_id,
            provider_name: claim.provider_name,
            nphies_id: claim.provider_nphies_id,
            provider_type: claim.provider_type,
            address: claim.provider_address
          },
          insurer: {
            insurer_id: claim.insurer_id,
            insurer_name: claim.insurer_name,
            nphies_id: claim.insurer_nphies_id,
            address: claim.insurer_address
          },
          coverage: null,
          payloads
        });
      } else {
        // Unsolicited communication
        communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
          priorAuth: claimAboutRecord(claim),
          claimUse: 'claim',
          patient: {
            patient_id: claim.patient_id,
            identifier: claim.patient_identifier,
            identifier_type: claim.patient_identifier_type || 'national_id',
            name: claim.patient_name,
            gender: claim.patient_gender,
            birth_date: claim.patient_birth_date,
            phone: claim.patient_phone,
            address: claim.patient_address
          },
          provider: {
            provider_id: claim.provider_id,
            provider_name: claim.provider_name,
            nphies_id: claim.provider_nphies_id,
            provider_type: claim.provider_type,
            address: claim.provider_address
          },
          insurer: {
            insurer_id: claim.insurer_id,
            insurer_name: claim.insurer_name,
            nphies_id: claim.insurer_nphies_id,
            address: claim.insurer_address
          },
          coverage: null,
          payloads
        });
      }

      return {
        success: true,
        bundle: communicationBundle,
        metadata
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error previewing communication bundle:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      await releaseSchemaClient(client);
    }
  }

  /**
   * Poll for acknowledgment of a specific Communication
   * Use when communication has acknowledgment_status = 'queued'
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {string} communicationId - Communication UUID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Poll result with acknowledgment status
   */
  async pollCommunicationAcknowledgment(claimId, communicationId, schemaName = 'public') {
    try {
      // 1. Get the communication
      const comm = await withSchemaClient(schemaName, async client => {
        const commResult = await client.query(`
          SELECT c.*, cs.claim_number, pr.nphies_id as provider_nphies_id, pr.provider_name
          FROM nphies_communications c
          LEFT JOIN claim_submissions cs ON c.claim_id = cs.id
          LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
          WHERE c.communication_id = $1 AND c.claim_id = $2
        `, [communicationId, claimId]);
        return commResult.rows[0] || null;
      });

      if (!comm) {
        throw new Error('Communication not found');
      }

      // 2. Check if already acknowledged
      if (comm.acknowledgment_received && comm.acknowledgment_status === 'ok') {
        return {
          success: true,
          alreadyAcknowledged: true,
          acknowledgmentStatus: comm.acknowledgment_status,
          message: 'Communication was already acknowledged'
        };
      }

      // 3. Build poll request
      const pollBundle = this.mapper.buildPollRequestBundle(
        comm.provider_nphies_id,
        comm.provider_name || 'Healthcare Provider'
      );

      // 4. Send poll request (no database client held during the HTTP call)
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error || 'Poll request failed',
          pollBundle,
          responseBundle: pollResponse.data
        };
      }

      // 5. Look for our acknowledgment; every other message in the response is
      //    handed to the system poll path instead of being discarded.
      const messages = systemPollService.extractPollMessages(pollResponse.data);
      const otherMessages = [];
      let acknowledgmentFound = false;
      let acknowledgmentStatus = null;

      for (const message of messages) {
        const respComm = message.resource;
        let isOurAck = false;
        if (!acknowledgmentFound && respComm?.resourceType === 'Communication') {
          const parsed = this.mapper.parseCommunication(respComm);
          const responseToId = parsed.inResponseTo ? this.mapper.extractIdFromReference(parsed.inResponseTo) : null;
          if (responseToId === communicationId) {
            isOurAck = true;
            acknowledgmentFound = true;
            acknowledgmentStatus = parsed.status;

            await withSchemaClient(schemaName, client => client.query(`
              UPDATE nphies_communications
              SET acknowledgment_received = TRUE,
                  acknowledgment_at = NOW(),
                  acknowledgment_status = $1,
                  acknowledgment_bundle = $2
              WHERE communication_id = $3
            `, [acknowledgmentStatus, JSON.stringify(respComm), communicationId]));
          }
        }
        if (!isOurAck) otherMessages.push(message);
      }

      const routed = await this.routeOtherMessages(
        otherMessages, pollBundle, pollResponse.data, schemaName, `claim #${claimId} acknowledgment poll`
      );

      return {
        success: true,
        acknowledgmentFound,
        acknowledgmentStatus,
        otherMessages: routed,
        pollBundle,
        responseBundle: pollResponse.data,
        message: acknowledgmentFound 
          ? `Acknowledgment received: ${acknowledgmentStatus}`
          : 'No acknowledgment found. The message may still be processing.'
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling for acknowledgment:', error);
      throw error;
    }
  }

  /**
   * Poll for all queued acknowledgments for a Claim
   * 
   * @param {number} claimId - Claim Submission ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Results for all polled communications
   */
  async pollAllQueuedAcknowledgments(claimId, schemaName = 'public') {
    try {
      // 1. Get all communications with queued acknowledgments. The client is
      //    released before polling, so the per-communication polls below never
      //    wait for a second pooled connection while holding this one.
      const rows = await withSchemaClient(schemaName, async client => {
        const commsResult = await client.query(`
          SELECT c.communication_id
          FROM nphies_communications c
          WHERE c.claim_id = $1
            AND (c.acknowledgment_status = 'queued' OR (c.acknowledgment_received = FALSE AND c.status = 'completed'))
        `, [claimId]);
        return commsResult.rows;
      });

      if (rows.length === 0) {
        return {
          success: true,
          totalPolled: 0,
          acknowledged: 0,
          stillQueued: 0,
          results: [],
          message: 'No communications awaiting acknowledgment'
        };
      }

      // 2. Poll for each communication
      const results = [];
      let acknowledged = 0;
      let stillQueued = 0;
      const errors = [];

      for (const row of rows) {
        try {
          const pollResult = await this.pollCommunicationAcknowledgment(
            claimId,
            row.communication_id,
            schemaName
          );

          if (pollResult.acknowledgmentFound) {
            acknowledged++;
          } else if (!pollResult.alreadyAcknowledged) {
            stillQueued++;
          }

          results.push({
            communicationId: row.communication_id,
            ...pollResult
          });
        } catch (err) {
          errors.push({
            communicationId: row.communication_id,
            error: err.message
          });
        }
      }

      return {
        success: true,
        totalPolled: rows.length,
        acknowledged,
        stillQueued,
        errors: errors.length > 0 ? errors : undefined,
        results,
        message: `Polled ${rows.length} communication(s): ${acknowledged} acknowledged, ${stillQueued} still queued`
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling all acknowledgments:', error);
      throw error;
    }
  }
}

export default new ClaimCommunicationService();

