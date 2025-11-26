import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

class ProvidersController extends BaseController {
  constructor() {
    super('providers', validationSchemas.provider);
  }

  // Get all providers with optional search
  async getAll(req, res) {
    try {
      const queries = await loadQueries();
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const license = req.query.license || '';

      let whereClause = '';
      let queryParams = [];
      let countParams = [];
      
      // Priority: exact license match (if nphies_id is used for license), then general search
      if (license) {
        // Exact match for license/nphies_id
        whereClause = ' WHERE nphies_id = $1';
        queryParams = [license, limit, offset];
        countParams = [license];
      } else if (search) {
        // Fuzzy search for provider name or nphies_id
        whereClause = ' WHERE (provider_name ILIKE $1 OR nphies_id ILIKE $1)';
        queryParams = [`%${search}%`, limit, offset];
        countParams = [`%${search}%`];
      } else {
        queryParams = [limit, offset];
      }

      // Get total count
      const countQuery = queries.PROVIDERS.GET_ALL_COUNT + whereClause;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const limitOffsetIndex = whereClause ? '$2 OFFSET $3' : '$1 OFFSET $2';
      const dataQuery = queries.PROVIDERS.GET_ALL + whereClause + 
        ` ORDER BY provider_name ASC LIMIT ${limitOffsetIndex}`;
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
      console.error('Error getting providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  }

  // Get provider by ID with related data
  async getById(req, res) {
    try {
      const queries = await loadQueries();
      const { id } = req.params;
      
      // Get provider details
      const providerResult = await query(queries.PROVIDERS.GET_BY_ID, [id]);

      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      // Get related claims
      const claimsResult = await query(queries.PROVIDERS.GET_RELATED_CLAIMS, [id]);

      // Get claim count
      const claimCountResult = await query(queries.PROVIDERS.GET_CLAIM_COUNT, [id]);

      res.json({
        data: {
          ...providerResult.rows[0],
          recent_claims: claimsResult.rows,
          total_claims: parseInt(claimCountResult.rows[0].total_claims)
        }
      });
    } catch (error) {
      console.error('Error getting provider by ID:', error);
      res.status(500).json({ error: 'Failed to fetch provider' });
    }
  }
}

export default new ProvidersController();
