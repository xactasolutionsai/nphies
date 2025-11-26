import generalRequestValidationService from '../services/generalRequestValidationService.js';

class GeneralRequestValidationController {
  /**
   * Validate general request (diagnosis to scan matching) - DUAL SYSTEM
   * POST /api/general-request/validate
   */
  async validateGeneralRequest(req, res) {
    try {
      const formData = req.body;

      // Validate that we have required data
      if (!formData || !formData.service) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Request body must contain service data'
        });
      }

      const { diagnosis, description, bodyPart, laterality, previousTests, previousTest } = formData.service;

      // Validate required fields
      if (!diagnosis || !description) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Diagnosis and service description are required'
        });
      }

      console.log(`🔍 General request validation received (DUAL SYSTEM)`);
      console.log(`   Diagnosis: ${diagnosis}`);
      console.log(`   Service: ${description} ${bodyPart || ''}`);
      console.log(`   Laterality: ${laterality || 'not specified'}`);
      console.log(`   Patient: ${formData.patient?.fullName || 'Unknown'}`);
      console.log(`   Medications: ${formData.medications?.length || 0}`);
      console.log(`   Emergency: ${formData.service?.emergencyCase ? 'YES' : 'NO'}`);

      // Pass entire formData to service for AI-enhanced validation
      // Service will extract what it needs for traditional validation
      const validationResult = await generalRequestValidationService.validateDiagnosisToScan(formData);

      // Return dual result (traditional + aiEnhanced)
      res.json(validationResult);

    } catch (error) {
      console.error('❌ Error in validateGeneralRequest:', error.message);
      console.error(error.stack);
      
      // Return error in dual structure format
      res.status(500).json({
        traditional: {
          success: false,
          error: 'Validation failed',
          message: error.message,
          fit: false,
          diagnoses: ['Server error occurred during validation']
        },
        aiEnhanced: null,
        metadata: {
          timestamp: new Date().toISOString(),
          bothSystemsRan: false,
          error: error.message
        }
      });
    }
  }

  /**
   * Check health of validation service
   * GET /api/general-request/health
   */
  async checkHealth(req, res) {
    try {
      const health = await generalRequestValidationService.checkHealth();
      
      const statusCode = health.status === 'ready' ? 200 : 503;
      
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
}

export default new GeneralRequestValidationController();

