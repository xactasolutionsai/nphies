import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class PatientsController extends BaseController {
  constructor() {
    super('patients', validationSchemas.patient);
  }

  // Get all patients with optional search
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const identifier = req.query.identifier || '';

      // Load queries dynamically
      const queries = await loadQueries();

      let whereClause = '';
      let queryParams = [];
      let countParams = [];
      
      // Priority: exact identifier match, then general search
      if (identifier) {
        // Exact match for identifier
        whereClause = ' WHERE identifier = $1';
        queryParams = [identifier, limit, offset];
        countParams = [identifier];
      } else if (search) {
        // Fuzzy search for name or identifier
        whereClause = ' WHERE (name ILIKE $1 OR identifier ILIKE $1)';
        queryParams = [`%${search}%`, limit, offset];
        countParams = [`%${search}%`];
      } else {
        queryParams = [limit, offset];
      }

      // Get total count
      const countQuery = queries.PATIENTS.GET_ALL_COUNT + whereClause;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const limitOffsetIndex = whereClause ? '$2 OFFSET $3' : '$1 OFFSET $2';
      const dataQuery = queries.PATIENTS.GET_ALL + whereClause + 
        ` ORDER BY birth_date DESC LIMIT ${limitOffsetIndex}`;
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
      console.error('Error getting patients:', error);
      res.status(500).json({ error: 'Failed to fetch patients' });
    }
  }

  // Get patient by ID with related claims
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Load queries dynamically
      const queries = await loadQueries();
      
      // Get patient details
      const patientResult = await query(queries.PATIENTS.GET_BY_ID, [id]);

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Get related claims
      const claimsResult = await query(queries.PATIENTS.GET_WITH_CLAIMS, [id]);

      // Get related authorizations
      const authsResult = await query(queries.PATIENTS.GET_WITH_AUTHORIZATIONS, [id]);

      res.json({
        data: {
          ...patientResult.rows[0],
          claims: claimsResult.rows,
          authorizations: authsResult.rows
        }
      });
    } catch (error) {
      console.error('Error getting patient by ID:', error);
      res.status(500).json({ error: 'Failed to fetch patient' });
    }
  }
}

export default new PatientsController();
