import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class PaymentsController extends BaseController {
  constructor() {
    super('payments', validationSchemas.payment);
  }

  // Get all payments with joins
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      // Load queries dynamically
      const queries = await loadQueries();

      let whereClause = '';
      let queryParams = [limit, offset];
      let paramIndex = 3;

      if (search) {
        whereClause = queries.PAYMENTS.SEARCH_WHERE;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = queries.PAYMENTS.GET_ALL_COUNT + whereClause;
      const countResult = await query(countQuery, queryParams.slice(2));
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = queries.PAYMENTS.GET_ALL_WITH_JOINS + whereClause + 
        ` ORDER BY p.payment_date DESC LIMIT $1 OFFSET $2`;
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
      console.error('Error getting payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }

  // Get payment by ID with full details
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.PAYMENTS.GET_BY_ID, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting payment by ID:', error);
      res.status(500).json({ error: 'Failed to fetch payment' });
    }
  }

  // Update payment details
  async updatePayment(req, res) {
    try {
      const { id } = req.params;
      const { payment_ref_number, total_paid_amount, payment_date } = req.body;

      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.PAYMENTS.UPDATE_PAYMENT, [payment_ref_number, total_paid_amount, payment_date, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(500).json({ error: 'Failed to update payment' });
    }
  }

  // Get payment statistics
  async getStats(req, res) {
    try {
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.PAYMENTS.GET_STATS);

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting payment statistics:', error);
      res.status(500).json({ error: 'Failed to fetch payment statistics' });
    }
  }

  // Get payments by insurer
  async getByInsurer(req, res) {
    try {
      const { insurerId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Load queries dynamically
      const queries = await loadQueries();
      
      // Get total count
      const countResult = await query(queries.PAYMENTS.GET_BY_INSURER_COUNT, [insurerId]);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const result = await query(queries.PAYMENTS.GET_BY_INSURER, [insurerId, limit, offset]);

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
      console.error('Error getting payments by insurer:', error);
      res.status(500).json({ error: 'Failed to fetch payments by insurer' });
    }
  }
}

export default new PaymentsController();
