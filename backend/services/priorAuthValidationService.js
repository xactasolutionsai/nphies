import ollamaService from './ollamaService.js';
import ragService from './ragService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Prior Authorization Validation Service
 * Uses biomistral AI model to validate and enhance prior authorization data
 * before NPHIES submission to reduce rejection rates
 */
class PriorAuthValidationService {
  constructor() {
    this.enabled = process.env.AI_VALIDATION_ENABLED !== 'false';
    
    // Validation rules by auth type
    this.validationRules = {
      institutional: {
        requiredVitals: ['systolic', 'diastolic', 'height', 'weight', 'pulse', 'temperature', 'oxygen_saturation', 'respiratory_rate'],
        requiredClinical: ['chief_complaint', 'history_of_present_illness', 'physical_examination', 'treatment_plan'],
        requiresAdmissionInfo: true
      },
      professional: {
        requiredVitals: ['systolic', 'diastolic', 'pulse', 'temperature', 'height', 'weight'],
        requiredClinical: ['chief_complaint', 'history_of_present_illness', 'treatment_plan'],
        requiresAdmissionInfo: false
      },
      pharmacy: {
        requiredVitals: ['weight', 'height'],
        requiredClinical: ['chief_complaint'],
        requiresAdmissionInfo: false
      },
      dental: {
        requiredVitals: ['systolic', 'diastolic', 'pulse'],
        requiredClinical: ['chief_complaint', 'history_of_present_illness', 'physical_examination', 'treatment_plan'],
        requiresAdmissionInfo: false
      },
      vision: {
        requiredVitals: ['systolic', 'diastolic'],
        requiredClinical: ['chief_complaint', 'physical_examination', 'treatment_plan'],
        requiresAdmissionInfo: false
      }
    };

    // Physiological ranges for vitals plausibility check
    this.vitalRanges = {
      systolic: { min: 70, max: 250, unit: 'mmHg' },
      diastolic: { min: 40, max: 150, unit: 'mmHg' },
      height: { min: 50, max: 250, unit: 'cm' },
      weight: { min: 2, max: 300, unit: 'kg' },
      pulse: { min: 30, max: 220, unit: 'bpm' },
      temperature: { min: 34, max: 42, unit: '°C' },
      oxygen_saturation: { min: 70, max: 100, unit: '%' },
      respiratory_rate: { min: 8, max: 60, unit: '/min' }
    };

    // NPHIES rejection categories
    this.rejectionCategories = {
      ADMINISTRATIVE: 'AD',
      COVERAGE: 'CV',
      MEDICAL_NECESSITY: 'MN',
      SUPPORTING_EVIDENCE: 'SE',
      BILLING: 'BL'
    };

    console.log(`✅ Prior Auth Validation Service initialized (enabled: ${this.enabled})`);
  }

  /**
   * Comprehensive prior authorization validation
   * @param {object} formData - Complete prior auth form data
   * @returns {Promise<object>} - Validation result with risk scores and suggestions
   */
  async validatePriorAuth(formData) {
    if (!this.enabled) {
      return this.getDisabledResponse();
    }

    const startTime = Date.now();
    const authType = formData.auth_type || 'professional';
    const rules = this.validationRules[authType] || this.validationRules.professional;

    try {
      console.log(`🏥 Starting prior auth validation for ${authType} type...`);

      // Step 1: Basic validation (non-AI)
      const basicValidation = this.performBasicValidation(formData, rules);
      
      // Step 2: Vitals plausibility check
      const vitalsValidation = this.validateVitalsPlausibility(formData.vital_signs);
      
      // Step 3: Time relevance check
      const timeValidation = this.validateTimeRelevance(formData);
      
      // Step 4: AI-powered validation using biomistral
      const aiValidation = await this.performAIValidation(formData, authType);
      
      // Step 5: Retrieve relevant medical guidelines
      const guidelines = await this.retrieveRelevantGuidelines(formData);
      
      // Step 6: Calculate risk scores
      const riskScores = this.calculateRiskScores(basicValidation, vitalsValidation, timeValidation, aiValidation);
      
      // Step 7: Generate suggestions
      const suggestions = this.generateSuggestions(basicValidation, vitalsValidation, aiValidation, formData);

      const duration = Date.now() - startTime;

      return {
        success: true,
        isValid: riskScores.overall < 0.5,
        authType,
        riskScores,
        validation: {
          basic: basicValidation,
          vitals: vitalsValidation,
          time: timeValidation,
          ai: aiValidation
        },
        suggestions,
        guidelines: guidelines.slice(0, 3), // Top 3 relevant guidelines
        metadata: {
          validationDuration: duration,
          model: ollamaService.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error in prior auth validation:', error.message);
      return {
        success: false,
        isValid: true, // Default to valid on error to not block workflow
        error: error.message,
        riskScores: { overall: 0, categories: {} },
        suggestions: [],
        metadata: {
          error: true,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Perform basic (non-AI) validation checks
   */
  performBasicValidation(formData, rules) {
    const issues = [];
    const vitalSigns = formData.vital_signs || {};
    const clinicalInfo = formData.clinical_info || {};
    const admissionInfo = formData.admission_info || {};

    // Check required vitals
    rules.requiredVitals.forEach(vital => {
      if (!vitalSigns[vital] || vitalSigns[vital] === '') {
        issues.push({
          category: this.rejectionCategories.SUPPORTING_EVIDENCE,
          field: `vital_signs.${vital}`,
          code: 'SE-1',
          message: `Missing required vital sign: ${this.formatVitalName(vital)}`,
          severity: 'high'
        });
      }
    });

    // Check required clinical fields
    rules.requiredClinical.forEach(field => {
      const value = field === 'chief_complaint' 
        ? (clinicalInfo.chief_complaint_code || clinicalInfo.chief_complaint_text)
        : clinicalInfo[field];
      
      if (!value || value === '') {
        issues.push({
          category: this.rejectionCategories.SUPPORTING_EVIDENCE,
          field: `clinical_info.${field}`,
          code: 'SE-2',
          message: `Missing required clinical information: ${this.formatFieldName(field)}`,
          severity: 'high'
        });
      }
    });

    // Check admission info for institutional
    if (rules.requiresAdmissionInfo) {
      if (!admissionInfo.admission_weight) {
        issues.push({
          category: this.rejectionCategories.SUPPORTING_EVIDENCE,
          field: 'admission_info.admission_weight',
          code: 'SE-3',
          message: 'Missing admission weight for institutional authorization',
          severity: 'medium'
        });
      }
    }

    // Check diagnoses
    if (!formData.diagnoses || formData.diagnoses.length === 0) {
      issues.push({
        category: this.rejectionCategories.MEDICAL_NECESSITY,
        field: 'diagnoses',
        code: 'MN-1',
        message: 'At least one diagnosis is required',
        severity: 'high'
      });
    }

    // Check items
    if (!formData.items || formData.items.length === 0) {
      issues.push({
        category: this.rejectionCategories.BILLING,
        field: 'items',
        code: 'BL-1',
        message: 'At least one service/procedure item is required',
        severity: 'high'
      });
    }

    return {
      passed: issues.length === 0,
      issues,
      completeness: this.calculateCompleteness(formData, rules)
    };
  }

  /**
   * Validate vitals are within physiologically plausible ranges
   */
  validateVitalsPlausibility(vitalSigns = {}) {
    const issues = [];
    const warnings = [];

    Object.entries(vitalSigns).forEach(([key, value]) => {
      if (!value || value === '' || key === 'measurement_time') return;
      
      const numValue = parseFloat(value);
      const range = this.vitalRanges[key];
      
      if (!range) return;

      if (isNaN(numValue)) {
        issues.push({
          field: key,
          message: `Invalid ${this.formatVitalName(key)} value: not a number`,
          severity: 'high'
        });
      } else if (numValue < range.min || numValue > range.max) {
        issues.push({
          field: key,
          message: `${this.formatVitalName(key)} (${numValue} ${range.unit}) is outside normal range (${range.min}-${range.max} ${range.unit})`,
          severity: 'high',
          suggestion: `Please verify the ${this.formatVitalName(key)} value`
        });
      }
    });

    // Calculate BMI if height and weight are present
    if (vitalSigns.height && vitalSigns.weight) {
      const heightM = parseFloat(vitalSigns.height) / 100;
      const weightKg = parseFloat(vitalSigns.weight);
      const bmi = weightKg / (heightM * heightM);

      if (bmi < 15 || bmi > 50) {
        warnings.push({
          field: 'bmi',
          message: `Calculated BMI (${bmi.toFixed(1)}) is unusual. Please verify height and weight.`,
          severity: 'medium'
        });
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      warnings,
      bmi: vitalSigns.height && vitalSigns.weight 
        ? (parseFloat(vitalSigns.weight) / Math.pow(parseFloat(vitalSigns.height) / 100, 2)).toFixed(1)
        : null
    };
  }

  /**
   * Validate time relevance of vitals and encounter dates
   */
  validateTimeRelevance(formData) {
    const issues = [];
    const now = new Date();
    const measurementTime = formData.vital_signs?.measurement_time 
      ? new Date(formData.vital_signs.measurement_time) 
      : null;
    const encounterStart = formData.encounter_start 
      ? new Date(formData.encounter_start) 
      : null;

    // Check if vitals are too old (more than 24 hours before encounter)
    if (measurementTime && encounterStart) {
      const timeDiff = encounterStart - measurementTime;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        issues.push({
          field: 'vital_signs.measurement_time',
          message: `Vital signs were measured ${Math.round(hoursDiff)} hours before the encounter. Payer may request updated vitals.`,
          severity: 'medium',
          code: 'SE-4'
        });
      }
    }

    // Check if measurement time is in the future
    if (measurementTime && measurementTime > now) {
      issues.push({
        field: 'vital_signs.measurement_time',
        message: 'Vital signs measurement time cannot be in the future',
        severity: 'high'
      });
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * Perform AI-powered validation using biomistral
   */
  async performAIValidation(formData, authType) {
    try {
      const prompt = this.buildAIValidationPrompt(formData, authType);
      
      console.log('🤖 Sending to AI for clinical validation...');
      
      const result = await ollamaService.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 2000,
        repeat_penalty: 1.2
      });

      return this.parseAIValidationResponse(result.response, formData);

    } catch (error) {
      console.error('❌ AI validation error:', error.message);
      return {
        passed: true,
        issues: [],
        recommendations: [],
        medicalNecessityScore: 0.5,
        error: error.message
      };
    }
  }

  /**
   * Build the AI validation prompt
   */
  buildAIValidationPrompt(formData, authType) {
    const vitalSigns = formData.vital_signs || {};
    const clinicalInfo = formData.clinical_info || {};
    const diagnoses = formData.diagnoses || [];
    const items = formData.items || [];

    // Calculate BMI if available
    let bmiInfo = '';
    if (vitalSigns.height && vitalSigns.weight) {
      const bmi = parseFloat(vitalSigns.weight) / Math.pow(parseFloat(vitalSigns.height) / 100, 2);
      bmiInfo = `BMI: ${bmi.toFixed(1)} kg/m²`;
    }

    const diagnosisList = diagnoses.map(d => 
      `- ${d.diagnosis_code || 'N/A'}: ${d.diagnosis_display || d.diagnosis_description || 'N/A'} (${d.diagnosis_type || 'secondary'})`
    ).join('\n');

    const itemsList = items.map(i => 
      `- ${i.product_or_service_code || i.medication_code || 'N/A'}: ${i.service_description || i.medication_name || 'N/A'}`
    ).join('\n');

    return `You are a medical AI assistant reviewing a prior authorization request for NPHIES (Saudi Arabia healthcare system). Analyze the clinical data and identify potential rejection risks.

=== AUTHORIZATION TYPE ===
${authType.toUpperCase()}

=== VITAL SIGNS ===
Systolic BP: ${vitalSigns.systolic || 'Not recorded'} mmHg
Diastolic BP: ${vitalSigns.diastolic || 'Not recorded'} mmHg
Height: ${vitalSigns.height || 'Not recorded'} cm
Weight: ${vitalSigns.weight || 'Not recorded'} kg
${bmiInfo}
Pulse: ${vitalSigns.pulse || 'Not recorded'} bpm
Temperature: ${vitalSigns.temperature || 'Not recorded'} °C
O2 Saturation: ${vitalSigns.oxygen_saturation || 'Not recorded'} %
Respiratory Rate: ${vitalSigns.respiratory_rate || 'Not recorded'} /min

=== CLINICAL INFORMATION ===
Chief Complaint: ${clinicalInfo.chief_complaint_display || clinicalInfo.chief_complaint_text || 'Not specified'}
Chief Complaint Code: ${clinicalInfo.chief_complaint_code || 'Not coded'}

Patient History:
${clinicalInfo.patient_history || 'Not documented'}

History of Present Illness:
${clinicalInfo.history_of_present_illness || 'Not documented'}

Physical Examination:
${clinicalInfo.physical_examination || 'Not documented'}

Treatment Plan:
${clinicalInfo.treatment_plan || 'Not documented'}

Investigation Result: ${clinicalInfo.investigation_result || 'Not specified'}

=== DIAGNOSES ===
${diagnosisList || 'No diagnoses specified'}

=== REQUESTED SERVICES/PROCEDURES ===
${itemsList || 'No items specified'}

=== ANALYSIS REQUIRED ===
Analyze this prior authorization request and provide:

1. MEDICAL_NECESSITY_SCORE: A score from 0.0 to 1.0 indicating how well the clinical documentation supports the requested services (1.0 = excellent justification, 0.0 = no justification)

2. CONSISTENCY_CHECK: Are the chief complaint, diagnoses, and requested services logically consistent?

3. DOCUMENTATION_GAPS: List any missing documentation that could lead to rejection

4. REJECTION_RISKS: List specific rejection risks with NPHIES codes (MN-*, SE-*, CV-*)

5. RECOMMENDATIONS: Specific improvements to strengthen the authorization

=== OUTPUT FORMAT ===

MEDICAL_NECESSITY_SCORE: [0.0-1.0]

CONSISTENCY_CHECK: [PASS/FAIL]
[Explanation if FAIL]

DOCUMENTATION_GAPS:
- [Gap 1]
- [Gap 2]

REJECTION_RISKS:
- [Code]: [Description]

RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]

JUSTIFICATION_NARRATIVE:
[A brief medical necessity justification that could be added to strengthen the request]

=== BEGIN ANALYSIS ===`;
  }

  /**
   * Parse AI validation response
   */
  parseAIValidationResponse(responseText, formData) {
    const result = {
      passed: true,
      medicalNecessityScore: 0.5,
      consistencyCheck: { passed: true, explanation: '' },
      documentationGaps: [],
      rejectionRisks: [],
      recommendations: [],
      justificationNarrative: ''
    };

    try {
      // Extract medical necessity score
      const scoreMatch = responseText.match(/MEDICAL_NECESSITY_SCORE:\s*([\d.]+)/i);
      if (scoreMatch) {
        result.medicalNecessityScore = parseFloat(scoreMatch[1]);
        if (result.medicalNecessityScore < 0.6) {
          result.passed = false;
        }
      }

      // Extract consistency check
      const consistencyMatch = responseText.match(/CONSISTENCY_CHECK:\s*(PASS|FAIL)/i);
      if (consistencyMatch) {
        result.consistencyCheck.passed = consistencyMatch[1].toUpperCase() === 'PASS';
        if (!result.consistencyCheck.passed) {
          result.passed = false;
          // Try to extract explanation
          const explMatch = responseText.match(/CONSISTENCY_CHECK:\s*FAIL\s*\n([^\n]+)/i);
          if (explMatch) {
            result.consistencyCheck.explanation = explMatch[1].trim();
          }
        }
      }

      // Extract documentation gaps
      const gapsSection = responseText.match(/DOCUMENTATION_GAPS:([\s\S]*?)(?=REJECTION_RISKS:|RECOMMENDATIONS:|$)/i);
      if (gapsSection) {
        const gapLines = gapsSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        result.documentationGaps = gapLines.map(line => line.replace(/^-\s*/, '').trim()).filter(g => g.length > 5);
      }

      // Extract rejection risks
      const risksSection = responseText.match(/REJECTION_RISKS:([\s\S]*?)(?=RECOMMENDATIONS:|JUSTIFICATION_NARRATIVE:|$)/i);
      if (risksSection) {
        const riskLines = risksSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        result.rejectionRisks = riskLines.map(line => {
          const cleaned = line.replace(/^-\s*/, '').trim();
          const codeMatch = cleaned.match(/^([A-Z]{2}-[\d-]+):\s*(.+)/);
          if (codeMatch) {
            return { code: codeMatch[1], description: codeMatch[2] };
          }
          return { code: 'UNKNOWN', description: cleaned };
        }).filter(r => r.description.length > 5);
      }

      // Extract recommendations
      const recsSection = responseText.match(/RECOMMENDATIONS:([\s\S]*?)(?=JUSTIFICATION_NARRATIVE:|$)/i);
      if (recsSection) {
        const recLines = recsSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        result.recommendations = recLines.map(line => line.replace(/^-\s*/, '').trim()).filter(r => r.length > 5);
      }

      // Extract justification narrative
      const narrativeSection = responseText.match(/JUSTIFICATION_NARRATIVE:([\s\S]*?)$/i);
      if (narrativeSection) {
        result.justificationNarrative = narrativeSection[1].trim()
          .replace(/^[\s\n]+/, '')
          .replace(/[\s\n]+$/, '')
          .split('\n')
          .filter(line => !line.match(/^(===|---)/))
          .join(' ')
          .trim();
      }

    } catch (error) {
      console.error('❌ Error parsing AI response:', error.message);
    }

    return result;
  }

  /**
   * Retrieve relevant medical guidelines using RAG
   */
  async retrieveRelevantGuidelines(formData) {
    try {
      const diagnoses = formData.diagnoses || [];
      const items = formData.items || [];
      
      // Build query from diagnoses and items
      const queryParts = [
        ...diagnoses.map(d => d.diagnosis_display || d.diagnosis_description || ''),
        ...items.map(i => i.service_description || i.medication_name || '')
      ].filter(Boolean);

      if (queryParts.length === 0) {
        return [];
      }

      const query = queryParts.join(', ');
      const guidelines = await ragService.retrieveRelevantGuidelines({ 
        chief_complaints: query,
        diagnoses: diagnoses.map(d => d.diagnosis_display).join(', ')
      });

      return guidelines;

    } catch (error) {
      console.error('❌ Error retrieving guidelines:', error.message);
      return [];
    }
  }

  /**
   * Calculate risk scores by category
   */
  calculateRiskScores(basicValidation, vitalsValidation, timeValidation, aiValidation) {
    const scores = {
      administrative: 0,
      coverage: 0,
      medicalNecessity: 0,
      supportingEvidence: 0,
      billing: 0
    };

    // Calculate from basic validation issues
    basicValidation.issues.forEach(issue => {
      switch (issue.category) {
        case this.rejectionCategories.ADMINISTRATIVE:
          scores.administrative += issue.severity === 'high' ? 0.3 : 0.1;
          break;
        case this.rejectionCategories.COVERAGE:
          scores.coverage += issue.severity === 'high' ? 0.3 : 0.1;
          break;
        case this.rejectionCategories.MEDICAL_NECESSITY:
          scores.medicalNecessity += issue.severity === 'high' ? 0.3 : 0.1;
          break;
        case this.rejectionCategories.SUPPORTING_EVIDENCE:
          scores.supportingEvidence += issue.severity === 'high' ? 0.3 : 0.1;
          break;
        case this.rejectionCategories.BILLING:
          scores.billing += issue.severity === 'high' ? 0.3 : 0.1;
          break;
      }
    });

    // Add vitals plausibility issues
    vitalsValidation.issues.forEach(() => {
      scores.supportingEvidence += 0.2;
    });

    // Add time relevance issues
    timeValidation.issues.forEach(() => {
      scores.supportingEvidence += 0.15;
    });

    // Add AI validation risks
    if (aiValidation.medicalNecessityScore < 0.6) {
      scores.medicalNecessity += (1 - aiValidation.medicalNecessityScore) * 0.5;
    }

    if (!aiValidation.consistencyCheck.passed) {
      scores.medicalNecessity += 0.2;
    }

    aiValidation.rejectionRisks.forEach(risk => {
      if (risk.code.startsWith('MN')) scores.medicalNecessity += 0.15;
      else if (risk.code.startsWith('SE')) scores.supportingEvidence += 0.15;
      else if (risk.code.startsWith('CV')) scores.coverage += 0.15;
    });

    // Cap scores at 1.0
    Object.keys(scores).forEach(key => {
      scores[key] = Math.min(1, scores[key]);
    });

    // Calculate overall score (weighted average)
    const overall = (
      scores.administrative * 0.1 +
      scores.coverage * 0.2 +
      scores.medicalNecessity * 0.35 +
      scores.supportingEvidence * 0.25 +
      scores.billing * 0.1
    );

    return {
      overall: Math.min(1, overall),
      categories: scores,
      riskLevel: overall < 0.3 ? 'low' : overall < 0.6 ? 'medium' : 'high'
    };
  }

  /**
   * Generate actionable suggestions
   */
  generateSuggestions(basicValidation, vitalsValidation, aiValidation, formData) {
    const suggestions = [];

    // Suggestions from basic validation
    basicValidation.issues.forEach(issue => {
      suggestions.push({
        type: 'missing_field',
        field: issue.field,
        message: issue.message,
        severity: issue.severity,
        action: 'fill',
        category: issue.category
      });
    });

    // Suggestions from vitals validation
    vitalsValidation.issues.forEach(issue => {
      suggestions.push({
        type: 'invalid_value',
        field: `vital_signs.${issue.field}`,
        message: issue.message,
        severity: issue.severity,
        action: 'verify',
        suggestion: issue.suggestion
      });
    });

    // Suggestions from AI validation
    aiValidation.recommendations.forEach(rec => {
      suggestions.push({
        type: 'ai_recommendation',
        message: rec,
        severity: 'medium',
        action: 'review'
      });
    });

    // Add justification narrative suggestion if available
    if (aiValidation.justificationNarrative && aiValidation.justificationNarrative.length > 20) {
      suggestions.push({
        type: 'justification',
        field: 'clinical_info.treatment_plan',
        message: 'Consider adding this medical necessity justification to strengthen your request',
        severity: 'medium',
        action: 'enhance',
        suggestedText: aiValidation.justificationNarrative
      });
    }

    // Add consistency warning if needed
    if (!aiValidation.consistencyCheck.passed) {
      suggestions.push({
        type: 'consistency',
        message: `Clinical consistency issue: ${aiValidation.consistencyCheck.explanation || 'Chief complaint, diagnoses, and requested services may not align'}`,
        severity: 'high',
        action: 'review'
      });
    }

    return suggestions;
  }

  /**
   * Enhance clinical text using AI
   */
  async enhanceClinicalText(text, field, context = {}) {
    if (!this.enabled) {
      return { success: false, error: 'AI validation disabled' };
    }

    try {
      const prompt = this.buildEnhancementPrompt(text, field, context);
      
      const result = await ollamaService.generateCompletion(prompt, {
        temperature: 0.4,
        num_predict: 1500
      });

      return {
        success: true,
        originalText: text,
        enhancedText: this.parseEnhancedText(result.response),
        metadata: {
          model: ollamaService.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error enhancing clinical text:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build prompt for clinical text enhancement
   */
  buildEnhancementPrompt(text, field, context) {
    const fieldDescriptions = {
      history_of_present_illness: 'History of Present Illness (HPI)',
      physical_examination: 'Physical Examination findings',
      treatment_plan: 'Treatment Plan',
      patient_history: 'Patient Medical History'
    };

    const fieldName = fieldDescriptions[field] || field;

    return `You are a medical documentation specialist. Enhance the following ${fieldName} to meet insurance prior authorization requirements.

=== CONTEXT ===
Chief Complaint: ${context.chiefComplaint || 'Not specified'}
Diagnosis: ${context.diagnosis || 'Not specified'}
Requested Service: ${context.requestedService || 'Not specified'}

=== ORIGINAL TEXT ===
${text || 'No text provided'}

=== REQUIREMENTS ===
1. Expand the text to be more detailed and clinically complete
2. Include relevant clinical findings that support the diagnosis
3. Document any prior treatments tried (if applicable)
4. Use professional medical terminology
5. Keep the content factual and based on the original text
6. Format appropriately for the ${fieldName} section

=== OUTPUT ===
Provide ONLY the enhanced text, without any explanations or headers. The text should be ready to use directly in the medical record.

ENHANCED_TEXT:`;
  }

  /**
   * Parse enhanced text from AI response
   */
  parseEnhancedText(response) {
    // Remove any leading markers
    let text = response.replace(/^ENHANCED_TEXT:\s*/i, '').trim();
    
    // Remove any trailing markers or instructions
    text = text.replace(/\n===.*$/s, '').trim();
    
    return text;
  }

  /**
   * Suggest SNOMED codes from free text
   */
  async suggestSnomedCodes(text, category = 'chief_complaint') {
    if (!this.enabled || !text) {
      return { success: false, suggestions: [] };
    }

    try {
      const prompt = `You are a medical coding specialist. Suggest appropriate SNOMED CT codes for the following clinical text.

=== CLINICAL TEXT ===
${text}

=== CATEGORY ===
${category}

=== REQUIREMENTS ===
Provide up to 5 relevant SNOMED CT codes with their descriptions. Format as:
CODE: [SNOMED code] - [Description]

Focus on the most specific and accurate codes for the clinical description.

=== SNOMED SUGGESTIONS ===`;

      const result = await ollamaService.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 500
      });

      const suggestions = this.parseSnomedSuggestions(result.response);

      return {
        success: true,
        originalText: text,
        suggestions,
        metadata: {
          model: ollamaService.model,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error suggesting SNOMED codes:', error.message);
      return { success: false, error: error.message, suggestions: [] };
    }
  }

  /**
   * Parse SNOMED suggestions from AI response
   */
  parseSnomedSuggestions(response) {
    const suggestions = [];
    const lines = response.split('\n');

    lines.forEach(line => {
      const match = line.match(/CODE:\s*(\d+)\s*-\s*(.+)/i) || 
                    line.match(/(\d{6,})\s*[-:]\s*(.+)/);
      if (match) {
        suggestions.push({
          code: match[1].trim(),
          display: match[2].trim()
        });
      }
    });

    return suggestions.slice(0, 5);
  }

  /**
   * Assess medical necessity risk
   */
  async assessMedicalNecessity(formData) {
    if (!this.enabled) {
      return this.getDisabledResponse();
    }

    try {
      const prompt = this.buildMedicalNecessityPrompt(formData);
      
      const result = await ollamaService.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 1500
      });

      return this.parseMedicalNecessityResponse(result.response);

    } catch (error) {
      console.error('❌ Error assessing medical necessity:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build medical necessity assessment prompt
   */
  buildMedicalNecessityPrompt(formData) {
    const diagnoses = formData.diagnoses || [];
    const items = formData.items || [];
    const clinicalInfo = formData.clinical_info || {};

    return `You are a medical necessity reviewer for insurance prior authorizations. Assess whether the requested services are medically necessary based on the clinical documentation.

=== DIAGNOSES ===
${diagnoses.map(d => `- ${d.diagnosis_code}: ${d.diagnosis_display || d.diagnosis_description}`).join('\n') || 'None specified'}

=== REQUESTED SERVICES ===
${items.map(i => `- ${i.product_or_service_code || i.medication_code}: ${i.service_description || i.medication_name}`).join('\n') || 'None specified'}

=== CLINICAL DOCUMENTATION ===
Chief Complaint: ${clinicalInfo.chief_complaint_display || clinicalInfo.chief_complaint_text || 'Not specified'}
HPI: ${clinicalInfo.history_of_present_illness || 'Not documented'}
Exam: ${clinicalInfo.physical_examination || 'Not documented'}
Plan: ${clinicalInfo.treatment_plan || 'Not documented'}

=== ASSESSMENT REQUIRED ===
1. Is the service medically necessary for the diagnosis?
2. Is there sufficient documentation to support the request?
3. What additional documentation would strengthen the case?

=== OUTPUT FORMAT ===
NECESSITY_SCORE: [0.0-1.0]
ASSESSMENT: [APPROVED/NEEDS_INFO/LIKELY_DENIED]
REASONING: [Brief explanation]
MISSING_ELEMENTS:
- [Element 1]
- [Element 2]
SUGGESTED_JUSTIFICATION: [A sentence that could be added to support medical necessity]`;
  }

  /**
   * Parse medical necessity response
   */
  parseMedicalNecessityResponse(response) {
    const result = {
      success: true,
      necessityScore: 0.5,
      assessment: 'NEEDS_INFO',
      reasoning: '',
      missingElements: [],
      suggestedJustification: ''
    };

    try {
      const scoreMatch = response.match(/NECESSITY_SCORE:\s*([\d.]+)/i);
      if (scoreMatch) result.necessityScore = parseFloat(scoreMatch[1]);

      const assessmentMatch = response.match(/ASSESSMENT:\s*(APPROVED|NEEDS_INFO|LIKELY_DENIED)/i);
      if (assessmentMatch) result.assessment = assessmentMatch[1];

      const reasoningMatch = response.match(/REASONING:\s*([^\n]+)/i);
      if (reasoningMatch) result.reasoning = reasoningMatch[1].trim();

      const missingSection = response.match(/MISSING_ELEMENTS:([\s\S]*?)(?=SUGGESTED_JUSTIFICATION:|$)/i);
      if (missingSection) {
        result.missingElements = missingSection[1].trim()
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(e => e.length > 3);
      }

      const justificationMatch = response.match(/SUGGESTED_JUSTIFICATION:\s*([^\n]+)/i);
      if (justificationMatch) result.suggestedJustification = justificationMatch[1].trim();

    } catch (error) {
      console.error('❌ Error parsing medical necessity response:', error.message);
    }

    return result;
  }

  /**
   * Calculate completeness percentage
   */
  calculateCompleteness(formData, rules) {
    let filled = 0;
    let total = 0;

    // Count vitals
    rules.requiredVitals.forEach(vital => {
      total++;
      if (formData.vital_signs?.[vital]) filled++;
    });

    // Count clinical fields
    rules.requiredClinical.forEach(field => {
      total++;
      const value = field === 'chief_complaint'
        ? (formData.clinical_info?.chief_complaint_code || formData.clinical_info?.chief_complaint_text)
        : formData.clinical_info?.[field];
      if (value) filled++;
    });

    // Count diagnoses and items
    total += 2;
    if (formData.diagnoses?.length > 0) filled++;
    if (formData.items?.length > 0) filled++;

    return {
      percentage: Math.round((filled / total) * 100),
      filled,
      total
    };
  }

  /**
   * Format vital sign name for display
   */
  formatVitalName(key) {
    const names = {
      systolic: 'Systolic BP',
      diastolic: 'Diastolic BP',
      height: 'Height',
      weight: 'Weight',
      pulse: 'Pulse Rate',
      temperature: 'Temperature',
      oxygen_saturation: 'O2 Saturation',
      respiratory_rate: 'Respiratory Rate'
    };
    return names[key] || key;
  }

  /**
   * Format field name for display
   */
  formatFieldName(field) {
    const names = {
      chief_complaint: 'Chief Complaint',
      patient_history: 'Patient History',
      history_of_present_illness: 'History of Present Illness',
      physical_examination: 'Physical Examination',
      treatment_plan: 'Treatment Plan',
      investigation_result: 'Investigation Result'
    };
    return names[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get disabled response
   */
  getDisabledResponse() {
    return {
      success: true,
      isValid: true,
      riskScores: { overall: 0, categories: {}, riskLevel: 'low' },
      validation: {},
      suggestions: [],
      metadata: {
        enabled: false,
        message: 'AI validation is currently disabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Check service health
   */
  async checkHealth() {
    try {
      const ollamaHealth = await ollamaService.checkHealth();
      
      return {
        enabled: this.enabled,
        ollama: ollamaHealth,
        status: ollamaHealth.available ? 'ready' : 'limited',
        message: ollamaHealth.available 
          ? 'Prior Auth Validation Service is operational' 
          : 'AI service unavailable - basic validation only'
      };
    } catch (error) {
      return {
        enabled: this.enabled,
        status: 'error',
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new PriorAuthValidationService();

