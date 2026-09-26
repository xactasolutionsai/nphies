import ollamaService from './ollamaService.js';
import ragService from './ragService.js';
import { parseStructuredReply, INVALID_REPLY_MESSAGE } from './ai/structuredOutput.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Structured-output contract for the AI clinical review (owner item C5): sent to Ollama as
 * `format` and validated on return. A reply that does not match is never read as a pass.
 */
export const PA_AI_VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    medicalNecessityScore: { type: 'number', minimum: 0, maximum: 1 },
    consistencyCheck: {
      type: 'object',
      properties: { passed: { type: 'boolean' }, explanation: { type: 'string' } },
      required: ['passed', 'explanation']
    },
    documentationGaps: { type: 'array', items: { type: 'string', minLength: 1 } },
    rejectionRisks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: ['string', 'null'] },
          description: { type: 'string', minLength: 1 }
        },
        required: ['code', 'description']
      }
    },
    recommendations: { type: 'array', items: { type: 'string', minLength: 1 } },
    justificationNarrative: { type: 'string' }
  },
  required: ['medicalNecessityScore', 'consistencyCheck', 'documentationGaps', 'rejectionRisks', 'recommendations', 'justificationNarrative']
};

/**
 * Prior Authorization Validation Service
 * Uses the configured Ollama model to validate and enhance prior authorization data
 * before NPHIES submission to reduce rejection rates
 */
class PriorAuthValidationService {
  constructor() {
    this.enabled = process.env.AI_VALIDATION_ENABLED !== 'false';
    
    // Validation rules by auth type
    // Reference: NPHIES Implementation Guide - Each claim type has different requirements
    this.validationRules = {
      institutional: {
        requiredVitals: ['systolic', 'diastolic', 'height', 'weight', 'pulse', 'temperature', 'oxygen_saturation', 'respiratory_rate'],
        requiredClinical: ['chief_complaint', 'history_of_present_illness', 'physical_examination', 'treatment_plan'],
        requiresAdmissionInfo: true,
        requiresEncounter: true
      },
      professional: {
        requiredVitals: ['systolic', 'diastolic', 'pulse', 'temperature', 'height', 'weight'],
        requiredClinical: ['chief_complaint', 'history_of_present_illness', 'treatment_plan'],
        requiresAdmissionInfo: false,
        requiresEncounter: true
      },
      pharmacy: {
        // Pharmacy claims: NO ENCOUNTER REQUIRED per NPHIES example
        // BUT requires supporting info fields per NPHIES specification
        requiredVitals: [], // No vitals required for pharmacy
        requiredClinical: [], // Clinical notes go into supportingInfo
        requiredSupportingInfo: ['treatment-plan', 'patient-history', 'physical-examination', 'history-of-present-illness'],
        requiresAdmissionInfo: false,
        requiresEncounter: false
      },
      dental: {
        // Dental (Oral) claims: Require clinical documentation but no vitals
        // Per user feedback: dental needs clinical text fields
        requiredVitals: [], // No vitals required for dental
        requiredClinical: [], // Clinical notes go into supportingInfo
        requiredSupportingInfo: ['treatment-plan', 'patient-history', 'physical-examination', 'history-of-present-illness'],
        requiresAdmissionInfo: false,
        requiresEncounter: true // Dental does require ambulatory encounter
      },
      vision: {
        // Vision claims: NO ENCOUNTER REQUIRED per NPHIES IG
        // BUT requires supporting info per NPHIES errors:
        // BV-00803: treatment-plan required
        // BV-00804: patient-history required  
        // BV-00805: physical-examination required
        // BV-00806: history-of-present-illness required
        requiredVitals: [], // No vitals required for vision
        requiredClinical: [], // Clinical notes go into supportingInfo, not separate fields
        requiredSupportingInfo: ['treatment-plan', 'patient-history', 'physical-examination', 'history-of-present-illness'],
        requiresAdmissionInfo: false,
        requiresEncounter: false
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
    const startTime = Date.now();
    const authType = formData.auth_type || 'professional';
    const rules = this.validationRules[authType] || this.validationRules.professional;

    // Rule-based checks never depend on the AI and are always returned.
    let basicValidation, vitalsValidation, timeValidation;
    try {
      basicValidation = this.performBasicValidation(formData, rules);
      vitalsValidation = this.validateVitalsPlausibility(formData.vital_signs);
      timeValidation = this.validateTimeRelevance(formData);
    } catch (error) {
      console.error('❌ Error in rule-based prior auth validation:', error.message);
      return {
        success: false,
        isValid: false,
        requiresManualReview: true,
        error: error.message,
        riskScores: { overall: 0, categories: {}, riskLevel: 'unknown' },
        suggestions: [],
        metadata: {
          error: true,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }

    let aiValidation;
    let guidelines = [];
    if (!this.enabled) {
      aiValidation = this.getUnavailableAIValidation('AI validation is currently disabled');
    } else {
      console.log(`🏥 Starting prior auth validation for ${authType} type...`);
      aiValidation = await this.performAIValidation(formData, authType);
      guidelines = aiValidation.aiUnavailable ? [] : await this.retrieveRelevantGuidelines(formData);
    }

    try {
      const riskScores = this.calculateRiskScores(basicValidation, vitalsValidation, timeValidation, aiValidation);
      const suggestions = this.generateSuggestions(basicValidation, vitalsValidation, aiValidation, formData);
      const ruleBasedValid = riskScores.overall < 0.5;
      const aiUnavailable = aiValidation.aiUnavailable === true;
      const aiIncomplete = aiValidation.analysisIncomplete === true;

      return {
        success: true,
        // Without a readable AI review the request is not reported as valid: it needs a
        // human to review it. The rule-based verdict is still returned separately.
        isValid: ruleBasedValid && !aiUnavailable && !aiIncomplete,
        ruleBasedValid,
        aiUnavailable,
        requiresManualReview: aiUnavailable || aiIncomplete,
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
          validationDuration: Date.now() - startTime,
          model: ollamaService.model,
          enabled: this.enabled,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error in prior auth validation:', error.message);
      return {
        success: false,
        isValid: false,
        aiUnavailable: aiValidation?.aiUnavailable === true,
        requiresManualReview: true,
        error: error.message,
        riskScores: { overall: 0, categories: {}, riskLevel: 'unknown' },
        validation: {
          basic: basicValidation,
          vitals: vitalsValidation,
          time: timeValidation,
          ai: aiValidation
        },
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
   * AI result used when the model could not be consulted. It carries every field
   * the scoring/suggestion code reads, with "unknown" values instead of passes.
   */
  getUnavailableAIValidation(reason) {
    return {
      passed: null,
      aiUnavailable: true,
      medicalNecessityScore: null,
      consistencyCheck: { passed: null, explanation: '' },
      documentationGaps: [],
      rejectionRisks: [],
      recommendations: [],
      justificationNarrative: '',
      error: reason
    };
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

    // Check required supporting info categories (e.g., for vision claims)
    // NPHIES errors: BV-00803, BV-00804, BV-00805, BV-00806
    if (rules.requiredSupportingInfo && rules.requiredSupportingInfo.length > 0) {
      const supportingInfo = formData.supporting_info || [];
      const providedCategories = supportingInfo.map(info => info.category);
      
      const supportingInfoLabels = {
        'treatment-plan': 'Treatment Plan',
        'patient-history': 'Patient History',
        'physical-examination': 'Physical Examination',
        'history-of-present-illness': 'History of Present Illness'
      };
      
      const supportingInfoCodes = {
        'treatment-plan': 'BV-00803',
        'patient-history': 'BV-00804',
        'physical-examination': 'BV-00805',
        'history-of-present-illness': 'BV-00806'
      };
      
      rules.requiredSupportingInfo.forEach(category => {
        const hasCategory = providedCategories.includes(category);
        // Also check if the supporting info has actual content
        // Note: Frontend sends value_string for text fields, value for other types
        const infoWithContent = supportingInfo.find(info => {
          if (info.category !== category) return false;
          const value = info.value_string || info.value || '';
          return typeof value === 'string' && value.trim().length > 0;
        });
        
        if (!hasCategory || !infoWithContent) {
          issues.push({
            category: this.rejectionCategories.SUPPORTING_EVIDENCE,
            field: `supporting_info.${category}`,
            code: supportingInfoCodes[category] || 'SE-4',
            message: `Missing required supporting information: ${supportingInfoLabels[category] || category}`,
            severity: 'high'
          });
        }
      });
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
        format: PA_AI_VALIDATION_SCHEMA
      });

      return this.parseAIValidationResponse(result.response);

    } catch (error) {
      console.error('❌ AI validation error:', error.message);
      return this.getUnavailableAIValidation(`AI validation unavailable: ${error.message}`);
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
    const rules = this.validationRules[authType] || this.validationRules.professional;

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

    // Build auth type specific context
    let authTypeContext = '';
    if (authType === 'vision') {
      authTypeContext = `
IMPORTANT: This is a VISION authorization request.
- Vision claims do NOT require encounter information per NPHIES IG
- Vision claims do NOT require vital signs or clinical notes
- Only diagnosis and vision services/items are required
- Focus validation on: diagnosis appropriateness, service codes, and coverage
- Do NOT flag missing vitals or clinical notes as issues`;
    } else if (authType === 'pharmacy') {
      authTypeContext = `
IMPORTANT: This is a PHARMACY authorization request.
- Pharmacy claims do NOT require encounter information per NPHIES IG
- Pharmacy claims do NOT require vital signs or clinical notes
- Only diagnosis and medication items are required
- Focus validation on: diagnosis-medication alignment, drug interactions, dosage appropriateness
- Do NOT flag missing vitals or clinical notes as issues`;
    } else if (authType === 'dental') {
      authTypeContext = `
IMPORTANT: This is a DENTAL authorization request.
- Dental claims require ambulatory encounter class
- Focus on dental-specific diagnoses (ICD-10 K00-K14)
- Verify tooth numbers and dental procedure codes are appropriate`;
    } else if (authType === 'institutional') {
      authTypeContext = `
IMPORTANT: This is an INSTITUTIONAL authorization request.
- Requires inpatient or daycase encounter class
- Full vital signs and clinical documentation are required
- Admission information is mandatory`;
    }

    // Build vitals section only if required for this auth type
    let vitalsSection = '';
    if (rules.requiredVitals && rules.requiredVitals.length > 0) {
      vitalsSection = `
=== VITAL SIGNS ===
Systolic BP: ${vitalSigns.systolic || 'Not recorded'} mmHg
Diastolic BP: ${vitalSigns.diastolic || 'Not recorded'} mmHg
Height: ${vitalSigns.height || 'Not recorded'} cm
Weight: ${vitalSigns.weight || 'Not recorded'} kg
${bmiInfo}
Pulse: ${vitalSigns.pulse || 'Not recorded'} bpm
Temperature: ${vitalSigns.temperature || 'Not recorded'} °C
O2 Saturation: ${vitalSigns.oxygen_saturation || 'Not recorded'} %
Respiratory Rate: ${vitalSigns.respiratory_rate || 'Not recorded'} /min`;
    } else {
      vitalsSection = `
=== VITAL SIGNS ===
(Not required for ${authType} authorization type)`;
    }

    // Build clinical section only if required for this auth type
    let clinicalSection = '';
    if (rules.requiredClinical && rules.requiredClinical.length > 0) {
      clinicalSection = `
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

Investigation Result: ${clinicalInfo.investigation_result || 'Not specified'}`;
    } else {
      clinicalSection = `
=== CLINICAL INFORMATION ===
(Detailed clinical notes not required for ${authType} authorization type)
Chief Complaint: ${clinicalInfo.chief_complaint_display || clinicalInfo.chief_complaint_text || 'Not specified'}`;
    }

    return `You are a medical AI assistant reviewing a prior authorization request for NPHIES (Saudi Arabia healthcare system). Analyze the clinical data and identify potential rejection risks.

=== AUTHORIZATION TYPE ===
${authType.toUpperCase()}
${authTypeContext}
${vitalsSection}
${clinicalSection}

=== DIAGNOSES ===
${diagnosisList || 'No diagnoses specified'}

=== REQUESTED SERVICES/PROCEDURES ===
${itemsList || 'No items specified'}

=== ANALYSIS REQUIRED ===
Analyze this prior authorization request and provide:

1. MEDICAL_NECESSITY_SCORE: A score from 0.0 to 1.0 indicating how well the clinical documentation supports the requested services (1.0 = excellent justification, 0.0 = no justification)

2. CONSISTENCY_CHECK: Are the diagnoses and requested services logically consistent?

3. DOCUMENTATION_GAPS: List any missing documentation that could lead to rejection (considering the auth type requirements)

4. REJECTION_RISKS: List specific rejection risks with NPHIES codes (MN-*, SE-*, CV-*)

5. RECOMMENDATIONS: Specific improvements to strengthen the authorization

=== OUTPUT ===
Answer with one JSON object only:
{"medicalNecessityScore": 0.0-1.0,
 "consistencyCheck": {"passed": true|false, "explanation": "why, if it failed"},
 "documentationGaps": ["..."],
 "rejectionRisks": [{"code": "NPHIES code such as MN-1-1, or null", "description": "..."}],
 "recommendations": ["..."],
 "justificationNarrative": "a brief medical necessity justification that could be added to the request"}`;
  }

  /**
   * Read the AI clinical review (PA_AI_VALIDATION_SCHEMA). Fails closed: a reply that is not
   * valid JSON or does not match the schema is `analysisIncomplete` with unknown (null) values.
   */
  parseAIValidationResponse(responseText) {
    const { ok, data, errors } = parseStructuredReply(responseText, PA_AI_VALIDATION_SCHEMA);
    if (!ok) {
      console.warn(`⚠️ Prior auth AI review rejected (${errors.slice(0, 3).join('; ')})`);
      return {
        ...this.getUnavailableAIValidation(INVALID_REPLY_MESSAGE),
        aiUnavailable: false,
        analysisIncomplete: true
      };
    }
    const consistencyPassed = data.consistencyCheck.passed;
    return {
      passed: consistencyPassed && data.medicalNecessityScore >= 0.6,
      medicalNecessityScore: data.medicalNecessityScore,
      consistencyCheck: {
        passed: consistencyPassed,
        explanation: consistencyPassed ? '' : data.consistencyCheck.explanation.trim()
      },
      documentationGaps: data.documentationGaps,
      rejectionRisks: data.rejectionRisks.map(risk => ({
        code: typeof risk.code === 'string' && risk.code.trim() ? risk.code.trim() : null,
        description: risk.description.trim()
      })),
      recommendations: data.recommendations,
      justificationNarrative: data.justificationNarrative.trim()
    };
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

      // General knowledge search: retrieveRelevantGuidelines() is the eye-form
      // (ophthalmology-only) retrieval and must not be used for prior authorizations.
      const query = queryParts.join(', ');
      return await ragService.searchKnowledge(query, ragService.maxRetrievalResults);

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

    // Add AI validation risks (unknown AI values add nothing; the result is
    // flagged aiUnavailable/analysisIncomplete instead)
    const necessityScore = aiValidation?.medicalNecessityScore;
    if (typeof necessityScore === 'number' && necessityScore < 0.6) {
      scores.medicalNecessity += (1 - necessityScore) * 0.5;
    }

    if (aiValidation?.consistencyCheck?.passed === false) {
      scores.medicalNecessity += 0.2;
    }

    (aiValidation?.rejectionRisks || []).forEach(risk => {
      const code = typeof risk?.code === 'string' ? risk.code : '';
      if (code.startsWith('MN')) scores.medicalNecessity += 0.15;
      else if (code.startsWith('SE')) scores.supportingEvidence += 0.15;
      else if (code.startsWith('CV')) scores.coverage += 0.15;
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

    if (aiValidation?.aiUnavailable) {
      suggestions.push({
        type: 'ai_unavailable',
        message: 'AI clinical review was not performed. Only rule-based checks ran; manual clinical review is required.',
        severity: 'high',
        action: 'review'
      });
    } else if (aiValidation?.analysisIncomplete) {
      suggestions.push({
        type: 'ai_incomplete',
        message: 'The AI clinical review could not be fully read. Manual clinical review is required.',
        severity: 'high',
        action: 'review'
      });
    }

    // Suggestions from AI validation
    (aiValidation?.recommendations || []).forEach(rec => {
      suggestions.push({
        type: 'ai_recommendation',
        message: rec,
        severity: 'medium',
        action: 'review'
      });
    });

    // Add justification narrative suggestion if available
    if (aiValidation?.justificationNarrative && aiValidation.justificationNarrative.length > 20) {
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
    if (aiValidation?.consistencyCheck?.passed === false) {
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
   * Calculate completeness percentage
   */
  calculateCompleteness(formData, rules) {
    let filled = 0;
    let total = 0;

    // Count vitals (only if required for this auth type)
    if (rules.requiredVitals && rules.requiredVitals.length > 0) {
      rules.requiredVitals.forEach(vital => {
        total++;
        if (formData.vital_signs?.[vital]) filled++;
      });
    }

    // Count clinical fields (only if required for this auth type)
    if (rules.requiredClinical && rules.requiredClinical.length > 0) {
      rules.requiredClinical.forEach(field => {
        total++;
        const value = field === 'chief_complaint'
          ? (formData.clinical_info?.chief_complaint_code || formData.clinical_info?.chief_complaint_text)
          : formData.clinical_info?.[field];
        if (value) filled++;
      });
    }

    // Count diagnoses and items (always required for all auth types)
    total += 2;
    if (formData.diagnoses?.length > 0) filled++;
    if (formData.items?.length > 0) filled++;

    // Prevent division by zero
    if (total === 0) {
      return { percentage: 100, filled: 0, total: 0 };
    }

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

