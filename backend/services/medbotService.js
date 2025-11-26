import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Medbot Service
 * Handles medical information generation using the Goosedev/medbot model
 * Separated from ollamaService for better organization
 */
class MedbotService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = 'Goosedev/medbot';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT) || 120000;
    this.maxRetries = 3;
    
    this.client = new Ollama({
      host: this.baseUrl
    });
    
    console.log('✅ Medbot Service initialized with model: Goosedev/medbot');
  }

  /**
   * Generate a completion from the Goosedev/medbot model
   * @param {string} prompt - The prompt to send to the model
   * @param {object} options - Additional options for the completion
   * @returns {Promise<object>} - The completion response
   */
  async generateCompletion(prompt, options = {}) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🤖 Medbot request (attempt ${attempt}/${this.maxRetries})`);
        
        const response = await this.client.generate({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.3,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.num_predict || 4000,
            repeat_penalty: options.repeat_penalty || 1.1,
            ...options
          }
        });

        const duration = Date.now() - startTime;
        console.log(`✅ Medbot response received in ${duration}ms`);

        return {
          response: response.response,
          model: response.model,
          duration: duration,
          done: response.done
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Medbot request failed (attempt ${attempt}/${this.maxRetries}):`, error.message);
        
        if (attempt < this.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Medbot request failed after ${this.maxRetries} attempts: ${lastError.message}`);
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
        temperature: 0.3,
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
      console.log(`   Medication Info: ${medicineInfo.medicationInfo.genericName || 'N/A'}`);
      console.log(`   Indications: ${medicineInfo.indications.length} items`);
      console.log(`   Common Side Effects: ${medicineInfo.sideEffects.common.length} items`);
      console.log(`   Serious Side Effects: ${medicineInfo.sideEffects.serious.length} items`);
      console.log(`   Interactions: ${medicineInfo.interactions.length} items`);
      console.log(`   Full Description Length: ${result.response.length} chars`);
      if (medicineInfo.indications.length === 0 && medicineInfo.sideEffects.common.length === 0) {
        console.warn('⚠️ Minimal structured data extracted, but fullDescription is available');
      }
      console.log();
      
      return {
        ...medicineInfo,
        fullDescription: result.response, // Always include full natural language response
        metadata: {
          model: this.model,
          responseTime: `${(result.duration / 1000).toFixed(2)}s`,
          timestamp: new Date().toISOString(),
          rawResponse: result.response,
          parsingSuccess: medicineInfo.sideEffects.common.length > 0 || 
                          medicineInfo.interactions.length > 0 ||
                          medicineInfo.indications.length > 0
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

    return `Provide comprehensive pharmaceutical information about ${medicineData.activeIngredient}.

**Medication Information:**
* Generic Name: ${medicineData.activeIngredient}
* Brand Names: ${brandsList}
* Type: [oral tablet/capsule/etc]
* Pack Size: [available sizes]

**Uses:**
[List what this medicine is used for]

**Side Effects:**

Common side effects include:
* [list common side effects]

Less common but more serious side effects can include:
* [list serious side effects]

**Interactions:**

${medicineData.activeIngredient} may interact with:
* [list drug interactions]

**Price:**
[pricing information]

**Manufacturer:**
[manufacturer information]

Provide accurate, evidence-based information. Use bullet points with * for lists.`;
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
      medicationInfo: {
        genericName: '',
        brandNames: [],
        type: '',
        packSize: '',
        composition: ''
      },
      indications: [],
      contraindications: [],
      sideEffects: {
        common: [],
        serious: []
      },
      interactions: [],
      dosageGuidelines: '',
      warnings: [],
      price: '',
      manufacturer: '',
      clinicalInformation: '',
      mechanismOfAction: ''
    };

    try {
      // Extract Medication Information section (more flexible)
      const medInfoMatch = responseText.match(/\*\*Medication Information:\*\*([\s\S]*?)(?=\*\*Uses:\*\*|\*\*Side Effects:\*\*|\*\*Interactions:\*\*|$)/i);
      if (medInfoMatch) {
        const medInfo = medInfoMatch[1];
        const genericNameMatch = medInfo.match(/\*?\*?Generic Name:\*?\*?\s*(.+)/i);
        if (genericNameMatch) result.medicationInfo.genericName = genericNameMatch[1].trim();
        
        const typeMatch = medInfo.match(/\*?\*?Type:\*?\*?\s*(.+)/i);
        if (typeMatch) result.medicationInfo.type = typeMatch[1].trim();
        
        const packSizeMatch = medInfo.match(/\*?\*?Pack Size:\*?\*?\s*(.+)/i);
        if (packSizeMatch) result.medicationInfo.packSize = packSizeMatch[1].trim();
        
        const compositionMatch = medInfo.match(/\*?\*?Composition:\*?\*?\s*(.+)/i);
        if (compositionMatch) result.medicationInfo.composition = compositionMatch[1].trim();
      }

      // Extract Uses/Clinical Information/Indications (flexible section name)
      const usesMatch = responseText.match(/\*\*(?:Uses|Clinical Information|Indications):\*\*([\s\S]*?)(?=\*\*Side Effects:\*\*|\*\*Interactions:\*\*|$)/i);
      if (usesMatch) {
        const usesText = usesMatch[1].trim();
        result.clinicalInformation = usesText;
        const usesList = this.extractListItems(usesText);
        if (usesList.length > 0) {
          result.indications = usesList;
        } else {
          // If no list items, treat the whole section as indication
          const lines = usesText.split('\n').filter(l => l.trim().length > 15);
          result.indications = lines.map(l => l.trim()).filter(l => l.length > 10);
        }
      }

      // Extract Common Side Effects
      const commonSideEffectsMatch = responseText.match(/Common side effects include:([\s\S]*?)(?=Less common but more serious|Less common|$)/i);
      if (commonSideEffectsMatch) {
        result.sideEffects.common = this.extractListItems(commonSideEffectsMatch[1]);
      }

      // Extract Serious Side Effects
      const seriousSideEffectsMatch = responseText.match(/Less common but more serious side effects (?:can )?include:([\s\S]*?)(?=\*\*Interactions:\*\*|\*\*Price:\*\*|\*\*Manufacturer:\*\*|$)/i);
      if (seriousSideEffectsMatch) {
        result.sideEffects.serious = this.extractListItems(seriousSideEffectsMatch[1]);
      }

      // Extract Interactions section (more flexible)
      const interactionsMatch = responseText.match(/\*\*Interactions:\*\*([\s\S]*?)(?=\*\*Price:\*\*|\*\*Manufacturer:\*\*|\*\*Clinical|$)/i);
      if (interactionsMatch) {
        const interactionText = interactionsMatch[1];
        const interactions = this.extractListItems(interactionText);
        if (interactions.length > 0) {
          result.interactions = interactions;
        } else {
          // Try extracting the sentence after "may interact with"
          const sentenceMatch = interactionText.match(/may interact with[^:]*:([\s\S]*?)$/i);
          if (sentenceMatch) {
            result.interactions = this.extractListItems(sentenceMatch[1]);
          }
        }
      }

      // Extract Price
      const priceMatch = responseText.match(/\*\*Price:\*\*([\s\S]*?)(?=\*\*Manufacturer:\*\*|\*\*Clinical|$)/i);
      if (priceMatch) {
        result.price = priceMatch[1].trim();
      }

      // Extract Manufacturer
      const manufacturerMatch = responseText.match(/\*\*Manufacturer:\*\*([\s\S]*?)(?=\*\*|$)/i);
      if (manufacturerMatch) {
        result.manufacturer = manufacturerMatch[1].trim();
      }

      // Extract Contraindications (if separate section)
      const contraindicationsMatch = responseText.match(/\*\*Contraindications:\*\*([\s\S]*?)(?=\*\*Dosage|\*\*Warnings:\*\*|$)/i);
      if (contraindicationsMatch) {
        const text = contraindicationsMatch[1].trim();
        const contraList = this.extractListItems(text);
        if (contraList.length > 0) {
          result.contraindications = contraList;
        } else if (text.length > 0) {
          result.contraindications = [text];
        }
      }

      // Extract Dosage Guidelines
      const dosageMatch = responseText.match(/\*\*Dosage(?:\s+Guidelines)?:\*\*([\s\S]*?)(?=\*\*Warnings:\*\*|$)/i);
      if (dosageMatch) {
        result.dosageGuidelines = dosageMatch[1].trim();
      }

      // Extract Warnings
      const warningsMatch = responseText.match(/\*\*Warnings:\*\*([\s\S]*?)$/i);
      if (warningsMatch) {
        const text = warningsMatch[1].trim();
        const warnList = this.extractListItems(text);
        if (warnList.length > 0) {
          result.warnings = warnList;
        } else if (text.length > 0) {
          result.warnings = [text];
        }
      }

      // Intelligent fallback: If structured parsing found minimal data, try smart extraction
      if (result.sideEffects.common.length === 0 && 
          result.sideEffects.serious.length === 0 &&
          result.interactions.length === 0 &&
          result.indications.length === 0) {
        
        console.log('⚠️ Structured parsing found minimal data, attempting smart fallback...');
        
        // Extract ALL bullet points from the response
        const allBullets = this.extractAllBulletPoints(responseText);
        
        // Categorize bullets by context keywords
        allBullets.forEach(bullet => {
          const lowerBullet = bullet.toLowerCase();
          
          if (lowerBullet.includes('treat') || lowerBullet.includes('used for') || 
              lowerBullet.includes('relieve') || lowerBullet.includes('reduce')) {
            result.indications.push(bullet);
          } else if (lowerBullet.includes('nausea') || lowerBullet.includes('vomit') ||
                     lowerBullet.includes('pain') || lowerBullet.includes('dizz') ||
                     lowerBullet.includes('effect')) {
            if (lowerBullet.includes('serious') || lowerBullet.includes('severe') ||
                lowerBullet.includes('liver') || lowerBullet.includes('allergic')) {
              result.sideEffects.serious.push(bullet);
            } else {
              result.sideEffects.common.push(bullet);
            }
          } else if (lowerBullet.includes('interact') || lowerBullet.includes('with other') ||
                     lowerBullet.includes('warfarin') || lowerBullet.includes('antacid')) {
            result.interactions.push(bullet);
          }
        });
        
        console.log(`✅ Fallback extracted: ${allBullets.length} bullet points total`);
        console.log(`   - Indications: ${result.indications.length}`);
        console.log(`   - Common Side Effects: ${result.sideEffects.common.length}`);
        console.log(`   - Serious Side Effects: ${result.sideEffects.serious.length}`);
        console.log(`   - Interactions: ${result.interactions.length}`);
      }

    } catch (error) {
      console.error('❌ Error parsing medicine information response:', error.message);
      console.error('Response text:', responseText.substring(0, 500)); // Log first 500 chars for debugging
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
   * Extract ALL bullet points from text, regardless of section
   * @private
   */
  extractAllBulletPoints(text) {
    const bullets = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      // Match lines starting with *, -, •, or numbered lists
      if (trimmed.match(/^[\*\-•]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/)) {
        const content = trimmed.replace(/^[\*\-•\d\.]\s+/, '').trim();
        if (content.length > 10 && !this.isInstructionLine(content)) {
          bullets.push(content);
        }
      }
    });
    
    return bullets;
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

  /**
   * Health check for the Medbot service
   * @returns {Promise<object>} - Service health status
   */
  async healthCheck() {
    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: 'Health check',
        stream: false,
        options: {
          num_predict: 10
        }
      });

      return {
        status: 'healthy',
        model: this.model,
        available: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        model: this.model,
        available: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new MedbotService();

