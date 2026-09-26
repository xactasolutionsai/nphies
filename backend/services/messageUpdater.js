/**
 * Message Updater Service
 * 
 * Handles updating database records when poll responses are matched
 * to existing outbound requests. Extracts and consolidates the update
 * logic that was previously scattered across multiple controllers/services.
 */

import { transaction } from '../db.js';
import advancedAuthParser from './advancedAuthParser.js';
import CommunicationMapper from './communicationMapper.js';
import PaymentReconciliationService from './paymentReconciliationService.js';
import { setLocalSearchPath, withSchemaClient, withSchemaTransaction } from './dbSchema.js';

const mapper = new CommunicationMapper();

// Negative phrases are checked first so "not approved" is never read as approved.
const NEGATIVE_DISPOSITION = /\b(not\s+(?:been\s+)?(?:approved|accepted|authori[sz]ed|covered)|unapproved|disapproved|denied|declined|rejected|reject)\b/i;
const POSITIVE_DISPOSITION = /\b(approved|accepted|authori[sz]ed)\b/i;
const EXTENSION_STATUS = { approved: 'approved', rejected: 'denied', partial: 'partial', pended: 'queued' };

/**
 * Map a ClaimResponse to our record status. Shared by the system poll and the
 * per-record polls so prior authorizations and claims are interpreted the same way.
 *
 * - outcome queued/error win (queued / error).
 * - The adjudication-outcome extension is authoritative when present.
 * - Without it, a "complete" response is only approved/denied when the
 *   disposition clearly says so; anything else stays 'pending' with
 *   needsReview=true. It is never defaulted to approved.
 *
 * @returns {{status: string, outcome: string|null, adjudicationOutcome: string|null, needsReview: boolean}}
 */
export function mapClaimResponseStatus(claimResponse) {
  const outcome = claimResponse?.outcome ?? null;
  const extensionCode = claimResponse?.extension?.find(
    ext => ext.url?.includes('extension-adjudication-outcome')
  )?.valueCodeableConcept?.coding?.[0]?.code || null;

  let adjudicationOutcome = EXTENSION_STATUS[extensionCode] ? extensionCode : null;
  let status = 'pending';
  let needsReview = false;

  if (outcome === 'queued') {
    status = 'queued';
  } else if (outcome === 'error') {
    status = 'error';
  } else if (adjudicationOutcome) {
    status = EXTENSION_STATUS[adjudicationOutcome];
  } else if (outcome === 'partial') {
    status = 'partial';
    adjudicationOutcome = 'partial';
  } else if (outcome === 'complete') {
    const disposition = claimResponse.disposition || '';
    if (NEGATIVE_DISPOSITION.test(disposition)) {
      status = 'denied';
      adjudicationOutcome = 'rejected';
    } else if (POSITIVE_DISPOSITION.test(disposition)) {
      status = 'approved';
      adjudicationOutcome = 'approved';
    } else {
      needsReview = true;
    }
  } else {
    needsReview = true;
  }

  if (extensionCode && !EXTENSION_STATUS[extensionCode]) needsReview = true;
  if (needsReview) {
    console.warn(`[MessageUpdater] ClaimResponse ${claimResponse?.id || ''} has no clear adjudication (outcome=${outcome}); left as '${status}' for review`);
  }

  return { status, outcome, adjudicationOutcome, needsReview };
}

const COMMUNICATION_STATUSES = new Set(['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown']);

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
    return transaction(async client => {
      await setLocalSearchPath(client, schemaName);

      const { status, outcome, adjudicationOutcome, needsReview } = mapClaimResponseStatus(claimResponse);

      // Extract financial totals
      const totals = claimResponse.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        amount: total.amount?.value,
        currency: total.amount?.currency || 'SAR'
      })) || [];

      const approvedAmount = totals.find(t => t.category === 'benefit')?.amount ??
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
        approvedAmount ?? null,
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

        const itemApprovedAmount = item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'benefit')?.amount?.value ??
                                   item.adjudication?.find(a => a.category?.coding?.[0]?.code === 'eligible')?.amount?.value;

        await client.query(`
          UPDATE prior_authorization_items
          SET adjudication_status = $1,
              adjudication_amount = $2
          WHERE prior_auth_id = $3 AND sequence = $4
        `, [adjudicationStatus, itemApprovedAmount ?? null, recordId, item.itemSequence]);
      }

      // Extract NPHIES validation errors from ClaimResponse.error[] so the UI can
      // surface them per-item without re-parsing the whole bundle on every render.
      const claimResponseErrors = (claimResponse.error || []).map(err => ({
        code: err.code?.coding?.[0]?.code,
        message: err.code?.coding?.[0]?.display,
        location: err.code?.coding?.[0]?.extension?.find(
          ext => ext.url?.includes('error-expression')
        )?.valueString || null
      }));
      const hasErrors = claimResponseErrors.length > 0 || outcome === 'error';

      // Store in responses table
      await client.query(`
        INSERT INTO prior_authorization_responses
        (prior_auth_id, response_type, outcome, disposition, pre_auth_ref,
         bundle_json, has_errors, errors, is_nphies_generated, nphies_response_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        recordId, 'poll', outcome,
        claimResponse.disposition || null,
        claimResponse.preAuthRef || null,
        JSON.stringify(claimResponse),
        hasErrors,
        claimResponseErrors.length > 0 ? JSON.stringify(claimResponseErrors) : null,
        true,
        claimResponse.id || null
      ]);

      console.log(`[MessageUpdater] Updated prior_authorization #${recordId}: status=${status}, outcome=${outcome}, errors=${claimResponseErrors.length}`);

      return {
        table: 'prior_authorizations',
        recordId,
        status,
        outcome,
        adjudicationOutcome,
        needsReview,
        disposition: claimResponse.disposition
      };

    });
  }

  /**
   * Update a Claim Submission with a ClaimResponse from poll
   */
  async updateClaimSubmission(recordId, claimResponse, responseBundle, schemaName) {
    return transaction(async client => {
      await setLocalSearchPath(client, schemaName);

      const { status: newStatus, outcome, adjudicationOutcome, needsReview } = mapClaimResponseStatus(claimResponse);

      const nphiesClaimId = claimResponse.identifier?.[0]?.value || claimResponse.id;

      // Extract financial totals from ClaimResponse
      const totals = claimResponse.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        amount: total.amount?.value,
        currency: total.amount?.currency || 'SAR'
      })) || [];

      const approvedAmount = totals.find(t => t.category === 'benefit')?.amount ??
                             totals.find(t => t.category === 'eligible')?.amount;
      const eligibleAmount = totals.find(t => t.category === 'eligible')?.amount;
      const benefitAmount = totals.find(t => t.category === 'benefit')?.amount;
      const copayAmount = totals.find(t => t.category === 'copay')?.amount;
      const taxAmount = totals.find(t => t.category === 'tax')?.amount;

      // Store the full message bundle (with all related resources) when available,
      // otherwise fall back to just the ClaimResponse
      const bundleToStore = responseBundle || claimResponse;

      await client.query(`
        UPDATE claim_submissions
        SET status = $1,
            outcome = $2,
            disposition = $3,
            nphies_claim_id = COALESCE($4, nphies_claim_id),
            adjudication_outcome = $5,
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
        newStatus, outcome, claimResponse.disposition,
        nphiesClaimId, adjudicationOutcome,
        approvedAmount ?? null,
        eligibleAmount ?? null,
        benefitAmount ?? null,
        copayAmount ?? null,
        taxAmount ?? null,
        JSON.stringify(bundleToStore),
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
          recordId,
          item.itemSequence
        ]);
      }

      // Extract NPHIES validation errors from ClaimResponse.error[] so the UI can
      // surface them per-item without re-parsing the whole bundle on every render.
      const claimResponseErrors = (claimResponse.error || []).map(err => ({
        code: err.code?.coding?.[0]?.code,
        message: err.code?.coding?.[0]?.display,
        location: err.code?.coding?.[0]?.extension?.find(
          ext => ext.url?.includes('error-expression')
        )?.valueString || null
      }));
      const hasErrors = claimResponseErrors.length > 0 || outcome === 'error';

      // Store in responses table (full bundle for response history)
      await client.query(`
        INSERT INTO claim_submission_responses
        (claim_id, response_type, outcome, disposition, nphies_claim_id,
         bundle_json, has_errors, errors, is_nphies_generated, nphies_response_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        recordId, 'poll', outcome,
        claimResponse.disposition || null,
        nphiesClaimId,
        JSON.stringify(bundleToStore),
        hasErrors,
        claimResponseErrors.length > 0 ? JSON.stringify(claimResponseErrors) : null,
        true,
        claimResponse.id || null
      ]);

      console.log(`[MessageUpdater] Updated claim_submission #${recordId}: status=${newStatus}, outcome=${outcome}, errors=${claimResponseErrors.length}`);

      return {
        table: 'claim_submissions',
        recordId,
        status: newStatus,
        outcome,
        adjudicationOutcome,
        needsReview,
        disposition: claimResponse.disposition
      };

    });
  }

  /**
   * Update a Claim Batch with a ClaimResponse received via system poll.
   * Mirrors the logic from claimBatchesController.processPolledClaimResponses.
   *
   * @param {number} recordId - The claim_batches.id
   * @param {Object} claimResponse - The FHIR ClaimResponse resource
   * @param {Object} correlationResult - Includes batchNumber from the correlator
   * @param {string} schemaName
   */
  async updateClaimBatch(recordId, claimResponse, correlationResult, schemaName) {
    // One transaction with the batch row locked, so concurrent polls cannot
    // overwrite each other's polledResponses.
    return transaction(async client => {
      await setLocalSearchPath(client, schemaName);

      const batchResult = await client.query(
        `SELECT request_bundle, response_bundle, total_claims FROM claim_batches WHERE id = $1 FOR UPDATE`,
        [recordId]
      );
      if (batchResult.rows.length === 0) {
        console.error(`[MessageUpdater] claim_batches #${recordId} not found`);
        return null;
      }

      const batch = batchResult.rows[0];
      const requestBundle = typeof batch.request_bundle === 'string'
        ? JSON.parse(batch.request_bundle) : batch.request_bundle;
      const itemIds = requestBundle?._metadata?.item_ids || requestBundle?.item_ids || [];

      // Parse the ClaimResponse
      const adjudicationOutcome = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      )?.valueCodeableConcept?.coding?.[0]?.code;

      const batchIdentifier = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-batch-identifier')
      )?.valueIdentifier?.value;

      const batchNumber = correlationResult?.batchNumber ||
        claimResponse.extension?.find(
          ext => ext.url?.includes('extension-batch-number')
        )?.valuePositiveInt;

      const outcome = claimResponse.outcome || 'complete';
      // Response identifier: used to recognise a re-delivered response.
      const nphiesClaimId = claimResponse.identifier?.[0]?.value || claimResponse.id || null;
      const itemId = batchNumber ? itemIds[batchNumber - 1] : null;

      let existingResponseBundle = {};
      if (batch.response_bundle) {
        existingResponseBundle = typeof batch.response_bundle === 'string'
          ? JSON.parse(batch.response_bundle) : batch.response_bundle;
      }
      if (!Array.isArray(existingResponseBundle.polledResponses)) {
        existingResponseBundle.polledResponses = [];
      }

      // Extract financial totals from ClaimResponse
      const totals = claimResponse.total?.map(t => ({
        category: t.category?.coding?.[0]?.code,
        amount: t.amount?.value,
        currency: t.amount?.currency || 'SAR'
      })) || [];
      const benefitAmount = totals.find(t => t.category === 'benefit')?.amount;
      const eligibleAmount = totals.find(t => t.category === 'eligible')?.amount;
      const copayAmount = totals.find(t => t.category === 'copay')?.amount;
      const claimApprovedAmount = benefitAmount ?? eligibleAmount ?? 0;

      const polledEntry = {
        batchNumber,
        itemId,
        outcome,
        adjudicationOutcome,
        disposition: claimResponse.disposition,
        nphiesClaimId,
        batchIdentifier,
        approvedAmount: claimApprovedAmount,
        eligibleAmount: eligibleAmount ?? 0,
        copayAmount: copayAmount ?? 0,
        errors: [],
        receivedAt: new Date().toISOString()
      };

      // Dedupe: the same response (same identifier) or a newer response for the
      // same claim in the batch (same batch number) replaces the earlier entry.
      const existingIndex = existingResponseBundle.polledResponses.findIndex(pr =>
        (nphiesClaimId && pr.nphiesClaimId === nphiesClaimId) ||
        (batchNumber != null && pr.batchNumber != null && Number(pr.batchNumber) === Number(batchNumber))
      );
      const duplicate = existingIndex !== -1;
      if (duplicate) {
        existingResponseBundle.polledResponses[existingIndex] = polledEntry;
      } else {
        existingResponseBundle.polledResponses.push(polledEntry);
      }

      // Compute batch-level stats from all polledResponses
      let approved = 0, rejected = 0, totalApprovedAmount = 0;
      for (const pr of existingResponseBundle.polledResponses) {
        if (pr.outcome === 'complete' || pr.outcome === 'partial') {
          if (pr.adjudicationOutcome === 'approved' || pr.adjudicationOutcome === 'partial') {
            approved++;
            totalApprovedAmount += parseFloat(pr.approvedAmount || 0);
          } else if (pr.adjudicationOutcome === 'rejected') {
            rejected++;
          }
        } else if (pr.outcome === 'error') {
          rejected++;
        }
      }

      const totalClaims = batch.total_claims || 0;
      if (totalClaims > 0) {
        // Never report more processed claims than the batch contains.
        approved = Math.min(approved, totalClaims);
        rejected = Math.min(rejected, totalClaims - approved);
      }
      const processedCount = approved + rejected;
      let batchStatus = 'Submitted';
      if (processedCount === totalClaims && totalClaims > 0) {
        if (rejected === totalClaims) batchStatus = 'Rejected';
        else if (approved === totalClaims) batchStatus = 'Processed';
        else batchStatus = 'Partial';
      } else if (processedCount > 0) {
        batchStatus = 'Partial';
      }

      await client.query(`
        UPDATE claim_batches
        SET response_bundle = $1,
            status = $2,
            processed_claims = $3,
            approved_claims = $4,
            rejected_claims = $5,
            approved_amount = $6,
            processed_date = CASE WHEN $8 IN ('Processed', 'Partial', 'Rejected') THEN CURRENT_TIMESTAMP ELSE processed_date END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
      `, [
        JSON.stringify(existingResponseBundle),
        batchStatus,
        processedCount,
        approved,
        rejected,
        totalApprovedAmount,
        recordId,
        batchStatus
      ]);

      // Also update the related prior_authorization_item adjudication if we can
      if (itemId && batchNumber) {
        const itemOutcome = claimResponse.item?.[0]?.extension?.find(
          ext => ext.url?.includes('extension-adjudication-outcome')
        )?.valueCodeableConcept?.coding?.[0]?.code;

        const adjStatus = itemOutcome === 'approved' ? 'approved'
          : itemOutcome === 'rejected' ? 'denied'
          : adjudicationOutcome === 'approved' ? 'approved'
          : adjudicationOutcome === 'rejected' ? 'denied' : 'pending';

        const itemBenefitAmount = claimResponse.item?.[0]?.adjudication?.find(
          a => a.category?.coding?.[0]?.code === 'benefit'
        )?.amount?.value;

        await client.query(`
          UPDATE prior_authorization_items
          SET adjudication_status = $1,
              adjudication_amount = COALESCE($2, adjudication_amount)
          WHERE id = $3
        `, [adjStatus, itemBenefitAmount ?? null, itemId]);
      }

      console.log(`[MessageUpdater] Updated claim_batch #${recordId}: batchNumber=${batchNumber}, outcome=${outcome}, adjudication=${adjudicationOutcome}${duplicate ? ' (replaced earlier response)' : ''}`);

      return {
        table: 'claim_batches',
        recordId,
        status: batchStatus,
        outcome,
        adjudicationOutcome,
        batchNumber,
        duplicate
      };
    });
  }

  /**
   * Save an Advanced Authorization (payer-initiated, no matching outbound request)
   * Reuses the parsing logic from advancedAuthParser
   */
  async saveAdvancedAuthorization(claimResponse, pollBundle, responseBundle, schemaName) {
    const parsed = advancedAuthParser.parseAdvancedAuthorization(claimResponse);

    // Check-then-insert runs in one transaction under an advisory lock on the
    // identifier, so two concurrent polls cannot both insert the same authorization.
    return transaction(async client => {
      await setLocalSearchPath(client, schemaName);

      // Check if already exists by identifier
      if (parsed.identifier_value) {
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`advanced_authorizations:${parsed.identifier_value}`]
        );
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
    });
  }

  /**
   * Store a CommunicationRequest (payer asking for info)
   * 
   * @param {Object} commRequest - The FHIR CommunicationRequest resource
   * @param {Object} correlationResult - Result from correlator with matched table/record
   * @param {string} schemaName
   */
  async storeCommunicationRequest(commRequest, correlationResult, schemaName) {
    return withSchemaClient(schemaName, async client => {
      const parsed = mapper.parseCommunicationRequest(commRequest);

      const priorAuthId = correlationResult?.table === 'prior_authorizations' ? correlationResult.recordId : null;
      const claimId = correlationResult?.table === 'claim_submissions' ? correlationResult.recordId : null;
      const advancedAuthId = correlationResult?.table === 'advanced_authorizations' ? correlationResult.recordId : null;

      const attachment = parsed.payloadAttachment || {};
      // request_id is UNIQUE: ON CONFLICT makes a re-delivered request a no-op
      // even when two polls store it at the same time.
      const result = await client.query(`
        INSERT INTO nphies_communication_requests (
          request_id, prior_auth_id, claim_id, advanced_authorization_id,
          status, category, priority,
          about_reference, about_type, about_identifier, about_identifier_system,
          cr_identifier, cr_identifier_system,
          payload_content_type, payload_content_string,
          payload_attachment_content_type, payload_attachment_data,
          payload_attachment_url, payload_attachment_title,
          sender_identifier, recipient_identifier, authored_on, request_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (request_id) DO NOTHING
        RETURNING *
      `, [
        commRequest.id,
        priorAuthId,
        claimId,
        advancedAuthId,
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
        attachment.contentType || null,
        attachment.data || null,
        attachment.url || null,
        attachment.title || null,
        parsed.senderIdentifier,
        parsed.recipientIdentifier,
        parsed.authoredOn,
        JSON.stringify(commRequest)
      ]);

      if (result.rows.length === 0) {
        const existing = await client.query(
          `SELECT id FROM nphies_communication_requests WHERE request_id = $1`,
          [commRequest.id]
        );
        return { id: existing.rows[0]?.id, alreadyStored: true, table: 'nphies_communication_requests' };
      }

      console.log(`[MessageUpdater] Stored CommunicationRequest: id=${commRequest.id}, prior_auth=${priorAuthId}, claim=${claimId}, advanced_auth=${advancedAuthId}`);

      // Return the parent (correlated) record info for the link,
      // so the poll UI can link to the original PA/Claim/AdvancedAuth rather than
      // the CommunicationRequest record itself
      const parentTable = priorAuthId ? 'prior_authorizations' :
                          claimId ? 'claim_submissions' :
                          advancedAuthId ? 'advanced_authorizations' : null;
      const parentRecordId = priorAuthId || claimId || advancedAuthId || null;

      return {
        id: result.rows[0].id,
        table: parentTable || 'nphies_communication_requests',
        recordId: parentRecordId || result.rows[0].id,
        newRecordTable: 'nphies_communication_requests',
        newRecordId: result.rows[0].id,
        isNew: true
      };
    });
  }

  /**
   * Store a Communication received from NPHIES.
   *
   * - An acknowledgment (inResponseTo one of our Communications) updates that
   *   Communication's acknowledgment fields.
   * - Any other Communication is stored as a new, payer-originated row linked to
   *   the correlated PA / claim / advanced authorization / CommunicationRequest.
   */
  async storeCommunication(communication, correlationResult, schemaName) {
    return withSchemaTransaction(schemaName, async client => {
      const parentOf = row => {
        const table = row.prior_auth_id ? 'prior_authorizations' :
                      row.claim_id ? 'claim_submissions' :
                      row.advanced_authorization_id ? 'advanced_authorizations' : null;
        return { table, recordId: row.prior_auth_id || row.claim_id || row.advanced_authorization_id || null };
      };

      // 1. Acknowledgment of a Communication we sent
      const inResponseTo = communication.inResponseTo?.[0]?.reference;
      const ourCommunicationId = inResponseTo ? mapper.extractIdFromReference(inResponseTo) : null;
      if (ourCommunicationId) {
        const ack = await client.query(`
          UPDATE nphies_communications
          SET acknowledgment_received = TRUE,
              acknowledgment_at = NOW(),
              acknowledgment_status = $1,
              acknowledgment_bundle = $2
          WHERE communication_id = $3
          RETURNING id, prior_auth_id, claim_id, advanced_authorization_id
        `, [communication.status || 'completed', JSON.stringify(communication), ourCommunicationId]);
        if (ack.rows.length > 0) {
          const parent = parentOf(ack.rows[0]);
          console.log(`[MessageUpdater] Acknowledgment stored for Communication ${ourCommunicationId}`);
          return {
            id: ack.rows[0].id,
            table: parent.table || 'nphies_communications',
            recordId: parent.recordId || ack.rows[0].id,
            acknowledgment: true,
            isNew: false
          };
        }
      }

      const priorAuthId = correlationResult?.relatedPriorAuthId || 
                          (correlationResult?.table === 'prior_authorizations' ? correlationResult.recordId : null);
      const claimId = correlationResult?.relatedClaimId ||
                      (correlationResult?.table === 'claim_submissions' ? correlationResult.recordId : null);
      const advancedAuthId = correlationResult?.relatedAdvancedAuthId ||
                             (correlationResult?.table === 'advanced_authorizations' ? correlationResult.recordId : null);
      const communicationRequestId = correlationResult?.relatedCommunicationRequestId || null;

      const about = communication.about?.[0] || {};
      const aboutType = about.type || mapper.extractTypeFromReference(about.reference);
      const status = COMMUNICATION_STATUSES.has(communication.status) ? communication.status : 'unknown';

      // 2. Store as a new Communication (communication_id is UNIQUE: re-delivery is a no-op)
      const result = await client.query(`
        INSERT INTO nphies_communications (
          communication_id, prior_auth_id, claim_id, advanced_authorization_id,
          communication_type, based_on_request_id,
          status, category, about_reference, about_type,
          sender_identifier, recipient_identifier, sent_at,
          request_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (communication_id) DO NOTHING
        RETURNING *
      `, [
        communication.id,
        priorAuthId,
        claimId,
        advancedAuthId,
        (communicationRequestId || communication.basedOn?.length) ? 'solicited' : 'unsolicited',
        communicationRequestId,
        status,
        communication.category?.[0]?.coding?.[0]?.code || 'alert',
        about.reference || about.identifier?.value || null,
        ['Claim', 'ClaimResponse'].includes(aboutType) ? aboutType : null,
        communication.sender?.identifier?.value || null,
        communication.recipient?.[0]?.identifier?.value || null,
        communication.sent || null,
        JSON.stringify(communication)
      ]);

      if (result.rows.length === 0) {
        const existing = await client.query(
          `SELECT id FROM nphies_communications WHERE communication_id = $1`,
          [communication.id]
        );
        return { id: existing.rows[0]?.id, alreadyStored: true, table: 'nphies_communications' };
      }

      console.log(`[MessageUpdater] Stored Communication: id=${communication.id}, prior_auth=${priorAuthId}, claim=${claimId}, advanced_auth=${advancedAuthId}`);

      // Return the parent (correlated) record info for the link
      const parent = parentOf(result.rows[0]);
      return {
        id: result.rows[0].id,
        table: parent.table || 'nphies_communications',
        recordId: parent.recordId || result.rows[0].id,
        newRecordTable: 'nphies_communications',
        newRecordId: result.rows[0].id,
        isNew: true
      };
    });
  }

  /**
   * Store a PaymentReconciliation received via system poll.
   * Delegates to PaymentReconciliationService.processBundle() which handles
   * validation, extraction, duplicate checking, and DB storage.
   *
   * @param {Object} messageBundle - The full FHIR message Bundle containing the PaymentReconciliation
   * @param {string} schemaName
   * @returns {Object} { table, recordId, isNew }
   */
  async storePaymentReconciliation(messageBundle, schemaName) {
    const result = await PaymentReconciliationService.processBundle(messageBundle);

    if (result.success) {
      console.log(`[MessageUpdater] Stored PaymentReconciliation #${result.reconciliationId} from system poll`);
      return {
        table: 'payment_reconciliations',
        recordId: result.reconciliationId,
        isNew: !result.duplicate
      };
    }

    if (result.duplicate) {
      console.log(`[MessageUpdater] PaymentReconciliation duplicate skipped`);
      return {
        table: 'payment_reconciliations',
        recordId: null,
        isNew: false,
        alreadyStored: true
      };
    }

    throw new Error('PaymentReconciliation processing failed: '+(result.errors || []).join('; '));
  }
}

export default new MessageUpdater();
