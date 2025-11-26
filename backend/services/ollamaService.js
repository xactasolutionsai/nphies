import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'cniongolo/biomistral';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT) || 120000; // 120 seconds default
    this.maxRetries = 3;
    
    this.client = new Ollama({
      host: this.baseUrl
    });
    
    console.log(`✅ Ollama Service initialized with model: ${this.model}`);
  }

  /**
   * Generate a completion from the model
   * @param {string} prompt - The prompt to send to the model
   * @param {object} options - Additional options for the completion
   * @returns {Promise<object>} - The completion response
   */
  async generateCompletion(prompt, options = {}) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🤖 Ollama request (attempt ${attempt}/${this.maxRetries}) - Model: ${this.model}`);
        console.log(`   Format: ${options.format || 'none'}`);
        console.log(`   Temperature: ${options.temperature || 0.7}`);
        console.log(`   num_predict: ${options.num_predict || 2048}`);
        console.log(`   num_ctx: ${options.num_ctx || 'default'}`);
        
        const requestConfig = {
          model: this.model,
          prompt: prompt,
          stream: false,
          format: options.format || undefined, // 'json' for JSON mode
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.num_predict || 2048,
            num_ctx: options.num_ctx || undefined,
            ...(Object.keys(options).reduce((acc, key) => {
              // Don't duplicate format in options
              if (key !== 'format' && key !== 'temperature' && key !== 'top_p' && key !== 'top_k' && key !== 'num_predict' && key !== 'num_ctx') {
                acc[key] = options[key];
              }
              return acc;
            }, {}))
          }
        };
        
        const response = await this.client.generate(requestConfig);

        const duration = Date.now() - startTime;
        console.log(`✅ Ollama response received in ${duration}ms`);

        return {
          success: true,
          response: response.response,
          model: this.model,
          duration: duration,
          totalDuration: response.total_duration,
          loadDuration: response.load_duration,
          promptEvalCount: response.prompt_eval_count,
          evalCount: response.eval_count
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Ollama error (attempt ${attempt}/${this.maxRetries}):`, error.message);
        
        // Don't retry on certain errors
        if (error.message?.includes('model not found') || error.message?.includes('invalid model')) {
          throw new Error(`Model ${this.model} not found. Please ensure it's installed in Ollama.`);
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    throw new Error(`Ollama request failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Generate embeddings for text
   * @param {string} text - The text to embed
   * @returns {Promise<array>} - The embedding vector
   */
  async generateEmbedding(text) {
    try {
      console.log(`🔢 Generating embedding for text (length: ${text.length})`);
      
      const response = await this.client.embeddings({
        model: this.model,
        prompt: text
      });

      if (!response.embedding || !Array.isArray(response.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      console.log(`✅ Embedding generated (dimension: ${response.embedding.length})`);
      return response.embedding;

    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      
      // Fallback: try with a simpler embedding model if available
      if (error.message?.includes('does not support') || error.message?.includes('embeddings')) {
        console.log('⚠️ Model does not support embeddings, trying alternative approach...');
        // You could fallback to another model or service here
        throw new Error(`Model ${this.model} does not support embeddings. Consider using an embedding-specific model.`);
      }
      
      throw error;
    }
  }

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
  parseValidationResponse(responseText, formData) {
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
        const warningLines = warningsSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        warningLines.forEach(line => {
          const cleanLine = line.replace(/^-\s*/, '').trim();
          const severityMatch = cleanLine.match(/Severity:\s*(high|medium|low)/i);
          const severity = severityMatch ? severityMatch[1].toLowerCase() : 'medium';
          const message = cleanLine.replace(/\s*-\s*Severity:\s*(high|medium|low)/i, '').trim();
          
          if (message && message.length > 5) {
            const fieldMatch = message.match(/^\[(.*?)\]:\s*(.*)/) || message.match(/^(.*?):\s*(.*)/);
            result.warnings.push({
              field: fieldMatch ? fieldMatch[1].trim() : 'general',
              message: fieldMatch ? fieldMatch[2].trim() : message,
              severity: severity
            });
          }
        });
      }

      // Extract recommendations
      const recommendationsSection = responseText.match(/RECOMMENDATIONS:([\s\S]*?)(?=MISSING_ANALYSES:|$)/i);
      if (recommendationsSection) {
        const recLines = recommendationsSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        recLines.forEach(line => {
          const cleanLine = line.replace(/^-\s*/, '').trim();
          if (cleanLine && cleanLine.length > 5) {
            result.recommendations.push(cleanLine);
          }
        });
      }

      // Extract missing analyses
      const missingSection = responseText.match(/MISSING_ANALYSES:([\s\S]*?)$/i);
      if (missingSection) {
        const missingLines = missingSection[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
        missingLines.forEach(line => {
          const cleanLine = line.replace(/^-\s*/, '').trim();
          if (cleanLine && cleanLine.length > 5) {
            result.missingAnalyses.push(cleanLine);
          }
        });
      }

      // If parsing found nothing, try a more lenient approach
      if (result.warnings.length === 0 && result.recommendations.length === 0 && result.missingAnalyses.length === 0) {
        console.log('⚠️ Structured parsing found nothing, using fallback parsing...');
        console.log('📄 Full response text for debugging:');
        console.log(responseText);
        
        // Define instruction patterns to filter out (these should NOT be included in recommendations)
        const instructionPatterns = [
          /you are (reviewing|analyzing)/i,
          /analyze the data/i,
          /respond only/i,
          /output required/i,
          /copy this format/i,
          /now analyze/i,
          /^(===|---)/,  // Section delimiters
          /^\[.*\]$/,    // Placeholder brackets like [Yes or No]
          /begin (your )?analysis/i,
          /required output format/i,
          /patient data/i,
          /important:/i,
          /do not repeat/i,
          /structured format/i,
          /medical ai assistant/i
        ];
        
        // Try to extract useful information from unstructured response
        const lines = responseText.split('\n').filter(l => l.trim().length > 10);
        
        // Add meaningful lines as recommendations
        let addedCount = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Check if line matches any instruction pattern
          const isInstruction = instructionPatterns.some(pattern => pattern.test(trimmed));
          
          // Skip empty lines, headers, instructions, and very short lines
          if (trimmed && 
              !isInstruction &&
              !trimmed.match(/^(VALIDITY|CONFIDENCE|WARNINGS|RECOMMENDATIONS|MISSING_ANALYSES):/i) &&
              trimmed.length > 20 &&  // Increased minimum length for better quality
              addedCount < 10) {
            // Remove bullet points and clean up
            const cleaned = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
            
            // Additional quality checks
            if (cleaned.length > 20 && 
                !cleaned.match(/^\[.*\]$/) &&  // Not a placeholder
                cleaned.split(' ').length >= 4) {  // At least 4 words
              result.recommendations.push(cleaned);
              addedCount++;
            }
          }
        }
        
        // If still nothing useful, add a helpful message
        if (result.recommendations.length === 0) {
          result.recommendations.push('AI analysis completed. Please review the raw response in server logs for details.');
          result.warnings.push({
            field: 'parsing',
            message: 'AI response format not recognized. Check server logs for full response.',
            severity: 'low'
          });
        }
      }

    } catch (error) {
      console.error('❌ Error parsing validation response:', error.message);
      // Return safe defaults
      result.warnings.push({
        field: 'parsing',
        message: 'Unable to fully parse AI response. Manual review recommended.',
        severity: 'medium'
      });
    }

    return result;
  }

  /**
   * Check if Ollama is available and model is installed
   * @returns {Promise<object>} - Status information
   */
  async checkHealth() {
    try {
      // Try to list available models
      const models = await this.client.list();
      const modelExists = models.models.some(m => m.name === this.model || m.name.startsWith(this.model));

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
      maxRetries: this.maxRetries
    };
  }

  /**
   * Get detailed medicine information using AI (Goosedev/medbot)
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
        temperature: 0.3, // Lower temperature for more factual responses
        num_predict: 4000,
        repeat_penalty: 1.1
      });

      console.log('\n📥 ==> RAW AI RESPONSE <==');
      console.log('─'.repeat(80));
      console.log(result.response);
      console.log('─'.repeat(80));
      console.log(`⏱️  Response Time: ${(result.duration / 1000).toFixed(2)}s\n`);

      // Parse the AI response into structured format
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
    const brandsList = medicineData.brands && medicineData.brands.length > 0
      ? medicineData.brands.map(b => b.brand_name || b.brandName).filter(Boolean).join(', ')
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
      const contraindicationsMatch = responseText.match(/CONTRAINDICATIONS:([\s\S]*?)(?=SIDE_EFFECTS:|DRUG_INTERACTIONS:|$)/i);
      if (contraindicationsMatch) {
        result.contraindications = this.extractListItems(contraindicationsMatch[1]);
      }

      // Extract side effects
      const sideEffectsMatch = responseText.match(/SIDE_EFFECTS:([\s\S]*?)(?=DRUG_INTERACTIONS:|DOSAGE_GUIDELINES:|$)/i);
      if (sideEffectsMatch) {
        result.sideEffects = this.extractListItems(sideEffectsMatch[1]);
      }

      // Extract drug interactions
      const interactionsMatch = responseText.match(/DRUG_INTERACTIONS:([\s\S]*?)(?=DOSAGE_GUIDELINES:|WARNINGS:|$)/i);
      if (interactionsMatch) {
        result.interactions = this.extractListItems(interactionsMatch[1]);
      }

      // Extract dosage guidelines
      const dosageMatch = responseText.match(/DOSAGE_GUIDELINES:([\s\S]*?)(?=WARNINGS:|MECHANISM_OF_ACTION:|$)/i);
      if (dosageMatch) {
        result.dosageGuidelines = dosageMatch[1].trim().replace(/^[-*]\s*/gm, '');
      }

      // Extract warnings
      const warningsMatch = responseText.match(/WARNINGS:([\s\S]*?)(?=MECHANISM_OF_ACTION:|$)/i);
      if (warningsMatch) {
        result.warnings = this.extractListItems(warningsMatch[1]);
      }

      // Extract mechanism of action
      const mechanismMatch = responseText.match(/MECHANISM_OF_ACTION:([\s\S]*?)$/i);
      if (mechanismMatch) {
        result.mechanismOfAction = mechanismMatch[1].trim().replace(/^[-*]\s*/gm, '');
      }

      // Fallback: if no structured data found, try to extract useful information
      if (result.indications.length === 0 && result.contraindications.length === 0 && 
          result.sideEffects.length === 0 && result.interactions.length === 0) {
        console.log('⚠️ Structured parsing found nothing, attempting fallback extraction...');
        
        // Extract any bullet points or useful information
        const lines = responseText.split('\n')
          .filter(line => line.trim().length > 10)
          .filter(line => !this.isInstructionLine(line));
        
        // Try to categorize lines based on content
        lines.forEach(line => {
          const cleaned = line.trim().replace(/^[-*•]\s*/, '');
          if (cleaned.length > 15) {
            // Simple heuristic categorization
            if (cleaned.toLowerCase().includes('treat') || cleaned.toLowerCase().includes('used for')) {
              result.indications.push(cleaned);
            } else if (cleaned.toLowerCase().includes('should not') || cleaned.toLowerCase().includes('avoid')) {
              result.contraindications.push(cleaned);
            } else if (cleaned.toLowerCase().includes('side effect') || cleaned.toLowerCase().includes('adverse')) {
              result.sideEffects.push(cleaned);
            } else if (cleaned.toLowerCase().includes('interact') || cleaned.toLowerCase().includes('with other')) {
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
    
    const lines = text.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('•'))
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
}

// Export singleton instance
export default new OllamaService();

