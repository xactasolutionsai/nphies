import { query } from '../db.js';
import ollamaService from './ollamaService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Expected embedding dimension of the pgvector columns. It must match both the
 * embedding model (OLLAMA_EMBED_MODEL) and the vector(N) column definitions.
 */
export function resolveEmbeddingDimension(env = process.env) {
  const value = parseInt(env.EMBEDDING_DIM, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

class RAGService {
  constructor() {
    // null = not configured: any dimension returned by the model is accepted and
    // the database column type is the final check.
    this.embeddingDimension = resolveEmbeddingDimension();
    this.similarityThreshold = 0.7;
    this.maxRetrievalResults = 5;
    
    console.log('✅ RAG Service initialized');
  }

  /**
   * Generate embedding for text using Ollama.
   * There is deliberately no fallback: a made-up (e.g. hash-based) vector would be
   * stored or compared as if it were a real embedding and silently corrupt search.
   * @param {string} text - Text to embed
   * @returns {Promise<array>} - Embedding vector
   * @throws {Error} when no real embedding can be produced
   */
  async generateEmbedding(text) {
    let embedding;
    try {
      embedding = await ollamaService.generateEmbedding(text);
    } catch (error) {
      throw new Error(`Embedding generation failed (model ${ollamaService.embeddingModel}): ${error.message}`);
    }

    if (!Array.isArray(embedding) || embedding.length === 0 ||
        !embedding.every(v => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Embedding generation failed: the model returned an invalid vector');
    }
    if (this.embeddingDimension && embedding.length !== this.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch: model ${ollamaService.embeddingModel} returned ${embedding.length}, ` +
        `EMBEDDING_DIM is ${this.embeddingDimension}`
      );
    }
    return embedding;
  }

  /**
   * Store medical knowledge with embedding
   * @param {string} content - The medical guideline/knowledge content
   * @param {object} metadata - Additional metadata (title, source, etc.)
   * @param {string} category - Category of the knowledge
   * @returns {Promise<object>} - Inserted record
   */
  async storeKnowledge(content, metadata = {}, category = 'general') {
    try {
      console.log(`📝 Storing knowledge: ${content.substring(0, 50)}...`);
      
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(content);
      
      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${embedding.join(',')}]`;
      
      // Insert into database
      const insertQuery = `
        INSERT INTO medical_knowledge (content, embedding, metadata, source, category)
        VALUES ($1, $2::vector, $3, $4, $5)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        content,
        vectorString,
        JSON.stringify(metadata),
        metadata.source || 'manual',
        category
      ]);
      
      console.log(`✅ Knowledge stored with ID: ${result.rows[0].id}`);
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Error storing knowledge:', error.message);
      throw error;
    }
  }

  /**
   * Store multiple knowledge entries in batch
   * @param {array} knowledgeItems - Array of {content, metadata, category}
   * @returns {Promise<array>} - Array of inserted records
   */
  async storeBatchKnowledge(knowledgeItems) {
    const results = [];
    
    console.log(`📦 Storing ${knowledgeItems.length} knowledge items in batch...`);
    
    for (let i = 0; i < knowledgeItems.length; i++) {
      const item = knowledgeItems[i];
      try {
        const result = await this.storeKnowledge(
          item.content,
          item.metadata || {},
          item.category || 'general'
        );
        results.push(result);
        
        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`📊 Progress: ${i + 1}/${knowledgeItems.length} items stored`);
        }
        
      } catch (error) {
        console.error(`❌ Error storing item ${i + 1}:`, error.message);
        // Continue with next item
      }
    }
    
    console.log(`✅ Batch storage complete: ${results.length}/${knowledgeItems.length} successful`);
    return results;
  }

  /**
   * Search for relevant medical knowledge using semantic similarity
   * @param {string} queryText - The query text
   * @param {number} limit - Maximum number of results
   * @param {string} category - Optional category filter
   * @returns {Promise<array>} - Array of relevant knowledge items
   */
  async searchKnowledge(queryText, limit = null, category = null) {
    try {
      console.log(`🔍 Searching knowledge: "${queryText.substring(0, 50)}..."`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      const vectorString = `[${queryEmbedding.join(',')}]`;
      
      // Build the SQL query with vector similarity search
      let sqlQuery = `
        SELECT 
          id,
          content,
          metadata,
          source,
          category,
          1 - (embedding <=> $1::vector) as similarity
        FROM medical_knowledge
        WHERE 1=1
      `;
      
      const params = [vectorString];
      let paramIndex = 2;
      
      // Add category filter if provided
      if (category) {
        sqlQuery += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }
      
      // Order by similarity and limit results
      sqlQuery += ` ORDER BY embedding <=> $1::vector`;
      
      const resultLimit = limit || this.maxRetrievalResults;
      sqlQuery += ` LIMIT $${paramIndex}`;
      params.push(resultLimit);
      
      const result = await query(sqlQuery, params);
      
      console.log(`✅ Found ${result.rows.length} relevant knowledge items`);
      
      // Filter by similarity threshold and return
      return result.rows
        .filter(row => row.similarity >= this.similarityThreshold)
        .map(row => ({
          id: row.id,
          content: row.content,
          metadata: row.metadata,
          source: row.source,
          category: row.category,
          similarity: parseFloat(row.similarity)
        }));
      
    } catch (error) {
      console.error('❌ Error searching knowledge:', error.message);
      // Return empty array on error to allow graceful degradation
      return [];
    }
  }

  /**
   * Generate context from form data for retrieval
   * @param {object} formData - Eye approval form data
   * @returns {string} - Context string for RAG retrieval
   */
  generateFormContext(formData) {
    const contextParts = [];
    
    // Add symptoms and complaints
    if (formData.chief_complaints) {
      contextParts.push(`Chief complaints: ${formData.chief_complaints}`);
    }
    
    if (formData.significant_signs) {
      contextParts.push(`Significant signs: ${formData.significant_signs}`);
    }
    
    // Add prescription information
    if (formData.right_eye_specs) {
      const rightEye = formData.right_eye_specs;
      if (rightEye.distance) {
        const sphere = rightEye.distance.sphere;
        const cylinder = rightEye.distance.cylinder;
        if (sphere || cylinder) {
          contextParts.push(`Right eye prescription: sphere ${sphere}, cylinder ${cylinder}`);
        }
      }
    }
    
    if (formData.left_eye_specs) {
      const leftEye = formData.left_eye_specs;
      if (leftEye.distance) {
        const sphere = leftEye.distance.sphere;
        const cylinder = leftEye.distance.cylinder;
        if (sphere || cylinder) {
          contextParts.push(`Left eye prescription: sphere ${sphere}, cylinder ${cylinder}`);
        }
      }
    }
    
    // Add lens specifications
    if (formData.lens_type) {
      contextParts.push(`Lens type: ${formData.lens_type}`);
    }
    
    // Add procedures
    if (formData.procedures && formData.procedures.length > 0) {
      const procDescriptions = formData.procedures
        .map(p => p.service_description)
        .filter(d => d)
        .join(', ');
      if (procDescriptions) {
        contextParts.push(`Procedures: ${procDescriptions}`);
      }
    }
    
    // Add age-related context
    if (formData.age) {
      contextParts.push(`Patient age: ${formData.age}`);
    }
    
    // Add duration of illness
    if (formData.duration_of_illness_days) {
      contextParts.push(`Duration of illness: ${formData.duration_of_illness_days} days`);
    }
    
    return contextParts.join('. ');
  }

  /**
   * Retrieve relevant guidelines for form validation
   * @param {object} formData - Eye approval form data
   * @returns {Promise<array>} - Array of relevant guidelines
   */
  async retrieveRelevantGuidelines(formData) {
    try {
      // Generate context from form data
      const context = this.generateFormContext(formData);
      
      if (!context || context.trim().length === 0) {
        console.log('⚠️ No context generated from form data, using generic query');
        return await this.searchKnowledge('eye examination ophthalmology guidelines', 3);
      }
      
      console.log(`📋 Generated context: ${context.substring(0, 100)}...`);
      
      // Search for relevant knowledge
      const guidelines = await this.searchKnowledge(context, this.maxRetrievalResults, 'ophthalmology');
      
      // If no specific guidelines found, search more broadly
      if (guidelines.length === 0) {
        console.log('⚠️ No specific guidelines found, searching broadly...');
        return await this.searchKnowledge('eye examination optical prescription', this.maxRetrievalResults);
      }
      
      return guidelines;
      
    } catch (error) {
      console.error('❌ Error retrieving guidelines:', error.message);
      return [];
    }
  }

  /**
   * Delete knowledge by ID
   * @param {number} id - Knowledge ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteKnowledge(id) {
    try {
      const result = await query('DELETE FROM medical_knowledge WHERE id = $1', [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('❌ Error deleting knowledge:', error.message);
      return false;
    }
  }

  /**
   * Get knowledge statistics
   * @returns {Promise<object>} - Statistics about the knowledge base
   */
  async getStatistics() {
    try {
      const totalQuery = 'SELECT COUNT(*) as total FROM medical_knowledge';
      const categoryQuery = 'SELECT category, COUNT(*) as count FROM medical_knowledge GROUP BY category';
      
      const [totalResult, categoryResult] = await Promise.all([
        query(totalQuery),
        query(categoryQuery)
      ]);
      
      return {
        totalEntries: parseInt(totalResult.rows[0].total),
        categories: categoryResult.rows.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {}),
        embeddingDimension: this.embeddingDimension,
        similarityThreshold: this.similarityThreshold
      };
      
    } catch (error) {
      console.error('❌ Error getting statistics:', error.message);
      return {
        totalEntries: 0,
        categories: {},
        error: error.message
      };
    }
  }

  /**
   * Update configuration
   * @param {object} config - Configuration object
   */
  updateConfig(config) {
    if (config.similarityThreshold !== undefined) {
      this.similarityThreshold = config.similarityThreshold;
      console.log(`📊 Updated similarity threshold: ${this.similarityThreshold}`);
    }
    
    if (config.maxRetrievalResults !== undefined) {
      this.maxRetrievalResults = config.maxRetrievalResults;
      console.log(`📊 Updated max retrieval results: ${this.maxRetrievalResults}`);
    }
  }

  /**
   * Get current configuration
   * @returns {object} - Current configuration
   */
  getConfig() {
    return {
      embeddingDimension: this.embeddingDimension,
      similarityThreshold: this.similarityThreshold,
      maxRetrievalResults: this.maxRetrievalResults
    };
  }
}

// Export singleton instance
export default new RAGService();

