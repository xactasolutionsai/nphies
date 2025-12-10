import medicalValidationService from '../services/medicalValidationService.js';
import priorAuthValidationService from '../services/priorAuthValidationService.js';
import ollamaService from '../services/ollamaService.js';
import ragService from '../services/ragService.js';

class AIValidationController {
  /**
   * Validate eye approval form
   * POST /api/ai-validation/validate-eye-form
   */
  async validateEyeForm(req, res) {
    try {
      const formData = req.body;
      const options = {
        saveToDatabase: req.body.saveToDatabase !== false,
        formId: req.body.formId || null
      };

      // Validate that we have form data
      if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({
          error: 'Form data is required',
          message: 'Please provide the eye approval form data to validate'
        });
      }

      console.log(`🔍 AI validation request received for ${formData.insured_name || 'patient'}`);

      // Perform validation
      const validationResult = await medicalValidationService.validateEyeForm(formData, options);

      // Return result
      res.json({
        success: true,
        data: validationResult
      });

    } catch (error) {
      console.error('❌ Error in validateEyeForm:', error.message);
      res.status(500).json({
        error: 'Validation failed',
        message: error.message,
        success: false
      });
    }
  }

  /**
   * Get validation history for a form
   * GET /api/ai-validation/history/:formId
   */
  async getValidationHistory(req, res) {
    try {
      const { formId } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      if (!formId) {
        return res.status(400).json({
          error: 'Form ID is required'
        });
      }

      const history = await medicalValidationService.getValidationHistory(formId, limit);

      res.json({
        success: true,
        data: history,
        count: history.length
      });

    } catch (error) {
      console.error('❌ Error in getValidationHistory:', error.message);
      res.status(500).json({
        error: 'Failed to retrieve validation history',
        message: error.message
      });
    }
  }

  /**
   * Mark validation as overridden by user
   * POST /api/ai-validation/override/:validationId
   */
  async markAsOverridden(req, res) {
    try {
      const { validationId } = req.params;

      if (!validationId) {
        return res.status(400).json({
          error: 'Validation ID is required'
        });
      }

      const success = await medicalValidationService.markAsOverridden(validationId);

      if (success) {
        res.json({
          success: true,
          message: 'Validation marked as overridden'
        });
      } else {
        res.status(404).json({
          error: 'Validation record not found',
          success: false
        });
      }

    } catch (error) {
      console.error('❌ Error in markAsOverridden:', error.message);
      res.status(500).json({
        error: 'Failed to update validation record',
        message: error.message
      });
    }
  }

  /**
   * Get validation statistics
   * GET /api/ai-validation/statistics
   */
  async getStatistics(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        formType: req.query.formType || null
      };

      const stats = await medicalValidationService.getStatistics(filters);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Error in getStatistics:', error.message);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: error.message
      });
    }
  }

  /**
   * Check AI validation service health
   * GET /api/ai-validation/health
   */
  async checkHealth(req, res) {
    try {
      const health = await medicalValidationService.checkHealth();

      const statusCode = health.status === 'ready' ? 200 : 
                        health.status === 'limited' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('❌ Error in checkHealth:', error.message);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  }

  /**
   * Search medical knowledge base
   * POST /api/ai-validation/knowledge/search
   */
  async searchKnowledge(req, res) {
    try {
      const { query, limit, category } = req.body;

      if (!query) {
        return res.status(400).json({
          error: 'Search query is required'
        });
      }

      const results = await ragService.searchKnowledge(
        query,
        limit || 5,
        category || null
      );

      res.json({
        success: true,
        data: results,
        count: results.length
      });

    } catch (error) {
      console.error('❌ Error in searchKnowledge:', error.message);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }

  /**
   * Get knowledge base statistics
   * GET /api/ai-validation/knowledge/stats
   */
  async getKnowledgeStats(req, res) {
    try {
      const stats = await ragService.getStatistics();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Error in getKnowledgeStats:', error.message);
      res.status(500).json({
        error: 'Failed to retrieve knowledge base statistics',
        message: error.message
      });
    }
  }

  // ============================================================================
  // PRIOR AUTHORIZATION VALIDATION ENDPOINTS
  // ============================================================================

  /**
   * Validate prior authorization form
   * POST /api/ai-validation/validate-prior-auth
   */
  async validatePriorAuth(req, res) {
    try {
      const formData = req.body;

      // Validate that we have form data
      if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Form data is required',
          message: 'Please provide the prior authorization form data to validate'
        });
      }

      console.log(`🏥 Prior auth validation request received for ${formData.auth_type || 'unknown'} type`);

      // Perform validation
      const validationResult = await priorAuthValidationService.validatePriorAuth(formData);

      // Return result
      res.json(validationResult);

    } catch (error) {
      console.error('❌ Error in validatePriorAuth:', error.message);
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: error.message
      });
    }
  }

  /**
   * Enhance clinical text using AI
   * POST /api/ai-validation/enhance-clinical
   */
  async enhanceClinicalText(req, res) {
    try {
      const { text, field, context } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required',
          message: 'Please provide the clinical text to enhance'
        });
      }

      if (!field) {
        return res.status(400).json({
          success: false,
          error: 'Field type is required',
          message: 'Please specify the field type (e.g., history_of_present_illness, physical_examination)'
        });
      }

      console.log(`📝 Clinical text enhancement request for field: ${field}`);

      const result = await ollamaService.enhanceClinicalText(text, field, context || {});

      res.json(result);

    } catch (error) {
      console.error('❌ Error in enhanceClinicalText:', error.message);
      res.status(500).json({
        success: false,
        error: 'Enhancement failed',
        message: error.message
      });
    }
  }

  /**
   * Suggest SNOMED codes from free text
   * POST /api/ai-validation/suggest-snomed
   */
  async suggestSnomedCodes(req, res) {
    try {
      const { text, category } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required',
          message: 'Please provide the clinical text to analyze'
        });
      }

      console.log(`🏷️ SNOMED suggestion request for: ${text.substring(0, 50)}...`);

      const result = await ollamaService.suggestSnomedCodes(text, category || 'chief_complaint');

      res.json(result);

    } catch (error) {
      console.error('❌ Error in suggestSnomedCodes:', error.message);
      res.status(500).json({
        success: false,
        error: 'SNOMED suggestion failed',
        message: error.message
      });
    }
  }

  /**
   * Check medical necessity for prior authorization
   * POST /api/ai-validation/check-medical-necessity
   */
  async checkMedicalNecessity(req, res) {
    try {
      const formData = req.body;

      if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Form data is required',
          message: 'Please provide the prior authorization form data'
        });
      }

      console.log(`⚖️ Medical necessity check request`);

      const result = await ollamaService.assessMedicalNecessity(formData);

      res.json(result);

    } catch (error) {
      console.error('❌ Error in checkMedicalNecessity:', error.message);
      res.status(500).json({
        success: false,
        error: 'Medical necessity check failed',
        message: error.message
      });
    }
  }

  /**
   * Check prior auth validation service health
   * GET /api/ai-validation/prior-auth/health
   */
  async checkPriorAuthHealth(req, res) {
    try {
      const health = await priorAuthValidationService.checkHealth();

      const statusCode = health.status === 'ready' ? 200 : 
                        health.status === 'limited' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('❌ Error in checkPriorAuthHealth:', error.message);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  }

  /**
   * Validate SNOMED code against its description
   * POST /api/ai-validation/validate-snomed
   */
  async validateSnomedCode(req, res) {
    try {
      const { code, description } = req.body;

      if (!code || !description) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Both code and description are required'
        });
      }

      console.log(`🏷️ SNOMED validation request: ${code} - ${description}`);

      const result = await ollamaService.validateSnomedCode(code, description);

      res.json(result);

    } catch (error) {
      console.error('❌ Error in validateSnomedCode:', error.message);
      res.status(500).json({
        success: false,
        error: 'SNOMED validation failed',
        message: error.message
      });
    }
  }
}

export default new AIValidationController();

