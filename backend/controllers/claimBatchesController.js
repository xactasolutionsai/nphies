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

    // Get item IDs from the batch's request_bundle metadata
    // Check both direct item_ids and _metadata.item_ids (after submission the bundle structure changes)
    let itemIds = [];
    if (batch.request_bundle) {
      const bundleData = typeof batch.request_bundle === 'string' 
        ? JSON.parse(batch.request_bundle) 
        : batch.request_bundle;
      // Try direct item_ids first (before submission), then _metadata.item_ids (after submission)
      itemIds = bundleData.item_ids || bundleData._metadata?.item_ids || [];
      console.log(`[BatchClaims] Batch ${id} - request_bundle item_ids:`, itemIds);
    } else {
      console.log(`[BatchClaims] Batch ${id} - NO request_bundle found`);
    }

    // Get prior authorization items in this batch
    let claims = [];
    if (itemIds.length > 0) {
      console.log(`[BatchClaims] Fetching ${itemIds.length} items from prior_authorization_items`);
      const itemsResult = await query(`
        SELECT 
          pai.id,
          pai.prior_auth_id,
          pai.sequence,
          pai.product_or_service_code,
          pai.product_or_service_display,
          pai.quantity,
          pai.unit_price,
          pai.net_amount as total_amount,
          pai.adjudication_status as status,
          pai.adjudication_amount,
          pai.serviced_date,
          pa.request_number as claim_number,
          pa.auth_type as claim_type,
          pa.pre_auth_ref,
          p.name as patient_name,
          p.identifier as patient_identifier
        FROM prior_authorization_items pai
        INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        WHERE pai.id = ANY($1::int[])
        ORDER BY pai.id
      `, [itemIds]);

      console.log(`[BatchClaims] Found ${itemsResult.rows.length} items in database`);

      // Add batch_number based on position in itemIds array
      claims = itemsResult.rows.map(item => ({
        ...item,
        batch_number: itemIds.indexOf(item.id) + 1,
        claim_number: `${item.claim_number}-${item.sequence}`
      }));
    } else {
      console.log(`[BatchClaims] Batch ${id} - itemIds is empty, no claims to fetch`);
    }

    // Calculate batch statistics from items
    const statistics = {
      total_claims: claims.length,
      approved_claims: claims.filter(c => c.status === 'approved').length,
      pending_claims: claims.filter(c => c.status === 'pending').length,
      rejected_claims: claims.filter(c => c.status === 'denied').length,
      total_claim_amount: claims.reduce((sum, c) => sum + parseFloat(c.total_amount || c.adjudication_amount || 0), 0),
      approved_amount: claims.reduce((sum, c) => sum + parseFloat(c.adjudication_amount || 0), 0)
    };

    return {
      ...batch,
      claims,
      statistics
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
   * Get available items for batch claim creation
   * Returns APPROVED prior authorization items that can be submitted as claims
   * 
   * Per NPHIES workflow:
   * 1. Prior Authorization is submitted and approved
   * 2. Approved items can then be submitted as claims (individually or in batch)
   * 
   * Items available for batch claims:
   * - From prior authorizations with status 'approved' or 'partial'
   * - Items with adjudication_status 'approved'
   * - Not already submitted as claims (or from failed batches for testing)
   */
  async getAvailableClaims(req, res) {
    try {
      const { insurer_id, provider_id, include_failed_batch } = req.query;

      let whereConditions = [
        // Prior auth must be approved or partial
        "pa.status IN ('approved', 'partial')",
        // Item must be approved
        "pai.adjudication_status = 'approved'"
      ];
      let queryParams = [];
      let paramIndex = 1;

      if (insurer_id) {
        whereConditions.push(`pa.insurer_id = $${paramIndex}`);
        queryParams.push(insurer_id);
        paramIndex++;
      }

      if (provider_id) {
        whereConditions.push(`pa.provider_id = $${paramIndex}`);
        queryParams.push(provider_id);
        paramIndex++;
      }

      const result = await query(`
        SELECT 
          pai.id,
          pai.prior_auth_id,
          pai.sequence,
          pai.product_or_service_code,
          pai.product_or_service_display,
          pai.quantity,
          pai.unit_price,
          pai.net_amount as total_amount,
          pai.adjudication_status,
          pai.adjudication_amount,
          pai.serviced_date,
          pa.request_number as auth_request_number,
          pa.auth_type as claim_type,
          pa.status as auth_status,
          pa.pre_auth_ref,
          pa.total_amount as auth_total_amount,
          pa.approved_amount as auth_approved_amount,
          p.name as patient_name,
          p.identifier as patient_identifier,
          p.patient_id,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          pr.provider_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          i.insurer_id,
          pa.created_at
        FROM prior_authorization_items pai
        INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY pa.created_at DESC, pai.sequence ASC
        LIMIT 500
      `, queryParams);

      // Group items by prior authorization for better display
      const groupedData = result.rows.map(row => ({
        id: row.id,
        item_id: row.id,
        prior_auth_id: row.prior_auth_id,
        sequence: row.sequence,
        claim_number: `${row.auth_request_number}-${row.sequence}`,
        claim_type: row.claim_type,
        status: row.adjudication_status,
        total_amount: row.total_amount || row.adjudication_amount,
        service_date: row.serviced_date,
        created_at: row.created_at,
        patient_name: row.patient_name,
        patient_identifier: row.patient_identifier,
        patient_id: row.patient_id,
        provider_name: row.provider_name,
        provider_nphies_id: row.provider_nphies_id,
        provider_id: row.provider_id,
        insurer_name: row.insurer_name,
        insurer_nphies_id: row.insurer_nphies_id,
        insurer_id: row.insurer_id,
        pre_auth_ref: row.pre_auth_ref,
        auth_request_number: row.auth_request_number,
        product_code: row.product_or_service_code,
        product_display: row.product_or_service_display,
        quantity: row.quantity,
        unit_price: row.unit_price
      }));

      res.json({ data: groupedData });
    } catch (error) {
      console.error('Error getting available claims:', error);
      res.status(500).json({ error: 'Failed to fetch available claims' });
    }
  }

  // ============================================
  // CREATE METHODS
  // ============================================

  /**
   * Create a new batch from selected APPROVED prior authorization items
   * 
   * Requirements:
   * - All items must be from approved prior authorizations
   * - All items must be for the same insurer
   * - Maximum 200 items per batch
   * - Items must have adjudication_status = 'approved'
   */
  async createBatch(req, res) {
    try {
      const { 
        batch_identifier, 
        claim_ids,  // These are actually prior_authorization_item IDs
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
        return res.status(400).json({ error: 'At least 2 approved items are required for a batch' });
      }

      if (claim_ids.length > 200) {
        return res.status(400).json({ error: 'Batch cannot exceed 200 items' });
      }

      // Verify all items exist, are approved, and are for the same insurer
      const itemsResult = await query(`
        SELECT 
          pai.id,
          pai.prior_auth_id,
          pai.sequence,
          pai.net_amount,
          pai.adjudication_status,
          pai.adjudication_amount,
          pai.product_or_service_code,
          pai.product_or_service_display,
          pa.request_number,
          pa.auth_type,
          pa.status as auth_status,
          pa.pre_auth_ref,
          pa.patient_id,
          pa.provider_id,
          pa.insurer_id,
          i.nphies_id as insurer_nphies_id, 
          i.insurer_name,
          pr.nphies_id as provider_nphies_id,
          pr.provider_name
        FROM prior_authorization_items pai
        INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        WHERE pai.id = ANY($1::int[])
      `, [claim_ids]);

      if (itemsResult.rows.length !== claim_ids.length) {
        const foundIds = itemsResult.rows.map(c => c.id);
        const missingIds = claim_ids.filter(id => !foundIds.includes(id));
        return res.status(400).json({ error: `Items not found: ${missingIds.join(', ')}` });
      }

      // Check all items are approved
      const nonApprovedItems = itemsResult.rows.filter(item => 
        item.adjudication_status !== 'approved' || 
        !['approved', 'partial'].includes(item.auth_status)
      );
      if (nonApprovedItems.length > 0) {
        return res.status(400).json({ 
          error: `Some items are not approved: ${nonApprovedItems.map(i => `Item ${i.id} (${i.adjudication_status})`).join(', ')}` 
        });
      }

      // Check all items are for the same insurer (NPHIES requirement)
      const insurerIds = [...new Set(itemsResult.rows.map(c => c.insurer_id))];
      if (insurerIds.length > 1) {
        return res.status(400).json({ error: 'All items in a batch must be for the same insurer (payer)' });
      }

      // Check all items are for the same provider (NPHIES requirement)
      const providerIds = [...new Set(itemsResult.rows.map(c => c.provider_id))];
      if (providerIds.length > 1) {
        return res.status(400).json({ error: 'All items in a batch must be for the same provider' });
      }

      // Check all items are of the same claim type (NPHIES requirement)
      const claimTypes = [...new Set(itemsResult.rows.map(c => {
        const type = c.auth_type;
        if (!type) return null;
        const normalized = type.toLowerCase();
        // Normalize similar types
        if (['institutional', 'inpatient', 'daycase'].includes(normalized)) return 'institutional';
        if (['dental', 'oral'].includes(normalized)) return 'oral';
        return normalized;
      }).filter(Boolean))];
      if (claimTypes.length > 1) {
        return res.status(400).json({ 
          error: `All items in a batch must be of the same claim type. Found: ${claimTypes.join(', ')}` 
        });
      }

      // Calculate total amount
      const totalAmount = itemsResult.rows.reduce((sum, item) => 
        sum + parseFloat(item.adjudication_amount || item.net_amount || 0), 0
      );

      // Get provider and insurer UUIDs
      const actualInsurerId = itemsResult.rows[0].insurer_id;
      const actualProviderId = itemsResult.rows[0].provider_id;

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

      // Store batch items in a new linking table or update the batch with item references
      // For now, we'll store the item IDs in the batch's request_bundle as metadata
      const batchItems = itemsResult.rows.map((item, index) => ({
        item_id: item.id,
        prior_auth_id: item.prior_auth_id,
        sequence: item.sequence,
        batch_number: index + 1,
        request_number: item.request_number,
        product_code: item.product_or_service_code,
        product_display: item.product_or_service_display,
        amount: item.adjudication_amount || item.net_amount,
        pre_auth_ref: item.pre_auth_ref
      }));

      // Update batch with items metadata
      await query(`
        UPDATE claim_batches 
        SET request_bundle = $1
        WHERE id = $2
      `, [JSON.stringify({ items: batchItems, item_ids: claim_ids }), batchId]);

      // Get the complete batch
      const completeBatch = await this.getByIdInternal(batchId);

      res.status(201).json({ 
        data: completeBatch,
        message: `Batch created with ${claim_ids.length} approved items`
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
        SET total_claims = COALESCE(total_claims, 0) + $1::int, 
            total_amount = COALESCE(total_amount, 0) + $2::numeric,
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

      // Get original item_ids from current request_bundle to preserve them
      let itemIds = [];
      if (batch.request_bundle) {
        const currentBundle = typeof batch.request_bundle === 'string' 
          ? JSON.parse(batch.request_bundle) 
          : batch.request_bundle;
        itemIds = currentBundle.item_ids || [];
      }

      // Store the request bundle while preserving item_ids metadata
      const bundleWithMetadata = {
        ...batchBundle,
        _metadata: {
          item_ids: itemIds,
          items: bundleData.claims?.map((c, i) => ({
            item_id: c.itemId,
            batch_number: i + 1
          })) || []
        }
      };
      
      await query(`
        UPDATE claim_batches SET request_bundle = $1 WHERE id = $2
      `, [JSON.stringify(bundleWithMetadata), id]);

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
   * Prepare data for building batch bundle from approved prior authorization items
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

    // Get item IDs from the batch's request_bundle metadata
    let itemIds = [];
    if (batch.request_bundle) {
      const bundleData = typeof batch.request_bundle === 'string' 
        ? JSON.parse(batch.request_bundle) 
        : batch.request_bundle;
      itemIds = bundleData.item_ids || [];
    }

    // Get full claim data for each prior authorization item in the batch
    const claims = [];
    for (const itemId of itemIds) {
      const claimData = await this.getAuthItemDataForBundle(itemId);
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
   * Get full claim data from approved prior authorization item for building FHIR bundle
   * This converts a prior authorization item into claim data format
   */
  async getAuthItemDataForBundle(itemId) {
    // Get the prior authorization item with its parent authorization data
    const itemResult = await query(`
      SELECT 
        pai.*,
        pa.id as auth_id,
        pa.request_number,
        pa.auth_type,
        pa.sub_type,
        pa.status as auth_status,
        pa.pre_auth_ref,
        pa.encounter_class,
        pa.encounter_start,
        pa.encounter_end,
        pa.encounter_identifier,
        pa.priority,
        pa.diagnosis_codes,
        pa.primary_diagnosis,
        pa.patient_id,
        pa.provider_id,
        pa.insurer_id,
        pa.practitioner_id,
        pa.coverage_id,
        pa.practice_code,
        pa.service_event_type,
        pa.request_bundle as auth_request_bundle,
        p.name as patient_name, 
        p.identifier as patient_identifier, 
        p.identifier_type as patient_identifier_type,
        p.gender as patient_gender, 
        p.birth_date as patient_birth_date,
        p.nphies_patient_id as patient_nphies_id,
        p.nationality as patient_nationality,
        p.marital_status as patient_marital_status,
        p.occupation as patient_occupation,
        pr.provider_name, 
        pr.nphies_id as provider_nphies_id, 
        pr.provider_type,
        i.insurer_name, 
        i.nphies_id as insurer_nphies_id
      FROM prior_authorization_items pai
      INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
      LEFT JOIN patients p ON pa.patient_id = p.patient_id
      LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
      LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
      WHERE pai.id = $1
    `, [itemId]);

    if (itemResult.rows.length === 0) return null;

    const item = itemResult.rows[0];

    // Get related diagnoses from the prior authorization
    const diagnosesResult = await query(`
      SELECT * FROM prior_authorization_diagnoses 
      WHERE prior_auth_id = $1 
      ORDER BY sequence ASC
    `, [item.auth_id]);

    // Get supporting info from the prior authorization
    const supportingInfoResult = await query(`
      SELECT * FROM prior_authorization_supporting_info 
      WHERE prior_auth_id = $1 
      ORDER BY sequence ASC
    `, [item.auth_id]);

    // Get coverage data for the patient and insurer
    const coverageResult = await query(`
      SELECT * FROM patient_coverage 
      WHERE patient_id = $1 AND insurer_id = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [item.patient_id, item.insurer_id]);

    // Practitioner data - use default if not available
    // Note: practitioners table may not exist, so we use defaults based on claim type
    let practitioner = null;

    // Build the data structure expected by claim mappers
    // Convert prior auth item to claim format
    // IMPORTANT: items, diagnoses, supportingInfo MUST be inside the claim object
    // The claim mappers access them as claim.items, claim.diagnoses, etc.
    
    const diagnosesArray = diagnosesResult.rows.map(d => ({
      sequence: d.sequence,
      diagnosis_code: d.diagnosis_code,
      diagnosis_system: d.diagnosis_system,
      diagnosis_display: d.diagnosis_display,
      diagnosis_type: d.diagnosis_type,
      on_admission: d.on_admission
    }));

    const itemsArray = [{
      sequence: 1,
      product_or_service_code: item.product_or_service_code,
      product_or_service_system: item.product_or_service_system,
      product_or_service_display: item.product_or_service_display,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      net_amount: item.adjudication_amount || item.net_amount,
      serviced_date: item.serviced_date,
      body_site_code: item.body_site_code,
      body_site_system: item.body_site_system,
      tooth_number: item.tooth_number,
      tooth_surface: item.tooth_surface,
      eye: item.eye,
      medication_code: item.medication_code,
      medication_system: item.medication_system,
      days_supply: item.days_supply,
      information_sequences: item.information_sequences
    }];

    // Build coverage object
    const coverageData = coverageResult.rows.length > 0 ? coverageResult.rows[0] : null;
    const coverage = coverageData ? {
      id: coverageData.coverage_id,
      coverage_id: coverageData.coverage_id,
      member_id: coverageData.member_id || coverageData.policy_number,
      policy_number: coverageData.policy_number,
      coverage_type: coverageData.coverage_type || 'EHCPOL',
      relationship: coverageData.relationship || 'self',
      network: coverageData.network_type || coverageData.network,
      class_code: coverageData.class_code,
      class_name: coverageData.class_name || 'Insurance Plan',
      period_start: coverageData.start_date || coverageData.period_start,
      period_end: coverageData.end_date || coverageData.period_end
    } : {
      // Default coverage if none found
      id: `cov-${item.patient_id}`,
      coverage_id: `cov-${item.patient_id}`,
      member_id: item.patient_identifier,
      coverage_type: 'EHCPOL',
      relationship: 'self'
    };

    return {
      claim: {
        id: item.id,
        claim_number: `${item.request_number}-${item.sequence}`,
        claim_type: item.auth_type || 'institutional',
        sub_type: item.sub_type || 'op',
        status: 'pending',
        priority: item.priority || 'normal',
        total_amount: item.adjudication_amount || item.net_amount,
        service_date: item.serviced_date,
        encounter_class: item.encounter_class,
        encounter_start: item.encounter_start,
        encounter_end: item.encounter_end,
        encounter_identifier: item.encounter_identifier,
        pre_auth_ref: item.pre_auth_ref,
        primary_diagnosis: item.primary_diagnosis,
        practice_code: item.practice_code || '08.00',
        service_event_type: item.service_event_type || 'ICSE',
        // CRITICAL: These must be inside claim object for mappers to find them
        items: itemsArray,
        diagnoses: diagnosesArray,
        supportingInfo: supportingInfoResult.rows,
        attachments: []
      },
      patient: {
        patient_id: item.patient_id,
        name: item.patient_name,
        identifier: item.patient_identifier,
        identifier_type: item.patient_identifier_type,
        gender: item.patient_gender,
        birth_date: item.patient_birth_date,
        nphies_id: item.patient_nphies_id,
        nationality: item.patient_nationality,
        marital_status: item.patient_marital_status,
        occupation: item.patient_occupation
      },
      provider: {
        provider_id: item.provider_id,
        name: item.provider_name,
        nphies_id: item.provider_nphies_id,
        type: item.provider_type
      },
      insurer: {
        insurer_id: item.insurer_id,
        name: item.insurer_name,
        nphies_id: item.insurer_nphies_id
      },
      coverage,
      // Practitioner - use default values, mappers will create default practitioner resource
      practitioner: {
        name: 'Default Practitioner',
        specialty_code: item.practice_code || '08.00'
      },
      // Also include at root level for backwards compatibility with some mappers
      items: itemsArray,
      diagnoses: diagnosesArray,
      supportingInfo: supportingInfoResult.rows,
      attachments: [],
      // Include pre-auth reference for claim submission
      preAuthRef: item.pre_auth_ref
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
      SET processed_claims = $1::int + $2::int,
          approved_claims = $1::int,
          rejected_claims = $2::int,
          status = $3,
          processed_date = CASE WHEN $3 IN ('Processed', 'Partial', 'Rejected') THEN CURRENT_TIMESTAMP ELSE processed_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [parseInt(stats.approved) || 0, parseInt(stats.rejected) || 0, batchStatus, batchId]);
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
