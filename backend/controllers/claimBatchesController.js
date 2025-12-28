import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';
import batchClaimMapper from '../services/claimMapper/BatchClaimMapper.js';
import { getClaimMapper } from '../services/claimMapper/index.js';
import nphiesService from '../services/nphiesService.js';

/**
 * Claim Batches Controller
 * 
 * Handles NPHIES Batch Claims use case:
 * - Create batch from selected claims
 * - Submit batch to NPHIES
 * - Poll for deferred responses
 * 
 * Reference: https://portal.nphies.sa/ig/usecase-claim-batch.html
 */
class ClaimBatchesController extends BaseController {
  constructor() {
    super('claim_batches', validationSchemas.claimBatch);
  }

  // ============================================
  // GET METHODS
  // ============================================

  /**
   * Get all claim batches with joins
   */
  async getAll(req, res) {
    try {
      const queries = await loadQueries();
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (search) {
        whereConditions.push(`(cb.batch_identifier ILIKE $${paramIndex} OR pr.provider_name ILIKE $${paramIndex} OR i.insurer_name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`cb.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM claim_batches cb
        LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT 
          cb.*,
          pr.provider_name as provider_name,
          pr.nphies_id as provider_nphies_id,
          i.insurer_name as insurer_name,
          i.nphies_id as insurer_nphies_id,
          (SELECT COUNT(*) FROM claim_submissions cs WHERE cs.batch_id = cb.id) as claim_count
        FROM claim_batches cb
        LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY cb.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const result = await query(dataQuery, [...queryParams, limit, offset]);

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting claim batches:', error);
      res.status(500).json({ error: 'Failed to fetch claim batches' });
    }
  }

  /**
   * Get claim batch by ID with full details
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const batch = await this.getByIdInternal(id);

      if (!batch) {
        return res.status(404).json({ error: 'Claim batch not found' });
      }

      res.json({ data: batch });
    } catch (error) {
      console.error('Error getting claim batch by ID:', error);
      res.status(500).json({ error: 'Failed to fetch claim batch' });
    }
  }

  /**
   * Internal method to get batch with full details
   */
  async getByIdInternal(id) {
    // Get batch details
    const batchResult = await query(`
      SELECT 
        cb.*,
        pr.provider_name as provider_name,
        pr.type as provider_type,
        pr.nphies_id as provider_nphies_id,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM claim_batches cb
      LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
      WHERE cb.id = $1
    `, [id]);

    if (batchResult.rows.length === 0) {
      return null;
    }

    const batch = batchResult.rows[0];

    // Get claims in this batch
    const claimsResult = await query(`
      SELECT 
        cs.*,
        p.name as patient_name,
        p.identifier as patient_identifier,
        (SELECT outcome FROM claim_submission_responses WHERE claim_id = cs.id ORDER BY received_at DESC LIMIT 1) as latest_outcome
      FROM claim_submissions cs
      LEFT JOIN patients p ON cs.patient_id = p.patient_id
      WHERE cs.batch_id = $1
      ORDER BY cs.batch_number ASC, cs.created_at DESC
    `, [id]);

    // Get batch statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'pending' OR status = 'queued' THEN 1 END) as pending_claims,
        COUNT(CASE WHEN status = 'denied' OR status = 'error' THEN 1 END) as rejected_claims,
        COALESCE(SUM(total_amount), 0) as total_claim_amount,
        COALESCE(SUM(approved_amount), 0) as approved_amount
      FROM claim_submissions 
      WHERE batch_id = $1
    `, [id]);

    return {
      ...batch,
      claims: claimsResult.rows,
      statistics: statsResult.rows[0]
    };
  }

  /**
   * Get batch statistics
   */
  async getStats(req, res) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_batches,
          COUNT(CASE WHEN status = 'Processed' THEN 1 END) as processed_batches,
          COUNT(CASE WHEN status IN ('Pending', 'Submitted', 'Queued') THEN 1 END) as pending_batches,
          COUNT(CASE WHEN status = 'Rejected' OR status = 'Error' THEN 1 END) as rejected_batches,
          COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_batches,
          COALESCE(SUM(total_amount), 0) as total_batch_amount,
          COALESCE(SUM(total_claims), 0) as total_claims_in_batches
        FROM claim_batches
      `);

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting claim batch statistics:', error);
      res.status(500).json({ error: 'Failed to fetch claim batch statistics' });
    }
  }

  /**
   * Get available claims for batch creation
   * Returns claims that:
   * - Are not in any batch, OR
   * - Are in a batch with Error/Rejected status (can be reused for testing)
   */
  async getAvailableClaims(req, res) {
    try {
      const { insurer_id, provider_id, include_failed_batch } = req.query;

      // Base condition: claims not in a batch OR in a failed/error batch
      // This allows reusing claims from failed batches for testing
      let whereConditions = [
        `(
          cs.batch_id IS NULL 
          OR cb.status IN ('Error', 'Rejected', 'Draft')
        )`,
        "cs.status IN ('draft', 'pending', 'error')"
      ];
      let queryParams = [];
      let paramIndex = 1;

      if (insurer_id) {
        whereConditions.push(`cs.insurer_id = $${paramIndex}`);
        queryParams.push(insurer_id);
        paramIndex++;
      }

      if (provider_id) {
        whereConditions.push(`cs.provider_id = $${paramIndex}`);
        queryParams.push(provider_id);
        paramIndex++;
      }

      const result = await query(`
        SELECT 
          cs.id,
          cs.claim_number,
          cs.claim_type,
          cs.status,
          cs.total_amount,
          cs.service_date,
          cs.created_at,
          cs.batch_id,
          p.name as patient_name,
          p.identifier as patient_identifier,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          i.insurer_id,
          cb.batch_identifier as current_batch_identifier,
          cb.status as current_batch_status
        FROM claim_submissions cs
        LEFT JOIN patients p ON cs.patient_id = p.patient_id
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        LEFT JOIN claim_batches cb ON cs.batch_id = cb.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cs.created_at DESC
        LIMIT 500
      `, queryParams);

      res.json({ data: result.rows });
    } catch (error) {
      console.error('Error getting available claims:', error);
      res.status(500).json({ error: 'Failed to fetch available claims' });
    }
  }

  // ============================================
  // CREATE METHODS
  // ============================================

  /**
   * Create a new batch from selected claims
   * 
   * Requirements:
   * - All claims must be for the same insurer
   * - Maximum 200 claims per batch
   * - Claims must not already be in another batch
   */
  async createBatch(req, res) {
    try {
      const { 
        batch_identifier, 
        claim_ids, 
        provider_id, 
        insurer_id,
        batch_period_start,
        batch_period_end,
        description 
      } = req.body;

      // Validate required fields
      if (!batch_identifier) {
        return res.status(400).json({ error: 'Batch identifier is required' });
      }

      if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length < 2) {
        return res.status(400).json({ error: 'At least 2 claims are required for a batch' });
      }

      if (claim_ids.length > 200) {
        return res.status(400).json({ error: 'Batch cannot exceed 200 claims' });
      }

      // Verify all claims exist and are for the same insurer
      // Also check if they're in a failed batch (which can be reused)
      const claimsResult = await query(`
        SELECT cs.id, cs.insurer_id, cs.provider_id, cs.batch_id, cs.status, cs.total_amount,
               i.insurer_id as ins_uuid, i.nphies_id as insurer_nphies_id, i.insurer_name,
               cb.status as batch_status, cb.batch_identifier as current_batch_identifier
        FROM claim_submissions cs
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        LEFT JOIN claim_batches cb ON cs.batch_id = cb.id
        WHERE cs.id = ANY($1::int[])
      `, [claim_ids]);

      if (claimsResult.rows.length !== claim_ids.length) {
        const foundIds = claimsResult.rows.map(c => c.id);
        const missingIds = claim_ids.filter(id => !foundIds.includes(id));
        return res.status(400).json({ error: `Claims not found: ${missingIds.join(', ')}` });
      }

      // Check all claims are for the same insurer
      const insurerIds = [...new Set(claimsResult.rows.map(c => c.insurer_id))];
      if (insurerIds.length > 1) {
        return res.status(400).json({ error: 'All claims in a batch must be for the same insurer' });
      }

      // Check claims are not in an ACTIVE batch (allow reuse from Error/Rejected/Draft batches)
      const claimsInActiveBatch = claimsResult.rows.filter(c => 
        c.batch_id !== null && 
        !['Error', 'Rejected', 'Draft'].includes(c.batch_status)
      );
      if (claimsInActiveBatch.length > 0) {
        return res.status(400).json({ 
          error: `Claims are in an active batch: ${claimsInActiveBatch.map(c => `${c.id} (${c.current_batch_identifier})`).join(', ')}` 
        });
      }

      // Clear batch_id for claims being moved from failed batches
      const claimsToUnassign = claimsResult.rows.filter(c => c.batch_id !== null);
      if (claimsToUnassign.length > 0) {
        await query(`
          UPDATE claim_submissions 
          SET batch_id = NULL, batch_number = NULL 
          WHERE id = ANY($1::int[])
        `, [claimsToUnassign.map(c => c.id)]);
        console.log(`[BatchClaims] Unassigned ${claimsToUnassign.length} claims from previous failed batches`);
      }

      // Calculate total amount
      const totalAmount = claimsResult.rows.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);

      // Get provider and insurer UUIDs (they're already UUIDs in claim_submissions)
      const actualInsurerId = claimsResult.rows[0].insurer_id;
      const actualProviderId = claimsResult.rows[0].provider_id;

      // Create the batch
      const batchResult = await query(`
        INSERT INTO claim_batches (
          batch_identifier, 
          provider_id, 
          insurer_id, 
          status,
          total_amount,
          total_claims,
          batch_period_start,
          batch_period_end,
          description,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, 'Draft', $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        batch_identifier,
        actualProviderId,
        actualInsurerId,
        totalAmount,
        claim_ids.length,
        batch_period_start || new Date().toISOString().split('T')[0],
        batch_period_end || new Date().toISOString().split('T')[0],
        description
      ]);

      const batchId = batchResult.rows[0].id;

      // Update claims with batch_id and batch_number
      for (let i = 0; i < claim_ids.length; i++) {
        await query(`
          UPDATE claim_submissions 
          SET batch_id = $1, batch_number = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [batchId, i + 1, claim_ids[i]]);
      }

      // Get the complete batch with claims
      const completeBatch = await this.getByIdInternal(batchId);

      res.status(201).json({ 
        data: completeBatch,
        message: `Batch created with ${claim_ids.length} claims`
      });
    } catch (error) {
      console.error('Error creating batch:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Batch identifier already exists' });
      }
      res.status(500).json({ error: error.message || 'Failed to create batch' });
    }
  }

  /**
   * Add claims to an existing draft batch
   */
  async addClaimsToBatch(req, res) {
    try {
      const { id } = req.params;
      const { claim_ids } = req.body;

      // Get the batch
      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only add claims to draft batches' });
      }

      // Get current claim count
      const countResult = await query('SELECT COUNT(*) as count FROM claim_submissions WHERE batch_id = $1', [id]);
      const currentCount = parseInt(countResult.rows[0].count);

      if (currentCount + claim_ids.length > 200) {
        return res.status(400).json({ error: `Cannot exceed 200 claims. Current: ${currentCount}, Adding: ${claim_ids.length}` });
      }

      // Verify claims and add them
      const claimsResult = await query(`
        SELECT id, insurer_id, batch_id, total_amount FROM claim_submissions WHERE id = ANY($1::int[])
      `, [claim_ids]);

      // Get insurer UUID for this batch (batch.insurer_id is already UUID)
      const batchInsurerId = batch.insurer_id;

      // Validate claims
      for (const claim of claimsResult.rows) {
        if (claim.batch_id !== null) {
          return res.status(400).json({ error: `Claim ${claim.id} is already in a batch` });
        }
        if (claim.insurer_id !== batchInsurerId) {
          return res.status(400).json({ error: `Claim ${claim.id} is for a different insurer` });
        }
      }

      // Add claims to batch
      for (let i = 0; i < claim_ids.length; i++) {
        await query(`
          UPDATE claim_submissions 
          SET batch_id = $1, batch_number = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [id, currentCount + i + 1, claim_ids[i]]);
      }

      // Update batch totals
      const newTotalAmount = claimsResult.rows.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
      await query(`
        UPDATE claim_batches 
        SET total_claims = total_claims + $1, 
            total_amount = total_amount + $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [claim_ids.length, newTotalAmount, id]);

      const completeBatch = await this.getByIdInternal(id);
      res.json({ data: completeBatch });
    } catch (error) {
      console.error('Error adding claims to batch:', error);
      res.status(500).json({ error: 'Failed to add claims to batch' });
    }
  }

  /**
   * Remove claims from a draft batch
   */
  async removeClaimsFromBatch(req, res) {
    try {
      const { id } = req.params;
      const { claim_ids } = req.body;

      // Get the batch
      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only remove claims from draft batches' });
      }

      // Get the claims being removed
      const claimsResult = await query(`
        SELECT id, total_amount FROM claim_submissions WHERE id = ANY($1::int[]) AND batch_id = $2
      `, [claim_ids, id]);

      // Remove claims from batch
      await query(`
        UPDATE claim_submissions 
        SET batch_id = NULL, batch_number = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[]) AND batch_id = $2
      `, [claim_ids, id]);

      // Update batch totals
      const removedAmount = claimsResult.rows.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
      await query(`
        UPDATE claim_batches 
        SET total_claims = total_claims - $1, 
            total_amount = total_amount - $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [claimsResult.rows.length, removedAmount, id]);

      // Renumber remaining claims
      const remainingClaims = await query(`
        SELECT id FROM claim_submissions WHERE batch_id = $1 ORDER BY batch_number ASC
      `, [id]);

      for (let i = 0; i < remainingClaims.rows.length; i++) {
        await query(`
          UPDATE claim_submissions SET batch_number = $1 WHERE id = $2
        `, [i + 1, remainingClaims.rows[i].id]);
      }

      const completeBatch = await this.getByIdInternal(id);
      res.json({ data: completeBatch });
    } catch (error) {
      console.error('Error removing claims from batch:', error);
      res.status(500).json({ error: 'Failed to remove claims from batch' });
    }
  }

  // ============================================
  // NPHIES SUBMISSION METHODS
  // ============================================

  /**
   * Preview the FHIR bundle that will be sent to NPHIES
   */
  async previewBundle(req, res) {
    try {
      const { id } = req.params;
      const batch = await this.getByIdInternal(id);

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      if (batch.claims.length < 2) {
        return res.status(400).json({ error: 'Batch must have at least 2 claims' });
      }

      // Build the batch bundle
      const bundleData = await this.prepareBatchBundleData(batch);
      const batchBundle = batchClaimMapper.buildBatchClaimRequestBundle(bundleData);

      res.json({ 
        data: batchBundle,
        claimCount: batch.claims.length,
        totalAmount: batch.total_amount
      });
    } catch (error) {
      console.error('Error previewing batch bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to preview batch bundle' });
    }
  }

  /**
   * Submit batch to NPHIES
   */
  async sendToNphies(req, res) {
    try {
      const { id } = req.params;
      const batch = await this.getByIdInternal(id);

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      if (batch.status !== 'Draft' && batch.status !== 'Error') {
        return res.status(400).json({ error: `Cannot submit batch with status: ${batch.status}` });
      }

      if (batch.claims.length < 2) {
        return res.status(400).json({ error: 'Batch must have at least 2 claims' });
      }

      // Update status to Pending
      await query(`
        UPDATE claim_batches 
        SET status = 'Pending', submission_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);

      // Build the batch bundle
      const bundleData = await this.prepareBatchBundleData(batch);
      const batchBundle = batchClaimMapper.buildBatchClaimRequestBundle(bundleData);

      // Store the request bundle
      await query(`
        UPDATE claim_batches SET request_bundle = $1 WHERE id = $2
      `, [JSON.stringify(batchBundle), id]);

      // Submit to NPHIES
      console.log(`[BatchClaims] Submitting batch ${batch.batch_identifier} with ${batch.claims.length} claims`);
      const nphiesResponse = await nphiesService.submitBatchClaim(batchBundle);

      // Process the response
      if (nphiesResponse.success) {
        // Store response bundle
        await query(`
          UPDATE claim_batches 
          SET response_bundle = $1, 
              nphies_response_id = $2,
              status = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [
          JSON.stringify(nphiesResponse.data),
          nphiesResponse.data?.id,
          nphiesResponse.hasQueuedClaims ? 'Queued' : 'Submitted',
          id
        ]);

        // Process individual claim responses
        if (nphiesResponse.claimResponses) {
          await this.processClaimResponses(id, nphiesResponse.claimResponses);
        }

        // Update batch statistics
        await this.updateBatchStatistics(id);

        const updatedBatch = await this.getByIdInternal(id);
        res.json({
          success: true,
          data: updatedBatch,
          nphiesResponse: {
            bundleId: nphiesResponse.data?.id,
            hasQueuedClaims: nphiesResponse.hasQueuedClaims,
            hasPendedClaims: nphiesResponse.hasPendedClaims,
            claimResponseCount: nphiesResponse.claimResponses?.length || 0
          },
          message: nphiesResponse.hasQueuedClaims 
            ? 'Batch submitted. Claims are queued for insurer processing. Use polling to retrieve responses.'
            : 'Batch submitted successfully.'
        });
      } else {
        // Handle failure
        await query(`
          UPDATE claim_batches 
          SET status = 'Error', 
              errors = $1,
              response_bundle = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [
          JSON.stringify(nphiesResponse.errors || [{ message: nphiesResponse.error?.message || 'Unknown error' }]),
          nphiesResponse.data ? JSON.stringify(nphiesResponse.data) : null,
          id
        ]);

        const updatedBatch = await this.getByIdInternal(id);
        res.status(400).json({
          success: false,
          data: updatedBatch,
          error: nphiesResponse.error?.message || 'Batch submission failed',
          errors: nphiesResponse.errors
        });
      }
    } catch (error) {
      console.error('Error submitting batch to NPHIES:', error);
      
      // Update batch status to Error
      await query(`
        UPDATE claim_batches 
        SET status = 'Error', 
            errors = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify([{ message: error.message }]), req.params.id]);

      res.status(500).json({ error: error.message || 'Failed to submit batch to NPHIES' });
    }
  }

  /**
   * Poll NPHIES for deferred batch claim responses
   */
  async pollResponses(req, res) {
    try {
      const { id } = req.params;
      const batch = await this.getByIdInternal(id);

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      if (!['Submitted', 'Queued', 'Partial'].includes(batch.status)) {
        return res.status(400).json({ error: `Cannot poll batch with status: ${batch.status}` });
      }

      // Get provider info
      const providerResult = await query(`
        SELECT * FROM providers WHERE provider_id = $1
      `, [batch.provider_id]);

      if (providerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider not found' });
      }

      const provider = providerResult.rows[0];

      // Poll for responses
      console.log(`[BatchClaims] Polling for batch ${batch.batch_identifier} responses`);
      const pollResponse = await nphiesService.pollBatchClaimResponses(provider, batch.batch_identifier);

      if (pollResponse.success && pollResponse.claimResponses?.length > 0) {
        // Process the claim responses
        await this.processClaimResponses(id, pollResponse.claimResponses);

        // Update batch statistics
        await this.updateBatchStatistics(id);

        const updatedBatch = await this.getByIdInternal(id);

        res.json({
          success: true,
          data: updatedBatch,
          pollResult: {
            responsesReceived: pollResponse.claimResponses.length,
            message: pollResponse.message
          }
        });
      } else {
        res.json({
          success: true,
          data: batch,
          pollResult: {
            responsesReceived: 0,
            message: pollResponse.message || 'No pending responses found'
          }
        });
      }
    } catch (error) {
      console.error('Error polling batch responses:', error);
      res.status(500).json({ error: error.message || 'Failed to poll batch responses' });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Prepare data for building batch bundle
   */
  async prepareBatchBundleData(batch) {
    // Get provider details
    const providerResult = await query(`
      SELECT * FROM providers WHERE provider_id = $1
    `, [batch.provider_id]);
    const provider = providerResult.rows[0];

    // Get insurer details
    const insurerResult = await query(`
      SELECT * FROM insurers WHERE insurer_id = $1
    `, [batch.insurer_id]);
    const insurer = insurerResult.rows[0];

    // Get full claim data for each claim in the batch
    const claims = [];
    for (const claim of batch.claims) {
      const claimData = await this.getClaimDataForBundle(claim.id);
      if (claimData) {
        claims.push(claimData);
      }
    }

    return {
      batchIdentifier: batch.batch_identifier,
      batchPeriodStart: batch.batch_period_start,
      batchPeriodEnd: batch.batch_period_end,
      claims,
      provider: {
        nphies_id: provider.nphies_id,
        name: provider.name || provider.provider_name
      },
      insurer: {
        nphies_id: insurer.nphies_id,
        name: insurer.name || insurer.insurer_name
      }
    };
  }

  /**
   * Get full claim data for building FHIR bundle
   */
  async getClaimDataForBundle(claimId) {
    // Get claim with all related data
    const claimResult = await query(`
      SELECT cs.*, 
        p.name as patient_name, p.identifier as patient_identifier, 
        p.gender as patient_gender, p.birth_date as patient_birth_date,
        pr.provider_name, pr.nphies_id as provider_nphies_id, pr.provider_type,
        i.insurer_name, i.nphies_id as insurer_nphies_id
      FROM claim_submissions cs
      LEFT JOIN patients p ON cs.patient_id = p.patient_id
      LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
      WHERE cs.id = $1
    `, [claimId]);

    if (claimResult.rows.length === 0) return null;

    const claim = claimResult.rows[0];

    // Get related data
    const [itemsResult, supportingInfoResult, diagnosesResult, attachmentsResult] = await Promise.all([
      query('SELECT * FROM claim_submission_items WHERE claim_id = $1 ORDER BY sequence ASC', [claimId]),
      query('SELECT * FROM claim_submission_supporting_info WHERE claim_id = $1 ORDER BY sequence ASC', [claimId]),
      query('SELECT * FROM claim_submission_diagnoses WHERE claim_id = $1 ORDER BY sequence ASC', [claimId]),
      query('SELECT * FROM claim_submission_attachments WHERE claim_id = $1 ORDER BY created_at ASC', [claimId])
    ]);

    // Build the data structure expected by claim mappers
    return {
      claim: {
        ...claim,
        claim_type: claim.claim_type || 'institutional'
      },
      patient: {
        name: claim.patient_name,
        identifier: claim.patient_identifier,
        gender: claim.patient_gender,
        birth_date: claim.patient_birth_date
      },
      provider: {
        name: claim.provider_name,
        nphies_id: claim.provider_nphies_id,
        type: claim.provider_type
      },
      insurer: {
        name: claim.insurer_name,
        nphies_id: claim.insurer_nphies_id
      },
      items: itemsResult.rows,
      supportingInfo: supportingInfoResult.rows,
      diagnoses: diagnosesResult.rows,
      attachments: attachmentsResult.rows
    };
  }

  /**
   * Process individual claim responses from NPHIES
   */
  async processClaimResponses(batchId, claimResponses) {
    for (const response of claimResponses) {
      if (!response.batchNumber) continue;

      // Find the claim by batch number
      const claimResult = await query(`
        SELECT id FROM claim_submissions WHERE batch_id = $1 AND batch_number = $2
      `, [batchId, response.batchNumber]);

      if (claimResult.rows.length === 0) continue;

      const claimId = claimResult.rows[0].id;

      // Update claim status based on response
      let status = 'pending';
      if (response.outcome === 'complete' && response.adjudicationOutcome === 'approved') {
        status = 'approved';
      } else if (response.adjudicationOutcome === 'rejected') {
        status = 'denied';
      } else if (response.outcome === 'queued') {
        status = 'queued';
      } else if (response.outcome === 'error') {
        status = 'error';
      }

      await query(`
        UPDATE claim_submissions 
        SET status = $1, 
            outcome = $2,
            adjudication_outcome = $3,
            disposition = $4,
            nphies_claim_id = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        status,
        response.outcome,
        response.adjudicationOutcome,
        response.disposition,
        response.nphiesClaimId,
        claimId
      ]);

      // Store the response
      await query(`
        INSERT INTO claim_submission_responses (
          claim_id, response_type, outcome, disposition, 
          nphies_claim_id, has_errors, errors, is_nphies_generated,
          nphies_response_id, received_at
        ) VALUES ($1, 'batch-response', $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        claimId,
        response.outcome,
        response.disposition,
        response.nphiesClaimId,
        response.errors?.length > 0,
        response.errors ? JSON.stringify(response.errors) : null,
        response.isNphiesGenerated || false,
        response.nphiesClaimId
      ]);
    }
  }

  /**
   * Update batch statistics after processing responses
   */
  async updateBatchStatistics(batchId) {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status IN ('denied', 'error') THEN 1 END) as rejected,
        COUNT(CASE WHEN status NOT IN ('approved', 'denied', 'error') THEN 1 END) as pending
      FROM claim_submissions WHERE batch_id = $1
    `, [batchId]);

    const stats = statsResult.rows[0];
    
    // Determine batch status
    let batchStatus = 'Submitted';
    if (parseInt(stats.approved) + parseInt(stats.rejected) === parseInt(stats.total)) {
      batchStatus = parseInt(stats.rejected) === parseInt(stats.total) ? 'Rejected' : 
                    parseInt(stats.approved) === parseInt(stats.total) ? 'Processed' : 'Partial';
    } else if (parseInt(stats.pending) > 0) {
      batchStatus = 'Queued';
    }

    await query(`
      UPDATE claim_batches 
      SET processed_claims = $1 + $2,
          approved_claims = $1,
          rejected_claims = $2,
          status = $3,
          processed_date = CASE WHEN $3 IN ('Processed', 'Partial', 'Rejected') THEN CURRENT_TIMESTAMP ELSE processed_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [parseInt(stats.approved), parseInt(stats.rejected), batchStatus, batchId]);
  }

  /**
   * Update batch status
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, description } = req.body;

      const validStatuses = ['Draft', 'Pending', 'Submitted', 'Queued', 'Processed', 'Partial', 'Rejected', 'Error'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const result = await query(`
        UPDATE claim_batches 
        SET status = $1, 
            description = COALESCE($2, description),
            processed_date = CASE WHEN $1 IN ('Processed', 'Partial', 'Rejected') THEN CURRENT_TIMESTAMP ELSE processed_date END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [status, description, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim batch not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating claim batch status:', error);
      res.status(500).json({ error: 'Failed to update claim batch status' });
    }
  }

  /**
   * Delete a draft batch (removes batch association from claims)
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Get the batch
      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only delete draft batches' });
      }

      // Remove batch association from claims
      await query(`
        UPDATE claim_submissions 
        SET batch_id = NULL, batch_number = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = $1
      `, [id]);

      // Delete the batch
      await query('DELETE FROM claim_batches WHERE id = $1', [id]);

      res.json({ message: 'Batch deleted successfully' });
    } catch (error) {
      console.error('Error deleting batch:', error);
      res.status(500).json({ error: 'Failed to delete batch' });
    }
  }
}

export default new ClaimBatchesController();
