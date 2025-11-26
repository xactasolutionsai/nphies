import medbotService from './medbotService.js';

/**
 * Medication Safety Service
 * Uses Goosedev/medbot for comprehensive medication safety analysis
 */
class MedicationSafetyService {
  /**
   * Check for drug-drug interactions between multiple medications
   * @param {Array} medications - Array of medication objects
   * @returns {Promise<object>} - Interaction results
   */
  async checkDrugInteractions(medications) {
    if (!medications || medications.length < 2) {
      return {
        hasInteractions: false,
        interactions: [],
        message: 'At least 2 medications required for interaction checking'
      };
    }

    const medicationList = medications
      .filter(med => med.medicationName || med.activeIngredient)
      .map((med, idx) => `${idx + 1}. ${med.medicationName || med.activeIngredient}${med.strength ? ` ${med.strength}${med.unit || ''}` : ''}`)
      .join('\n');

    const prompt = `You are a clinical pharmacist AI. Analyze these medications for drug-drug interactions:

${medicationList}

Provide JSON response:
{
  "hasInteractions": true/false,
  "interactions": [
    {
      "severity": "severe/moderate/mild",
      "affectedDrugs": ["Drug A", "Drug B"],
      "interaction": "Description",
      "recommendation": "What to do"
    }
  ]
}`;

    try {
      const result = await medbotService.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 2000
      });

      return this.parseInteractionsResponse(result.response);
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      throw error;
    }
  }

  /**
   * Comprehensive medication safety analysis with patient context
   * @param {Array} medications - Array of medication objects
   * @param {object} patientContext - Patient information
   * @returns {Promise<object>} - Comprehensive safety analysis
   */
  async analyzeMedicationSafety(medications, patientContext = {}) {
    if (!medications || medications.length === 0) {
      return {
        success: false,
        message: 'No medications to analyze'
      };
    }

    const prompt = this.buildSafetyAnalysisPrompt(medications, patientContext);

    try {
      console.log('🔍 Analyzing medication safety with Medbot...');
      const result = await medbotService.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 3000
      });

      const analysis = this.parseSafetyAnalysisResponse(result.response);

      // Add duplicate detection (local check)
      const duplicates = this.detectDuplicateIngredients(medications);
      if (duplicates.length > 0) {
        analysis.duplicateIngredients = duplicates;
      }

      return {
        success: true,
        analysis,
        metadata: {
          model: 'Goosedev/medbot',
          responseTime: result.duration,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error analyzing medication safety:', error);
      throw error;
    }
  }

  /**
   * Suggest medications based on diagnosis and patient context
   * @param {string} diagnosis - Patient diagnosis
   * @param {number} patientAge - Patient age
   * @param {string} patientGender - Patient gender
   * @param {boolean} emergencyCase - Is this an emergency
   * @returns {Promise<object>} - Medication suggestions
   */
  async suggestMedications(diagnosis, patientAge, patientGender, emergencyCase = false) {
    if (!diagnosis) {
      return {
        success: false,
        message: 'Diagnosis required for medication suggestions'
      };
    }

    const prompt = this.buildMedicationSuggestionPrompt(
      diagnosis,
      patientAge,
      patientGender,
      emergencyCase
    );

    try {
      console.log(`💊 Generating medication suggestions for: ${diagnosis}`);
      const result = await medbotService.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 2500
      });

      const suggestions = this.parseSuggestionsResponse(result.response);

      return {
        success: true,
        suggestions,
        metadata: {
          model: 'Goosedev/medbot',
          responseTime: result.duration,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error suggesting medications:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive safety analysis prompt
   * @private
   */
  buildSafetyAnalysisPrompt(medications, patientContext) {
    const age = patientContext.age || 'Unknown';
    const gender = patientContext.gender || 'Unknown';
    const pregnant = patientContext.pregnant || 'Unknown';
    const allergies = patientContext.allergies || 'None reported';
    const emergency = patientContext.emergencyCase ? 'YES' : 'NO';

    const medicationList = medications
      .filter(med => med.medicationName || med.activeIngredient)
      .map((med, idx) => {
        const name = med.medicationName || med.activeIngredient;
        const strength = med.strength ? `${med.strength}${med.unit || ''}` : '';
        const activeIng = med.activeIngredient ? `(${med.activeIngredient})` : '';
        return `${idx + 1}. ${name} ${strength} ${activeIng}`.trim();
      })
      .join('\n');

    return `You are a clinical pharmacist AI assistant. Perform comprehensive medication safety analysis.

=== PATIENT CONTEXT ===
Age: ${age} years
Gender: ${gender}
Pregnant: ${pregnant}
Known Allergies: ${allergies}
Emergency Case: ${emergency}

=== CURRENT MEDICATIONS ===
${medicationList}

=== ANALYSIS REQUIRED ===
Provide comprehensive medication safety analysis in JSON format:

{
  "drugInteractions": [
    {
      "severity": "severe/moderate/mild",
      "affectedDrugs": ["Drug A", "Drug B"],
      "interaction": "Detailed description of the interaction mechanism",
      "clinicalSignificance": "What this means for the patient",
      "recommendation": "Specific clinical recommendation"
    }
  ],
  "ageRelatedWarnings": [
    {
      "medication": "Drug name",
      "warning": "Age-specific concern",
      "recommendation": "Dosing adjustment or alternative"
    }
  ],
  "pregnancyWarnings": [
    {
      "medication": "Drug name",
      "category": "Pregnancy category if known",
      "warning": "Risk description",
      "recommendation": "What to do"
    }
  ],
  "sideEffectsOverview": {
    "common": ["Common side effect 1", "Common side effect 2"],
    "serious": ["Serious side effect 1", "Serious side effect 2"]
  },
  "overallRiskAssessment": "low/moderate/high",
  "recommendations": [
    "Clinical recommendation 1",
    "Clinical recommendation 2"
  ]
}

IMPORTANT:
- Consider patient age for dosing appropriateness (pediatric/geriatric)
- Identify drug-drug interactions (pharmacokinetic and pharmacodynamic)
- Assess cumulative side effect risks
- Note contraindications based on patient factors
- If pregnant or female of childbearing age, include pregnancy warnings
- Provide specific, actionable recommendations
- Output ONLY valid JSON`;
  }

  /**
   * Build medication suggestion prompt
   * @private
   */
  buildMedicationSuggestionPrompt(diagnosis, patientAge, patientGender, emergencyCase) {
    const ageStr = patientAge ? `${patientAge} years` : 'Unknown';
    const emergencyStr = emergencyCase ? 'YES - Consider immediate-acting medications' : 'NO';

    return `You are a clinical pharmacist AI. Suggest appropriate medications for this clinical scenario:

=== CLINICAL SCENARIO ===
Diagnosis: ${diagnosis}
Patient Age: ${ageStr}
Gender: ${patientGender}
Emergency Case: ${emergencyStr}

=== TASK ===
Suggest 3-5 appropriate medications for this diagnosis. Consider patient age and standard treatment protocols.

=== REQUIRED JSON FORMAT ===
{
  "suggestions": [
    {
      "medicationClass": "Drug class (e.g., Analgesic, Antibiotic)",
      "genericName": "Generic drug name",
      "brandNamesExamples": ["Brand 1", "Brand 2"],
      "typicalDosage": "Standard dosing regimen",
      "reasoning": "Why this medication is appropriate for this diagnosis",
      "ageAppropriate": true/false,
      "contraindications": "Key contraindications to be aware of",
      "monitoringRequired": "What to monitor during therapy"
    }
  ]
}

GUIDELINES:
- Prioritize first-line treatments
- Consider age-appropriate dosing
- For emergency cases, include rapid-acting options
- Include both generic and common brand names
- Provide evidence-based suggestions
- Note any special monitoring requirements
- Output ONLY valid JSON`;
  }

  /**
   * Parse drug interactions response
   * @private
   */
  parseInteractionsResponse(responseText) {
    try {
      // Try direct JSON parse
      const parsed = JSON.parse(responseText);
      if (parsed.interactions !== undefined) {
        return {
          hasInteractions: parsed.hasInteractions || parsed.interactions.length > 0,
          interactions: parsed.interactions || []
        };
      }
    } catch (e) {
      // Try to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            hasInteractions: parsed.hasInteractions || parsed.interactions?.length > 0,
            interactions: parsed.interactions || []
          };
        } catch (e2) {
          console.error('Failed to parse interactions JSON');
        }
      }
    }

    return {
      hasInteractions: false,
      interactions: [],
      parsingError: true
    };
  }

  /**
   * Parse comprehensive safety analysis response
   * @private
   */
  parseSafetyAnalysisResponse(responseText) {
    const defaultResult = {
      drugInteractions: [],
      ageRelatedWarnings: [],
      pregnancyWarnings: [],
      duplicateIngredients: [],
      sideEffectsOverview: {
        common: [],
        serious: []
      },
      overallRiskAssessment: 'moderate',
      recommendations: [],
      parsingError: false
    };

    try {
      // Try direct JSON parse
      const parsed = JSON.parse(responseText);
      return {
        ...defaultResult,
        ...parsed,
        parsingError: false
      };
    } catch (e) {
      // Try to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...defaultResult,
            ...parsed,
            parsingError: false
          };
        } catch (e2) {
          console.error('Failed to parse safety analysis JSON');
        }
      }
    }

    console.warn('Could not parse safety analysis, returning defaults');
    return {
      ...defaultResult,
      parsingError: true,
      recommendations: ['Unable to parse AI response. Manual review recommended.']
    };
  }

  /**
   * Parse medication suggestions response
   * @private
   */
  parseSuggestionsResponse(responseText) {
    try {
      // Try direct JSON parse
      const parsed = JSON.parse(responseText);
      if (parsed.suggestions) {
        return parsed.suggestions;
      }
    } catch (e) {
      // Try to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.suggestions) {
            return parsed.suggestions;
          }
        } catch (e2) {
          console.error('Failed to parse suggestions JSON');
        }
      }
    }

    return [];
  }

  /**
   * Detect duplicate active ingredients (local check)
   * @private
   */
  detectDuplicateIngredients(medications) {
    const duplicates = [];
    const ingredientMap = new Map();

    medications.forEach((med, index) => {
      const ingredient = (med.activeIngredient || med.medicationName || '').toLowerCase().trim();
      if (!ingredient) return;

      if (ingredientMap.has(ingredient)) {
        const firstIndex = ingredientMap.get(ingredient);
        duplicates.push({
          activeIngredient: med.activeIngredient || med.medicationName,
          medications: [
            medications[firstIndex].medicationName,
            med.medicationName
          ],
          warning: 'Same active ingredient prescribed multiple times',
          recommendation: 'Review and consolidate if appropriate'
        });
      } else {
        ingredientMap.set(ingredient, index);
      }
    });

    return duplicates;
  }

  /**
   * Health check for medication safety service
   */
  async healthCheck() {
    try {
      const medbotHealth = await medbotService.healthCheck();
      return {
        status: medbotHealth.available ? 'healthy' : 'degraded',
        medbot: medbotHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new MedicationSafetyService();

