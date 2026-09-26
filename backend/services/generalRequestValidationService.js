import ollamaService from './ollamaService.js';
import { query } from '../db.js';

// Structured-output contract for the diagnosis <-> scan check (Ollama `format`).
const FIT_SCHEMA = {
  type: 'object',
  properties: {
    fit: { type: 'boolean' },
    diagnoses: { type: 'array', items: { type: 'string' } }
  },
  required: ['fit', 'diagnoses']
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, ch => `\\${ch}`);

class GeneralRequestValidationService {
  /**
   * Extract direction (laterality) from text.
   * Whole words only, case-insensitive: "Cleft palate" or "bright" are not a side.
   * @param {string} text - Text to extract direction from
   * @returns {string} - 'left', 'right', 'bilateral', or ''
   */
  extractDirection(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    const hasLeft = /\bleft\b/i.test(text);
    const hasRight = /\bright\b/i.test(text);
    
    if (/\bbilateral\b/i.test(text) || (hasLeft && hasRight)) {
      return 'bilateral';
    }
    if (hasLeft) return 'left';
    if (hasRight) return 'right';
    
    return '';
  }

  /**
   * Remove direction words from text
   * Matches the n8n Code1 node logic
   * @param {string} text - Text to clean
   * @returns {string} - Cleaned text without 'left' or 'right'
   */
  removeDirections(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Use word boundaries to match whole words only
    return text.replace(/\b(left|right)\b/gi, '').trim();
  }

  /**
   * Check if laterality matches between diagnosis and scan
   * @param {string} diagnosisDirection - Direction extracted from diagnosis
   * @param {string} scanLaterality - Laterality from scan request
   * @returns {boolean} - True if they match or if diagnosis has no direction
   */
  checkLateralityMatch(diagnosisDirection, scanLaterality) {
    const diagnosisSide = String(diagnosisDirection || '').trim().toLowerCase();
    const scanSide = String(scanLaterality || '').trim().toLowerCase();

    // If diagnosis has no direction specified, it's considered a match
    if (!diagnosisSide) {
      return true;
    }

    // No side on the scan request (or a bilateral diagnosis): nothing to contradict
    if (!scanSide || diagnosisSide === 'bilateral') {
      return true;
    }
    
    // Direct match
    if (diagnosisSide === scanSide) {
      return true;
    }
    
    // Bilateral matches everything
    if (scanSide === 'bilateral') {
      return true;
    }
    
    return false;
  }

  /**
   * Build AI prompt for diagnosis-to-scan validation
   * Matches the n8n AI Agent system message
   * @param {object} formData - Form data with diagnosis and scan info
   * @param {string} cleanedDiagnosis - Diagnosis with laterality removed
   * @returns {string} - Formatted prompt
   */
  buildValidationPrompt(formData, cleanedDiagnosis) {
    const { diagnosis, description, bodyPart, laterality, previousTests } = formData;
    
    // Extract direction from diagnosis
    const diagnosisDirection = this.extractDirection(diagnosis);
    
    return `You are a clinical decision assistant.

TASK: Check if a requested imaging scan is appropriate for a given diagnosis.

OUTPUT FORMAT: Strictly return JSON with this exact structure:
{
  "fit": true/false,
  "diagnoses": [ "Diagnosis 1", "Diagnosis 2", "Diagnosis 3" ]
}

RULES:
- If the laterality (side) between diagnosis and scan does not match, set "fit"=false and provide 3 professional diagnoses relevant to the scan's side and region.
- If the scan fits the diagnosis: set "fit"=true and "diagnoses" must contain exactly 3 professional, properly phrased diagnostic terms that justify the scan.
- If the scan does not fit: set "fit"=false and "diagnoses" must contain exactly 3 professional, properly phrased diagnostic terms that would justify this scan instead.
- If the diagnosis is a systemic condition (e.g., diabetes, hypertension, flu) or otherwise unrelated to the anatomical region of the scan, always set "fit"=false and return 3 local, anatomically appropriate diagnoses that match the scan region and laterality.
- If the diagnosis is on a certain part (eg.hand ,head) ensure scan part is the same otherwise set "fit"=false and "diagnoses" must contain exactly 3 professional, properly phrased diagnostic terms that would justify this scan instead.
- Never include systemic diseases in the "diagnoses" list.
- Output only valid JSON with the structure:
  {
    "fit": true/false,
    "diagnoses": [ "Diagnosis 1", "Diagnosis 2", "Diagnosis 3" ]
  }

INPUT DATA:
Diagnosis: ${diagnosis}
Laterality (side): ${diagnosisDirection}
Requested Scan: ${description} ${bodyPart || ''}
Requested Scan Laterality (side): ${laterality}

Analyze and respond ONLY with the JSON structure specified above.`;
  }

  /**
   * Parse AI response to extract fit and diagnoses
   * @param {string} responseText - Raw AI response
   * @returns {object} - Parsed { fit, diagnoses }
   */
  parseAIResponse(responseText) {
    console.log('\n🔍 ==> PARSING AI RESPONSE <==');
    console.log('Raw response length:', responseText.length);
    
    try {
      // Method 1: Try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.fit !== undefined && parsed.diagnoses !== undefined) {
          console.log('✓ Method 1: Direct JSON parse successful');
          return {
            fit: parsed.fit === true || parsed.fit === 'true',
            diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [String(parsed.diagnoses)]
          };
        }
      } catch (e) {
        // Not a direct JSON, continue to other methods
      }
      
      // Method 2: Try to find JSON object in the response (may have text before/after)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.fit !== undefined && parsed.diagnoses !== undefined) {
            console.log('✓ Method 2: Extracted JSON parse successful');
            return {
              fit: parsed.fit === true || parsed.fit === 'true',
              diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [String(parsed.diagnoses)]
            };
          }
        } catch (e) {
          console.log('⚠️ Method 2: JSON extraction found but parse failed:', e.message);
        }
      }
      
      // Method 3: Try to find the first complete JSON object (in case of multiple)
      const firstJsonMatch = responseText.match(/\{[^{}]*"fit"[^{}]*"diagnoses"[^{}]*\}/);
      if (firstJsonMatch) {
        try {
          const parsed = JSON.parse(firstJsonMatch[0]);
          console.log('✓ Method 3: First JSON object parse successful');
          return {
            fit: parsed.fit === true || parsed.fit === 'true',
            diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [String(parsed.diagnoses)]
          };
        } catch (e) {
          console.log('⚠️ Method 3: Failed:', e.message);
        }
      }
      
      // Method 4: Manual extraction fallback
      const fitMatch = responseText.match(/"fit"\s*:\s*(true|false)/i);
      const diagnosesMatch = responseText.match(/"diagnoses"\s*:\s*\[(.*?)\]/s);
      
      if (fitMatch) {
        console.log('✓ Method 4: Manual extraction');
        const fit = fitMatch[1].toLowerCase() === 'true';
        let diagnoses = [];
        
        if (diagnosesMatch) {
          // Extract items between quotes
          const items = diagnosesMatch[1].match(/"([^"]*)"/g);
          if (items) {
            diagnoses = items.map(item => item.replace(/"/g, ''));
          }
        }
        
        return diagnoses.length > 0
          ? { fit, diagnoses }
          : { fit, diagnoses: ['Unable to extract diagnoses from response'], analysisIncomplete: true };
      }
      
      // Raw model output is not logged: it can echo patient data.
      console.error('❌ All parsing methods failed');
      
      return {
        fit: false,
        diagnoses: ['AI response format not recognized. Manual review required.'],
        analysisIncomplete: true
      };
      
    } catch (error) {
      console.error('❌ Critical error in parseAIResponse:', error.message);
      return {
        fit: false,
        diagnoses: ['Error: ' + error.message],
        analysisIncomplete: true
      };
    }
  }

  /**
   * Query database for exam prerequisites
   * @param {string} examName - Name of the exam/scan
   * @returns {Promise<string|null>} - Prerequisites or null
   */
  async getExamPrerequisites(examName) {
    if (!examName) {
      return null;
    }
    
    try {
      const result = await query(
        `SELECT prerequisites 
         FROM medical_exams 
         WHERE LOWER(exam_name) LIKE LOWER($1)
         LIMIT 1`,
        [`%${escapeLike(examName)}%`]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].prerequisites;
      }
      
      return null;
    } catch (error) {
      console.error('Error querying exam prerequisites:', error.message);
      return null;
    }
  }

  /**
   * Check if prerequisites are satisfied
   * @param {string} requiredPrerequisites - Required prerequisites from DB
   * @param {string} providedTests - Tests provided in the form
   * @returns {boolean} - True if prerequisites are met
   */
  checkPrerequisites(requiredPrerequisites, providedTests) {
    // If no prerequisites required, it's satisfied
    if (!requiredPrerequisites || requiredPrerequisites.trim() === '') {
      return true;
    }
    
    // If prerequisites required but none provided, not satisfied
    if (!providedTests || providedTests.trim() === '') {
      return false;
    }
    
    // Simple string comparison (n8n uses equals comparison)
    // In a production system, you might want more sophisticated matching
    return requiredPrerequisites.toLowerCase().trim() === providedTests.toLowerCase().trim();
  }

  /**
   * Calculate age from date of birth
   * @param {string} dob - Date of birth in YYYY-MM-DD format
   * @returns {number|null} - Age in years or null if invalid
   */
  calculateAge(dob) {
    if (!dob) return null;
    
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age >= 0 ? age : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Build comprehensive AI prompt for test recommendations with full patient context
   * @param {object} fullFormData - Complete form data including patient, service, medications
   * @returns {string} - Formatted prompt
   */
  buildDiagnosisTestRecommendationPrompt(fullFormData) {
    // Extract all relevant fields. Only clinically relevant data goes to the model:
    // no national ID, names, facility or physician identity.
    const patient = fullFormData.patient || {};
    const service = fullFormData.service || {};
    const provider = fullFormData.provider || {};
    const medications = fullFormData.medications || [];
    
    // Calculate patient age
    const age = this.calculateAge(patient.dob);
    const ageStr = age !== null ? `${age} years` : 'Unknown';
    
    // Format medications list
    const medicationsList = medications
      .filter(med => med.medicationName)
      .map(med => {
        const parts = [med.medicationName];
        if (med.type) parts.push(`Type: ${med.type}`);
        if (med.quantity) parts.push(`Qty: ${med.quantity}`);
        return parts.join(', ');
      })
      .join('\n  - ');
    
    const medicationsContext = medicationsList 
      ? `\n  - ${medicationsList}` 
      : '\n  - None reported';

    return `You are a medical AI assistant specializing in diagnostic pathways and test ordering.

=== PATIENT CONTEXT ===
Age: ${ageStr}
Gender: ${patient.gender || 'Unknown'}

=== CLINICAL SCENARIO ===
Primary Diagnosis: ${service.diagnosis || 'Not specified'}
Requested Test/Scan: ${service.description || 'Not specified'}
Body Part: ${service.bodyPart || 'Not specified'}
Laterality: ${service.laterality || 'Not specified'}
Clinical Urgency: ${service.urgency || 'Routine'}
Emergency Case: ${service.emergencyCase ? 'YES' : 'NO'}

=== MEDICAL HISTORY ===
Current Medications:${medicationsContext}

Previous Tests/Imaging: ${service.previousTest || 'None documented'}

=== PROVIDER INFORMATION ===
Department: ${provider.department || 'N/A'}

=== YOUR TASK ===
Provide a comprehensive clinical assessment and diagnostic testing pathway for this patient.

=== REQUIRED OUTPUT (JSON FORMAT) ===
{
  "testAppropriate": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief clinical explanation for your assessment",
  
  "prerequisiteChain": [
    {
      "order": 1,
      "testName": "Name of test",
      "clinicalReason": "Why this test is needed in the diagnostic pathway",
      "urgency": "immediate/urgent/routine/optional",
      "typicalFindings": "What results would support proceeding",
      "mustCompleteBeforeNext": true/false
    }
  ],
  
  "recommendedTests": [
    "Additional tests that should be considered for complete workup"
  ],
  
  "alternativeTests": [
    "Alternative diagnostic approaches if primary test unavailable or contraindicated"
  ],
  
  "contraindications": [
    "Patient-specific concerns, medication interactions, or safety warnings"
  ],
  
  "criticalPrerequisites": [
    "Must-have results or conditions before proceeding with requested test"
  ],
  
  "emergencyModifications": "If emergency case, explain how the standard pathway should be modified (expedited, parallel testing, etc.)"
}

=== CLINICAL GUIDELINES ===
- Consider patient age, gender, and medications when recommending tests
- Order tests by clinical logic: basic screening → confirmatory → advanced imaging
- Indicate urgency based on clinical presentation and emergency status
- Note safety prerequisites (renal function before contrast, pregnancy testing, etc.)
- Consider medication interactions (e.g., metformin with contrast, anticoagulants before procedures)
- For emergency cases, identify which prerequisites can be done in parallel or safely skipped
- Provide evidence-based recommendations following standard of care
- Be specific about typical findings that guide progression through the pathway

=== IMPORTANT ===
- Output ONLY valid JSON matching the structure above
- Do NOT repeat these instructions
- Base recommendations on the complete patient context provided
- Consider age-appropriate testing (pediatric vs adult vs geriatric protocols)
- Factor in emergency status when ordering test sequence

=== BEGIN YOUR ANALYSIS ===`;
  }

  /**
   * Parse AI response for test recommendations
   * @param {string} responseText - Raw AI response
   * @returns {object} - Parsed test recommendations
   */
  parseTestRecommendations(responseText) {
    console.log('\n🔍 ==> PARSING AI TEST RECOMMENDATIONS <==');
    console.log('Raw response length:', responseText.length);
    
    const defaultResult = {
      testAppropriate: false,
      confidence: 0,
      analysisIncomplete: true,
      requiresManualReview: true,
      reasoning: 'Unable to parse AI response. Manual review required.',
      prerequisiteChain: [],
      recommendedTests: [],
      alternativeTests: [],
      contraindications: [],
      criticalPrerequisites: [],
      emergencyModifications: null
    };
    
    try {
      // Method 1: Try to parse entire response as JSON
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.testAppropriate !== undefined) {
          console.log('✓ Direct JSON parse successful');
          return {
            testAppropriate: parsed.testAppropriate === true,
            confidence: parseFloat(parsed.confidence) || 0.5,
            reasoning: parsed.reasoning || 'No reasoning provided',
            prerequisiteChain: Array.isArray(parsed.prerequisiteChain) ? parsed.prerequisiteChain : [],
            recommendedTests: Array.isArray(parsed.recommendedTests) ? parsed.recommendedTests : [],
            alternativeTests: Array.isArray(parsed.alternativeTests) ? parsed.alternativeTests : [],
            contraindications: Array.isArray(parsed.contraindications) ? parsed.contraindications : [],
            criticalPrerequisites: Array.isArray(parsed.criticalPrerequisites) ? parsed.criticalPrerequisites : [],
            emergencyModifications: parsed.emergencyModifications || null
          };
        }
      } catch (e) {
        // Not direct JSON, try extraction
      }
      
      // Method 2: Extract JSON from response text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.testAppropriate !== undefined) {
            console.log('✓ Extracted JSON parse successful');
            return {
              testAppropriate: parsed.testAppropriate === true,
              confidence: parseFloat(parsed.confidence) || 0.5,
              reasoning: parsed.reasoning || 'No reasoning provided',
              prerequisiteChain: Array.isArray(parsed.prerequisiteChain) ? parsed.prerequisiteChain : [],
              recommendedTests: Array.isArray(parsed.recommendedTests) ? parsed.recommendedTests : [],
              alternativeTests: Array.isArray(parsed.alternativeTests) ? parsed.alternativeTests : [],
              contraindications: Array.isArray(parsed.contraindications) ? parsed.contraindications : [],
              criticalPrerequisites: Array.isArray(parsed.criticalPrerequisites) ? parsed.criticalPrerequisites : [],
              emergencyModifications: parsed.emergencyModifications || null
            };
          }
        } catch (e) {
          console.log('⚠️ JSON extraction failed:', e.message);
        }
      }
      
      // If all parsing fails, return default with warning (raw reply not logged: PHI)
      console.error('❌ Unable to parse AI test recommendations');
      return defaultResult;
      
    } catch (error) {
      console.error('❌ Critical error in parseTestRecommendations:', error.message);
      return defaultResult;
    }
  }

  /**
   * Get AI-based test recommendations with full patient context
   * @param {object} fullFormData - Complete form data
   * @returns {Promise<object>} - Test recommendations
   */
  async getAIBasedTestRecommendations(fullFormData) {
    const startTime = Date.now();
    
    try {
      console.log('\n🤖 ==> AI-ENHANCED TEST RECOMMENDATIONS <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      
      const service = fullFormData.service || {};
      const patient = fullFormData.patient || {};
      const age = this.calculateAge(patient.dob);
      
      console.log(`👤 Age: ${age ?? 'Unknown'}, Gender: ${patient.gender || 'Unknown'}`);
      console.log(`🏥 Diagnosis: ${service.diagnosis || 'N/A'}`);
      console.log(`📊 Requested: ${service.description || 'N/A'}`);
      console.log(`⚡ Emergency: ${service.emergencyCase ? 'YES' : 'NO'}, Urgency: ${service.urgency || 'Routine'}`);
      
      const prompt = this.buildDiagnosisTestRecommendationPrompt(fullFormData);
      console.log(`📝 Prompt length: ${prompt.length} characters\n`);
      
      const aiResult = await ollamaService.generateCompletion(prompt, {
        temperature: 0.2,
        num_ctx: 10000,
        num_predict: 2500,
        format: 'json'
      });
      
      console.log(`📥 AI Response received (${aiResult.response?.length || 0} chars)`);
      
      const recommendations = this.parseTestRecommendations(aiResult.response);
      
      console.log(`✓ Test Appropriate: ${recommendations.testAppropriate}`);
      console.log(`✓ Confidence: ${(recommendations.confidence * 100).toFixed(0)}%`);
      console.log(`✓ Prerequisite Chain: ${recommendations.prerequisiteChain.length} tests`);
      console.log(`✓ Contraindications: ${recommendations.contraindications.length}`);
      console.log(`⏱️  AI Response Time: ${Date.now() - startTime}ms\n`);
      
      return {
        ...recommendations,
        metadata: {
          model: ollamaService.model,
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString(),
          rawResponse: aiResult.response
        }
      };
      
    } catch (error) {
      console.error('❌ Error in getAIBasedTestRecommendations:', error.message);
      
      // Return error result (fail closed and flagged)
      return {
        testAppropriate: false,
        confidence: 0,
        aiUnavailable: true,
        requiresManualReview: true,
        reasoning: `AI service error: ${error.message}`,
        prerequisiteChain: [],
        recommendedTests: [],
        alternativeTests: [],
        contraindications: [`AI system error: ${error.message}`],
        criticalPrerequisites: [],
        emergencyModifications: null,
        metadata: {
          error: true,
          errorMessage: error.message,
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Main validation function - DUAL SYSTEM (Traditional + AI-Enhanced)
   * Orchestrates the entire validation flow matching n8n workflow
   * @param {object} fullFormData - Complete form data from frontend (patient, service, medications, etc.)
   * @returns {Promise<object>} - Dual validation result with traditional and AI-enhanced
   */
  async validateDiagnosisToScan(fullFormData) {
    const startTime = Date.now();
    const traditionalStartTime = Date.now();
    
    // Extract service data for backwards compatibility with traditional validation
    const serviceData = fullFormData.service || fullFormData;
    const formData = {
      diagnosis: serviceData.diagnosis,
      description: serviceData.description,
      bodyPart: serviceData.bodyPart || '',
      laterality: serviceData.laterality || '',
      previousTests: serviceData.previousTests || serviceData.previousTest || ''
    };
    
    try {
      console.log('\n🔍 ==> DUAL VALIDATION SYSTEM (Traditional + AI-Enhanced) <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🏥 Diagnosis: ${formData.diagnosis}`);
      console.log(`📊 Scan: ${formData.description} ${formData.bodyPart || ''}`);
      console.log(`🔄 Laterality: ${formData.laterality}\n`);
      
      // Step 1: Extract direction from diagnosis
      const diagnosisDirection = this.extractDirection(formData.diagnosis);
      console.log(`📍 Extracted direction from diagnosis: "${diagnosisDirection}"`);
      
      // Step 2: Check laterality match (n8n "If" node)
      const lateralityMatches = this.checkLateralityMatch(diagnosisDirection, formData.laterality);
      console.log(`✓ Laterality match: ${lateralityMatches}`);
      
      // If laterality doesn't match, return immediately (n8n "Code1" and "Respond to Webhook1")
      if (!lateralityMatches) {
        const cleanedDiagnosis = this.removeDirections(formData.diagnosis);
        const traditionalResponseTime = Date.now() - traditionalStartTime;
        console.log(`⚠️ Laterality mismatch detected`);
        console.log(`⏱️  Traditional validation time: ${traditionalResponseTime}ms`);
        
        // Traditional result
        const traditionalResult = {
          success: true,
          fit: false,
          diagnoses: [`${cleanedDiagnosis} ${formData.laterality}`],
          requiresPrerequisites: false,
          prerequisitesNeeded: null,
          lateralityMismatch: true,
          metadata: {
            responseTime: `${traditionalResponseTime}ms`,
            timestamp: new Date().toISOString(),
            diagnosisDirection,
            scanLaterality: formData.laterality
          }
        };
        
        // Get AI-enhanced recommendations even for laterality mismatch
        let aiEnhancedResult = null;
        try {
          console.log('🤖 Calling AI for enhanced recommendations despite laterality mismatch...');
          aiEnhancedResult = await this.getAIBasedTestRecommendations(fullFormData);
        } catch (aiError) {
          console.error('⚠️ AI validation failed:', aiError.message);
          aiEnhancedResult = null;
        }
        
        console.log(`⏱️  Total time: ${Date.now() - startTime}ms\n`);
        
        // Return dual structure
        return {
          traditional: traditionalResult,
          aiEnhanced: aiEnhancedResult,
          metadata: {
            timestamp: new Date().toISOString(),
            bothSystemsRan: aiEnhancedResult !== null,
            traditionalResponseTime: `${traditionalResponseTime}ms`,
            aiResponseTime: aiEnhancedResult?.metadata?.responseTime || null,
            totalResponseTime: `${Date.now() - startTime}ms`
          }
        };
      }
      
      // Step 3: AI validation (n8n "AI Agent (Diagnosis ↔ Scan)")
      console.log('🤖 Calling AI for diagnosis-to-scan validation...');
      const cleanedDiagnosis = this.removeDirections(formData.diagnosis);
      const prompt = this.buildValidationPrompt(formData, cleanedDiagnosis);
      
      const aiResult = await ollamaService.generateCompletion(prompt, {
        temperature: 0,
        num_ctx: 10000,
        num_predict: 500, // Increase to ensure complete response
        format: FIT_SCHEMA
      });
      
      console.log(`📥 AI Response received (${aiResult.response?.length || 0} chars)`);
      
      // Parse AI response
      const { fit, diagnoses, analysisIncomplete = false } = this.parseAIResponse(aiResult.response);
      console.log(`✓ AI Validation - Fit: ${fit}`);
      console.log(`✓ AI Diagnoses: ${JSON.stringify(diagnoses)}`);
      
      // Step 4: Check prerequisites (n8n "Execute a SQL query" and "If1")
      console.log('\n🔍 Checking exam prerequisites...');
      const prerequisites = await this.getExamPrerequisites(formData.description);
      
      if (prerequisites) {
        console.log(`📋 Prerequisites required: ${prerequisites}`);
        console.log(`📋 Previous tests provided: ${formData.previousTests || 'None'}`);
        
        const prerequisitesMet = this.checkPrerequisites(prerequisites, formData.previousTests);
        console.log(`✓ Prerequisites met: ${prerequisitesMet}`);
        
        if (!prerequisitesMet) {
          const traditionalResponseTime = Date.now() - traditionalStartTime;
          console.log(`⚠️ Prerequisites not satisfied`);
          console.log(`⏱️  Traditional validation time: ${traditionalResponseTime}ms`);
          
          // Traditional result
          const traditionalResult = {
            success: true,
            fit: false,
            diagnoses: [`${prerequisites} is needed`],
            requiresPrerequisites: true,
            prerequisitesNeeded: prerequisites,
            metadata: {
              model: ollamaService.model,
              responseTime: `${traditionalResponseTime}ms`,
              timestamp: new Date().toISOString(),
              aiResponseTime: aiResult.duration
            }
          };
          
          // Get AI-enhanced recommendations
          let aiEnhancedResult = null;
          try {
            console.log('🤖 Calling AI for enhanced recommendations...');
            aiEnhancedResult = await this.getAIBasedTestRecommendations(fullFormData);
          } catch (aiError) {
            console.error('⚠️ AI validation failed:', aiError.message);
            aiEnhancedResult = null;
          }
          
          console.log(`⏱️  Total time: ${Date.now() - startTime}ms\n`);
          
          // Return dual structure
          return {
            traditional: traditionalResult,
            aiEnhanced: aiEnhancedResult,
            metadata: {
              timestamp: new Date().toISOString(),
              bothSystemsRan: aiEnhancedResult !== null,
              traditionalResponseTime: `${traditionalResponseTime}ms`,
              aiResponseTime: aiEnhancedResult?.metadata?.responseTime || null,
              totalResponseTime: `${Date.now() - startTime}ms`
            }
          };
        }
      } else {
        console.log('✓ No prerequisites required for this exam');
      }
      
      // Step 5: Return final validation result
      const traditionalResponseTime = Date.now() - traditionalStartTime;
      console.log(`✅ Traditional validation complete - Fit: ${fit}`);
      console.log(`⏱️  Traditional validation time: ${traditionalResponseTime}ms`);
      
      // Traditional result
      const traditionalResult = {
        success: true,
        fit,
        diagnoses,
        ...(analysisIncomplete ? { analysisIncomplete: true, requiresManualReview: true } : {}),
        requiresPrerequisites: false,
        prerequisitesNeeded: null,
        metadata: {
          model: ollamaService.model,
          responseTime: `${traditionalResponseTime}ms`,
          timestamp: new Date().toISOString(),
          aiResponseTime: aiResult.duration,
          rawAIResponse: aiResult.response
        }
      };
      
      // Get AI-enhanced recommendations
      let aiEnhancedResult = null;
      try {
        console.log('🤖 Calling AI for enhanced recommendations...');
        aiEnhancedResult = await this.getAIBasedTestRecommendations(fullFormData);
      } catch (aiError) {
        console.error('⚠️ AI validation failed:', aiError.message);
        aiEnhancedResult = null;
      }
      
      console.log(`⏱️  Total time: ${Date.now() - startTime}ms\n`);
      
      // Return dual structure
      return {
        traditional: traditionalResult,
        aiEnhanced: aiEnhancedResult,
        metadata: {
          timestamp: new Date().toISOString(),
          bothSystemsRan: aiEnhancedResult !== null,
          traditionalResponseTime: `${traditionalResponseTime}ms`,
          aiResponseTime: aiEnhancedResult?.metadata?.responseTime || null,
          totalResponseTime: `${Date.now() - startTime}ms`
        }
      };
      
    } catch (error) {
      console.error('❌ Error in validateDiagnosisToScan:', error.message);
      
      const traditionalResult = {
        success: false,
        error: error.message,
        aiUnavailable: true,
        requiresManualReview: true,
        fit: false,
        diagnoses: ['Validation error occurred'],
        requiresPrerequisites: false,
        prerequisitesNeeded: null,
        metadata: {
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      };
      
      // Return dual structure even on error
      return {
        traditional: traditionalResult,
        aiEnhanced: null,
        metadata: {
          timestamp: new Date().toISOString(),
          bothSystemsRan: false,
          traditionalResponseTime: `${Date.now() - startTime}ms`,
          aiResponseTime: null,
          totalResponseTime: `${Date.now() - startTime}ms`,
          error: error.message
        }
      };
    }
  }

  /**
   * Check service health
   * @returns {Promise<object>} - Health status
   */
  async checkHealth() {
    try {
      // Check Ollama service
      const ollamaHealth = await ollamaService.checkHealth();
      
      // Check database connection
      const dbResult = await query('SELECT COUNT(*) FROM medical_exams');
      const examCount = parseInt(dbResult.rows[0].count);
      
      return {
        status: 'ready',
        ollama: ollamaHealth,
        database: {
          connected: true,
          examCount
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new GeneralRequestValidationService();

