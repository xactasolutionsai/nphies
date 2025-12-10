import medicationSafetyService from '../services/medicationSafetyService.js';
import { query as dbQuery } from '../db.js';

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
   * Enhanced to match suggestions with actual medications in the system database
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

      // Get AI suggestions
      const result = await medicationSafetyService.suggestMedications(
        diagnosis,
        patientAge,
        patientGender,
        emergencyCase || false
      );

      // If we have suggestions, try to match them with medications in our database
      if (result.success && result.suggestions && result.suggestions.length > 0) {
        const enhancedSuggestions = await Promise.all(
          result.suggestions.map(async (suggestion) => {
            // Search for matching medications in the database
            const matchingMedications = await this.findMatchingMedications(
              suggestion.genericName,
              suggestion.brandNamesExamples || []
            );

            return {
              ...suggestion,
              systemMedications: matchingMedications,
              hasSystemMatches: matchingMedications.length > 0
            };
          })
        );

        result.suggestions = enhancedSuggestions;
      }

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
   * Find matching medications from the system database
   * @param {string} genericName - Generic name from AI suggestion
   * @param {Array} brandNames - Brand names from AI suggestion
   * @returns {Array} - Matching medications from database
   */
  async findMatchingMedications(genericName, brandNames = []) {
    try {
      const searchTerms = [genericName, ...brandNames].filter(Boolean);
      
      if (searchTerms.length === 0) return [];

      // Build search conditions for each term
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      searchTerms.forEach(term => {
        const cleanTerm = term.trim().toLowerCase();
        if (cleanTerm.length < 2) return;

        // Search in display name, generic name, and ingredients
        conditions.push(`(
          LOWER(display) LIKE $${paramIndex} OR 
          LOWER(generic_name) LIKE $${paramIndex} OR 
          LOWER(ingredients) LIKE $${paramIndex}
        )`);
        params.push(`%${cleanTerm}%`);
        paramIndex++;
      });

      if (conditions.length === 0) return [];

      const query = `
        SELECT 
          code,
          display,
          strength,
          generic_name,
          dosage_form,
          route_of_administration,
          package_size,
          price,
          ingredients
        FROM medication_codes
        WHERE ${conditions.join(' OR ')}
        ORDER BY 
          CASE 
            WHEN LOWER(display) LIKE $1 THEN 0
            WHEN LOWER(generic_name) LIKE $1 THEN 1
            ELSE 2
          END,
          display
        LIMIT 10
      `;

      const result = await dbQuery(query, params);

      return result.rows.map(row => ({
        code: row.code,
        display: row.display,
        strength: row.strength,
        genericName: row.generic_name,
        dosageForm: row.dosage_form,
        route: row.route_of_administration,
        packageSize: row.package_size,
        price: row.price,
        ingredients: row.ingredients
      }));

    } catch (error) {
      console.error('Error finding matching medications:', error);
      return [];
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

