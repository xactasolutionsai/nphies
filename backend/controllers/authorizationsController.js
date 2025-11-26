import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class AuthorizationsController extends BaseController {
  constructor() {
    super('authorizations', validationSchemas.authorization);
  }

  // Get all authorizations with joins
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
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR pr.provider_name ILIKE $${paramIndex} OR i.insurer_name ILIKE $${paramIndex} OR a.auth_id::text ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`a.auth_status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM authorizations a
        LEFT JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN providers pr ON a.provider_id = pr.provider_id
        LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          a.*,
          a.auth_id as id,
          a.auth_status as status,
          p.name as patient_name,
          pr.provider_name as provider_name,
          i.insurer_name as insurer_name
        FROM authorizations a
        LEFT JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN providers pr ON a.provider_id = pr.provider_id
        LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY a.auth_id DESC 
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
      console.error('Error getting authorizations:', error);
      res.status(500).json({ error: 'Failed to fetch authorizations' });
    }
  }

  // Get authorization by ID with full details
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(`
        SELECT 
          a.*,
          CONCAT(p.first_name, ' ', p.last_name) as patient_name,
          p.nphies_id as patient_identifier,
          pr.name as provider_name,
          pr.nphies_id as provider_nphies_id,
          i.name as insurer_name,
          i.nphies_id as insurer_nphies_id
        FROM authorizations a
        LEFT JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN providers pr ON a.provider_id = pr.provider_id
        LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
        WHERE a.authorization_id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Authorization not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting authorization by ID:', error);
      res.status(500).json({ error: 'Failed to fetch authorization' });
    }
  }

  // Update authorization status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['approved', 'pending', 'denied'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await query(`
        UPDATE authorizations 
        SET auth_status = $1
        WHERE authorization_id = $2
        RETURNING *
      `, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Authorization not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating authorization status:', error);
      res.status(500).json({ error: 'Failed to update authorization status' });
    }
  }
}

export default new AuthorizationsController();
