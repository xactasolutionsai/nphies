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
 * - Create batch from approved prior authorization items
 * - Submit batch to NPHIES as a single batch-request bundle
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

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM claim_batches cb
        LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      const dataQuery = `
        SELECT 
          cb.*,
          pr.provider_name as provider_name,
          pr.nphies_id as provider_nphies_id,
          i.insurer_name as insurer_name,
          i.nphies_id as insurer_nphies_id
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

  async getByIdInternal(id) {
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

    const itemIds = this._extractItemIds(batch.request_bundle);

    let claims = [];
    if (itemIds.length > 0) {
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
          pa.id as prior_auth_db_id,
          p.name as patient_name,
          p.identifier as patient_identifier
        FROM prior_authorization_items pai
        INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        WHERE pai.id = ANY($1::int[])
        ORDER BY pai.id
      `, [itemIds]);

      claims = itemsResult.rows.map(item => ({
        ...item,
        batch_number: itemIds.indexOf(item.id) + 1,
        claim_number: `${item.claim_number}-${item.sequence}`
      }));
    }

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

  _extractItemIds(requestBundle) {
    if (!requestBundle) return [];
    const bundleData = typeof requestBundle === 'string'
      ? JSON.parse(requestBundle)
      : requestBundle;
    return bundleData.item_ids || bundleData._metadata?.item_ids || [];
  }

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

  async getAvailableClaims(req, res) {
    try {
      const { insurer_id, provider_id } = req.query;

      let whereConditions = [
        "pa.status IN ('approved', 'partial')",
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
  // CREATE / MODIFY METHODS
  // ============================================

  async createBatch(req, res) {
    try {
      const { 
        batch_identifier, 
        claim_ids,
        batch_period_start,
        batch_period_end,
        description 
      } = req.body;

      if (!batch_identifier) {
        return res.status(400).json({ error: 'Batch identifier is required' });
      }

      if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length < 2) {
        return res.status(400).json({ error: 'At least 2 approved items are required for a batch' });
      }

      if (claim_ids.length > 200) {
        return res.status(400).json({ error: 'Batch cannot exceed 200 items' });
      }

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

      const nonApprovedItems = itemsResult.rows.filter(item => 
        item.adjudication_status !== 'approved' || 
        !['approved', 'partial'].includes(item.auth_status)
      );
      if (nonApprovedItems.length > 0) {
        return res.status(400).json({ 
          error: `Some items are not approved: ${nonApprovedItems.map(i => `Item ${i.id} (${i.adjudication_status})`).join(', ')}` 
        });
      }

      const insurerIds = [...new Set(itemsResult.rows.map(c => c.insurer_id))];
      if (insurerIds.length > 1) {
        return res.status(400).json({ error: 'All items in a batch must be for the same insurer (payer)' });
      }

      const providerIds = [...new Set(itemsResult.rows.map(c => c.provider_id))];
      if (providerIds.length > 1) {
        return res.status(400).json({ error: 'All items in a batch must be for the same provider' });
      }

      const claimTypes = [...new Set(itemsResult.rows.map(c => {
        const type = c.auth_type;
        if (!type) return null;
        const normalized = type.toLowerCase();
        if (['institutional', 'inpatient', 'daycase'].includes(normalized)) return 'institutional';
        if (['dental', 'oral'].includes(normalized)) return 'oral';
        return normalized;
      }).filter(Boolean))];
      if (claimTypes.length > 1) {
        return res.status(400).json({ 
          error: `All items in a batch must be of the same claim type. Found: ${claimTypes.join(', ')}` 
        });
      }

      const totalAmount = itemsResult.rows.reduce((sum, item) => 
        sum + parseFloat(item.adjudication_amount || item.net_amount || 0), 0
      );

      const actualInsurerId = itemsResult.rows[0].insurer_id;
      const actualProviderId = itemsResult.rows[0].provider_id;

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

      await query(`
        UPDATE claim_batches 
        SET request_bundle = $1
        WHERE id = $2
      `, [JSON.stringify({ items: batchItems, item_ids: claim_ids }), batchId]);

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
   * Add prior authorization items to an existing draft batch.
   * Works via the request_bundle item_ids array.
   */
  async addClaimsToBatch(req, res) {
    try {
      const { id } = req.params;
      const { claim_ids } = req.body;

      if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
        return res.status(400).json({ error: 'claim_ids array is required' });
      }

      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only add items to draft batches' });
      }

      const currentItemIds = this._extractItemIds(batch.request_bundle);
      if (currentItemIds.length + claim_ids.length > 200) {
        return res.status(400).json({ error: `Cannot exceed 200 items. Current: ${currentItemIds.length}, Adding: ${claim_ids.length}` });
      }

      const duplicates = claim_ids.filter(cid => currentItemIds.includes(cid));
      if (duplicates.length > 0) {
        return res.status(400).json({ error: `Items already in batch: ${duplicates.join(', ')}` });
      }

      const itemsResult = await query(`
        SELECT pai.id, pai.net_amount, pai.adjudication_amount,
               pa.insurer_id, pa.provider_id, pa.auth_type
        FROM prior_authorization_items pai
        INNER JOIN prior_authorizations pa ON pai.prior_auth_id = pa.id
        WHERE pai.id = ANY($1::int[])
      `, [claim_ids]);

      if (itemsResult.rows.length !== claim_ids.length) {
        return res.status(400).json({ error: 'Some items were not found' });
      }

      for (const item of itemsResult.rows) {
        if (item.insurer_id !== batch.insurer_id) {
          return res.status(400).json({ error: `Item ${item.id} is for a different insurer` });
        }
        if (item.provider_id !== batch.provider_id) {
          return res.status(400).json({ error: `Item ${item.id} is for a different provider` });
        }
      }

      const newItemIds = [...currentItemIds, ...claim_ids];
      const bundleData = typeof batch.request_bundle === 'string'
        ? JSON.parse(batch.request_bundle)
        : (batch.request_bundle || {});
      bundleData.item_ids = newItemIds;

      const addedAmount = itemsResult.rows.reduce((sum, c) => sum + parseFloat(c.adjudication_amount || c.net_amount || 0), 0);

      await query(`
        UPDATE claim_batches 
        SET request_bundle = $1,
            total_claims = $2,
            total_amount = COALESCE(total_amount, 0) + $3::numeric,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [JSON.stringify(bundleData), newItemIds.length, addedAmount, id]);

      const completeBatch = await this.getByIdInternal(id);
      res.json({ data: completeBatch });
    } catch (error) {
      console.error('Error adding items to batch:', error);
      res.status(500).json({ error: 'Failed to add items to batch' });
    }
  }

  /**
   * Remove prior authorization items from a draft batch.
   * Works via the request_bundle item_ids array.
   */
  async removeClaimsFromBatch(req, res) {
    try {
      const { id } = req.params;
      const { claim_ids } = req.body;

      if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
        return res.status(400).json({ error: 'claim_ids array is required' });
      }

      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only remove items from draft batches' });
      }

      const currentItemIds = this._extractItemIds(batch.request_bundle);
      const newItemIds = currentItemIds.filter(cid => !claim_ids.includes(cid));

      if (newItemIds.length < 2) {
        return res.status(400).json({ error: 'Batch must retain at least 2 items' });
      }

      const removedItemsResult = await query(`
        SELECT pai.id, pai.net_amount, pai.adjudication_amount
        FROM prior_authorization_items pai
        WHERE pai.id = ANY($1::int[])
      `, [claim_ids]);

      const removedAmount = removedItemsResult.rows.reduce((sum, c) => sum + parseFloat(c.adjudication_amount || c.net_amount || 0), 0);

      const bundleData = typeof batch.request_bundle === 'string'
        ? JSON.parse(batch.request_bundle)
        : (batch.request_bundle || {});
      bundleData.item_ids = newItemIds;
      if (bundleData.items) {
        bundleData.items = bundleData.items.filter(i => !claim_ids.includes(i.item_id));
      }

      await query(`
        UPDATE claim_batches 
        SET request_bundle = $1,
            total_claims = $2,
            total_amount = GREATEST(COALESCE(total_amount, 0) - $3::numeric, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [JSON.stringify(bundleData), newItemIds.length, removedAmount, id]);

      const completeBatch = await this.getByIdInternal(id);
      res.json({ data: completeBatch });
    } catch (error) {
      console.error('Error removing items from batch:', error);
      res.status(500).json({ error: 'Failed to remove items from batch' });
    }
  }

  // ============================================
  // NPHIES SUBMISSION METHODS
  // ============================================

  /**
   * Preview the FHIR bundle that will be sent to NPHIES.
   * Returns both the full batch bundle and individual bundles for inspection.
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

      const bundleData = await this.prepareBatchBundleData(batch);
      const batchBundle = batchClaimMapper.buildBatchRequestBundle(bundleData);
      const individualBundles = batchClaimMapper.buildIndividualClaimBundles(bundleData);

      res.json({ 
        data: individualBundles,
        batchBundle,
        bundleCount: individualBundles.length,
        claimCount: batch.claims.length,
        totalAmount: batch.total_amount,
        note: 'batchBundle is the single outer bundle sent to NPHIES (event=batch-request). "data" shows individual claim bundles for easy inspection.'
      });
    } catch (error) {
      console.error('Error previewing batch bundles:', error);
      res.status(500).json({ error: error.message || 'Failed to preview batch bundles' });
    }
  }

  /**
   * Submit batch to NPHIES as a SINGLE batch-request bundle.
   * Per NPHIES docs: outer bundle (batch-request) wraps nested claim bundles.
   * NPHIES validates in real-time, then queues valid claims for background delivery.
   * Deferred responses are retrieved via polling.
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

      await query(`
        UPDATE claim_batches 
        SET status = 'Pending', submission_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);

      const bundleData = await this.prepareBatchBundleData(batch);
      const batchBundle = batchClaimMapper.buildBatchRequestBundle(bundleData);

      console.log(`[BatchClaims] Submitting batch ${batch.batch_identifier} as single batch-request bundle with ${batch.claims.length} nested claims`);

      const itemIds = this._extractItemIds(batch.request_bundle);

      const storedRequestBundle = {
        batchBundle,
        _metadata: {
          item_ids: itemIds,
          batchIdentifier: bundleData.batchIdentifier,
          totalClaims: batch.claims.length,
          items: bundleData.claims?.map((c, i) => ({
            item_id: c.claim?.id || c.itemId,
            batch_number: i + 1
          })) || []
        }
      };

      await query(`
        UPDATE claim_batches SET request_bundle = $1 WHERE id = $2
      `, [JSON.stringify(storedRequestBundle), id]);

      const nphiesResponse = await nphiesService.submitBatchClaim(batchBundle);

      let batchStatus;
      let allErrors = [];

      if (nphiesResponse.success) {
        const parsed = nphiesResponse.parsedResponse || nphiesResponse;
        const claimResponses = parsed.claimResponses || nphiesResponse.claimResponses || [];

        const successCount = claimResponses.filter(r => r.success).length;
        const errorCount = claimResponses.filter(r => !r.success).length;
        const hasQueuedClaims = parsed.hasQueuedClaims || claimResponses.some(r => r.outcome === 'queued');

        allErrors = (parsed.errors || []).concat(
          claimResponses.filter(r => !r.success).flatMap(r => r.errors || [])
        );

        if (errorCount === claimResponses.length && claimResponses.length > 0) {
          batchStatus = 'Error';
        } else if (errorCount > 0) {
          batchStatus = 'Partial';
        } else if (hasQueuedClaims) {
          batchStatus = 'Queued';
        } else {
          batchStatus = 'Submitted';
        }

        await query(`
          UPDATE claim_batches 
          SET response_bundle = $1, 
              status = $2,
              errors = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [
          JSON.stringify(nphiesResponse.data || nphiesResponse),
          batchStatus,
          allErrors.length > 0 ? JSON.stringify(allErrors) : null,
          id
        ]);

        await this.updateBatchStatistics(id);
        const updatedBatch = await this.getByIdInternal(id);

        if (batchStatus === 'Error') {
          res.status(400).json({
            success: false,
            data: updatedBatch,
            error: 'All claims in batch failed validation',
            errors: allErrors,
            results: { total: batch.claims.length, success: successCount, failed: errorCount }
          });
        } else {
          res.json({
            success: true,
            data: updatedBatch,
            nphiesResponse: {
              hasQueuedClaims,
              hasPendedClaims: parsed.hasPendedClaims || false,
              claimResponseCount: claimResponses.length
            },
            results: { total: batch.claims.length, success: successCount, failed: errorCount },
            message: batchStatus === 'Partial'
              ? `Batch partially accepted. ${successCount}/${batch.claims.length} claims passed validation.`
              : hasQueuedClaims 
                ? 'Batch submitted. Claims are queued for insurer processing. Use polling to retrieve responses.'
                : 'Batch submitted successfully.'
          });
        }
      } else {
        batchStatus = 'Error';
        allErrors = nphiesResponse.errors || [{ message: nphiesResponse.error?.message || 'Batch submission failed' }];

        await query(`
          UPDATE claim_batches 
          SET response_bundle = $1, 
              status = 'Error',
              errors = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [
          JSON.stringify(nphiesResponse.data || nphiesResponse),
          JSON.stringify(allErrors),
          id
        ]);

        const updatedBatch = await this.getByIdInternal(id);
        res.status(400).json({
          success: false,
          data: updatedBatch,
          error: 'Batch submission failed',
          errors: allErrors
        });
      }
    } catch (error) {
      console.error('Error submitting batch to NPHIES:', error);

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
   * Poll NPHIES for deferred batch claim responses.
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

      const providerResult = await query(`
        SELECT * FROM providers WHERE provider_id = $1
      `, [batch.provider_id]);

      if (providerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider not found' });
      }

      const provider = providerResult.rows[0];

      console.log(`[BatchClaims] Polling for batch ${batch.batch_identifier} responses`);
      const pollResponse = await nphiesService.pollBatchClaimResponses(provider, batch.batch_identifier);

      if (pollResponse.success && pollResponse.claimResponses?.length > 0) {
        await this.processPolledClaimResponses(id, pollResponse.claimResponses, batch);
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
  // RESPONSE PROCESSING
  // ============================================

  /**
   * Process polled claim responses by correlating batch-number to item_ids.
   * Updates the batch response_bundle with per-claim outcomes.
   */
  async processPolledClaimResponses(batchId, claimResponses, batch) {
    try {
      const itemIds = this._extractItemIds(batch.request_bundle);

      let existingResponseBundle = {};
      if (batch.response_bundle) {
        existingResponseBundle = typeof batch.response_bundle === 'string'
          ? JSON.parse(batch.response_bundle)
          : batch.response_bundle;
      }

      if (!existingResponseBundle.polledResponses) {
        existingResponseBundle.polledResponses = [];
      }

      for (const response of claimResponses) {
        const batchNumber = response.batchNumber;
        if (!batchNumber) continue;

        const itemId = itemIds[batchNumber - 1];
        existingResponseBundle.polledResponses.push({
          batchNumber,
          itemId,
          outcome: response.outcome,
          adjudicationOutcome: response.adjudicationOutcome,
          disposition: response.disposition,
          nphiesClaimId: response.nphiesClaimId,
          batchIdentifier: response.batchIdentifier,
          errors: response.errors,
          receivedAt: new Date().toISOString()
        });
      }

      await query(`
        UPDATE claim_batches 
        SET response_bundle = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify(existingResponseBundle), batchId]);

    } catch (error) {
      console.error(`[BatchClaims] Error processing polled responses for batch ${batchId}:`, error);
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async updateBatchStatistics(batchId) {
    const batchResult = await query(`
      SELECT response_bundle, total_claims FROM claim_batches WHERE id = $1
    `, [batchId]);

    if (batchResult.rows.length === 0) {
      return;
    }

    const batch = batchResult.rows[0];
    const responseBundle = batch.response_bundle;
    const totalClaims = batch.total_claims || 0;

    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let queued = 0;

    if (responseBundle) {
      const responsesToAnalyze = responseBundle.responses || [];
      const polledResponses = responseBundle.polledResponses || [];

      for (const response of responsesToAnalyze) {
        if (!response.success) {
          rejected++;
          continue;
        }

        const claimResponse = response.data?.entry?.find(
          e => e.resource?.resourceType === 'ClaimResponse'
        )?.resource;

        if (!claimResponse) {
          pending++;
          continue;
        }

        const outcome = claimResponse.outcome;
        const adjudicationOutcome = claimResponse.extension?.find(
          ext => ext.url?.includes('extension-adjudication-outcome')
        )?.valueCodeableConcept?.coding?.[0]?.code;

        if (outcome === 'complete') {
          if (adjudicationOutcome === 'approved' || adjudicationOutcome === 'partial') {
            approved++;
          } else if (adjudicationOutcome === 'rejected') {
            rejected++;
          } else {
            pending++;
          }
        } else if (outcome === 'queued') {
          queued++;
        } else if (outcome === 'error') {
          rejected++;
        } else {
          pending++;
        }
      }

      if (responseBundle.entry) {
        for (const entry of responseBundle.entry) {
          if (entry.resource?.resourceType === 'Bundle' || entry.resource?.resourceType === 'ClaimResponse') {
            const cr = entry.resource?.resourceType === 'ClaimResponse'
              ? entry.resource
              : entry.resource?.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;

            if (!cr) continue;
            const outcome = cr.outcome;
            const adj = cr.extension?.find(ext => ext.url?.includes('extension-adjudication-outcome'))?.valueCodeableConcept?.coding?.[0]?.code;

            if (outcome === 'queued') queued++;
            else if (outcome === 'error') rejected++;
            else if (adj === 'approved' || adj === 'partial') approved++;
            else if (adj === 'rejected') rejected++;
            else pending++;
          }
        }
      }

      for (const pr of polledResponses) {
        if (pr.outcome === 'complete') {
          if (pr.adjudicationOutcome === 'approved' || pr.adjudicationOutcome === 'partial') approved++;
          else if (pr.adjudicationOutcome === 'rejected') rejected++;
          else pending++;
        } else if (pr.outcome === 'queued') {
          queued++;
        } else if (pr.outcome === 'error') {
          rejected++;
        }
      }
    }

    let batchStatus = 'Submitted';
    const processedCount = approved + rejected;
    
    if (processedCount === totalClaims && totalClaims > 0) {
      if (rejected === totalClaims) batchStatus = 'Rejected';
      else if (approved === totalClaims) batchStatus = 'Processed';
      else batchStatus = 'Partial';
    } else if (queued > 0) {
      batchStatus = 'Queued';
    } else if (processedCount > 0) {
      batchStatus = 'Partial';
    }

    console.log(`[BatchClaims] Statistics for batch ${batchId}: total=${totalClaims}, approved=${approved}, rejected=${rejected}, queued=${queued}, status=${batchStatus}`);

    await query(`
      UPDATE claim_batches 
      SET processed_claims = $1::int,
          approved_claims = $2::int,
          rejected_claims = $3::int,
          status = $4::text,
          processed_date = CASE WHEN $4::text IN ('Processed', 'Partial', 'Rejected') THEN CURRENT_TIMESTAMP ELSE processed_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [processedCount, approved, rejected, batchStatus, batchId]);
  }

  async recalculateStatistics(req, res) {
    try {
      const { id } = req.params;
      
      const batch = await this.getByIdInternal(id);
      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      await this.updateBatchStatistics(id);
      const updatedBatch = await this.getByIdInternal(id);
      
      res.json({
        success: true,
        message: 'Statistics recalculated successfully',
        data: updatedBatch
      });
    } catch (error) {
      console.error('Error recalculating statistics:', error);
      res.status(500).json({ error: error.message });
    }
  }

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

  async delete(req, res) {
    try {
      const { id } = req.params;

      const batchResult = await query('SELECT * FROM claim_batches WHERE id = $1', [id]);
      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];
      if (batch.status !== 'Draft') {
        return res.status(400).json({ error: 'Can only delete draft batches' });
      }

      await query('DELETE FROM claim_batches WHERE id = $1', [id]);

      res.json({ message: 'Batch deleted successfully' });
    } catch (error) {
      console.error('Error deleting batch:', error);
      res.status(500).json({ error: 'Failed to delete batch' });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async prepareBatchBundleData(batch) {
    const providerResult = await query(`
      SELECT * FROM providers WHERE provider_id = $1
    `, [batch.provider_id]);
    const provider = providerResult.rows[0];

    const insurerResult = await query(`
      SELECT * FROM insurers WHERE insurer_id = $1
    `, [batch.insurer_id]);
    const insurer = insurerResult.rows[0];

    const itemIds = this._extractItemIds(batch.request_bundle);

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

  async getAuthItemDataForBundle(itemId) {
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

    const diagnosesResult = await query(`
      SELECT * FROM prior_authorization_diagnoses 
      WHERE prior_auth_id = $1 
      ORDER BY sequence ASC
    `, [item.auth_id]);

    const supportingInfoResult = await query(`
      SELECT * FROM prior_authorization_supporting_info 
      WHERE prior_auth_id = $1 
      ORDER BY sequence ASC
    `, [item.auth_id]);

    const coverageResult = await query(`
      SELECT * FROM patient_coverage 
      WHERE patient_id = $1 AND insurer_id = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [item.patient_id, item.insurer_id]);

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
      factor: item.factor || 1,
      tax: item.tax || 0,
      patient_share: item.patient_share || 0,
      net_amount: item.adjudication_amount || item.net_amount,
      serviced_date: item.serviced_date,
      body_site_code: item.body_site_code,
      body_site_system: item.body_site_system,
      tooth_number: item.tooth_number,
      tooth_surface: item.tooth_surface,
      eye: item.eye,
      medication_code: item.medication_code,
      medication_system: item.medication_system,
      medication_name: item.medication_name,
      days_supply: item.days_supply,
      information_sequences: item.information_sequences,
      item_type: item.item_type || 'medication',
      is_package: item.is_package || false,
      is_maternity: item.is_maternity || false,
      patient_invoice: item.patient_invoice,
      shadow_code: item.shadow_code,
      shadow_code_system: item.shadow_code_system,
      shadow_code_display: item.shadow_code_display,
      prescribed_medication_code: item.prescribed_medication_code,
      pharmacist_selection_reason: item.pharmacist_selection_reason,
      pharmacist_substitute: item.pharmacist_substitute
    }];

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
      practitioner: {
        name: 'Default Practitioner',
        specialty_code: item.practice_code || '08.00'
      },
      items: itemsArray,
      diagnoses: diagnosesArray,
      supportingInfo: supportingInfoResult.rows,
      attachments: [],
      preAuthRef: item.pre_auth_ref
    };
  }
}

export default new ClaimBatchesController();
