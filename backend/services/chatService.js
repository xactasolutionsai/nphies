import dotenv from 'dotenv';
import { getOllamaConfig, createOllamaClient, isTimeoutError } from './ollamaConfig.js';

dotenv.config();

/**
 * Chat Service
 * Handles AI chat interactions with streaming support
 * Supports two modes: drug (CHAT_DRUG_MODEL, default Goosedev/medbot) and general (OLLAMA_MODEL)
 */
class ChatService {
  constructor() {
    const { baseUrl, timeoutMs, configError } = getOllamaConfig();
    this.baseUrl = baseUrl;
    this.configError = configError;
    this.drugModel = process.env.CHAT_DRUG_MODEL || 'Goosedev/medbot';
    this.generalModel = process.env.OLLAMA_MODEL || 'thewindmom/llama3-med42-8b:latest';
    // Upper bound for a whole chat exchange; the stream is aborted when it expires.
    this.timeout = timeoutMs;
    
    this.client = createOllamaClient({ baseUrl, timeoutMs });
    
    if (configError) console.error(`❌ Chat Service disabled: ${configError.message}`);
    console.log('✅ Chat Service initialized');
    console.log(`   Drug Model: ${this.drugModel}`);
    console.log(`   General Model: ${this.generalModel}`);
  }

  /**
   * Get system prompt based on mode
   * @param {string} mode - 'drug' or 'general'
   * @returns {string} - System prompt
   */
  getSystemPrompt(mode) {
    if (mode === 'drug') {
      return `You are a knowledgeable pharmaceutical AI assistant. Provide accurate, evidence-based information about medications, dosages, drug interactions, side effects, and pharmaceutical guidance. Use clear language and always remind users to consult their healthcare provider for personalized medical advice.`;
    } else {
      return `You are a helpful medical AI assistant. Provide clear, accurate information about medical conditions, symptoms, health information, and when to seek medical attention. Use accessible language and always recommend users consult healthcare professionals for diagnosis and treatment.`;
    }
  }

  /**
   * Get model based on mode
   * @param {string} mode - 'drug' or 'general'
   * @returns {string} - Model name
   */
  getModelForMode(mode) {
    return mode === 'drug' ? this.drugModel : this.generalModel;
  }

  /**
   * Build conversation context from history
   * @param {Array} conversationHistory - Array of previous messages
   * @param {string} systemPrompt - System prompt for the mode
   * @returns {string} - Formatted prompt with context
   */
  buildPromptWithContext(currentMessage, conversationHistory = [], systemPrompt) {
    // Filter out system messages (mode changes)
    const relevantHistory = conversationHistory
      .filter(msg => msg.role !== 'system')
      .slice(-10); // Last 10 messages (5 turns)
    
    let prompt = `${systemPrompt}\n\n`;
    
    if (relevantHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      relevantHistory.forEach(msg => {
        if (msg.role === 'user') {
          prompt += `Human: ${msg.content}\n`;
        } else {
          prompt += `Assistant: ${msg.content}\n`;
        }
      });
      prompt += '\n';
    }
    
    prompt += `Human: ${currentMessage}\n\nAssistant:`;
    
    return prompt;
  }

  /**
   * Stream chat response
   * @param {string} message - User message
   * @param {string} mode - 'drug' or 'general'
   * @param {Array} conversationHistory - Previous messages
   * @param {Function} onChunk - Callback for each chunk
   * @param {Function} onComplete - Callback when complete
   * @param {Function} onError - Callback for errors
   */
  async streamChat(message, mode, conversationHistory = [], onChunk, onComplete, onError) {
    const model = this.getModelForMode(mode);
    const systemPrompt = this.getSystemPrompt(mode);
    const prompt = this.buildPromptWithContext(message, conversationHistory, systemPrompt);
    
    console.log(`\n💬 ==> CHAT REQUEST <==`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🎯 Mode: ${mode}`);
    console.log(`🤖 Model: ${model}`);
    console.log(`💭 Message length: ${message.length}`);
    console.log(`📚 History: ${conversationHistory.length} messages\n`);
    
    try {
      if (this.configError) throw this.configError;
      const stream = await this.client.generate({
        model: model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: mode === 'drug' ? 0.4 : 0.6,
          top_p: 0.9,
          top_k: 40,
          num_predict: 3000, // Increased for more complete responses
          repeat_penalty: 1.2,
          stop: ['Human:', 'User:', '\nHuman:', '\nUser:', '<|im_end|>'] // Stop sequences
        }
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        if (chunk.response) {
          // Filter out special tokens that shouldn't be visible
          let cleanedChunk = chunk.response
            .replace(/<\|im_end\|>/g, '')
            .replace(/<\|im_start\|>/g, '')
            .replace(/<\|system\|>/g, '')
            .replace(/<\|user\|>/g, '')
            .replace(/<\|assistant\|>/g, '');
          
          if (cleanedChunk) {
            fullResponse += cleanedChunk;
            onChunk(cleanedChunk);
          }
        }
        
        if (chunk.done) {
          console.log(`✅ Chat streaming completed (${fullResponse.length} chars)`);
          onComplete(fullResponse.trim());
        }
      }
      
    } catch (error) {
      const reported = isTimeoutError(error)
        ? new Error(`Chat response timed out after ${this.timeout}ms`)
        : error;
      console.error('❌ Error in chat streaming:', reported.message);
      onError(reported);
    }
  }

  /**
   * Check health of both models
   * @returns {Promise<object>} - Health status
   */
  async checkHealth() {
    try {
      if (this.configError) throw this.configError;
      const models = await this.client.list();
      const drugModelAvailable = models.models.some(m => 
        m.name === this.drugModel || m.name.includes('medbot')
      );
      const generalModelAvailable = models.models.some(m => 
        m.name === this.generalModel || m.name.includes('biomistral')
      );

      return {
        available: true,
        drugModel: {
          name: this.drugModel,
          available: drugModelAvailable
        },
        generalModel: {
          name: this.generalModel,
          available: generalModelAvailable
        },
        allModelsReady: drugModelAvailable && generalModelAvailable
      };

    } catch (error) {
      console.error('❌ Chat service health check failed:', error.message);
      return {
        available: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new ChatService();

