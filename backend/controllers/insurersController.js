import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class InsurersController extends BaseController {
  constructor() {
    super('insurers', validationSchemas.insurer);
  }

  // Get all insurers with optional search
  async getAll(req, res) {
    try {
      const queries = await loadQueries();
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let whereClause = '';
      let queryParams = [];
      let countParams = [];
      
      if (search) {
        // Fuzzy search on insurer_name or nphies_id
        whereClause = ' WHERE (insurer_name ILIKE $1 OR nphies_id ILIKE $1)';
        queryParams = [`%${search}%`, limit, offset];
        countParams = [`%${search}%`];
      } else {
        queryParams = [limit, offset];
      }

      // Get total count
      const countQuery = queries.INSURERS.GET_ALL_COUNT + whereClause;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const limitOffsetIndex = whereClause ? '$2 OFFSET $3' : '$1 OFFSET $2';
      const dataQuery = queries.INSURERS.GET_ALL + whereClause + 
        ` ORDER BY insurer_name ASC LIMIT ${limitOffsetIndex}`;
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
      console.error('Error getting insurers:', error);
      res.status(500).json({ error: 'Failed to fetch insurers' });
    }
  }

  // Get insurer by ID with related data
  async getById(req, res) {
    try {
      const queries = await loadQueries();
      const { id } = req.params;
      
      // Get insurer details
      const insurerResult = await query(queries.INSURERS.GET_BY_ID, [id]);

      if (insurerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Insurer not found' });
      }

      // Get related claims
      const claimsResult = await query(queries.INSURERS.GET_RELATED_CLAIMS, [id]);

      // Get claim statistics
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_claims,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
          COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending_claims,
          COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_claims
        FROM claims 
        WHERE insurer_id = $1
      `, [id]);

      // Get payment statistics
      const paymentStatsResult = await query(`
        SELECT 
          COUNT(*) as total_payments,
          COALESCE(SUM(amount), 0) as total_paid_amount
        FROM payments 
        WHERE insurer_id = $1
      `, [id]);

      res.json({
        data: {
          ...insurerResult.rows[0],
          recent_claims: claimsResult.rows,
          claim_stats: statsResult.rows[0],
          payment_stats: paymentStatsResult.rows[0]
        }
      });
    } catch (error) {
      console.error('Error getting insurer by ID:', error);
      res.status(500).json({ error: 'Failed to fetch insurer' });
    }
  }
}

export default new InsurersController();
