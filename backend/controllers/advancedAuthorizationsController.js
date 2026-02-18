/**
 * Advanced Authorizations Controller
 * 
 * Handles payer-initiated Advanced Prior Authorization (APA) responses.
 * These are ClaimResponses with the advanced-authorization profile that
 * arrive via polling from NPHIES.
 */

import pool from '../db.js';
import nphiesService from '../services/nphiesService.js';
import advancedAuthParser from '../services/advancedAuthParser.js';
import CommunicationMapper from '../services/communicationMapper.js';
import advancedAuthCommunicationService from '../services/advancedAuthCommunicationService.js';
import priorAuthMapper from '../services/priorAuthMapper/index.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

class AdvancedAuthorizationsController {
  constructor() {
    this.mapper = new CommunicationMapper();
  }

  /**
   * List all Advanced Authorizations with pagination and filtering
   */
  async getAll(req, res) {
    try {
      const schemaName = req.schemaName || 'public';
      const {
        page = 1,
        limit = 20,
        auth_reason,
        outcome,
        adjudication_outcome,
        claim_type,
        search,
        sort_by = 'received_at',
        sort_order = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (auth_reason) {
        conditions.push(`auth_reason = $${paramIdx++}`);
        params.push(auth_reason);
      }
      if (outcome) {
        conditions.push(`outcome = $${paramIdx++}`);
        params.push(outcome);
      }
      if (adjudication_outcome) {
        conditions.push(`adjudication_outcome = $${paramIdx++}`);
        params.push(adjudication_outcome);
      }
      if (claim_type) {
        conditions.push(`claim_type = $${paramIdx++}`);
        params.push(claim_type);
      }
      if (search) {
        conditions.push(`(identifier_value ILIKE $${paramIdx} OR pre_auth_ref ILIKE $${paramIdx} OR referring_provider_display ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Validate sort columns
      const allowedSortColumns = ['received_at', 'created_date', 'auth_reason', 'outcome', 'claim_type', 'adjudication_outcome', 'id'];
      const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'received_at';
      const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        // Get total count
        const countResult = await client.query(
          `SELECT COUNT(*) FROM advanced_authorizations ${whereClause}`,
          params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const dataResult = await client.query(
          `SELECT id, identifier_system, identifier_value, status, claim_type, claim_subtype,
                  use_field, auth_reason, outcome, adjudication_outcome, disposition,
                  patient_reference, insurer_reference, service_provider_reference,
                  referring_provider_display, pre_auth_ref, pre_auth_period_start,
                  pre_auth_period_end, created_date, is_newborn, reissue_reason,
                  received_at, created_at, updated_at
           FROM advanced_authorizations
           ${whereClause}
           ORDER BY ${safeSortBy} ${safeSortOrder}
           LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
          [...params, limit, offset]
        );

        // Get stats
        const statsResult = await client.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE adjudication_outcome = 'approved') as approved,
            COUNT(*) FILTER (WHERE adjudication_outcome = 'partial') as partial,
            COUNT(*) FILTER (WHERE adjudication_outcome = 'denied' OR adjudication_outcome = 'refused') as denied,
            COUNT(*) FILTER (WHERE outcome = 'queued') as pending
          FROM advanced_authorizations
        `);

        res.json({
          success: true,
          data: dataResult.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          },
          stats: statsResult.rows[0]
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error listing:', error);
      res.status(500).json({ error: error.message || 'Failed to list advanced authorizations' });
    }
  }

  /**
   * Get a single Advanced Authorization by ID with full details
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        const result = await client.query(
          'SELECT * FROM advanced_authorizations WHERE id = $1',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Advanced authorization not found' });
        }

        res.json({
          success: true,
          data: result.rows[0]
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error getting by ID:', error);
      res.status(500).json({ error: error.message || 'Failed to get advanced authorization' });
    }
  }

  /**
   * Preview the poll request bundle without sending
   * Returns the exact FHIR bundle that would be sent to NPHIES
   */
  async previewPollBundle(req, res) {
    try {
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      let providerNphiesId;
      let providerName;

      try {
        await client.query(`SET search_path TO ${schemaName}`);
        // First try to find the provider matching the configured NPHIES provider ID
        let providerResult = await client.query(
          `SELECT nphies_id, provider_name FROM providers WHERE nphies_id = $1 LIMIT 1`,
          [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
        );
        if (providerResult.rows.length === 0) {
          // Fallback: pick any provider that doesn't have a placeholder nphies_id
          providerResult = await client.query(
            `SELECT nphies_id, provider_name FROM providers WHERE nphies_id ~ '^[0-9]+$' ORDER BY created_at DESC LIMIT 1`
          );
        }
        if (providerResult.rows.length > 0) {
          providerNphiesId = providerResult.rows[0].nphies_id;
          providerName = providerResult.rows[0].provider_name;
        } else {
          providerNphiesId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
          providerName = 'Healthcare Provider';
        }
      } finally {
        client.release();
      }

      // Build a plain poll bundle (no input/focus) - same structure that works for prior auth polling
      // Advanced authorizations are payer-initiated, so we poll for ALL pending messages
      // and filter for advanced-authorization profile in the response
      const pollBundle = this.mapper.buildPollRequestBundle(
        providerNphiesId,
        providerName
      );

      res.json({
        success: true,
        pollBundle,
        endpoint: `${NPHIES_CONFIG.BASE_URL}/$process-message`,
        providerUsed: { nphiesId: providerNphiesId, name: providerName },
        description: 'This is the FHIR Bundle that will be sent to NPHIES to poll for Advanced Authorization responses. Uses plain poll (no input filters) - same structure as working prior auth polls.'
      });
    } catch (error) {
      console.error('[AdvancedAuth] Error building preview:', error);
      res.status(500).json({ error: error.message || 'Failed to build poll preview' });
    }
  }

  /**
   * Poll NPHIES for new Advanced Authorization responses
   * Builds a poll-request bundle with message type advanced-prior-authorization
   */
  async poll(req, res) {
    try {
      const schemaName = req.schemaName || 'public';

      // Get provider info for building the poll bundle
      const client = await pool.connect();
      let providerNphiesId;
      let providerName;

      try {
        await client.query(`SET search_path TO ${schemaName}`);

        // Find the provider matching the configured NPHIES provider ID
        let providerResult = await client.query(
          `SELECT nphies_id, provider_name FROM providers WHERE nphies_id = $1 LIMIT 1`,
          [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
        );
        if (providerResult.rows.length === 0) {
          // Fallback: pick any provider with a numeric nphies_id (real license, not placeholder)
          providerResult = await client.query(
            `SELECT nphies_id, provider_name FROM providers WHERE nphies_id ~ '^[0-9]+$' ORDER BY created_at DESC LIMIT 1`
          );
        }

        if (providerResult.rows.length > 0) {
          providerNphiesId = providerResult.rows[0].nphies_id;
          providerName = providerResult.rows[0].provider_name;
        } else {
          providerNphiesId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
          providerName = 'Healthcare Provider';
        }
      } finally {
        client.release();
      }

      // Build a plain poll bundle (no input/focus) - same structure that works for prior auth polling
      // Advanced authorizations are payer-initiated, so we poll for ALL pending messages
      // and filter for advanced-authorization profile in the response
      const pollBundle = this.mapper.buildPollRequestBundle(
        providerNphiesId,
        providerName
      );

      console.log(`[AdvancedAuth] Sending poll request using provider: ${providerNphiesId} (${providerName})`);

      // Send poll to NPHIES
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        // Extract meaningful error details from NPHIES response
        const nphiesErrors = pollResponse.errors || [];
        const errorDetails = nphiesErrors.length > 0
          ? nphiesErrors.map(e => e.diagnostics || e.message || e.code || JSON.stringify(e)).join('; ')
          : pollResponse.error || 'Unknown error';
        
        return res.json({
          success: false,
          message: `NPHIES Error (${pollResponse.responseCode || 'unknown'}): ${errorDetails}`,
          error: pollResponse.error,
          details: pollResponse.error,
          pollBundle,
          responseBundle: pollResponse.data || null,
          endpoint: `${NPHIES_CONFIG.BASE_URL}/$process-message`,
          errors: nphiesErrors,
          responseCode: pollResponse.responseCode
        });
      }

      // Extract advanced authorizations from the response
      const advancedAuths = advancedAuthParser.extractFromPollResponse(pollResponse.data);
      
      // Also extract any ClaimResponses that might be advanced auths
      const allClaimResponses = nphiesService.extractClaimResponsesFromPoll(pollResponse.data);
      for (const cr of allClaimResponses) {
        if (advancedAuthParser.isAdvancedAuthorization(cr)) {
          // Only add if not already found
          const alreadyFound = advancedAuths.some(a => a.id === cr.id);
          if (!alreadyFound) {
            advancedAuths.push(cr);
          }
        }
      }

      console.log(`[AdvancedAuth] Found ${advancedAuths.length} advanced authorization(s)`);

      // Save each to database
      const saved = [];
      const saveErrors = [];

      for (const apa of advancedAuths) {
        try {
          const savedRecord = await this.saveAdvancedAuth(apa, schemaName, pollBundle, pollResponse.data);
          saved.push(savedRecord);
        } catch (err) {
          console.error('[AdvancedAuth] Error saving APA:', err);
          saveErrors.push({ id: apa.id, error: err.message });
        }
      }

      res.json({
        success: true,
        message: advancedAuths.length > 0
          ? `Found and saved ${saved.length} advanced authorization(s)`
          : 'No new advanced authorizations found',
        data: saved,
        pollBundle,
        responseBundle: pollResponse.data,
        endpoint: `${NPHIES_CONFIG.BASE_URL}/$process-message`,
        errors: [...(pollResponse.errors || []), ...saveErrors],
        responseCode: pollResponse.responseCode,
        stats: {
          found: advancedAuths.length,
          saved: saved.length,
          errors: saveErrors.length
        }
      });
    } catch (error) {
      console.error('[AdvancedAuth] Error polling:', error);
      res.status(500).json({ error: error.message || 'Failed to poll for advanced authorizations' });
    }
  }

  /**
   * Save a parsed Advanced Authorization to the database
   */
  async saveAdvancedAuth(claimResponse, schemaName, pollBundle = null, pollResponseBundle = null) {
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
            pollResponseBundle ? JSON.stringify(pollResponseBundle) : null,
            parsed.transfer_auth_number, parsed.transfer_auth_period_start,
            parsed.transfer_auth_period_end, parsed.transfer_auth_provider,
            schemaName, parsed.identifier_value
          ]);
          return updateResult.rows[0];
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
        pollResponseBundle ? JSON.stringify(pollResponseBundle) : null,
        parsed.transfer_auth_number, parsed.transfer_auth_period_start,
        parsed.transfer_auth_period_end, parsed.transfer_auth_provider,
        schemaName
      ]);

      return insertResult.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Download the full FHIR message Bundle as JSON.
   * Prefers the inner message Bundle from poll_response_bundle (contains ClaimResponse + Patient + Organizations + Coverage).
   * Falls back to response_bundle (raw ClaimResponse) if poll_response_bundle is unavailable.
   */
  async downloadJson(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        const result = await client.query(
          'SELECT response_bundle, poll_response_bundle, identifier_value FROM advanced_authorizations WHERE id = $1',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Advanced authorization not found' });
        }

        const { response_bundle, poll_response_bundle, identifier_value } = result.rows[0];
        const filename = `advanced-auth-${identifier_value || id}.json`;

        let downloadBundle = response_bundle;

        if (poll_response_bundle && poll_response_bundle.resourceType === 'Bundle' && poll_response_bundle.entry) {
          // Case 1: poll_response_bundle is the outer poll response - find the inner message Bundle
          const innerBundle = poll_response_bundle.entry.find(e => {
            const r = e?.resource;
            return r?.resourceType === 'Bundle' && r.type === 'message' &&
                   r.entry?.some(ie => ie.resource?.resourceType === 'ClaimResponse');
          })?.resource;

          if (innerBundle) {
            downloadBundle = innerBundle;
          } else if (poll_response_bundle.type === 'message') {
            // Case 2: poll_response_bundle IS the inner message Bundle directly
            downloadBundle = poll_response_bundle;
          }
        }

        res.setHeader('Content-Type', 'application/fhir+json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(downloadBundle);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error downloading JSON:', error);
      res.status(500).json({ error: error.message || 'Failed to download' });
    }
  }

  // ============================================================================
  // CANCEL
  // ============================================================================

  /**
   * Cancel an Advanced Authorization by sending a cancel-request to NPHIES.
   * Reuses the prior auth cancel bundle structure since the Task resource is identical.
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        // Fetch the advanced authorization
        const result = await client.query(
          'SELECT * FROM advanced_authorizations WHERE id = $1',
          [id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Advanced authorization not found' });
        }

        const advAuth = result.rows[0];

        if (advAuth.status === 'cancelled' || advAuth.is_cancelled) {
          return res.status(400).json({ error: 'Advanced authorization is already cancelled' });
        }

        if (!advAuth.pre_auth_ref && !advAuth.identifier_value) {
          return res.status(400).json({ error: 'Cannot cancel: no authorization reference exists' });
        }

        if (advAuth.pre_auth_period_end) {
          const periodEnd = new Date(advAuth.pre_auth_period_end);
          if (periodEnd < new Date()) {
            return res.status(400).json({ error: 'Cannot cancel: authorization period has expired' });
          }
        }

        // Extract provider/insurer from the bundle
        const commService = advancedAuthCommunicationService;
        const bundleData = commService.extractBundleData(advAuth);

        // Build provider/insurer objects compatible with priorAuthMapper
        let providerNphiesId = bundleData.provider?.nphies_id;
        let providerName = bundleData.provider?.provider_name;

        if (!providerNphiesId) {
          const provResult = await client.query(
            'SELECT nphies_id, provider_name FROM providers WHERE nphies_id = $1 LIMIT 1',
            [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
          );
          if (provResult.rows.length > 0) {
            providerNphiesId = provResult.rows[0].nphies_id;
            providerName = provResult.rows[0].provider_name;
          } else {
            providerNphiesId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
            providerName = 'Healthcare Provider';
          }
        }

        const insurerNphiesId = bundleData.insurer?.nphies_id || NPHIES_CONFIG.DEFAULT_INSURER_ID;
        const insurerName = bundleData.insurer?.insurer_name || 'Insurance Company';

        // Use the original Claim identifier for the cancel Task focus
        const claimResponse = advAuth.response_bundle;
        const requestIdentifier = claimResponse?.request?.identifier?.value || advAuth.identifier_value;
        const identifierSystem = claimResponse?.request?.identifier?.system ||
          `http://${(providerName || 'provider').toLowerCase().replace(/\s+/g, '')}.com/Authorization`;

        const provider = {
          nphies_id: providerNphiesId,
          provider_name: providerName,
          provider_id: providerNphiesId,
          identifier_system: identifierSystem
        };

        const insurer = {
          nphies_id: insurerNphiesId,
          insurer_name: insurerName,
          insurer_id: insurerNphiesId
        };

        // Build the cancel bundle - reuse prior auth mapper's cancel task builder
        const cancelBundle = priorAuthMapper.buildCancelRequestBundle(
          {
            request_number: requestIdentifier,
            nphies_request_id: requestIdentifier,
            pre_auth_ref: advAuth.pre_auth_ref || advAuth.identifier_value,
            id: advAuth.id
          },
          provider,
          insurer,
          reason
        );

        console.log(`[AdvancedAuth] Sending cancel request for APA ${advAuth.identifier_value}`);

        const nphiesResponse = await nphiesService.submitCancelRequest(cancelBundle);

        if (nphiesResponse.success) {
          const dbOutcome = nphiesResponse.taskStatus === 'completed' ? 'complete' :
                            nphiesResponse.taskStatus === 'failed' ? 'error' : 'complete';

          await client.query(`
            UPDATE advanced_authorizations
            SET status = 'cancelled',
                is_cancelled = true,
                cancellation_reason = $1,
                cancel_outcome = $2,
                cancelled_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [reason, dbOutcome, id]);

          const updatedResult = await client.query(
            'SELECT * FROM advanced_authorizations WHERE id = $1',
            [id]
          );

          res.json({
            success: true,
            data: updatedResult.rows[0],
            message: 'Advanced authorization cancelled successfully',
            taskStatus: nphiesResponse.taskStatus,
            nphiesResponse: nphiesResponse.data,
            requestBundle: cancelBundle
          });
        } else {
          await client.query(`
            UPDATE advanced_authorizations
            SET cancel_outcome = 'error',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [id]);

          res.status(502).json({
            success: false,
            error: nphiesResponse.error || nphiesResponse.errors,
            taskStatus: nphiesResponse.taskStatus,
            message: 'Failed to cancel advanced authorization',
            nphiesResponse: nphiesResponse.data,
            requestBundle: cancelBundle
          });
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error cancelling:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel advanced authorization' });
    }
  }

  // ============================================================================
  // COMMUNICATION METHODS
  // ============================================================================

  /**
   * Preview Communication bundle without sending
   */
  async previewCommunicationBundle(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';
      const { payloads = [], type = 'unsolicited', communicationRequestId = null } = req.body;

      const result = await advancedAuthCommunicationService.previewCommunicationBundle(
        parseInt(id), payloads, type, communicationRequestId, schemaName
      );

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[AdvancedAuth] Error previewing communication bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to preview communication bundle' });
    }
  }

  /**
   * Send unsolicited communication
   */
  async sendUnsolicitedCommunication(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';
      const { payloads } = req.body;

      if (!payloads || payloads.length === 0) {
        return res.status(400).json({ error: 'At least one payload is required' });
      }

      const result = await advancedAuthCommunicationService.sendUnsolicitedCommunication(
        parseInt(id), payloads, schemaName
      );

      res.json(result);
    } catch (error) {
      console.error('[AdvancedAuth] Error sending unsolicited communication:', error);
      res.status(500).json({ error: error.message || 'Failed to send communication' });
    }
  }

  /**
   * Send solicited communication (response to CommunicationRequest)
   */
  async sendSolicitedCommunication(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';
      const { communicationRequestId, payloads } = req.body;

      if (!communicationRequestId) {
        return res.status(400).json({ error: 'communicationRequestId is required' });
      }
      if (!payloads || payloads.length === 0) {
        return res.status(400).json({ error: 'At least one payload is required' });
      }

      const result = await advancedAuthCommunicationService.sendSolicitedCommunication(
        parseInt(communicationRequestId), payloads, schemaName
      );

      res.json(result);
    } catch (error) {
      console.error('[AdvancedAuth] Error sending solicited communication:', error);
      res.status(500).json({ error: error.message || 'Failed to send solicited communication' });
    }
  }

  /**
   * Get CommunicationRequests for an Advanced Authorization
   */
  async getCommunicationRequests(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const requests = await advancedAuthCommunicationService.getCommunicationRequests(
        parseInt(id), schemaName
      );

      res.json({ success: true, data: requests });
    } catch (error) {
      console.error('[AdvancedAuth] Error getting communication requests:', error);
      res.status(500).json({ error: error.message || 'Failed to get communication requests' });
    }
  }

  /**
   * Download an attachment from a CommunicationRequest payload
   */
  async downloadCommunicationRequestAttachment(req, res) {
    try {
      const { requestId, payloadIndex } = req.params;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);
        const result = await client.query(
          'SELECT request_bundle FROM nphies_communication_requests WHERE id = $1',
          [parseInt(requestId)]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Communication request not found' });
        }

        const bundle = typeof result.rows[0].request_bundle === 'string'
          ? JSON.parse(result.rows[0].request_bundle)
          : result.rows[0].request_bundle;

        const idx = parseInt(payloadIndex);
        const payload = bundle?.payload?.[idx];
        if (!payload?.contentAttachment?.data) {
          return res.status(404).json({ error: 'Attachment not found at the specified payload index' });
        }

        const att = payload.contentAttachment;
        const buffer = Buffer.from(att.data, 'base64');
        const filename = att.title || `attachment_${idx}`;
        const contentType = att.contentType || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error downloading communication request attachment:', error);
      res.status(500).json({ error: error.message || 'Failed to download attachment' });
    }
  }

  /**
   * Get sent Communications for an Advanced Authorization
   */
  async getCommunications(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const communications = await advancedAuthCommunicationService.getCommunications(
        parseInt(id), schemaName
      );

      res.json({ success: true, data: communications });
    } catch (error) {
      console.error('[AdvancedAuth] Error getting communications:', error);
      res.status(500).json({ error: error.message || 'Failed to get communications' });
    }
  }

  /**
   * Get a single Communication by ID
   */
  async getCommunicationById(req, res) {
    try {
      const { commId } = req.params;
      const schemaName = req.schemaName || 'public';

      const communication = await advancedAuthCommunicationService.getCommunication(
        commId, schemaName
      );

      if (!communication) {
        return res.status(404).json({ error: 'Communication not found' });
      }

      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('[AdvancedAuth] Error getting communication:', error);
      res.status(500).json({ error: error.message || 'Failed to get communication' });
    }
  }

  /**
   * Poll for acknowledgment of a specific Communication
   */
  async pollCommunicationAcknowledgment(req, res) {
    try {
      const { id, commId } = req.params;
      const schemaName = req.schemaName || 'public';

      const result = await advancedAuthCommunicationService.pollCommunicationAcknowledgment(
        parseInt(id), commId, schemaName
      );

      res.json(result);
    } catch (error) {
      console.error('[AdvancedAuth] Error polling for acknowledgment:', error);
      res.status(500).json({ error: error.message || 'Failed to poll for acknowledgment' });
    }
  }

  /**
   * Poll for all queued acknowledgments
   */
  async pollAllQueuedAcknowledgments(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const result = await advancedAuthCommunicationService.pollAllQueuedAcknowledgments(
        parseInt(id), schemaName
      );

      res.json(result);
    } catch (error) {
      console.error('[AdvancedAuth] Error polling all acknowledgments:', error);
      res.status(500).json({ error: error.message || 'Failed to poll acknowledgments' });
    }
  }

  /**
   * Delete an Advanced Authorization record
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        const result = await client.query(
          'DELETE FROM advanced_authorizations WHERE id = $1 RETURNING id',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Advanced authorization not found' });
        }

        res.json({
          success: true,
          message: 'Advanced authorization deleted successfully'
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error deleting:', error);
      res.status(500).json({ error: error.message || 'Failed to delete' });
    }
  }
}

export default new AdvancedAuthorizationsController();
