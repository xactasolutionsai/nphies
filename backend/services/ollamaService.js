import dotenv from 'dotenv';
import { getOllamaConfig, createOllamaClient, isTimeoutError, DEFAULT_OLLAMA_MODEL } from './ollamaConfig.js';
import { parseStructuredReply, INVALID_REPLY_MESSAGE } from './ai/structuredOutput.js';

dotenv.config();

/*
 * Structured-output contracts (owner item C5). Each schema is sent to Ollama as `format`
 * and the reply is validated against the same schema (services/ai/structuredOutput.js).
 * A reply that is not valid JSON or does not match is never read as a verdict: the
 * callers below return their fail-closed shape (isValid:null / analysisIncomplete).
 */
const unitScore = { type: 'number', minimum: 0, maximum: 1 };
const textList = { type: 'array', items: { type: 'string', minLength: 1 } };

export const EYE_VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    confidenceScore: unitScore,
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['field', 'message', 'severity']
      }
    },
    recommendations: textList,
    missingAnalyses: textList
  },
  required: ['isValid', 'confidenceScore', 'warnings', 'recommendations', 'missingAnalyses']
};

export const ENHANCED_TEXT_SCHEMA = {
  type: 'object',
  properties: { enhancedText: { type: 'string', minLength: 1 } },
  required: ['enhancedText']
};

export const SNOMED_SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: '^[0-9]{6,18}$' },
          display: { type: 'string', minLength: 1 }
        },
        required: ['code', 'display']
      }
    }
  },
  required: ['suggestions']
};

const optionalText = { type: ['string', 'null'] };
export const SNOMED_VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    confidence: unitScore,
    explanation: { type: 'string' },
    correctDescription: optionalText,
    suggestedCode: { type: ['string', 'null'], pattern: '^[0-9]{6,18}$' },
    suggestedDescription: optionalText
  },
  required: ['isValid', 'confidence', 'explanation']
};

export const MEDICAL_NECESSITY_SCHEMA = {
  type: 'object',
  properties: {
    necessityScore: unitScore,
    assessment: { type: 'string', enum: ['APPROVED', 'NEEDS_INFO', 'LIKELY_DENIED'] },
    reasoning: { type: 'string' },
    missingElements: textList,
    suggestedJustification: { type: 'string' }
  },
  required: ['necessityScore', 'assessment', 'reasoning', 'missingElements', 'suggestedJustification']
};

/** Log only the first schema errors (paths and types, never values: replies can echo PHI). */
const logInvalidReply = (label, errors) =>
  console.warn(`⚠️ ${label}: AI reply rejected (${errors.slice(0, 3).join('; ')})`);

class OllamaService {
  constructor() {
    const { baseUrl, timeoutMs, configError } = getOllamaConfig();
    this.baseUrl = baseUrl;
    this.configError = configError;
    this.model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    this.timeout = timeoutMs;
    this.maxRetries = 3;
    this.requestCounter = 0;

    // Embeddings use their own model (OLLAMA_EMBED_MODEL). Falling back to the chat
    // model keeps existing vector indexes working, but a dedicated embedding model
    // is strongly recommended.
    this.embeddingModel = process.env.OLLAMA_EMBED_MODEL || this.model;

    // Every request made through this client is aborted after `this.timeout`, so a
    // timed-out generation does not keep running while the next retry starts.
    this.client = createOllamaClient({ baseUrl, timeoutMs });

    if (configError) {
      console.error(`\n❌ Ollama Service disabled: ${configError.message}`);
    } else {
      console.log(`\n✅ Ollama Service initialized`);
      console.log(`   📍 Base URL: ${this.baseUrl}`);
      console.log(`   🤖 Model: ${this.model}`);
      console.log(`   ⏱️  Timeout: ${this.timeout}ms`);
    }

    // Test connection on startup
    if (process.env.NODE_ENV !== 'test' && !configError) this.testConnection();
  }

  /**
   * Refuse to send anything when the endpoint configuration is unsafe/invalid.
   * @private
   */
  assertConfigured() {
    if (this.configError) throw this.configError;
  }

  /**
   * Test connection to Ollama server on startup
   */
  async testConnection() {
    console.log('\n🔌 Testing Ollama connection...');
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        console.error(`❌ Ollama server returned status: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log(`✅ Ollama server connected`);
      console.log(`   📦 Available models: ${data.models?.map(m => m.name).join(', ') || 'none'}`);
      
      const modelExists = data.models?.some(m => 
        m.name === this.model || m.name.startsWith(this.model.split(':')[0])
      );
      
      if (!modelExists) {
        console.warn(`   ⚠️  WARNING: Model "${this.model}" not found!`);
      } else {
        console.log(`   ✅ Model "${this.model}" is available`);
      }
    } catch (error) {
      console.error(`❌ Failed to connect to Ollama: ${error.message}`);
    }
  }

  // ============================================================================
  // CORE COMPLETION & EMBEDDINGS
  // ============================================================================

  /**
   * Generate a completion from the model
   * @param {string} prompt - The prompt to send to the model
   * @param {object} options - Additional options for the completion. `format` may be
   *   'json' or a JSON schema object (Ollama structured outputs).
   * @returns {Promise<object>} - The completion response
   */
  async generateCompletion(prompt, options = {}) {
    this.assertConfigured();
    const requestId = ++this.requestCounter;
    const startTime = Date.now();
    let lastError = null;

    console.log(`\n🚀 [REQ-${requestId}] Starting Ollama request`);
    console.log(`   🤖 Model: ${this.model}`);
    console.log(`   📝 Prompt length: ${prompt?.length || 0} chars`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`\n📤 [REQ-${requestId}] Sending request (attempt ${attempt}/${this.maxRetries})`);
        
        const requestConfig = {
          model: this.model,
          prompt,
          stream: false,
          format: options.format || undefined,
          options: {
            temperature: options.temperature ?? 0.7,
            top_p: options.top_p ?? 0.9,
            top_k: options.top_k ?? 40,
            num_predict: options.num_predict ?? 2048,
            num_ctx: options.num_ctx || undefined,
            ...(Object.keys(options).reduce((acc, key) => {
              if (!['format', 'temperature', 'top_p', 'top_k', 'num_predict', 'num_ctx'].includes(key)) {
                acc[key] = options[key];
              }
              return acc;
            }, {}))
          }
        };

        // Progress logging for long requests
        const progressInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`   ⏳ [REQ-${requestId}] Still waiting... ${elapsed}s elapsed`);
        }, 10000);

        try {
          // The client aborts the HTTP request itself after this.timeout.
          const response = await this.client.generate(requestConfig);

          clearInterval(progressInterval);
          const duration = Date.now() - startTime;
          
          // Only sizes are logged: model output can echo patient data.
          console.log(`\n✅ [REQ-${requestId}] Response received in ${duration}ms`);
          console.log(`   📝 Response length: ${response.response?.length || 0} chars`);

          return {
            success: true,
            response: response.response,
            model: this.model,
            duration,
            totalDuration: response.total_duration,
            loadDuration: response.load_duration,
            promptEvalCount: response.prompt_eval_count,
            evalCount: response.eval_count
          };
        } catch (innerError) {
          clearInterval(progressInterval);
          if (isTimeoutError(innerError)) {
            throw new Error(`Ollama completion timed out after ${this.timeout}ms`);
          }
          throw innerError;
        }
      } catch (error) {
        lastError = error;
        const elapsed = Date.now() - startTime;
        
        console.error(`\n❌ [REQ-${requestId}] Error after ${elapsed}ms (attempt ${attempt}/${this.maxRetries})`);
        console.error(`   Type: ${error.constructor.name}`);
        console.error(`   Message: ${error.message}`);
        
        // Categorize error
        if (error.message?.includes('model not found') || error.message?.includes('invalid model')) {
          console.error(`   💡 Run: ollama pull ${this.model}`);
          throw new Error(`Model ${this.model} not found. Run: ollama pull ${this.model}`);
        }
        if (error.message?.includes('timed out')) {
          console.error(`   💡 Request timed out after ${this.timeout}ms`);
          console.error(`   💡 Try increasing OLLAMA_TIMEOUT env variable`);
        }
        if (error.message?.includes('ECONNREFUSED')) {
          console.error(`   💡 Cannot connect to ${this.baseUrl}`);
          console.error(`   💡 Make sure Ollama is running: ollama serve`);
        }
        if (error.message?.includes('fetch failed') || error.message?.includes('ECONNRESET')) {
          console.error(`   💡 Network error - server may be overloaded or crashed`);
        }

        if (attempt < this.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`   ⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error(`\n💀 [REQ-${requestId}] All ${this.maxRetries} attempts failed`);
    throw new Error(`Ollama request failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate embeddings for text using the dedicated embedding model.
   * Uses the current /api/embed endpoint, falling back to the legacy
   * /api/embeddings endpoint only for Ollama servers that predate it.
   * @param {string} text - The text to embed
   * @returns {Promise<array>} - The embedding vector
   */
  async generateEmbedding(text) {
    this.assertConfigured();
    try {
      console.log(`🔢 Generating embedding for text (length: ${text.length})`);

      let embedding;
      try {
        const response = await this.client.embed({ model: this.embeddingModel, input: text });
        embedding = response?.embeddings?.[0];
      } catch (error) {
        if (error?.status_code !== 404 || /model/i.test(error?.message || '')) throw error;
        const legacy = await this.client.embeddings({ model: this.embeddingModel, prompt: text });
        embedding = legacy?.embedding;
      }

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding response from Ollama');
      }

      console.log(`✅ Embedding generated (dimension: ${embedding.length})`);
      return embedding;
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(`Ollama embedding timed out after ${this.timeout}ms`);
      }
      console.error('❌ Error generating embedding:', error.message);
      
      if (error.message?.includes('does not support') || error.message?.includes('embeddings')) {
        throw new Error(
          `Model ${this.embeddingModel} does not support embeddings. Set OLLAMA_EMBED_MODEL to an embedding model.`
        );
      }
      
      throw error;
    }
  }

  // ============================================================================
  // EYE PRESCRIPTION VALIDATION
  // ============================================================================

  /**
   * Validate eye approval form data with medical context
   * @param {object} formData - The form data to validate
   * @param {array} relevantGuidelines - Retrieved medical guidelines from RAG
   * @returns {Promise<object>} - Structured validation result
   */
  async validateEyeForm(formData, relevantGuidelines = []) {
    const prompt = this.buildValidationPrompt(formData, relevantGuidelines);
    
    try {
      console.log('\n🔍 ==> AI VALIDATION REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`📋 Age: ${formData.age || 'N/A'}`);
      console.log(`📚 Guidelines Retrieved: ${relevantGuidelines.length}`);
      console.log(`📝 Prompt Length: ${prompt.length} characters\n`);
      
      const result = await this.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 3000,
        format: EYE_VALIDATION_SCHEMA
      });

      // The raw reply is not logged: it can echo patient data from the prompt.
      console.log(`⏱️  Response Time: ${(result.duration / 1000).toFixed(2)}s (${result.response?.length || 0} chars)\n`);

      const validation = this.parseValidationResponse(result.response);

      console.log('✅ ==> PARSED VALIDATION RESULT <==');
      console.log(`   Valid: ${validation.isValid}`);
      console.log(`   Confidence: ${(validation.confidenceScore * 100).toFixed(0)}%`);
      console.log(`   Warnings: ${validation.warnings.length}`);
      console.log(`   Recommendations: ${validation.recommendations.length}`);
      console.log(`   Missing Analyses: ${validation.missingAnalyses.length}\n`);
      
      return {
        ...validation,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          retrievedGuidelines: relevantGuidelines.length,
          timestamp: new Date().toISOString(),
          rawResponse: result.response // Include raw response for debugging
        }
      };
    } catch (error) {
      console.error('❌ Error in form validation:', error.message);
      throw error;
    }
  }

  /**
   * Build the validation prompt with medical context
   * @private
   */
  buildValidationPrompt(formData, relevantGuidelines) {
    const guidelinesContext = relevantGuidelines.length > 0
      ? `\n\nRelevant medical guidelines:\n${relevantGuidelines.map((g, i) => `${i + 1}. ${g.content}`).join('\n')}`
      : '';

    return `Review this ophthalmology prescription for clinical consistency.${guidelinesContext}

=== PATIENT DATA ===
Age: ${formData.age} years, Sex: ${formData.sex || 'Unknown'}
Chief Complaints: ${formData.chief_complaints || 'Not specified'}
Duration: ${formData.duration_of_illness_days || 0} days
Clinical Signs: ${formData.significant_signs || 'None documented'}

RIGHT EYE: Sphere ${formData.right_eye_specs?.distance?.sphere || 'N/A'}, Cylinder ${formData.right_eye_specs?.distance?.cylinder || 'N/A'}, Axis ${formData.right_eye_specs?.distance?.axis || 'N/A'}, VA ${formData.right_eye_specs?.distance?.vn || 'N/A'}, Add ${formData.right_eye_specs?.bifocal_add || 'N/A'}

LEFT EYE: Sphere ${formData.left_eye_specs?.distance?.sphere || 'N/A'}, Cylinder ${formData.left_eye_specs?.distance?.cylinder || 'N/A'}, Axis ${formData.left_eye_specs?.distance?.axis || 'N/A'}, VA ${formData.left_eye_specs?.distance?.vn || 'N/A'}, Add ${formData.left_eye_specs?.bifocal_add || 'N/A'}

Lenses: ${formData.lens_type || 'Not specified'}
Procedures: ${formData.procedures?.map(p => p.service_description).join(', ') || 'None'}

=== OUTPUT ===
Answer with one JSON object only:
{"isValid": true|false, "confidenceScore": 0.0-1.0,
 "warnings": [{"field": "...", "message": "clinical concern", "severity": "low|medium|high"}],
 "recommendations": ["..."], "missingAnalyses": ["suggested test, if any"]}`;
  }

  /**
   * Read the eye-form validation reply (EYE_VALIDATION_SCHEMA). Fails closed: a reply that is
   * not valid JSON or does not match the schema gives isValid:null and requires manual review.
   * @private
   */
  parseValidationResponse(responseText) {
    const { ok, data, errors } = parseStructuredReply(responseText, EYE_VALIDATION_SCHEMA);
    if (ok) {
      return {
        isValid: data.isValid,
        confidenceScore: data.confidenceScore,
        warnings: data.warnings,
        recommendations: data.recommendations,
        missingAnalyses: data.missingAnalyses,
        analysisIncomplete: false
      };
    }
    logInvalidReply('Eye form validation', errors);
    return {
      isValid: null,
      confidenceScore: 0,
      analysisIncomplete: true,
      requiresManualReview: true,
      warnings: [{ field: 'system', message: `${INVALID_REPLY_MESSAGE} The form has NOT been validated.`, severity: 'high' }],
      recommendations: [],
      missingAnalyses: []
    };
  }

  // ============================================================================
  // HEALTH CHECK & CONFIG
  // ============================================================================

  /**
   * Check if Ollama is available and model is installed
   * @returns {Promise<object>} - Status information
   */
  async checkHealth() {
    try {
      this.assertConfigured();
      const models = await this.client.list();
      const modelExists = models.models.some(
        m => m.name === this.model || m.name.startsWith(this.model)
      );

      return {
        available: true,
        baseUrl: this.baseUrl,
        configuredModel: this.model,
        modelInstalled: modelExists,
        availableModels: models.models.map(m => m.name)
      };
    } catch (error) {
      console.error('❌ Ollama health check failed:', error.message);
      return {
        available: false,
        baseUrl: this.baseUrl,
        configuredModel: this.model,
        modelInstalled: false,
        error: error.message
      };
    }
  }

  /**
   * Change the model being used
   * @param {string} modelName - New model name
   */
  setModel(modelName) {
    console.log(`🔄 Changing model from ${this.model} to ${modelName}`);
    this.model = modelName;
  }

  /**
   * Get current configuration
   * @returns {object} - Current configuration
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      embeddingModel: this.embeddingModel
    };
  }

  // ============================================================================
  // CLINICAL TEXT ENHANCEMENT
  // ============================================================================

  /**
   * Enhance clinical text using AI
   * @param {string} text - The original clinical text
   * @param {string} field - The field type (history_of_present_illness, physical_examination, etc.)
   * @param {object} context - Additional context (chief complaint, diagnosis, etc.)
   * @returns {Promise<object>} - Enhanced text result
   */
  async enhanceClinicalText(text, field, context = {}) {
    // Any failure returns the original text unchanged (enhanced:false); the UI keeps the input.
    const unchanged = (error, extra = {}) => ({
      success: false, enhanced: false, originalText: text, enhancedText: text, error, ...extra
    });
    const prompt = this.buildClinicalEnhancementPrompt(text, field, context);

    try {
      console.log('\n📝 ==> AI CLINICAL TEXT ENHANCEMENT REQUEST <==');
      console.log(`🤖 Model: ${this.model}`);
      console.log(`📋 Field: ${field}`);
      console.log(`📝 Original Text Length: ${text?.length || 0} characters`);
      console.log(`📋 Context fields: ${Object.keys(context || {}).join(', ') || 'none'}\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.4,
        num_predict: 3000,
        top_p: 0.92,
        num_ctx: 4096,
        format: ENHANCED_TEXT_SCHEMA
      });
      const metadata = {
        model: this.model,
        responseTime: `${(result.duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };

      const { ok, data, errors } = parseStructuredReply(result.response, ENHANCED_TEXT_SCHEMA);
      if (!ok) {
        logInvalidReply('Clinical text enhancement', errors);
        return unchanged('The AI reply did not match the expected format; your text was not changed. Please try again.',
          { analysisIncomplete: true, metadata });
      }

      const enhancedText = data.enhancedText.trim();
      // Length sanity check on the parsed value: a reply far shorter than the input was cut off.
      if (enhancedText.length < (text?.length || 0) * 0.5) {
        return unchanged('AI response was truncated or incomplete; your text was not changed. Please try again.', { metadata });
      }

      console.log(`✅ Enhanced text generated (${enhancedText.length} characters)\n`);
      return { success: true, enhanced: true, originalText: text, enhancedText, metadata };
    } catch (error) {
      console.error('❌ Error enhancing clinical text:', error.message);
      return unchanged(error.message, { metadata: { model: this.model, timestamp: new Date().toISOString() } });
    }
  }

  /**
   * Build clinical text enhancement prompt
   * @private
   */
  buildClinicalEnhancementPrompt(text, field, context) {
    const fieldNames = {
      history_of_present_illness: 'History of Present Illness',
      physical_examination: 'Physical Examination',
      treatment_plan: 'Treatment Plan',
      patient_history: 'Patient Medical History'
    };
    
    const fieldName = fieldNames[field] || field;
    
    // Build comprehensive context from all available data
    let contextParts = [];
    
    // Patient Information (from database)
    // The patient's name is deliberately not sent to the model: age and gender are
    // the only demographics the enhancement needs.
    if (context.patientAge || context.patientBirthDate || context.patientGender) {
      let patientInfo = 'Patient:';
      
      // Calculate proper age display from birth date if available
      if (context.patientBirthDate) {
        const birthDate = new Date(context.patientBirthDate);
        const today = new Date();
        const ageInDays = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
        const ageInMonths = Math.floor(ageInDays / 30.44);
        const ageInYears = Math.floor(ageInDays / 365.25);
        
        if (ageInDays < 0) {
          patientInfo += `, Not yet born`;
        } else if (ageInDays < 28) {
          patientInfo += `, ${ageInDays} days old (Neonate)`;
        } else if (ageInMonths < 12) {
          patientInfo += `, ${ageInMonths} months old (Infant)`;
        } else if (ageInYears < 2) {
          patientInfo += `, ${ageInMonths} months old (Toddler)`;
        } else {
          patientInfo += `, ${ageInYears} years old`;
        }
      } else if (context.patientAge) {
        // Fallback to provided age string
        patientInfo += `, ${context.patientAge}`;
        if (!context.patientAge.toString().includes('month') && !context.patientAge.toString().includes('day')) {
          patientInfo += ' years old';
        }
      }
      
      if (context.patientGender) patientInfo += `, ${context.patientGender}`;
      contextParts.push(patientInfo.replace('Patient:, ', 'Patient: '));
    }
    
    // Basic Information
    if (context.authType) {
      const authTypeLabels = {
        institutional: 'Institutional (Hospital/Facility)',
        professional: 'Professional (Outpatient)',
        pharmacy: 'Pharmacy/Medication',
        dental: 'Dental',
        vision: 'Vision/Optical'
      };
      contextParts.push(`Service Type: ${authTypeLabels[context.authType] || context.authType}`);
    }
    if (context.priority) {
      contextParts.push(`Priority: ${context.priority}`);
    }
    if (context.encounterClass) {
      contextParts.push(`Encounter: ${context.encounterClass}`);
    }
    
    // Chief Complaint
    if (context.chiefComplaint) {
      let ccText = `Chief Complaint: ${context.chiefComplaint}`;
      if (context.chiefComplaintCode) ccText += ` (${context.chiefComplaintCode})`;
      contextParts.push(ccText);
    }
    
    // Diagnoses (all from form)
    if (context.diagnoses && context.diagnoses.length > 0) {
      const diagList = context.diagnoses.map(d => {
        let diagText = '';
        if (d.code) diagText += d.code;
        if (d.display || d.description) diagText += ` - ${d.display || d.description}`;
        if (d.type) diagText += ` (${d.type})`;
        return diagText.trim();
      }).filter(d => d).join('\n  - ');
      if (diagList) {
        contextParts.push(`Diagnoses:\n  - ${diagList}`);
      }
    }
    
    // Vital Signs (all from form)
    if (context.vitalSigns) {
      const vitals = context.vitalSigns;
      let vitalParts = [];
      if (vitals.systolic && vitals.diastolic) vitalParts.push(`BP: ${vitals.systolic}/${vitals.diastolic} mmHg`);
      if (vitals.pulse) vitalParts.push(`Pulse: ${vitals.pulse} bpm`);
      if (vitals.temperature) vitalParts.push(`Temp: ${vitals.temperature}°C`);
      if (vitals.oxygen_saturation) vitalParts.push(`SpO2: ${vitals.oxygen_saturation}%`);
      if (vitals.respiratory_rate) vitalParts.push(`RR: ${vitals.respiratory_rate}/min`);
      if (vitals.height) vitalParts.push(`Height: ${vitals.height} cm`);
      if (vitals.weight) vitalParts.push(`Weight: ${vitals.weight} kg`);
      if (vitals.height && vitals.weight) {
        const bmi = (parseFloat(vitals.weight) / Math.pow(parseFloat(vitals.height) / 100, 2)).toFixed(1);
        vitalParts.push(`BMI: ${bmi} kg/m²`);
      }
      if (vitalParts.length > 0) {
        contextParts.push(`Vital Signs: ${vitalParts.join(', ')}`);
      }
    }
    
    // Requested Services/Procedures/Medications (all from form)
    if (context.requestedServices && context.requestedServices.length > 0) {
      const services = context.requestedServices.map(s => {
        let svcText = s.description || '';
        if (s.code) svcText += ` (${s.code})`;
        if (s.tooth) svcText += ` - Tooth ${s.tooth}`;
        if (s.bodySite) svcText += ` - ${s.bodySite}`;
        if (s.quantity) svcText += ` x${s.quantity}`;
        return svcText.trim();
      }).filter(s => s).join('\n  - ');
      if (services) {
        contextParts.push(`Requested Services:\n  - ${services}`);
      }
    }
    
    // Provider & Insurer Information (from database)
    if (context.providerName) {
      let providerText = `Provider: ${context.providerName}`;
      if (context.providerType) providerText += ` (${context.providerType})`;
      contextParts.push(providerText);
    }
    if (context.insurerName) {
      contextParts.push(`Insurer: ${context.insurerName}`);
    }
    
    // Admission Info (for inpatient)
    if (context.admissionWeight || context.estimatedLengthOfStay) {
      let admissionParts = [];
      if (context.admissionWeight) admissionParts.push(`Admission Weight: ${context.admissionWeight} kg`);
      if (context.estimatedLengthOfStay) admissionParts.push(`Est. Stay: ${context.estimatedLengthOfStay} days`);
      contextParts.push(admissionParts.join(', '));
    }
    
    const contextString = contextParts.length > 0 
      ? contextParts.join('\n') 
      : 'No additional context provided';
    
    // Build a structured prompt optimized for Llama3-Med42-70B
    return `<|system|>
You are an expert medical documentation specialist. Your task is to expand brief clinical notes into comprehensive, professional medical documentation suitable for insurance prior authorization requests. Write in formal medical terminology while maintaining clinical accuracy.
</|system|>

<|user|>
Expand the following ${fieldName} into detailed professional medical documentation.

ORIGINAL TEXT:
"${text}"

CLINICAL CONTEXT:
${contextString}

REQUIREMENTS:
1. Expand the text with appropriate medical terminology and detail
2. Maintain clinical accuracy - do not add symptoms or findings not implied by the original
3. Use professional medical language suitable for insurance documentation
4. Include relevant temporal markers, severity descriptors, and clinical observations where appropriate
5. Format as a cohesive narrative paragraph or structured note as appropriate for the field type
6. Answer with one JSON object only: {"enhancedText": "<the enhanced clinical text>"} - no preamble, explanations, or meta-commentary
</|user|>

<|assistant|>
`;
  }

  // ============================================================================
  // SNOMED SUGGESTIONS
  // ============================================================================

  /**
   * Suggest SNOMED codes from free text
   * @param {string} text - The clinical text to analyze
   * @param {string} category - The category (chief_complaint, diagnosis, etc.)
   * @returns {Promise<object>} - SNOMED code suggestions
   */
  async suggestSnomedCodes(text, category = 'chief_complaint') {
    if (!text || text.trim().length < 3) {
      return { success: false, suggestions: [], error: 'Text too short' };
    }

    const prompt = this.buildSnomedSuggestionPrompt(text, category);

    try {
      console.log('\n🏷️ ==> AI SNOMED CODE SUGGESTION REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`📋 Category: ${category}`);
      console.log(`📝 Text length: ${text.length}\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 600,
        format: SNOMED_SUGGESTIONS_SCHEMA
      });
      const metadata = {
        model: this.model,
        responseTime: `${(result.duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };

      const parsed = this.parseSnomedSuggestionsResponse(result.response);
      if (!parsed) {
        return {
          success: false, originalText: text, suggestions: [], analysisIncomplete: true,
          error: INVALID_REPLY_MESSAGE, metadata
        };
      }

      console.log(`✅ Found ${parsed.length} SNOMED suggestions\n`);
      return { success: true, originalText: text, suggestions: parsed, metadata };
    } catch (error) {
      console.error('❌ Error suggesting SNOMED codes:', error.message);
      return { success: false, suggestions: [], error: error.message };
    }
  }

  /**
   * Build SNOMED suggestion prompt
   * @private
   */
  buildSnomedSuggestionPrompt(text, category) {
    return `You are a medical coding specialist. Suggest appropriate SNOMED CT codes for the following clinical text.

=== CLINICAL TEXT ===
${text}

=== CATEGORY ===
${category}

=== REQUIREMENTS ===
Provide up to 5 relevant SNOMED CT codes with their descriptions.
Focus on the most specific and accurate codes for the clinical description.
Answer with one JSON object only: {"suggestions": [{"code": "<SNOMED CT concept id>", "display": "<description>"}]}`;
  }

  /**
   * Read the SNOMED suggestion reply (SNOMED_SUGGESTIONS_SCHEMA).
   * @returns {Array|null} suggestions, or null when the reply is unusable
   * @private
   */
  parseSnomedSuggestionsResponse(response) {
    const { ok, data, errors } = parseStructuredReply(response, SNOMED_SUGGESTIONS_SCHEMA);
    if (!ok) {
      logInvalidReply('SNOMED suggestions', errors);
      return null;
    }
    return data.suggestions.map(({ code, display }) => ({ code, display: display.trim() }));
  }

  /**
   * Validate if a SNOMED code matches its description
   * @param {string} code - The SNOMED CT code to validate
   * @param {string} description - The description/display text for the code
   * @returns {Promise<object>} - Validation result with isValid, confidence, and suggestions
   */
  async validateSnomedCode(code, description) {
    if (!code || !description) {
      return { 
        success: false, 
        isValid: false, 
        error: 'Both code and description are required',
        confidence: 0
      };
    }

    const prompt = this.buildSnomedValidationPrompt(code, description);

    try {
      console.log('\n✅ ==> AI SNOMED CODE VALIDATION REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`🏷️ Code: ${code}`);
      console.log(`📝 Description: ${description}\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.1, // Very low temperature for consistent validation
        num_predict: 800,
        format: SNOMED_VALIDATION_SCHEMA
      });

      const validation = this.parseSnomedValidationResponse(result.response);
      console.log(`\n✅ Validation Result: ${validation.isValid === null ? 'UNREADABLE' : validation.isValid ? 'VALID' : 'INVALID'}`);

      return {
        success: !validation.analysisIncomplete,
        code,
        providedDescription: description,
        ...validation,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error validating SNOMED code:', error.message);
      return { 
        success: false, 
        isValid: false, 
        code,
        providedDescription: description,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Build SNOMED validation prompt
   * @private
   */
  buildSnomedValidationPrompt(code, description) {
    return `You are a medical coding expert specializing in SNOMED CT (Systematized Nomenclature of Medicine - Clinical Terms). 

Your task is to validate whether a given SNOMED CT code correctly matches its provided description.

=== CODE TO VALIDATE ===
SNOMED Code: ${code}
Provided Description: ${description}

=== VALIDATION TASK ===
1. Determine if this SNOMED CT code exists and is valid
2. Check if the provided description accurately matches the official SNOMED CT concept for this code
3. If the code is valid but the description is wrong, provide the correct description
4. If the description is valid but the code is wrong, suggest the correct code
5. Rate your confidence in this validation (0.0 to 1.0)

=== OUTPUT ===
Answer with one JSON object only:
{"isValid": true|false, "confidence": 0.0-1.0, "explanation": "brief explanation",
 "correctDescription": "official description for this code, or null if the code is invalid",
 "suggestedCode": "correct code if the description is valid but the code is wrong, otherwise null",
 "suggestedDescription": "a better matching term, otherwise null"}`;
  }

  /**
   * Read the SNOMED validation reply (SNOMED_VALIDATION_SCHEMA). Fails closed: an unusable
   * reply is isValid:null (unknown), never "valid" or "invalid".
   * @private
   */
  parseSnomedValidationResponse(response) {
    const { ok, data, errors } = parseStructuredReply(response, SNOMED_VALIDATION_SCHEMA);
    if (ok) {
      return {
        isValid: data.isValid,
        confidence: data.confidence,
        explanation: data.explanation,
        correctDescription: data.correctDescription ?? null,
        suggestedCode: data.suggestedCode ?? null,
        suggestedDescription: data.suggestedDescription ?? null,
        analysisIncomplete: false
      };
    }
    logInvalidReply('SNOMED validation', errors);
    return {
      isValid: null,
      confidence: 0,
      explanation: '',
      correctDescription: null,
      suggestedCode: null,
      suggestedDescription: null,
      analysisIncomplete: true,
      requiresManualReview: true,
      error: INVALID_REPLY_MESSAGE
    };
  }

  // ============================================================================
  // MEDICAL NECESSITY ASSESSMENT
  // ============================================================================

  /**
   * Assess medical necessity for a prior authorization
   * @param {object} formData - The prior auth form data
   * @returns {Promise<object>} - Medical necessity assessment
   */
  async assessMedicalNecessity(formData) {
    const prompt = this.buildMedicalNecessityPrompt(formData);

    try {
      console.log('\n⚖️ ==> AI MEDICAL NECESSITY ASSESSMENT REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 1500,
        format: MEDICAL_NECESSITY_SCHEMA
      });

      const assessment = this.parseMedicalNecessityResponse(result.response);

      console.log(`✅ Assessment complete: ${assessment.assessment ?? 'unreadable reply'}\n`);

      return {
        ...assessment,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error assessing medical necessity:', error.message);
      throw error;
    }
  }

  /**
   * Build medical necessity assessment prompt
   * @private
   */
  buildMedicalNecessityPrompt(formData) {
    const diagnoses = formData.diagnoses || [];
    const items = formData.items || [];
    const clinicalInfo = formData.clinical_info || {};
    const patient = formData.patient || {};
    const authType = formData.auth_type || 'professional';

    // Calculate patient age from birth date
    let patientAge = 'Unknown';
    let ageCategory = 'adult';
    
    if (patient.birth_date || patient.birthDate || formData.birth_date) {
      const birthDate = new Date(patient.birth_date || patient.birthDate || formData.birth_date);
      const today = new Date();
      const ageInDays = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
      const ageInMonths = Math.floor(ageInDays / 30.44);
      const ageInYears = Math.floor(ageInDays / 365.25);
      
      if (ageInDays < 0) {
        patientAge = 'Not yet born (future date)';
        ageCategory = 'invalid';
      } else if (ageInDays < 28) {
        patientAge = `${ageInDays} days (Neonate)`;
        ageCategory = 'neonate';
      } else if (ageInMonths < 12) {
        patientAge = `${ageInMonths} months (Infant)`;
        ageCategory = 'infant';
      } else if (ageInYears < 2) {
        patientAge = `${ageInMonths} months (Toddler)`;
        ageCategory = 'toddler';
      } else if (ageInYears < 12) {
        patientAge = `${ageInYears} years (Child)`;
        ageCategory = 'child';
      } else {
        patientAge = `${ageInYears} years`;
        ageCategory = ageInYears >= 65 ? 'elderly' : 'adult';
      }
    }

    // Age-specific guidance
    let ageGuidance = '';
    if ((ageCategory === 'neonate' || ageCategory === 'infant') && authType === 'dental') {
      ageGuidance = `
CRITICAL: This is a ${ageCategory.toUpperCase()} patient (${patientAge}) with a DENTAL authorization request.
- Infants typically have NO teeth or only erupting primary teeth
- Most dental procedures are NOT medically appropriate for infants
- This request should be flagged as LIKELY_DENIED unless there is a specific neonatal dental condition documented`;
    } else if (ageCategory === 'neonate' || ageCategory === 'infant') {
      ageGuidance = `
NOTE: This is a ${ageCategory.toUpperCase()} patient (${patientAge}).
- Verify all treatments are age-appropriate
- Ensure pediatric dosing is used for any medications
- Consider whether specialist pediatric care is required`;
    }

    return `You are a medical necessity reviewer for insurance prior authorizations. Assess whether the requested services are medically necessary based on the clinical documentation.

=== PATIENT INFORMATION ===
Age: ${patientAge}
Gender: ${patient.gender || patient.sex || formData.gender || 'Unknown'}
Authorization Type: ${authType.toUpperCase()}
${ageGuidance}

=== DIAGNOSES ===
${diagnoses
    .map(d => `- ${d.diagnosis_code}: ${d.diagnosis_display || d.diagnosis_description}`)
    .join('\n') || 'None specified'}

=== REQUESTED SERVICES ===
${items
    .map(i => `- ${i.product_or_service_code || i.medication_code}: ${i.service_description || i.medication_name}`)
    .join('\n') || 'None specified'}

=== CLINICAL DOCUMENTATION ===
Chief Complaint: ${clinicalInfo.chief_complaint_display || clinicalInfo.chief_complaint_text || 'Not specified'}
HPI: ${clinicalInfo.history_of_present_illness || 'Not documented'}
Exam: ${clinicalInfo.physical_examination || 'Not documented'}
Plan: ${clinicalInfo.treatment_plan || 'Not documented'}

=== ASSESSMENT REQUIRED ===
1. Is the service medically necessary for the diagnosis?
2. Is there sufficient documentation to support the request?
3. Are the requested services appropriate for the patient's age?
4. What additional documentation would strengthen the case?

=== OUTPUT ===
Answer with one JSON object only:
{"necessityScore": 0.0-1.0, "assessment": "APPROVED|NEEDS_INFO|LIKELY_DENIED",
 "reasoning": "brief explanation", "missingElements": ["..."],
 "suggestedJustification": "a sentence that could be added to support medical necessity"}`;
  }

  /**
   * Read the medical necessity reply (MEDICAL_NECESSITY_SCHEMA). Fails closed: an unusable
   * reply has no score and no assessment (null) and requires manual review.
   * @private
   */
  parseMedicalNecessityResponse(response) {
    const { ok, data, errors } = parseStructuredReply(response, MEDICAL_NECESSITY_SCHEMA);
    if (ok) {
      return {
        success: true,
        necessityScore: data.necessityScore,
        assessment: data.assessment,
        reasoning: data.reasoning,
        missingElements: data.missingElements,
        suggestedJustification: data.suggestedJustification,
        analysisIncomplete: false
      };
    }
    logInvalidReply('Medical necessity', errors);
    return {
      success: false,
      necessityScore: null,
      assessment: null,
      reasoning: '',
      missingElements: [],
      suggestedJustification: '',
      analysisIncomplete: true,
      requiresManualReview: true,
      error: INVALID_REPLY_MESSAGE
    };
  }
}

// Export singleton instance and class (for testing / flexibility)
export const ollamaService = new OllamaService();
export default ollamaService;
export { OllamaService };
