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

        // Get the first provider to use for polling
        const providerResult = await client.query(
          `SELECT nphies_id, provider_name FROM providers LIMIT 1`
        );

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

      // Build poll request bundle
      // Using the same Task-based structure but without specific focus
      // to get all pending advanced authorizations
      const pollBundle = this.mapper.buildPollRequestBundle(
        providerNphiesId,
        providerName
      );

      console.log('[AdvancedAuth] Sending poll request for advanced authorizations...');

      // Send poll to NPHIES
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to poll NPHIES',
          details: pollResponse.error,
          pollBundle,
          errors: pollResponse.errors || []
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
   * Download the raw FHIR ClaimResponse as JSON
   */
  async downloadJson(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schemaName}`);

        const result = await client.query(
          'SELECT response_bundle, identifier_value FROM advanced_authorizations WHERE id = $1',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Advanced authorization not found' });
        }

        const { response_bundle, identifier_value } = result.rows[0];
        const filename = `advanced-auth-${identifier_value || id}.json`;

        res.setHeader('Content-Type', 'application/fhir+json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(response_bundle);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[AdvancedAuth] Error downloading JSON:', error);
      res.status(500).json({ error: error.message || 'Failed to download' });
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
