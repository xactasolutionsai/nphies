/**
 * Message Updater Service
 * 
 * Handles updating database records when poll responses are matched
 * to existing outbound requests. Extracts and consolidates the update
 * logic that was previously scattered across multiple controllers/services.
 */

import pool from '../db.js';
import advancedAuthParser from './advancedAuthParser.js';
import CommunicationMapper from './communicationMapper.js';

const mapper = new CommunicationMapper();

class MessageUpdater {

  /**
   * Update a Prior Authorization with a ClaimResponse from poll
   * 
   * @param {number} recordId - The prior_authorizations.id
   * @param {Object} claimResponse - The FHIR ClaimResponse resource
   * @param {Object} responseBundle - The full response bundle (for audit)
   * @param {string} schemaName
   * @returns {Object} Update result
   */
  async updatePriorAuthorization(recordId, claimResponse, responseBundle, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const outcome = claimResponse.outcome;
      let status = 'pending';
      let adjudicationOutcome = null;

      // Extract adjudication outcome from extension
      const adjudicationExt = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      );
      adjudicationOutcome = adjudicationExt?.valueCodeableConcept?.coding?.[0]?.code;

      switch (outcome) {
        case 'complete': {
          const disposition = claimResponse.disposition?.toLowerCase() || '';
          if (disposition.includes('approved') || disposition.includes('accept')) {
            status = 'approved';
            if (!adjudicationOutcome) adjudicationOutcome = 'approved';
          } else if (disposition.includes('denied') || disposition.includes('reject')) {
            status = 'denied';
            if (!adjudicationOutcome) adjudicationOutcome = 'rejected';
          } else {
            status = 'approved';
            if (!adjudicationOutcome) adjudicationOutcome = 'approved';
          }
          break;
        }
        case 'partial':
          status = 'partial';
          if (!adjudicationOutcome) adjudicationOutcome = 'partial';
          break;
        case 'queued':
          status = 'queued';
          break;
        case 'error':
          status = 'error';
          break;
      }

      // Extract financial totals
      const totals = claimResponse.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        amount: total.amount?.value,
        currency: total.amount?.currency || 'SAR'
      })) || [];

      const approvedAmount = totals.find(t => t.category === 'benefit')?.amount ||
                             totals.find(t => t.category === 'eligible')?.amount;

      const preAuthPeriod = claimResponse.preAuthPeriod;

      // Update the prior authorization record
      await client.query(`
        UPDATE prior_authorizations
        SET status = $1,
            outcome = $2,
            disposition = $3,
            adjudication_outcome = $4,
            pre_auth_ref = COALESCE($5, pre_auth_ref),
            pre_auth_period_start = COALESCE($6, pre_auth_period_start),
            pre_auth_period_end = COALESCE($7, pre_auth_period_end),
            approved_amount = COALESCE($8, approved_amount),
            response_bundle = $9,
            response_date = NOW(),
            updated_at = NOW()
        WHERE id = $10
      `, [
        status, outcome, claimResponse.disposition, adjudicationOutcome,
        claimResponse.preAuthRef,
        preAuthPeriod?.start || null, preAuthPeriod?.end || null,
        approvedAmount || null,
        JSON.stringify(claimResponse),
        recordId
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

        const itemApprovedAmount = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'benefit')?.amount?.value ||
                                   item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'eligible')?.amount?.value;

        await client.query(`
          UPDATE prior_authorization_items
          SET adjudication_status = $1,
              adjudication_amount = $2
          WHERE prior_auth_id = $3 AND sequence = $4
        `, [adjudicationStatus, itemApprovedAmount || null, recordId, item.itemSequence]);
      }

      // Store in responses table
      await client.query(`
        INSERT INTO prior_authorization_responses
        (prior_auth_id, response_type, outcome, disposition, pre_auth_ref,
         bundle_json, has_errors, is_nphies_generated, nphies_response_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        recordId, 'poll', outcome,
        claimResponse.disposition || null,
        claimResponse.preAuthRef || null,
        JSON.stringify(claimResponse),
        false, true,
        claimResponse.id || null
      ]);

      console.log(`[MessageUpdater] Updated prior_authorization #${recordId}: status=${status}, outcome=${outcome}`);

      return {
        table: 'prior_authorizations',
        recordId,
        status,
        outcome,
        adjudicationOutcome,
        disposition: claimResponse.disposition
      };

    } finally {
      client.release();
    }
  }

  /**
   * Update a Claim Submission with a ClaimResponse from poll
   */
  async updateClaimSubmission(recordId, claimResponse, responseBundle, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const outcome = claimResponse.outcome;
      let adjudicationOutcome = null;

      const adjudicationExt = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      );
      adjudicationOutcome = adjudicationExt?.valueCodeableConcept?.coding?.[0]?.code;

      const newStatus = outcome === 'queued' ? 'queued' :
                        adjudicationOutcome === 'approved' ? 'approved' :
                        adjudicationOutcome === 'rejected' ? 'denied' :
                        outcome === 'complete' ? 'approved' : 'pending';

      const nphiesClaimId = claimResponse.identifier?.[0]?.value || claimResponse.id;

      await client.query(`
        UPDATE claim_submissions
        SET status = $1,
            outcome = $2,
            disposition = $3,
            nphies_claim_id = COALESCE($4, nphies_claim_id),
            adjudication_outcome = $5,
            response_bundle = $6,
            response_date = NOW(),
            updated_at = NOW()
        WHERE id = $7
      `, [
        newStatus, outcome, claimResponse.disposition,
        nphiesClaimId, adjudicationOutcome,
        JSON.stringify(claimResponse),
        recordId
      ]);

      // Store in responses table
      await client.query(`
        INSERT INTO claim_submission_responses
        (claim_id, response_type, outcome, disposition, nphies_claim_id,
         bundle_json, has_errors, is_nphies_generated, nphies_response_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        recordId, 'poll', outcome,
        claimResponse.disposition || null,
        nphiesClaimId,
        JSON.stringify(claimResponse),
        false, true,
        claimResponse.id || null
      ]);

      console.log(`[MessageUpdater] Updated claim_submission #${recordId}: status=${newStatus}, outcome=${outcome}`);

      return {
        table: 'claim_submissions',
        recordId,
        status: newStatus,
        outcome,
        adjudicationOutcome,
        disposition: claimResponse.disposition
      };

    } finally {
      client.release();
    }
  }

  /**
   * Save an Advanced Authorization (payer-initiated, no matching outbound request)
   * Reuses the parsing logic from advancedAuthParser
   */
  async saveAdvancedAuthorization(claimResponse, pollBundle, responseBundle, schemaName) {
    const parsed = advancedAuthParser.parseAdvancedAuthorization(claimResponse);

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Check if already exists by identifier
      if (parsed.identifier_value) {
        const existing = await client.query(
          'SELECT id FROM advanced_authorizations WHERE identifier_value = $1',
          [parsed.identifier_value]
        );
        if (existing.rows.length > 0) {
          // Update existing record
          const updateResult = await client.query(`
            UPDATE advanced_authorizations SET
              status = $1, claim_type = $2, claim_subtype = $3, use_field = $4,
              auth_reason = $5, outcome = $6, adjudication_outcome = $7, disposition = $8,
              patient_reference = $9, insurer_reference = $10, service_provider_reference = $11,
              referring_provider_reference = $12, referring_provider_display = $13,
              pre_auth_ref = $14, pre_auth_period_start = $15, pre_auth_period_end = $16,
              created_date = $17, is_newborn = $18, prescription_reference = $19,
              response_bundle = $20, diagnoses = $21, supporting_info = $22,
              add_items = $23, totals = $24, insurance = $25, process_notes = $26,
              reissue_reason = $27, poll_bundle = $28, poll_response_bundle = $29,
              transfer_auth_number = $30, transfer_auth_period_start = $31,
              transfer_auth_period_end = $32, transfer_auth_provider = $33,
              schema_name = $34, updated_at = NOW()
            WHERE identifier_value = $35
            RETURNING *
          `, [
            parsed.status, parsed.claim_type, parsed.claim_subtype, parsed.use_field,
            parsed.auth_reason, parsed.outcome, parsed.adjudication_outcome, parsed.disposition,
            parsed.patient_reference, parsed.insurer_reference, parsed.service_provider_reference,
            parsed.referring_provider_reference, parsed.referring_provider_display,
            parsed.pre_auth_ref, parsed.pre_auth_period_start, parsed.pre_auth_period_end,
            parsed.created_date, parsed.is_newborn, JSON.stringify(parsed.prescription_reference),
            JSON.stringify(parsed.response_bundle), JSON.stringify(parsed.diagnoses),
            JSON.stringify(parsed.supporting_info), JSON.stringify(parsed.add_items),
            JSON.stringify(parsed.totals), JSON.stringify(parsed.insurance),
            JSON.stringify(parsed.process_notes), parsed.reissue_reason,
            pollBundle ? JSON.stringify(pollBundle) : null,
            responseBundle ? JSON.stringify(responseBundle) : null,
            parsed.transfer_auth_number, parsed.transfer_auth_period_start,
            parsed.transfer_auth_period_end, parsed.transfer_auth_provider,
            schemaName, parsed.identifier_value
          ]);

          console.log(`[MessageUpdater] Updated existing advanced_authorization: identifier=${parsed.identifier_value}`);
          return {
            table: 'advanced_authorizations',
            recordId: updateResult.rows[0].id,
            isNew: false,
            record: updateResult.rows[0]
          };
        }
      }

      // Insert new record
      const insertResult = await client.query(`
        INSERT INTO advanced_authorizations (
          identifier_system, identifier_value, status, claim_type, claim_subtype, use_field,
          auth_reason, outcome, adjudication_outcome, disposition,
          patient_reference, insurer_reference, service_provider_reference,
          referring_provider_reference, referring_provider_display,
          pre_auth_ref, pre_auth_period_start, pre_auth_period_end, created_date,
          is_newborn, prescription_reference, response_bundle, diagnoses,
          supporting_info, add_items, totals, insurance, process_notes,
          reissue_reason, poll_bundle, poll_response_bundle,
          transfer_auth_number, transfer_auth_period_start,
          transfer_auth_period_end, transfer_auth_provider,
          schema_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34, $35, $36
        ) RETURNING *
      `, [
        parsed.identifier_system, parsed.identifier_value,
        parsed.status, parsed.claim_type, parsed.claim_subtype, parsed.use_field,
        parsed.auth_reason, parsed.outcome, parsed.adjudication_outcome, parsed.disposition,
        parsed.patient_reference, parsed.insurer_reference, parsed.service_provider_reference,
        parsed.referring_provider_reference, parsed.referring_provider_display,
        parsed.pre_auth_ref, parsed.pre_auth_period_start, parsed.pre_auth_period_end,
        parsed.created_date, parsed.is_newborn,
        JSON.stringify(parsed.prescription_reference),
        JSON.stringify(parsed.response_bundle),
        JSON.stringify(parsed.diagnoses), JSON.stringify(parsed.supporting_info),
        JSON.stringify(parsed.add_items), JSON.stringify(parsed.totals),
        JSON.stringify(parsed.insurance), JSON.stringify(parsed.process_notes),
        parsed.reissue_reason,
        pollBundle ? JSON.stringify(pollBundle) : null,
        responseBundle ? JSON.stringify(responseBundle) : null,
        parsed.transfer_auth_number, parsed.transfer_auth_period_start,
        parsed.transfer_auth_period_end, parsed.transfer_auth_provider,
        schemaName
      ]);

      console.log(`[MessageUpdater] Created new advanced_authorization: identifier=${parsed.identifier_value}`);
      return {
        table: 'advanced_authorizations',
        recordId: insertResult.rows[0].id,
        isNew: true,
        record: insertResult.rows[0]
      };

    } finally {
      client.release();
    }
  }

  /**
   * Store a CommunicationRequest (payer asking for info)
   * 
   * @param {Object} commRequest - The FHIR CommunicationRequest resource
   * @param {Object} correlationResult - Result from correlator with matched table/record
   * @param {string} schemaName
   */
  async storeCommunicationRequest(commRequest, correlationResult, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Check if already stored
      const existing = await client.query(
        `SELECT id FROM nphies_communication_requests WHERE request_id = $1`,
        [commRequest.id]
      );
      if (existing.rows.length > 0) {
        return { id: existing.rows[0].id, alreadyStored: true, table: 'nphies_communication_requests' };
      }

      const parsed = mapper.parseCommunicationRequest(commRequest);

      const priorAuthId = correlationResult?.table === 'prior_authorizations' ? correlationResult.recordId : null;
      const claimId = correlationResult?.table === 'claim_submissions' ? correlationResult.recordId : null;

      const result = await client.query(`
        INSERT INTO nphies_communication_requests (
          request_id, prior_auth_id, claim_id, status, category, priority,
          about_reference, about_type, about_identifier, about_identifier_system,
          cr_identifier, cr_identifier_system,
          payload_content_type, payload_content_string,
          sender_identifier, recipient_identifier, authored_on, request_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        commRequest.id,
        priorAuthId,
        claimId,
        parsed.status || 'active',
        parsed.category,
        parsed.priority,
        parsed.aboutReference,
        parsed.aboutType,
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

      console.log(`[MessageUpdater] Stored CommunicationRequest: id=${commRequest.id}, prior_auth=${priorAuthId}, claim=${claimId}`);

      return {
        id: result.rows[0].id,
        table: 'nphies_communication_requests',
        recordId: result.rows[0].id,
        isNew: true
      };

    } finally {
      client.release();
    }
  }

  /**
   * Store a Communication (acknowledgment or payer-initiated)
   */
  async storeCommunication(communication, correlationResult, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Check if already stored
      const existing = await client.query(
        `SELECT id FROM nphies_communications WHERE communication_id = $1`,
        [communication.id]
      );
      if (existing.rows.length > 0) {
        return { id: existing.rows[0].id, alreadyStored: true, table: 'nphies_communications' };
      }

      const priorAuthId = correlationResult?.relatedPriorAuthId || 
                          (correlationResult?.table === 'prior_authorizations' ? correlationResult.recordId : null);
      const claimId = correlationResult?.relatedClaimId ||
                      (correlationResult?.table === 'claim_submissions' ? correlationResult.recordId : null);
      const communicationRequestId = correlationResult?.relatedCommunicationRequestId || null;

      // If this is an acknowledgment for a communication request, update its status
      if (communicationRequestId) {
        await client.query(`
          UPDATE nphies_communication_requests
          SET acknowledgment_received = true,
              acknowledgment_at = NOW(),
              acknowledgment_status = 'completed'
          WHERE id = $1
        `, [communicationRequestId]);
      }

      const result = await client.query(`
        INSERT INTO nphies_communications (
          communication_id, prior_auth_id, claim_id, communication_request_id,
          status, category, payload_content_type, payload_content_string,
          sender_identifier, recipient_identifier, sent_date,
          communication_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        communication.id,
        priorAuthId,
        claimId,
        communicationRequestId,
        communication.status || 'completed',
        communication.category?.[0]?.coding?.[0]?.code || null,
        communication.payload?.[0]?.contentString ? 'string' : 'attachment',
        communication.payload?.[0]?.contentString || null,
        communication.sender?.identifier?.value || null,
        communication.recipient?.[0]?.identifier?.value || null,
        communication.sent || null,
        JSON.stringify(communication)
      ]);

      console.log(`[MessageUpdater] Stored Communication: id=${communication.id}, prior_auth=${priorAuthId}, claim=${claimId}`);

      return {
        id: result.rows[0].id,
        table: 'nphies_communications',
        recordId: result.rows[0].id,
        isNew: true
      };

    } finally {
      client.release();
    }
  }
}

export default new MessageUpdater();
