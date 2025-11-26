import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class ClaimBatchesController extends BaseController {
  constructor() {
    super('claim_batches', validationSchemas.claimBatch);
  }

  // Get all claim batches with joins
  async getAll(req, res) {
    try {
      const queries = await loadQueries();
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';

      let whereClause = '';
      let queryParams = [limit, offset];
      let paramIndex = 3;

      if (search || status) {
        whereClause = queries.CLAIM_BATCHES.SEARCH_WHERE;
        if (search) {
          queryParams.push(`%${search}%`);
          paramIndex++;
        }
        if (status) {
          whereClause += ' ' + queries.CLAIM_BATCHES.STATUS_WHERE.replace('$4', `$${paramIndex}`);
          queryParams.push(status);
          paramIndex++;
        }
      }

      // Get total count
      const countQuery = queries.CLAIM_BATCHES.GET_ALL_COUNT + whereClause;
      const countResult = await query(countQuery, queryParams.slice(2));
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = queries.CLAIM_BATCHES.GET_ALL_WITH_JOINS + whereClause + 
        ` ORDER BY cb.submission_date DESC LIMIT $1 OFFSET $2`;
      const result = await query(dataQuery, queryParams);

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

  // Get claim batch by ID with full details
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Get batch details
      const batchResult = await query(`
        SELECT 
          cb.*,
          pr.name as provider_name,
          pr.type as provider_type,
          pr.nphies_id as provider_nphies_id,
          i.name as insurer_name,
          i.nphies_id as insurer_nphies_id
        FROM claim_batches cb
        LEFT JOIN providers pr ON cb.provider_id = pr.id
        LEFT JOIN insurers i ON cb.insurer_id = i.id
        WHERE cb.id = $1
      `, [id]);

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Claim batch not found' });
      }

      // Get claims in this batch
      const claimsResult = await query(`
        SELECT 
          c.*,
          p.name as patient_name,
          p.identifier as patient_identifier
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.id
        WHERE c.claim_batch_id = $1
        ORDER BY c.created_at DESC
      `, [id]);

      // Get batch statistics
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_claims,
          COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved_claims,
          COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_claims,
          COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected_claims,
          COALESCE(SUM(amount), 0) as total_claim_amount
        FROM claims 
        WHERE claim_batch_id = $1
      `, [id]);

      res.json({
        data: {
          ...batchResult.rows[0],
          claims: claimsResult.rows,
          statistics: statsResult.rows[0]
        }
      });
    } catch (error) {
      console.error('Error getting claim batch by ID:', error);
      res.status(500).json({ error: 'Failed to fetch claim batch' });
    }
  }

  // Update batch status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!['Processed', 'Pending', 'Rejected', 'Under Review'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await query(`
        UPDATE claim_batches 
        SET status = $1, description = $2,
            processed_date = CASE WHEN status = 'Processed' THEN CURRENT_TIMESTAMP ELSE processed_date END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [status, notes, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim batch not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating claim batch status:', error);
      res.status(500).json({ error: 'Failed to update claim batch status' });
    }
  }

  // Get batch statistics
  async getStats(req, res) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_batches,
          COUNT(CASE WHEN status = 'Processed' THEN 1 END) as processed_batches,
          COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_batches,
          COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected_batches,
          COALESCE(SUM(total_amount), 0) as total_batch_amount
        FROM claim_batches
      `);

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting claim batch statistics:', error);
      res.status(500).json({ error: 'Failed to fetch claim batch statistics' });
    }
  }
}

export default new ClaimBatchesController();
