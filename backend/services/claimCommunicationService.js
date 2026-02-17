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

import { randomUUID } from 'crypto';
import pool from '../db.js';
import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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

      // Build Status Check bundle (without sending)
      const focalIdentifier = claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id;
      
      const statusCheckBundle = this.mapper.buildStatusCheckBundle({
        providerId: claim.provider_nphies_id,
        providerName: claim.provider_name || 'Healthcare Provider',
        insurerId: claim.insurer_nphies_id,
        insurerName: claim.insurer_name || 'Insurance Company',
        focalResourceIdentifier: focalIdentifier,
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
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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

      // 3. Build Status Check bundle
      // Use claim_number as the focal resource identifier
      const focalIdentifier = claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id;
      
      const statusCheckBundle = this.mapper.buildStatusCheckBundle({
        providerId: claim.provider_nphies_id,
        providerName: claim.provider_name || 'Healthcare Provider',
        insurerId: claim.insurer_nphies_id,
        insurerName: claim.insurer_name || 'Insurance Company',
        focalResourceIdentifier: focalIdentifier,
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
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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
      const claimIdentifier = claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id;
      
      const pollOptions = {
        focus: {
          type: 'Claim',
          identifier: {
            system: `http://${providerDomain}/identifiers/claim`,
            value: claimIdentifier
          }
        }
      };

      const pollBundle = this.mapper.buildPollRequestBundle(
        claim.provider_nphies_id,
        claim.provider_name || 'Healthcare Provider',
        undefined,
        pollOptions
      );

      console.log(`[ClaimCommunicationService] Polling for messages for claim ${claim.claim_number}`);

      // 3. Send poll request
      const pollResponse = await nphiesService.sendPoll(pollBundle);

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

      // 4. Extract and categorize responses
      const claimResponses = nphiesService.extractClaimResponsesFromPoll(pollResponse.data);
      const communicationRequests = nphiesService.extractCommunicationRequestsFromPoll(pollResponse.data);
      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);

      console.log(`[ClaimCommunicationService] Poll returned: ${claimResponses.length} ClaimResponse(s), ${communicationRequests.length} CommunicationRequest(s), ${communications.length} Communication(s)`);

      const results = {
        success: true,
        claimResponses: [],
        communicationRequests: [],
        acknowledgments: [],
        pollBundle,
        responseBundle: pollResponse.data,
        hasCommunicationRequests: communicationRequests.length > 0,
        hasClaimResponse: claimResponses.length > 0,
        errors: pollResponse.errors || [],
        responseCode: pollResponse.responseCode
      };

      // 5. Process ClaimResponses (final adjudicated responses)
      for (const cr of claimResponses) {
        const processed = await this.processClaimResponse(client, claimId, cr);
        results.claimResponses.push(processed);
      }

      // 6. Process CommunicationRequests (HIC asking for info - CONDITIONAL)
      for (const commReq of communicationRequests) {
        const processed = await this.storeCommunicationRequest(client, claimId, commReq);
        results.communicationRequests.push(processed);
      }

      // 7. Process Communications (acknowledgments)
      for (const comm of communications) {
        const processed = await this.processAcknowledgment(client, comm);
        if (processed) {
          results.acknowledgments.push(processed);
        }
      }

      // 8. Generate appropriate message based on what was received
      if (results.hasClaimResponse) {
        results.message = 'ClaimResponse received - claim has been adjudicated';
      } else if (results.hasCommunicationRequests) {
        results.message = 'CommunicationRequest received - insurer needs additional information';
      } else {
        results.message = 'No new messages. The insurer may still be processing.';
      }

      return results;

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling for messages:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process ClaimResponse from poll
   * Updates Claim status based on outcome
   */
  async processClaimResponse(client, claimId, claimResponse) {
    const outcome = claimResponse.outcome;
    let status = 'pending';
    let adjudicationOutcome = null;
    
    switch (outcome) {
      case 'complete':
        // Check disposition for approval/denial
        const disposition = claimResponse.disposition?.toLowerCase() || '';
        if (disposition.includes('approved') || disposition.includes('accept')) {
          status = 'approved';
          adjudicationOutcome = 'approved';
        } else if (disposition.includes('denied') || disposition.includes('reject')) {
          status = 'denied';
          adjudicationOutcome = 'rejected';
        } else {
          status = 'approved';
          adjudicationOutcome = 'approved';
        }
        break;
      case 'partial':
        status = 'partial';
        adjudicationOutcome = 'partial';
        break;
      case 'queued':
        status = 'queued';
        break;
      case 'error':
        status = 'error';
        break;
    }

    // Extract financial amounts from ClaimResponse
    const totalAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'submitted')?.amount?.value;
    const approvedAmount = claimResponse.total?.find(t => t.category?.coding?.[0]?.code === 'benefit')?.amount?.value;

    // Update Claim
    await client.query(`
      UPDATE claim_submissions
      SET status = $1,
          outcome = $2,
          adjudication_outcome = $3,
          disposition = $4,
          nphies_claim_id = COALESCE($5, nphies_claim_id),
          approved_amount = COALESCE($6, approved_amount),
          response_bundle = $7,
          response_date = NOW(),
          updated_at = NOW()
      WHERE id = $8
    `, [
      status,
      outcome,
      adjudicationOutcome,
      claimResponse.disposition,
      claimResponse.id,
      approvedAmount,
      JSON.stringify(claimResponse),
      claimId
    ]);

    // Store in responses table for history
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
      claimResponse.id,
      JSON.stringify(claimResponse)
    ]);

    return {
      id: claimResponse.id,
      outcome,
      status,
      adjudicationOutcome,
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
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get Claim with related data
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
        priorAuth: {
          nphies_request_id: claim.nphies_request_id,
          request_number: claim.claim_number,
          pre_auth_ref: claimIdentifier
        },
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

      // 3. Send to NPHIES
      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      // 4. Extract Communication ID
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // 5. Extract acknowledgment from response
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;
      
      if (nphiesResponse.data && nphiesResponse.data.entry) {
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (responseMessageHeader) {
          if (responseMessageHeader.response?.code) {
            acknowledgmentReceived = true;
            acknowledgmentStatus = responseMessageHeader.response.code;
          }
          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }
      }

      // 6. Store Communication in database
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id,
          nphies_communication_id,
          prior_auth_id,
          claim_id,
          patient_id,
          communication_type,
          status,
          category,
          priority,
          about_reference,
          about_type,
          sender_identifier,
          recipient_identifier,
          sent_at,
          acknowledgment_received,
          acknowledgment_at,
          acknowledgment_status,
          request_bundle,
          response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        null, // No prior_auth_id for claims
        claimId,
        claim.patient_id,
        'unsolicited',
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        `http://provider.com/Claim/${claimIdentifier}`,
        'Claim',
        claim.provider_nphies_id,
        claim.insurer_nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data ? JSON.stringify(nphiesResponse.data) : null
      ]);

      const communication = insertResult.rows[0];

      // 7. Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id,
            sequence,
            content_type,
            content_string,
            attachment_content_type,
            attachment_data,
            attachment_url,
            attachment_title,
            claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id,
          i + 1,
          payload.contentType,
          payload.contentString || null,
          payload.attachment?.contentType || null,
          payload.attachment?.data || null,
          payload.attachment?.url || null,
          payload.attachment?.title || null,
          payload.claimItemSequences || null
        ]);
      }

      await client.query('COMMIT');

      return {
        success: nphiesResponse.success,
        communication: {
          id: communication.id,
          communicationId: communication.communication_id,
          type: 'unsolicited',
          status: communication.status,
          sentAt: communication.sent_at,
          payloadCount: payloads.length
        },
        nphiesResponse: {
          status: nphiesResponse.status,
          success: nphiesResponse.success,
          error: nphiesResponse.error
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ClaimCommunicationService] Error sending unsolicited communication:', error);
      throw error;
    } finally {
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get CommunicationRequest with claim data
      const crResult = await client.query(`
        SELECT cr.*, 
               cs.id as claim_id, 
               cs.claim_number,
               cs.nphies_request_id,
               cs.nphies_claim_id,
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

      // 2. Allow multiple solicited responses to the same CommunicationRequest
      // (responded_at is tracked for audit but does not block further responses)

      // 3. Build Communication bundle
      const claimIdentifier = commRequest.claim_number || commRequest.nphies_claim_id || commRequest.nphies_request_id;
      
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
        priorAuth: {
          nphies_request_id: commRequest.nphies_request_id,
          request_number: commRequest.claim_number,
          pre_auth_ref: claimIdentifier
        },
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

      // 4. Send to NPHIES
      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      // 5. Extract Communication ID
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // 6. Extract acknowledgment
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;
      
      if (nphiesResponse.data && nphiesResponse.data.entry) {
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (responseMessageHeader) {
          if (responseMessageHeader.response?.code) {
            acknowledgmentReceived = true;
            acknowledgmentStatus = responseMessageHeader.response.code;
          }
          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }
      }

      // 7. Store Communication
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id,
          nphies_communication_id,
          prior_auth_id,
          claim_id,
          patient_id,
          communication_type,
          based_on_request_id,
          status,
          category,
          priority,
          about_reference,
          about_type,
          sender_identifier,
          recipient_identifier,
          sent_at,
          acknowledgment_received,
          acknowledgment_at,
          acknowledgment_status,
          request_bundle,
          response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        null,
        commRequest.claim_id,
        commRequest.patient_id,
        'solicited',
        communicationRequestId,
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        commRequest.about_reference,
        commRequest.about_type || 'Claim',
        commRequest.provider_nphies_id,
        commRequest.insurer_nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data ? JSON.stringify(nphiesResponse.data) : null
      ]);

      const communication = insertResult.rows[0];

      // 8. Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id,
            sequence,
            content_type,
            content_string,
            attachment_content_type,
            attachment_data,
            attachment_url,
            attachment_title,
            claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id,
          i + 1,
          payload.contentType,
          payload.contentString || null,
          payload.attachment?.contentType || null,
          payload.attachment?.data || null,
          payload.attachment?.url || null,
          payload.attachment?.title || null,
          payload.claimItemSequences || null
        ]);
      }

      // 9. Update CommunicationRequest as responded
      await client.query(`
        UPDATE nphies_communication_requests
        SET responded_at = NOW(),
            response_communication_id = $1
        WHERE id = $2
      `, [communication.id, communicationRequestId]);

      await client.query('COMMIT');

      return {
        success: nphiesResponse.success,
        communication: {
          id: communication.id,
          communicationId: communication.communication_id,
          type: 'solicited',
          basedOnRequestId: communicationRequestId,
          status: communication.status,
          sentAt: communication.sent_at,
          payloadCount: payloads.length
        },
        nphiesResponse: {
          status: nphiesResponse.status,
          success: nphiesResponse.success,
          error: nphiesResponse.error
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ClaimCommunicationService] Error sending solicited communication:', error);
      throw error;
    } finally {
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const result = await client.query(`
        SELECT *
        FROM nphies_communication_requests
        WHERE claim_id = $1
          AND responded_at IS NULL
        ORDER BY received_at DESC
      `, [claimId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get all CommunicationRequests for a Claim
   */
  async getCommunicationRequests(claimId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_uuid,
               c.sent_at as response_sent_at
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        WHERE cr.claim_id = $1
        ORDER BY cr.received_at DESC
      `, [claimId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get all Communications sent for a Claim
   */
  async getCommunications(claimId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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
      client.release();
    }
  }

  /**
   * Get a single CommunicationRequest by ID
   */
  async getCommunicationRequest(requestId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

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
      const claimIdentifier = claim.claim_number || claim.nphies_claim_id || claim.nphies_request_id;

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
          priorAuth: {
            nphies_request_id: claim.nphies_request_id,
            request_number: claim.claim_number,
            pre_auth_ref: claimIdentifier
          },
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
          priorAuth: {
            nphies_request_id: claim.nphies_request_id,
            request_number: claim.claim_number,
            pre_auth_ref: claimIdentifier
          },
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
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get the communication
      const commResult = await client.query(`
        SELECT c.*, cs.claim_number, pr.nphies_id as provider_nphies_id, pr.provider_name
        FROM nphies_communications c
        LEFT JOIN claim_submissions cs ON c.claim_id = cs.id
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        WHERE c.communication_id = $1 AND c.claim_id = $2
      `, [communicationId, claimId]);

      if (commResult.rows.length === 0) {
        throw new Error('Communication not found');
      }

      const comm = commResult.rows[0];

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

      // 4. Send poll request
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error || 'Poll request failed',
          pollBundle,
          responseBundle: pollResponse.data
        };
      }

      // 5. Look for acknowledgment in response
      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);
      
      let acknowledgmentFound = false;
      let acknowledgmentStatus = null;

      for (const respComm of communications) {
        const parsed = this.mapper.parseCommunication(respComm);
        
        if (parsed.inResponseTo) {
          const responseToId = this.mapper.extractIdFromReference(parsed.inResponseTo);
          
          if (responseToId === communicationId) {
            acknowledgmentFound = true;
            acknowledgmentStatus = parsed.status;

            // Update communication with acknowledgment
            await client.query(`
              UPDATE nphies_communications
              SET acknowledgment_received = TRUE,
                  acknowledgment_at = NOW(),
                  acknowledgment_status = $1,
                  acknowledgment_bundle = $2
              WHERE communication_id = $3
            `, [acknowledgmentStatus, JSON.stringify(respComm), communicationId]);

            break;
          }
        }
      }

      return {
        success: true,
        acknowledgmentFound,
        acknowledgmentStatus,
        pollBundle,
        responseBundle: pollResponse.data,
        message: acknowledgmentFound 
          ? `Acknowledgment received: ${acknowledgmentStatus}`
          : 'No acknowledgment found. The message may still be processing.'
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling for acknowledgment:', error);
      throw error;
    } finally {
      client.release();
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
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get all communications with queued acknowledgments
      const commsResult = await client.query(`
        SELECT c.communication_id
        FROM nphies_communications c
        WHERE c.claim_id = $1
          AND (c.acknowledgment_status = 'queued' OR (c.acknowledgment_received = FALSE AND c.status = 'completed'))
      `, [claimId]);

      if (commsResult.rows.length === 0) {
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

      for (const row of commsResult.rows) {
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
        totalPolled: commsResult.rows.length,
        acknowledged,
        stillQueued,
        errors: errors.length > 0 ? errors : undefined,
        results,
        message: `Polled ${commsResult.rows.length} communication(s): ${acknowledged} acknowledged, ${stillQueued} still queued`
      };

    } catch (error) {
      console.error('[ClaimCommunicationService] Error polling all acknowledgments:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new ClaimCommunicationService();

