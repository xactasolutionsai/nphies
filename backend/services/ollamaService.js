import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://206.168.83.244:11434';
    this.model = process.env.OLLAMA_MODEL || 'thewindmom/llama3-med42-8b:latest';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT, 10) || 120000; // 120 seconds default
    this.maxRetries = 3;
    this.requestCounter = 0;

    // Optional: separate embedding model
    this.embeddingModel = process.env.OLLAMA_EMBED_MODEL || this.model;
    
    this.client = new Ollama({
      host: this.baseUrl
    });
    
    console.log(`\n✅ Ollama Service initialized`);
    console.log(`   📍 Base URL: ${this.baseUrl}`);
    console.log(`   🤖 Model: ${this.model}`);
    console.log(`   ⏱️  Timeout: ${this.timeout}ms`);
    
    // Test connection on startup
    this.testConnection();
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
  // LOW-LEVEL HELPER
  // ============================================================================

  /**
   * Run a promise with a soft timeout (no abort, only rejection)
   * @private
   */
  async runWithTimeout(promise, ms, description = 'operation') {
    let timeoutId;
    const startTime = Date.now();
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`\n⏰ TIMEOUT: ${description} after ${elapsed}ms (limit: ${ms}ms)`);
        reject(new Error(`Ollama ${description} timed out after ${ms}ms`));
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================================================
  // CORE COMPLETION & EMBEDDINGS
  // ============================================================================

  /**
   * Generate a completion from the model
   * @param {string} prompt - The prompt to send to the model
   * @param {object} options - Additional options for the completion
   * @returns {Promise<object>} - The completion response
   */
  async generateCompletion(prompt, options = {}) {
    const requestId = ++this.requestCounter;
    const startTime = Date.now();
    let lastError = null;

    console.log(`\n🚀 [REQ-${requestId}] Starting Ollama request`);
    console.log(`   📍 Server: ${this.baseUrl}`);
    console.log(`   🤖 Model: ${this.model}`);
    console.log(`   📝 Prompt length: ${prompt?.length || 0} chars`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`\n📤 [REQ-${requestId}] Sending request (attempt ${attempt}/${this.maxRetries})`);
        console.log(`   Temperature: ${options.temperature ?? 0.7}`);
        console.log(`   num_predict: ${options.num_predict ?? 2048}`);
        
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
          const response = await this.runWithTimeout(
            this.client.generate(requestConfig),
            this.timeout,
            'completion'
          );

          clearInterval(progressInterval);
          const duration = Date.now() - startTime;
          
          console.log(`\n✅ [REQ-${requestId}] Response received in ${duration}ms`);
          console.log(`   📝 Response length: ${response.response?.length || 0} chars`);
          if (response.response) {
            console.log(`   📄 Preview: ${response.response.substring(0, 100)}...`);
          }

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
   * Generate embeddings for text
   * @param {string} text - The text to embed
   * @returns {Promise<array>} - The embedding vector
   */
  async generateEmbedding(text) {
    try {
      console.log(`🔢 Generating embedding for text (length: ${text.length})`);
      
      const response = await this.runWithTimeout(
        this.client.embeddings({
          model: this.embeddingModel,
        prompt: text
        }),
        this.timeout,
        'embedding'
      );

      if (!response.embedding || !Array.isArray(response.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      console.log(`✅ Embedding generated (dimension: ${response.embedding.length})`);
      return response.embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      
      if (error.message?.includes('does not support') || error.message?.includes('embeddings')) {
        console.log('⚠️ Model does not support embeddings, consider using an embedding-specific model.');
        throw new Error(
          `Model ${this.embeddingModel} does not support embeddings. Consider using an embedding-specific model.`
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
      console.log(`📋 Patient: ${formData.insured_name || 'N/A'}, Age: ${formData.age || 'N/A'}`);
      console.log(`💊 Chief Complaints: ${formData.chief_complaints?.substring(0, 60) || 'N/A'}...`);
      console.log(`📚 Guidelines Retrieved: ${relevantGuidelines.length}`);
      console.log(`📝 Prompt Length: ${prompt.length} characters\n`);
      
      const result = await this.generateCompletion(prompt, {
        temperature: 0.2, // Lower temperature for more consistent format adherence
        num_predict: 3000,
        repeat_penalty: 1.2 // Reduce prompt echoing and repetition
      });

      console.log('\n📥 ==> RAW AI RESPONSE <==');
      console.log('─'.repeat(80));
      console.log(result.response);
      console.log('─'.repeat(80));
      console.log(`⏱️  Response Time: ${(result.duration / 1000).toFixed(2)}s\n`);

      // Check for prompt echoing
      const hasEcho = this.detectPromptEcho(result.response);

      // Parse the AI response into structured format
      const validation = this.parseValidationResponse(result.response, formData);
      
      // Add warning if echo was detected
      if (hasEcho) {
        validation.warnings.push({
          field: 'system',
          message: 'AI response quality may be affected by prompt echo. Consider reviewing raw output.',
          severity: 'low'
        });
      }
      
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
   * Check if response contains prompt echoing
   * @private
   * @param {string} responseText - The AI response text
   * @returns {boolean} - True if echo detected
   */
  detectPromptEcho(responseText) {
    const echoPatterns = [
      'You are reviewing an ophthalmology prescription',
      'Analyze the data and respond ONLY',
      'As a medical AI assistant',
      'OUTPUT REQUIRED',
      'copy this format exactly',
      'Now analyze the above patient data',
      'BEGIN YOUR ANALYSIS'
    ];
    
    const lowerResponse = responseText.toLowerCase();
    const hasEcho = echoPatterns.some(pattern => 
      lowerResponse.includes(pattern.toLowerCase())
    );
    
    if (hasEcho) {
      console.log('⚠️ Prompt echo detected in AI response!');
    }
    
    return hasEcho;
  }

  /**
   * Build the validation prompt with medical context
   * @private
   */
  buildValidationPrompt(formData, relevantGuidelines) {
    const guidelinesContext = relevantGuidelines.length > 0
      ? `\n\nRelevant medical guidelines:\n${relevantGuidelines.map((g, i) => `${i + 1}. ${g.content}`).join('\n')}`
      : '';

    return `As a medical AI assistant, review this ophthalmology prescription and provide your analysis in the structured format below.

IMPORTANT: Do NOT repeat these instructions. Start directly with your analysis using the format shown.${guidelinesContext}

=== PATIENT DATA ===
Age: ${formData.age} years, Sex: ${formData.sex || 'Unknown'}
Chief Complaints: ${formData.chief_complaints || 'Not specified'}
Duration: ${formData.duration_of_illness_days || 0} days
Clinical Signs: ${formData.significant_signs || 'None documented'}

RIGHT EYE: Sphere ${formData.right_eye_specs?.distance?.sphere || 'N/A'}, Cylinder ${formData.right_eye_specs?.distance?.cylinder || 'N/A'}, Axis ${formData.right_eye_specs?.distance?.axis || 'N/A'}, VA ${formData.right_eye_specs?.distance?.vn || 'N/A'}, Add ${formData.right_eye_specs?.bifocal_add || 'N/A'}

LEFT EYE: Sphere ${formData.left_eye_specs?.distance?.sphere || 'N/A'}, Cylinder ${formData.left_eye_specs?.distance?.cylinder || 'N/A'}, Axis ${formData.left_eye_specs?.distance?.axis || 'N/A'}, VA ${formData.left_eye_specs?.distance?.vn || 'N/A'}, Add ${formData.left_eye_specs?.bifocal_add || 'N/A'}

Lenses: ${formData.lens_type || 'Not specified'}
Procedures: ${formData.procedures?.map(p => p.service_description).join(', ') || 'None'}

=== REQUIRED OUTPUT FORMAT ===

VALIDITY: [Yes or No]
CONFIDENCE: [0.0 to 1.0]

WARNINGS:
- [field]: [clinical concern] - Severity: [low/medium/high]

RECOMMENDATIONS:
- [clinical recommendation based on findings]

MISSING_ANALYSES:
- [suggested test if needed]

=== BEGIN YOUR ANALYSIS ===`;
  }

  /**
   * Parse AI response into structured validation result
   * @private
   */
  parseValidationResponse(responseText) {
    const result = {
      isValid: true,
      confidenceScore: 0.85,
      warnings: [],
      recommendations: [],
      missingAnalyses: []
    };

    try {
      // Extract validity
      const validityMatch = responseText.match(/VALIDITY:\s*(Yes|No)/i);
      if (validityMatch) {
        result.isValid = validityMatch[1].toLowerCase() === 'yes';
      }

      // Extract confidence score
      const confidenceMatch = responseText.match(/CONFIDENCE:\s*([\d.]+)/i);
      if (confidenceMatch) {
        result.confidenceScore = parseFloat(confidenceMatch[1]);
      }

      // Extract warnings
      const warningsSection = responseText.match(/WARNINGS:([\s\S]*?)(?=RECOMMENDATIONS:|MISSING_ANALYSES:|$)/i);
      if (warningsSection) {
        const warningLines = warningsSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        warningLines.forEach(line => {
          const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
          const severityMatch = cleanLine.match(/Severity:\s*(high|medium|low)/i);
          const severity = severityMatch ? severityMatch[1].toLowerCase() : 'medium';
          const message = cleanLine.replace(/\s*-\s*Severity:\s*(high|medium|low)/i, '').trim();
          
          if (message && message.length > 5) {
            const fieldMatch = message.match(/^\[(.*?)\]:\s*(.*)/) || message.match(/^(.*?):\s*(.*)/);
            result.warnings.push({
              field: fieldMatch ? fieldMatch[1].trim() : 'general',
              message: fieldMatch ? fieldMatch[2].trim() : message,
              severity
            });
          }
        });
      }

      // Extract recommendations
      const recommendationsSection = responseText.match(/RECOMMENDATIONS:([\s\S]*?)(?=MISSING_ANALYSES:|$)/i);
      if (recommendationsSection) {
        const recLines = recommendationsSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        recLines.forEach(line => {
          const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
          if (cleanLine && cleanLine.length > 5) {
            result.recommendations.push(cleanLine);
          }
        });
      }

      // Extract missing analyses
      const missingSection = responseText.match(/MISSING_ANALYSES:([\s\S]*?)$/i);
      if (missingSection) {
        const missingLines = missingSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        missingLines.forEach(line => {
          const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
          if (cleanLine && cleanLine.length > 5) {
            result.missingAnalyses.push(cleanLine);
          }
        });
      }

      // If parsing found nothing, fallback
      if (
        result.warnings.length === 0 &&
        result.recommendations.length === 0 &&
        result.missingAnalyses.length === 0
      ) {
        console.log('⚠️ Structured parsing found nothing, using fallback parsing...');
        console.log('📄 Full response text for debugging:');
        console.log(responseText);
        
        const instructionPatterns = [
          /you are (reviewing|analyzing)/i,
          /analyze the data/i,
          /respond only/i,
          /output required/i,
          /copy this format/i,
          /now analyze/i,
          /^(===|---)/,
          /^\[.*\]$/,
          /begin (your )?analysis/i,
          /required output format/i,
          /patient data/i,
          /important:/i,
          /do not repeat/i,
          /structured format/i,
          /medical ai assistant/i
        ];
        
        const lines = responseText.split('\n').filter(l => l.trim().length > 10);
        
        let addedCount = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          const isInstruction = instructionPatterns.some(pattern => pattern.test(trimmed));
          
          if (
            trimmed &&
              !isInstruction &&
              !trimmed.match(/^(VALIDITY|CONFIDENCE|WARNINGS|RECOMMENDATIONS|MISSING_ANALYSES):/i) &&
            trimmed.length > 20 &&
            addedCount < 10
          ) {
            const cleaned = trimmed
              .replace(/^[-*•]\s*/, '')
              .replace(/^\d+\.\s*/, '');

            if (
              cleaned.length > 20 &&
              !cleaned.match(/^\[.*\]$/) &&
              cleaned.split(' ').length >= 4
            ) {
              result.recommendations.push(cleaned);
              addedCount++;
            }
          }
        }
        
        if (result.recommendations.length === 0) {
          result.recommendations.push(
            'AI analysis completed. Please review the raw response in server logs for details.'
          );
          result.warnings.push({
            field: 'parsing',
            message: 'AI response format not recognized. Check server logs for full response.',
            severity: 'low'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error parsing validation response:', error.message);
      result.warnings.push({
        field: 'parsing',
        message: 'Unable to fully parse AI response. Manual review recommended.',
        severity: 'medium'
      });
    }

    return result;
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
  // MEDICINE INFORMATION (e.g. with medbot-like models)
  // ============================================================================

  /**
   * Get detailed medicine information using AI
   * @param {object} medicineData - Medicine data object
   * @returns {Promise<object>} - Detailed medicine information
   */
  async getMedicineInformation(medicineData) {
    const prompt = this.buildMedicineInfoPrompt(medicineData);
    
    try {
      console.log('\n💊 ==> AI MEDICINE INFORMATION REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`💊 Medicine: ${medicineData.activeIngredient}`);
      console.log(`📊 Strength: ${medicineData.strength} ${medicineData.unit}`);
      console.log(`📝 Dosage Form: ${medicineData.dosageForm?.parent || 'N/A'}`);
      console.log(`📝 Prompt Length: ${prompt.length} characters\n`);
      
      const result = await this.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 4000,
        repeat_penalty: 1.1
      });

      console.log('\n📥 ==> RAW AI RESPONSE <==');
      console.log('─'.repeat(80));
      console.log(result.response);
      console.log('─'.repeat(80));
      console.log(`⏱️  Response Time: ${(result.duration / 1000).toFixed(2)}s\n`);

      const medicineInfo = this.parseMedicineInfoResponse(result.response, medicineData);
      
      console.log('✅ ==> PARSED MEDICINE INFORMATION <==');
      console.log(`   Indications: ${medicineInfo.indications.length} items`);
      console.log(`   Contraindications: ${medicineInfo.contraindications.length} items`);
      console.log(`   Side Effects: ${medicineInfo.sideEffects.length} items`);
      console.log(`   Interactions: ${medicineInfo.interactions.length} items\n`);
      
      return {
        ...medicineInfo,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString(),
          rawResponse: result.response
        }
      };
    } catch (error) {
      console.error('❌ Error getting medicine information:', error.message);
      throw error;
    }
  }

  /**
   * Build the prompt for medicine information request
   * @private
   */
  buildMedicineInfoPrompt(medicineData) {
    const brandsList =
      medicineData.brands && medicineData.brands.length > 0
        ? medicineData.brands
          .map(b => b.brand_name || b.brandName)
          .filter(Boolean)
          .join(', ')
      : 'No brand names available';

    return `You are a medical AI assistant providing detailed pharmaceutical information. Analyze the following medicine and provide comprehensive clinical information.

=== MEDICINE DATA ===
Active Ingredient: ${medicineData.activeIngredient}
Strength: ${medicineData.strength} ${medicineData.unit}
Dosage Form: ${medicineData.dosageForm?.parent || 'N/A'} - ${medicineData.dosageForm?.child || 'N/A'}
Brand Names: ${brandsList}
MRID: ${medicineData.mrid}

=== REQUIRED OUTPUT FORMAT ===

INDICATIONS:
- [Primary therapeutic use and condition treated]
- [Additional indication if applicable]

CONTRAINDICATIONS:
- [Medical condition or situation where medicine should not be used]
- [Additional contraindication if applicable]

SIDE_EFFECTS:
- [Common side effect with frequency if known]
- [Additional side effect]

DRUG_INTERACTIONS:
- [Drug class or specific drug that interacts with this medicine]
- [Additional interaction]

DOSAGE_GUIDELINES:
[Standard dosing information, administration route, and frequency]

WARNINGS:
- [Important warning or precaution]
- [Additional warning]

MECHANISM_OF_ACTION:
[Brief explanation of how the medicine works in the body]

=== IMPORTANT ===
- Provide accurate, evidence-based information
- If unsure about specific details, indicate this clearly
- Focus on clinically relevant information
- Use clear, professional medical terminology
- Do NOT repeat these instructions in your response

=== BEGIN YOUR ANALYSIS ===`;
  }

  /**
   * Parse AI response for medicine information
   * @private
   */
  parseMedicineInfoResponse(responseText, medicineData) {
    const result = {
      medicine: {
        activeIngredient: medicineData.activeIngredient,
        strength: medicineData.strength,
        unit: medicineData.unit,
        mrid: medicineData.mrid
      },
      indications: [],
      contraindications: [],
      sideEffects: [],
      interactions: [],
      dosageGuidelines: '',
      warnings: [],
      mechanismOfAction: ''
    };

    try {
      // Extract indications
      const indicationsMatch = responseText.match(/INDICATIONS:([\s\S]*?)(?=CONTRAINDICATIONS:|SIDE_EFFECTS:|$)/i);
      if (indicationsMatch) {
        result.indications = this.extractListItems(indicationsMatch[1]);
      }

      // Extract contraindications
      const contraindicationsMatch = responseText.match(
        /CONTRAINDICATIONS:([\s\S]*?)(?=SIDE_EFFECTS:|DRUG_INTERACTIONS:|$)/i
      );
      if (contraindicationsMatch) {
        result.contraindications = this.extractListItems(contraindicationsMatch[1]);
      }

      // Extract side effects
      const sideEffectsMatch = responseText.match(
        /SIDE_EFFECTS:([\s\S]*?)(?=DRUG_INTERACTIONS:|DOSAGE_GUIDELINES:|$)/i
      );
      if (sideEffectsMatch) {
        result.sideEffects = this.extractListItems(sideEffectsMatch[1]);
      }

      // Extract drug interactions
      const interactionsMatch = responseText.match(
        /DRUG_INTERACTIONS:([\s\S]*?)(?=DOSAGE_GUIDELINES:|WARNINGS:|$)/i
      );
      if (interactionsMatch) {
        result.interactions = this.extractListItems(interactionsMatch[1]);
      }

      // Extract dosage guidelines
      const dosageMatch = responseText.match(
        /DOSAGE_GUIDELINES:([\s\S]*?)(?=WARNINGS:|MECHANISM_OF_ACTION:|$)/i
      );
      if (dosageMatch) {
        result.dosageGuidelines = dosageMatch[1].trim().replace(/^[-*•]\s*/gm, '');
      }

      // Extract warnings
      const warningsMatch = responseText.match(/WARNINGS:([\s\S]*?)(?=MECHANISM_OF_ACTION:|$)/i);
      if (warningsMatch) {
        result.warnings = this.extractListItems(warningsMatch[1]);
      }

      // Extract mechanism of action
      const mechanismMatch = responseText.match(/MECHANISM_OF_ACTION:([\s\S]*?)$/i);
      if (mechanismMatch) {
        result.mechanismOfAction = mechanismMatch[1].trim().replace(/^[-*•]\s*/gm, '');
      }

      // Fallback: heuristic extraction if nothing parsed
      if (
        result.indications.length === 0 &&
        result.contraindications.length === 0 &&
        result.sideEffects.length === 0 &&
        result.interactions.length === 0
      ) {
        console.log('⚠️ Structured parsing found nothing, attempting fallback extraction...');
        
        const lines = responseText
          .split('\n')
          .filter(line => line.trim().length > 10)
          .filter(line => !this.isInstructionLine(line));
        
        lines.forEach(line => {
          const cleaned = line.trim().replace(/^[-*•]\s*/, '');
          if (cleaned.length > 15) {
            const lower = cleaned.toLowerCase();
            if (lower.includes('treat') || lower.includes('used for')) {
              result.indications.push(cleaned);
            } else if (lower.includes('should not') || lower.includes('avoid')) {
              result.contraindications.push(cleaned);
            } else if (lower.includes('side effect') || lower.includes('adverse')) {
              result.sideEffects.push(cleaned);
            } else if (lower.includes('interact') || lower.includes('with other')) {
              result.interactions.push(cleaned);
            }
          }
        });
      }
    } catch (error) {
      console.error('❌ Error parsing medicine information response:', error.message);
    }

    return result;
  }

  /**
   * Extract list items from a text section
   * @private
   */
  extractListItems(text) {
    if (!text) return [];
    
    const lines = text
      .split('\n')
      .filter(line => line.trim().match(/^[-*•]/))
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 10);
    
    return lines;
  }

  /**
   * Check if a line is part of instructions (should be filtered out)
   * @private
   */
  isInstructionLine(line) {
    const instructionPatterns = [
      /you are (a |an )?medical/i,
      /analyze the (following )?medicine/i,
      /provide (comprehensive |detailed )?information/i,
      /required output format/i,
      /important:/i,
      /begin (your )?analysis/i,
      /do not repeat/i,
      /^===/,
      /medicine data/i
    ];
    
    return instructionPatterns.some(pattern => pattern.test(line));
  }

  // ============================================================================
  // PRIOR AUTHORIZATION VALIDATION (INSTITUTIONAL / PROFESSIONAL)
  // ============================================================================

  /**
   * Validate prior authorization form data
   * @param {object} formData - The prior auth form data to validate
   * @param {string} authType - The authorization type (institutional, professional, etc.)
   * @returns {Promise<object>} - Structured validation result
   */
  async validatePriorAuthForm(formData, authType = 'professional') {
    const prompt = this.buildPriorAuthValidationPrompt(formData, authType);

    try {
      console.log('\n🏥 ==> AI PRIOR AUTH VALIDATION REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`📋 Auth Type: ${authType}`);
      console.log(`📝 Prompt Length: ${prompt.length} characters\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.3,
        num_predict: 2500,
        repeat_penalty: 1.2
      });

      console.log('\n📥 ==> RAW AI RESPONSE <==');
      console.log('─'.repeat(80));
      console.log(result.response);
      console.log('─'.repeat(80));
      console.log(`⏱️  Response Time: ${(result.duration / 1000).toFixed(2)}s\n`);

      const validation = this.parsePriorAuthValidationResponse(result.response);

      console.log('✅ ==> PARSED VALIDATION RESULT <==');
      console.log(`   Medical Necessity Score: ${(validation.medicalNecessityScore * 100).toFixed(0)}%`);
      console.log(`   Consistency Check: ${validation.consistencyCheck.passed ? 'PASS' : 'FAIL'}`);
      console.log(`   Rejection Risks: ${validation.rejectionRisks.length}`);
      console.log(`   Recommendations: ${validation.recommendations.length}\n`);

      return {
        ...validation,
        authType,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString(),
          rawResponse: result.response
        }
      };
    } catch (error) {
      console.error('❌ Error in prior auth validation:', error.message);
      throw error;
    }
  }

  /**
   * Build the prior auth validation prompt
   * @private
   */
  buildPriorAuthValidationPrompt(formData, authType) {
    const vitalSigns = formData.vital_signs || {};
    const clinicalInfo = formData.clinical_info || {};
    const diagnoses = formData.diagnoses || [];
    const items = formData.items || [];
    const patient = formData.patient || {};

    // Calculate patient age from birth date
    let patientAge = 'Unknown';
    let ageInDays = null;
    let ageInMonths = null;
    let ageInYears = null;
    let ageCategory = 'adult'; // default
    
    if (patient.birth_date || patient.birthDate || formData.birth_date) {
      const birthDate = new Date(patient.birth_date || patient.birthDate || formData.birth_date);
      const today = new Date();
      const diffTime = today - birthDate;
      ageInDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      ageInMonths = Math.floor(ageInDays / 30.44);
      ageInYears = Math.floor(ageInDays / 365.25);
      
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
      } else if (ageInYears < 18) {
        patientAge = `${ageInYears} years (Adolescent)`;
        ageCategory = 'adolescent';
      } else if (ageInYears < 65) {
        patientAge = `${ageInYears} years (Adult)`;
        ageCategory = 'adult';
      } else {
        patientAge = `${ageInYears} years (Elderly)`;
        ageCategory = 'elderly';
      }
    }
    
    const patientGender = patient.gender || patient.sex || formData.gender || 'Unknown';
    const patientName = patient.name || patient.full_name || formData.patient_name || 'Not specified';

    let bmiInfo = '';
    if (vitalSigns.height && vitalSigns.weight) {
      const bmi =
        parseFloat(vitalSigns.weight) /
        Math.pow(parseFloat(vitalSigns.height) / 100, 2);
      bmiInfo = `BMI: ${bmi.toFixed(1)} kg/m²`;
    }

    // Build age-specific warnings for the AI
    let ageSpecificGuidance = '';
    if (ageCategory === 'neonate' || ageCategory === 'infant') {
      ageSpecificGuidance = `
CRITICAL AGE CONSIDERATION:
This patient is a ${ageCategory.toUpperCase()} (${patientAge}). You MUST:
- Flag ANY dental procedures as inappropriate (infants have no teeth or only primary teeth erupting)
- Verify vital signs are within pediatric/neonatal normal ranges (NOT adult ranges)
- Ensure diagnoses and treatments are age-appropriate
- Consider that many adult medications and procedures are contraindicated in infants
- Neonatal normal vitals: HR 120-160, RR 30-60, BP 60-90/30-60, Temp 36.5-37.5°C
- Infant normal vitals: HR 100-150, RR 25-40, BP 80-100/50-70`;
    } else if (ageCategory === 'toddler' || ageCategory === 'child') {
      ageSpecificGuidance = `
AGE CONSIDERATION:
This patient is a ${ageCategory.toUpperCase()} (${patientAge}). Consider:
- Pediatric dosing and age-appropriate treatments
- Vital sign ranges differ from adults
- Some procedures may require pediatric specialist involvement`;
    } else if (ageCategory === 'elderly') {
      ageSpecificGuidance = `
AGE CONSIDERATION:
This patient is ELDERLY (${patientAge}). Consider:
- Polypharmacy risks and drug interactions
- Renal/hepatic function adjustments may be needed
- Fall risk and frailty considerations`;
    }

    return `You are a medical AI assistant reviewing a prior authorization request for NPHIES (Saudi Arabia healthcare system). Analyze the clinical data and identify potential rejection risks.

=== AUTHORIZATION TYPE ===
${authType.toUpperCase()}

=== PATIENT DEMOGRAPHICS ===
Name: ${patientName}
Age: ${patientAge}
Gender: ${patientGender}
Birth Date: ${patient.birth_date || patient.birthDate || formData.birth_date || 'Not provided'}
${ageSpecificGuidance}

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
${diagnoses
    .map(
      d =>
        `- ${d.diagnosis_code || 'N/A'}: ${d.diagnosis_display || d.diagnosis_description || 'N/A'} (${d.diagnosis_type || 'secondary'})`
    )
    .join('\n') || 'No diagnoses specified'}

=== REQUESTED SERVICES/PROCEDURES ===
${items
    .map(
      i =>
        `- ${i.product_or_service_code || i.medication_code || 'N/A'}: ${i.service_description || i.medication_name || 'N/A'}`
    )
    .join('\n') || 'No items specified'}

=== ANALYSIS REQUIRED ===
Analyze this prior authorization request and provide:

1. MEDICAL_NECESSITY_SCORE: A score from 0.0 to 1.0 indicating how well the clinical documentation supports the requested services

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
   * Parse prior auth validation response
   * @private
   */
  parsePriorAuthValidationResponse(responseText) {
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
      }

      if (!result.consistencyCheck.passed) {
        result.passed = false;
        const consistencyFailSection = responseText.match(
          /CONSISTENCY_CHECK:\s*FAIL([\s\S]*?)(?=DOCUMENTATION_GAPS:|REJECTION_RISKS:|RECOMMENDATIONS:|JUSTIFICATION_NARRATIVE:|$)/i
        );
        if (consistencyFailSection) {
          result.consistencyCheck.explanation = consistencyFailSection[1].trim();
        }
      }

      // Extract documentation gaps
      const gapsSection = responseText.match(
        /DOCUMENTATION_GAPS:([\s\S]*?)(?=REJECTION_RISKS:|RECOMMENDATIONS:|JUSTIFICATION_NARRATIVE:|$)/i
      );
      if (gapsSection) {
        const gapLines = gapsSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        result.documentationGaps = gapLines
          .map(line => line.replace(/^[-*•]\s*/, '').trim())
          .filter(g => g.length > 5);
      }

      // Extract rejection risks
      const risksSection = responseText.match(
        /REJECTION_RISKS:([\s\S]*?)(?=RECOMMENDATIONS:|JUSTIFICATION_NARRATIVE:|$)/i
      );
      if (risksSection) {
        const riskLines = risksSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        result.rejectionRisks = riskLines
          .map(line => {
            const cleaned = line.replace(/^[-*•]\s*/, '').trim();
            // Try to match NPHIES-style codes: XX-XXXX, MN-XXX, SE-XXX, CV-XXX, BV-XXXXX, etc.
            const codeMatch = cleaned.match(/^([A-Z]{2,3}-[\d-]+):\s*(.+)/);
            if (codeMatch) {
              return { code: codeMatch[1], description: codeMatch[2] };
            }
            // If no code found but description is meaningful, return without code (null)
            // This prevents showing "UNKNOWN" badges in the UI
            if (cleaned.length > 10) {
              return { code: null, description: cleaned };
            }
            return null;
          })
          .filter(r => r && r.description && r.description.length > 5);
      }

      // Extract recommendations
      const recsSection = responseText.match(
        /RECOMMENDATIONS:([\s\S]*?)(?=JUSTIFICATION_NARRATIVE:|$)/i
      );
      if (recsSection) {
        const recLines = recsSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/));

        result.recommendations = recLines
          .map(line => line.replace(/^[-*•]\s*/, '').trim())
          .filter(r => r.length > 5);
      }

      // Extract justification narrative
      const narrativeSection = responseText.match(/JUSTIFICATION_NARRATIVE:([\s\S]*?)$/i);
      if (narrativeSection) {
        result.justificationNarrative = narrativeSection[1]
          .trim()
          .replace(/^[\s\n]+/, '')
          .replace(/[\s\n]+$/, '')
          .split('\n')
          .filter(line => !line.match(/^(===|---)/))
          .join(' ')
          .trim();
      }
    } catch (error) {
      console.error('❌ Error parsing prior auth validation response:', error.message);
    }

    return result;
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
    const prompt = this.buildClinicalEnhancementPrompt(text, field, context);

    try {
      console.log('\n📝 ==> AI CLINICAL TEXT ENHANCEMENT REQUEST <==');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`🤖 Model: ${this.model}`);
      console.log(`📋 Field: ${field}`);
      console.log(`📝 Original Text: "${text}"`);
      console.log(`📝 Original Text Length: ${text?.length || 0} characters`);
      console.log(`📋 Context: ${JSON.stringify(context)}\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.4,
        num_predict: 3000,
        repeat_penalty: 1.1,
        top_p: 0.92,
        num_ctx: 4096
      });

      console.log('\n📥 ==> RAW AI RESPONSE <==');
      console.log('─'.repeat(60));
      console.log(result.response);
      console.log('─'.repeat(60));

      let enhancedText = this.parseEnhancedTextResponse(result.response);

      console.log('\n📤 ==> PARSED ENHANCED TEXT <==');
      console.log('─'.repeat(60));
      console.log(enhancedText);
      console.log('─'.repeat(60));
      console.log(`✅ Enhanced text generated (${enhancedText.length} characters)\n`);

      // Clean up the response
      let cleanedText = enhancedText;
      
      // Remove any echo of the prompt
      const promptEchoPatterns = [
        /^rewrite this clinical note.*?:\s*/i,
        /^detailed version:\s*/i,
        /^["'].*?["']\s*\n*detailed version:\s*/i,
        /^enhance this .* for a medical/i,
        /^you are a medical documentation/i,
      ];
      
      for (const pattern of promptEchoPatterns) {
        cleanedText = cleanedText.replace(pattern, '');
      }
      
      // If response starts with the original text in quotes, remove it
      if (cleanedText.startsWith('"') || cleanedText.startsWith("'")) {
        const quoteEnd = cleanedText.indexOf(cleanedText[0], 1);
        if (quoteEnd > 0 && quoteEnd < 200) {
          // Check if there's more content after the quoted original
          const afterQuote = cleanedText.substring(quoteEnd + 1).trim();
          if (afterQuote.length > 30) {
            cleanedText = afterQuote.replace(/^detailed version:\s*/i, '').trim();
          }
        }
      }
      
      // Remove leading/trailing quotes
      cleanedText = cleanedText
        .replace(/^["']+/, '')
        .replace(/["']+$/, '')
        .trim();
      
      // Check for various failure modes where AI echoes instructions instead of enhancing
      const failurePatterns = [
        /^i am a/i,
        /^please write/i,
        /^as a/i,
        /^enhance this/i,
        /^rewrite and expand/i,
        /^your task is/i,
        /^field type:/i,
        /^clinical context:/i,
        /^text to enhance:/i,
        /^instructions:/i,
        /^write the expanded/i,
        /^you are a medical/i,
        /^you are an expert/i,
        /for a medical insurance prior authorization/i,
        /into detailed professional medical documentation/i,
        /into professional medical documentation/i,
      ];
      
      const isFailure = failurePatterns.some(pattern => pattern.test(cleanedText));
      if (isFailure) {
        console.warn('⚠️ AI echoed instructions instead of enhancing the text');
        return {
          success: false,
          originalText: text,
          enhancedText: text,
          error: 'AI did not enhance the text properly. The model may be overloaded. Please try again.',
          metadata: {
            model: this.model,
            responseTime: `${(result.duration / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check minimum length - enhanced text should be at least as long as original or close
      if (!cleanedText || cleanedText.length < 20) {
        console.warn('⚠️ Enhanced text too short or empty');
        return {
          success: false,
          originalText: text,
          enhancedText: text,
          error: 'AI returned insufficient content. Try adding more detail to your input.',
          metadata: {
            model: this.model,
            responseTime: `${(result.duration / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Additional check: if the "enhanced" text is much shorter than original, something went wrong
      if (cleanedText.length < text.length * 0.5) {
        console.warn('⚠️ Enhanced text is significantly shorter than original - likely a parsing issue');
        return {
          success: false,
          originalText: text,
          enhancedText: text,
          error: 'AI response was truncated or incomplete. Please try again.',
          metadata: {
            model: this.model,
            responseTime: `${(result.duration / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
          }
        };
      }

      enhancedText = cleanedText;

      return {
        success: true,
        originalText: text,
        enhancedText,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error enhancing clinical text:', error.message);
      return {
        success: false,
        originalText: text,
        enhancedText: text,
        error: error.message,
        metadata: {
          model: this.model,
          timestamp: new Date().toISOString()
        }
      };
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
    if (context.patientName || context.patientAge || context.patientBirthDate || context.patientGender) {
      let patientInfo = 'Patient:';
      if (context.patientName) patientInfo += ` ${context.patientName}`;
      
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
      contextParts.push(patientInfo);
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
6. Do NOT include any preamble, explanations, or meta-commentary - output ONLY the enhanced clinical text
</|user|>

<|assistant|>
`;
  }

  /**
   * Parse enhanced text response
   * @private
   */
  parseEnhancedTextResponse(response) {
    let text = response || '';

    // Remove Llama3 chat format tokens first
    text = text.replace(/<\|system\|>[\s\S]*?<\/\|system\|>/gi, '');
    text = text.replace(/<\|user\|>[\s\S]*?<\/\|user\|>/gi, '');
    text = text.replace(/<\|assistant\|>/gi, '');
    text = text.replace(/<\/\|assistant\|>/gi, '');
    text = text.replace(/<\|end\|>/gi, '');
    text = text.replace(/<\|eot_id\|>/gi, '');
    text = text.replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/gi, '');

    // Patterns that indicate the AI echoed the prompt instead of responding
    const echoPatterns = [
      /^Rewrite and expand this/i,
      /^Enhance this .* for a medical/i,
      /^You are a medical documentation specialist/i,
      /^You are an expert medical/i,
      /^You are a .* specialist/i,
      /^Your task is to rewrite/i,
      /^Your task is to expand/i,
      /^FIELD TYPE:/i,
      /^CLINICAL CONTEXT:/i,
      /^TEXT TO ENHANCE:/i,
      /^INSTRUCTIONS:/i,
      /^1\. Expand the text/i,
      /^Output ONLY the enhanced text/i,
      /^Write the expanded .* now/i,
      /into detailed professional medical documentation/i,
      /into professional medical documentation suitable/i,
      /suitable for insurance prior authorization/i,
      /^Expand the following/i,
      /^ORIGINAL TEXT:/i,
      /^REQUIREMENTS:/i,
    ];
    
    // Check if the response is just echoing the prompt
    const isEcho = echoPatterns.some(pattern => pattern.test(text.trim()));
    if (isEcho) {
      console.warn('⚠️ AI echoed the prompt instead of enhancing. Returning empty.');
      return '';
    }

    const prefixPatterns = [
      /^ENHANCED_TEXT:\s*/i,
      /^ENHANCED\s+[A-Z\s]+:\s*/i, // ENHANCED PATIENT HISTORY:, ENHANCED TREATMENT PLAN:, etc.
      /^Enhanced\s*(Text|Version|Content)?:\s*/i,
      /^Here('s| is) the enhanced.*?:\s*/i,
      /^The enhanced.*?:\s*/i,
      /^Here is the expanded.*?:\s*/i,
      /^Below is the expanded.*?:\s*/i,
      /^Please enhance.*$/im,
      /^You are a medical.*$/im,
      /^You are an expert.*$/im,
      /^<\|assistant\|>\s*/i,
      /^Assistant:\s*/i,
      /^Sure[,!]?\s*(here('s| is))?.*?:\s*/i,
      /^Certainly[,!]?\s*(here('s| is))?.*?:\s*/i,
      /^Rewrite and expand.*?:\s*/i,
      /^Write the expanded.*?:\s*/i,
      /^\*\*Enhanced.*?\*\*:?\s*/i,
      /^\*\*Expanded.*?\*\*:?\s*/i,
    ];

    for (const pattern of prefixPatterns) {
      text = text.replace(pattern, '');
    }

    text = text.replace(/\n*<\|.*?\|>.*$/s, '');
    text = text.replace(/\n*===.*$/s, '');
    text = text.replace(/\n*---.*$/s, '');
    
    // Remove any trailing instruction echoes
    text = text.replace(/\n*INSTRUCTIONS:[\s\S]*$/i, '');
    text = text.replace(/\n*CLINICAL CONTEXT:[\s\S]*$/i, '');
    text = text.replace(/\n*Context:[\s\S]*$/i, '');
    text = text.replace(/\n*REQUIREMENTS:[\s\S]*$/i, '');
    text = text.replace(/\n*Note:[\s\S]{0,200}$/i, ''); // Remove trailing notes

    text = text.trim();
    
    // Remove surrounding quotes
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1);
    }
    
    // Remove markdown bold markers around the entire text
    if (text.startsWith('**') && text.endsWith('**')) {
      text = text.slice(2, -2);
    }

    text = text.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');

    return text;
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
      console.log(`📝 Text: ${text.substring(0, 50)}...\n`);

      const result = await this.generateCompletion(prompt, {
        temperature: 0.2,
        num_predict: 600,
        repeat_penalty: 1.1
      });

      const suggestions = this.parseSnomedSuggestionsResponse(result.response);

      console.log(`✅ Found ${suggestions.length} SNOMED suggestions\n`);

      return {
        success: true,
        originalText: text,
        suggestions,
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString()
        }
      };
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
Provide up to 5 relevant SNOMED CT codes with their descriptions. Format each suggestion as:
CODE: [SNOMED code] - [Description]

Focus on the most specific and accurate codes for the clinical description.

=== SNOMED SUGGESTIONS ===`;
  }

  /**
   * Parse SNOMED suggestions response
   * @private
   */
  parseSnomedSuggestionsResponse(response) {
    const suggestions = [];
    const lines = response.split('\n');

    lines.forEach(line => {
      const match =
        line.match(/CODE:\s*(\d+)\s*-\s*(.+)/i) ||
        line.match(/(\d{6,})\s*[-:]\s*(.+)/) ||
        line.match(/^-?\s*(\d{6,})\s*[-:–]\s*(.+)/);

      if (match) {
        suggestions.push({
          code: match[1].trim(),
          display: match[2].trim().replace(/^\s*-\s*/, '')
        });
      }
    });

    return suggestions.slice(0, 5);
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
        repeat_penalty: 1.2
      });

      const assessment = this.parseMedicalNecessityResponse(result.response);

      console.log(`✅ Assessment complete: ${assessment.assessment}\n`);

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
   * @private
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

      const missingSection = response.match(
        /MISSING_ELEMENTS:([\s\S]*?)(?=SUGGESTED_JUSTIFICATION:|$)/i
      );
      if (missingSection) {
        result.missingElements = missingSection[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().match(/^[-*•]/))
          .map(line => line.replace(/^[-*•]\s*/, '').trim())
          .filter(e => e.length > 3);
      }

      const justificationMatch = response.match(/SUGGESTED_JUSTIFICATION:\s*([^\n]+)/i);
      if (justificationMatch) result.suggestedJustification = justificationMatch[1].trim();
    } catch (error) {
      console.error('❌ Error parsing medical necessity response:', error.message);
    }

    return result;
  }
}

// Export singleton instance and class (for testing / flexibility)
export const ollamaService = new OllamaService();
export default ollamaService;
export { OllamaService };
