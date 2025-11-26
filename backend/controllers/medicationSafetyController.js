import medicationSafetyService from '../services/medicationSafetyService.js';

class MedicationSafetyController {
  /**
   * Check drug interactions
   * POST /api/medication-safety/check-interactions
   */
  async checkInteractions(req, res) {
    try {
      const { medications } = req.body;

      if (!medications || !Array.isArray(medications)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Medications array is required'
        });
      }

      console.log(`🔍 Checking interactions for ${medications.length} medications`);

      const result = await medicationSafetyService.checkDrugInteractions(medications);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('❌ Error checking interactions:', error.message);
      res.status(500).json({
        success: false,
        error: 'Interaction check failed',
        message: error.message
      });
    }
  }

  /**
   * Comprehensive medication safety analysis
   * POST /api/medication-safety/analyze
   */
  async analyzeSafety(req, res) {
    try {
      const { medications, patientContext } = req.body;

      if (!medications || !Array.isArray(medications) || medications.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Medications array is required and must not be empty'
        });
      }

      console.log(`🔍 Analyzing medication safety for ${medications.length} medications`);
      console.log(`   Patient: Age ${patientContext?.age || 'Unknown'}, Gender: ${patientContext?.gender || 'Unknown'}`);

      const result = await medicationSafetyService.analyzeMedicationSafety(
        medications,
        patientContext || {}
      );

      res.json(result);

    } catch (error) {
      console.error('❌ Error analyzing medication safety:', error.message);
      res.status(500).json({
        success: false,
        error: 'Safety analysis failed',
        message: error.message
      });
    }
  }

  /**
   * Get AI medication suggestions based on diagnosis
   * POST /api/medication-safety/suggest
   */
  async suggestMedications(req, res) {
    try {
      const { diagnosis, patientAge, patientGender, emergencyCase } = req.body;

      if (!diagnosis) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Diagnosis is required'
        });
      }

      console.log(`💊 Generating medication suggestions for: ${diagnosis}`);
      console.log(`   Patient: Age ${patientAge || 'Unknown'}, Gender: ${patientGender || 'Unknown'}`);

      const result = await medicationSafetyService.suggestMedications(
        diagnosis,
        patientAge,
        patientGender,
        emergencyCase || false
      );

      res.json(result);

    } catch (error) {
      console.error('❌ Error suggesting medications:', error.message);
      res.status(500).json({
        success: false,
        error: 'Medication suggestion failed',
        message: error.message
      });
    }
  }

  /**
   * Health check
   * GET /api/medication-safety/health
   */
  async checkHealth(req, res) {
    try {
      const health = await medicationSafetyService.healthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  }
}

export default new MedicationSafetyController();

