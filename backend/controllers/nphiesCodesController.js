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
}

export default new NphiesCodesController();

