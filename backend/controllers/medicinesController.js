import medicineService from '../services/medicineService.js';
import medbotService from '../services/medbotService.js';

/**
 * Medicine Controller
 * Handles all medicine-related API requests
 */
class MedicinesController {
  /**
   * Search medicines using natural language query (RAG-based)
   * GET /api/medicines/search?q={query}&limit={limit}
   */
  async searchMedicines(req, res) {
    try {
      const { q, limit } = req.query;
      
      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const limitNum = limit ? parseInt(limit) : undefined;
      
      const results = await medicineService.searchMedicines(q, limitNum);
      
      res.json({
        success: true,
        query: q,
        count: results.length,
        results: results
      });
      
    } catch (error) {
      console.error('Error in searchMedicines:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search medicines',
        message: error.message
      });
    }
  }

  /**
   * Get medicine by MRID
   * GET /api/medicines/:mrid
   */
  async getMedicineByMRID(req, res) {
    try {
      const { mrid } = req.params;
      
      if (!mrid) {
        return res.status(400).json({
          success: false,
          error: 'MRID is required'
        });
      }

      const medicine = await medicineService.getMedicineByMRID(mrid);
      
      if (!medicine) {
        return res.status(404).json({
          success: false,
          error: 'Medicine not found'
        });
      }
      
      res.json({
        success: true,
        medicine: medicine
      });
      
    } catch (error) {
      console.error('Error in getMedicineByMRID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get medicine',
        message: error.message
      });
    }
  }

  /**
   * Get medicine by specific code
   * GET /api/medicines/code/:type/:value
   */
  async getMedicineByCode(req, res) {
    try {
      const { type, value } = req.params;
      
      if (!type || !value) {
        return res.status(400).json({
          success: false,
          error: 'Code type and value are required'
        });
      }

      const validTypes = ['MOH', 'NHIC', 'NUPCO', 'GTIN', 'REGISTRATION'];
      const upperType = type.toUpperCase();
      
      if (!validTypes.includes(upperType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid code type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      const medicine = await medicineService.getMedicineByCode(upperType, value);
      
      if (!medicine) {
        return res.status(404).json({
          success: false,
          error: 'Medicine not found with the specified code'
        });
      }
      
      res.json({
        success: true,
        codeType: upperType,
        codeValue: value,
        medicine: medicine
      });
      
    } catch (error) {
      console.error('Error in getMedicineByCode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get medicine by code',
        message: error.message
      });
    }
  }

  /**
   * Get medicine with AI-generated information
   * GET /api/medicines/:mridOrId/ai-info
   */
  async getMedicineWithAIInfo(req, res) {
    try {
      const { mridOrId } = req.params;
      
      if (!mridOrId) {
        return res.status(400).json({
          success: false,
          error: 'Medicine MRID or ID is required'
        });
      }

      console.log(`\n🤖 API Request: Get medicine with AI info for ${mridOrId}`);
      
      const medicine = await medicineService.getMedicineWithAIInfo(mridOrId);
      
      if (!medicine) {
        return res.status(404).json({
          success: false,
          error: 'Medicine not found'
        });
      }
      
      res.json({
        success: true,
        medicine: medicine
      });
      
    } catch (error) {
      console.error('Error in getMedicineWithAIInfo:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get medicine with AI information',
        message: error.message
      });
    }
  }

  /**
   * Search medicines by active ingredient
   * GET /api/medicines/ingredient/:name
   */
  async searchByActiveIngredient(req, res) {
    try {
      const { name } = req.params;
      const { limit } = req.query;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Ingredient name is required'
        });
      }

      const limitNum = limit ? parseInt(limit) : undefined;
      const results = await medicineService.searchByActiveIngredient(name, limitNum);
      
      res.json({
        success: true,
        ingredient: name,
        count: results.length,
        results: results
      });
      
    } catch (error) {
      console.error('Error in searchByActiveIngredient:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search by ingredient',
        message: error.message
      });
    }
  }

  /**
   * Search medicines by brand name
   * GET /api/medicines/brand/:name
   */
  async searchByBrandName(req, res) {
    try {
      const { name } = req.params;
      const { limit } = req.query;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Brand name is required'
        });
      }

      const limitNum = limit ? parseInt(limit) : undefined;
      const results = await medicineService.searchByBrandName(name, limitNum);
      
      res.json({
        success: true,
        brandName: name,
        count: results.length,
        results: results
      });
      
    } catch (error) {
      console.error('Error in searchByBrandName:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search by brand name',
        message: error.message
      });
    }
  }

  /**
   * Get AI-generated detailed information about a medicine
   * POST /api/medicines/:mrid/ai-info
   */
  async getMedicineAIInfo(req, res) {
    try {
      const { mrid } = req.params;
      
      if (!mrid) {
        return res.status(400).json({
          success: false,
          error: 'MRID is required'
        });
      }

      // First get the medicine data
      const medicine = await medicineService.getMedicineByMRID(mrid);
      
      if (!medicine) {
        return res.status(404).json({
          success: false,
          error: 'Medicine not found'
        });
      }

      // Get AI-generated information
      console.log(`\n🤖 Requesting AI information for medicine: ${medicine.activeIngredient}`);
      const aiInfo = await medbotService.getMedicineInformation(medicine);
      
      res.json({
        success: true,
        medicine: {
          mrid: medicine.mrid,
          activeIngredient: medicine.activeIngredient,
          strength: medicine.strength,
          unit: medicine.unit,
          dosageForm: medicine.dosageForm,
          brands: medicine.brands
        },
        aiInformation: aiInfo
      });
      
    } catch (error) {
      console.error('Error in getMedicineAIInfo:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get AI information',
        message: error.message
      });
    }
  }

  /**
   * Get medicine statistics
   * GET /api/medicines/stats
   */
  async getStatistics(req, res) {
    try {
      const stats = await medicineService.getStatistics();
      
      res.json({
        success: true,
        statistics: stats
      });
      
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        message: error.message
      });
    }
  }

  /**
   * Health check for medicine service
   * GET /api/medicines/health
   */
  async healthCheck(req, res) {
    try {
      const stats = await medicineService.getStatistics();
      const ollamaHealth = await ollamaService.checkHealth();
      
      res.json({
        success: true,
        status: 'operational',
        medicineService: {
          status: 'ok',
          totalMedicines: stats.totalMedicines,
          totalBrands: stats.totalBrands
        },
        aiService: {
          status: ollamaHealth.available ? 'ok' : 'unavailable',
          model: ollamaHealth.configuredModel,
          modelInstalled: ollamaHealth.modelInstalled
        }
      });
      
    } catch (error) {
      console.error('Error in healthCheck:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        error: error.message
      });
    }
  }
}

export default new MedicinesController();

