import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class ClaimsController extends BaseController {
  constructor() {
    super('claims', validationSchemas.claim);
  }

  // Get all claims with joins
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';

      // Build dynamic WHERE clause
      let whereConditions = [];
      let queryParams = [limit, offset];
      let countParams = [];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR pr.provider_name ILIKE $${paramIndex} OR i.insurer_name ILIKE $${paramIndex} OR c.claim_number ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`c.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        LEFT JOIN providers pr ON c.provider_id = pr.provider_id
        LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          c.*,
          p.name as patient_name,
          pr.provider_name as provider_name,
          i.insurer_name as insurer_name
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        LEFT JOIN providers pr ON c.provider_id = pr.provider_id
        LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY c.submission_date DESC 
        LIMIT $1 OFFSET $2
      `;
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
      console.error('Error getting claims:', error);
      res.status(500).json({ error: 'Failed to fetch claims' });
    }
  }

  // Get claim by ID with full details
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.CLAIMS.GET_BY_ID, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting claim by ID:', error);
      res.status(500).json({ error: 'Failed to fetch claim' });
    }
  }

  // Update claim status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['submitted', 'approved', 'denied', 'paid'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.CLAIMS.UPDATE_STATUS, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating claim status:', error);
      res.status(500).json({ error: 'Failed to update claim status' });
    }
  }

  // Get claims statistics
  async getStats(req, res) {
    try {
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.CLAIMS.GET_STATS);

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting claims statistics:', error);
      res.status(500).json({ error: 'Failed to fetch claims statistics' });
    }
  }
}

export default new ClaimsController();
