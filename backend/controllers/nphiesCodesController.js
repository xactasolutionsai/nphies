/**
 * NPHIES Codes Controller
 * Provides API endpoints for NPHIES code lookups
 */

import nphiesCodeService from '../services/nphiesCodeService.js';

class NphiesCodesController {
  
  /**
   * Get all code systems
   */
  async getCodeSystems(req, res) {
    try {
      const { query } = await import('../db.js');
      const result = await query(`
        SELECT code, name, description, source_url
        FROM nphies_code_systems
        WHERE is_active = true
        ORDER BY name
      `);
      
      res.json({ data: result.rows });
    } catch (error) {
      console.error('Error getting code systems:', error);
      res.status(500).json({ error: 'Failed to fetch code systems' });
    }
  }

  /**
   * Get all codes for a specific system
   */
  async getCodesBySystem(req, res) {
    try {
      const { systemCode } = req.params;
      const codes = await nphiesCodeService.getAllCodes(systemCode);
      
      if (codes.length === 0) {
        return res.status(404).json({ error: `Code system '${systemCode}' not found` });
      }
      
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting codes:', error);
      res.status(500).json({ error: 'Failed to fetch codes' });
    }
  }

  /**
   * Get display value for a specific code
   */
  async getCodeDisplay(req, res) {
    try {
      const { systemCode, code } = req.params;
      const lang = req.query.lang || 'en';
      
      const display = await nphiesCodeService.getDisplay(systemCode, code, lang);
      
      res.json({ 
        code,
        display,
        system: systemCode
      });
    } catch (error) {
      console.error('Error getting code display:', error);
      res.status(500).json({ error: 'Failed to fetch code display' });
    }
  }

  /**
   * Get multiple code lookups at once
   */
  async bulkLookup(req, res) {
    try {
      const { lookups } = req.body;
      const lang = req.query.lang || 'en';
      
      if (!Array.isArray(lookups)) {
        return res.status(400).json({ error: 'lookups must be an array' });
      }
      
      const results = await Promise.all(
        lookups.map(async ({ system, code }) => ({
          system,
          code,
          display: await nphiesCodeService.getDisplay(system, code, lang)
        }))
      );
      
      res.json({ data: results });
    } catch (error) {
      console.error('Error in bulk lookup:', error);
      res.status(500).json({ error: 'Failed to perform bulk lookup' });
    }
  }

  /**
   * Refresh the code cache
   */
  async refreshCache(req, res) {
    try {
      await nphiesCodeService.refresh();
      res.json({ message: 'Code cache refreshed successfully' });
    } catch (error) {
      console.error('Error refreshing cache:', error);
      res.status(500).json({ error: 'Failed to refresh cache' });
    }
  }

  /**
   * Get benefit categories (convenience endpoint)
   */
  async getBenefitCategories(req, res) {
    try {
      const codes = await nphiesCodeService.getAllCodes('benefit-category');
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting benefit categories:', error);
      res.status(500).json({ error: 'Failed to fetch benefit categories' });
    }
  }

  /**
   * Get coverage types (convenience endpoint)
   */
  async getCoverageTypes(req, res) {
    try {
      const codes = await nphiesCodeService.getAllCodes('coverage-type');
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting coverage types:', error);
      res.status(500).json({ error: 'Failed to fetch coverage types' });
    }
  }

  /**
   * Get identifier types (convenience endpoint)
   */
  async getIdentifierTypes(req, res) {
    try {
      const codes = await nphiesCodeService.getAllCodes('identifier-type');
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting identifier types:', error);
      res.status(500).json({ error: 'Failed to fetch identifier types' });
    }
  }

  /**
   * Get provider types (convenience endpoint)
   */
  async getProviderTypes(req, res) {
    try {
      const codes = await nphiesCodeService.getAllCodes('provider-type');
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting provider types:', error);
      res.status(500).json({ error: 'Failed to fetch provider types' });
    }
  }

  /**
   * Get relationships (convenience endpoint)
   */
  async getRelationships(req, res) {
    try {
      const codes = await nphiesCodeService.getAllCodes('subscriber-relationship');
      res.json({ data: codes });
    } catch (error) {
      console.error('Error getting relationships:', error);
      res.status(500).json({ error: 'Failed to fetch relationships' });
    }
  }

  /**
   * Get ICD-10 codes with search and pagination
   * 
   * Query parameters:
   * - search: Search term (searches code and description)
   * - type: Filter by code_type (chapter, block, category)
   * - limit: Max results (default 50, max 500)
   * - offset: Pagination offset (default 0)
   */
  async getIcd10Codes(req, res) {
    try {
      const { query: dbQuery } = await import('../db.js');
      
      const {
        search = '',
        type = '',
        limit = 50,
        offset = 0
      } = req.query;
      
      // Validate and sanitize parameters
      const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 500);
      const safeOffset = Math.max(0, parseInt(offset) || 0);
      
      let whereConditions = ['is_active = true'];
      let params = [];
      let paramIndex = 1;
      
      // Add search condition if provided
      if (search && search.trim()) {
        const searchTerm = search.trim();
        whereConditions.push(`(
          code ILIKE $${paramIndex} OR 
          description ILIKE $${paramIndex + 1}
        )`);
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        paramIndex += 2;
      }
      
      // Add type filter if provided
      if (type && ['chapter', 'block', 'category'].includes(type)) {
        whereConditions.push(`code_type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Get total count for pagination
      const countResult = await dbQuery(`
        SELECT COUNT(*) as total
        FROM icd10_codes
        ${whereClause}
      `, params);
      
      const total = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const result = await dbQuery(`
        SELECT 
          id,
          code,
          description,
          code_type,
          parent_code
        FROM icd10_codes
        ${whereClause}
        ORDER BY 
          CASE code_type 
            WHEN 'chapter' THEN 1 
            WHEN 'block' THEN 2 
            WHEN 'category' THEN 3 
          END,
          code
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, safeLimit, safeOffset]);
      
      res.json({
        data: result.rows,
        pagination: {
          total,
          limit: safeLimit,
          offset: safeOffset,
          hasMore: safeOffset + result.rows.length < total
        }
      });
    } catch (error) {
      console.error('Error getting ICD-10 codes:', error);
      res.status(500).json({ error: 'Failed to fetch ICD-10 codes' });
    }
  }

  /**
   * Get a single ICD-10 code by code value
   */
  async getIcd10CodeByCode(req, res) {
    try {
      const { query: dbQuery } = await import('../db.js');
      const { code } = req.params;
      
      const result = await dbQuery(`
        SELECT 
          id,
          code,
          description,
          code_type,
          parent_code
        FROM icd10_codes
        WHERE code = $1 AND is_active = true
      `, [code]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: `ICD-10 code '${code}' not found` });
      }
      
      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting ICD-10 code:', error);
      res.status(500).json({ error: 'Failed to fetch ICD-10 code' });
    }
  }

  /**
   * Search ICD-10 codes for async dropdown (optimized for react-select)
   * Returns simplified format: { value, label }
   */
  async searchIcd10Codes(req, res) {
    try {
      const { query: dbQuery } = await import('../db.js');
      
      const {
        q = '',
        limit = 50
      } = req.query;
      
      const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);
      
      let result;
      
      if (q && q.trim()) {
        const searchTerm = q.trim();
        
        // Optimized search: prioritize exact code matches, then code starts with, then description contains
        result = await dbQuery(`
          SELECT 
            code as value,
            code || ' - ' || description as label,
            code_type
          FROM icd10_codes
          WHERE is_active = true
            AND code_type = 'category'
            AND (
              code ILIKE $1 OR 
              description ILIKE $2
            )
          ORDER BY 
            CASE 
              WHEN code ILIKE $1 THEN 0
              WHEN code ILIKE $3 THEN 1
              ELSE 2
            END,
            code
          LIMIT $4
        `, [`${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, safeLimit]);
      } else {
        // Return common codes when no search term
        result = await dbQuery(`
          SELECT 
            code as value,
            code || ' - ' || description as label,
            code_type
          FROM icd10_codes
          WHERE is_active = true
            AND code_type = 'category'
          ORDER BY code
          LIMIT $1
        `, [safeLimit]);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error searching ICD-10 codes:', error);
      res.status(500).json({ error: 'Failed to search ICD-10 codes' });
    }
  }
}

export default new NphiesCodesController();

