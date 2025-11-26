import ollamaService from './ollamaService.js';
import ragService from './ragService.js';
import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

class MedicalValidationService {
  constructor() {
    this.enabled = process.env.AI_VALIDATION_ENABLED !== 'false'; // Enabled by default
    console.log(`✅ Medical Validation Service initialized (enabled: ${this.enabled})`);
  }

  /**
   * Validate eye approval form with AI and RAG
   * @param {object} formData - Eye approval form data
   * @param {object} options - Validation options
   * @returns {Promise<object>} - Validation result
   */
  async validateEyeForm(formData, options = {}) {
    if (!this.enabled) {
      return this.getDisabledResponse();
    }

    const startTime = Date.now();
    
    try {
      console.log('🏥 Starting medical validation for eye approval form...');

      // Step 1: Retrieve relevant medical guidelines using RAG
      const guidelines = await ragService.retrieveRelevantGuidelines(formData);
      console.log(`📚 Retrieved ${guidelines.length} relevant guidelines`);

      // Step 2: Validate form using AI with retrieved context
      const validationResult = await ollamaService.validateEyeForm(formData, guidelines);
      
      // Step 3: Add additional metadata
      const duration = Date.now() - startTime;
      const enrichedResult = {
        ...validationResult,
        metadata: {
          ...validationResult.metadata,
          validationDuration: duration,
          guidelinesUsed: guidelines.length,
          timestamp: new Date().toISOString()
        }
      };

      // Step 4: Save validation result to database if form_id is provided
      if (options.saveToDatabase && options.formId) {
        await this.saveValidationResult(options.formId, formData, enrichedResult);
      }

      console.log(`✅ Validation completed in ${duration}ms`);
      return enrichedResult;

    } catch (error) {
      console.error('❌ Error in medical validation:', error.message);
      
      // Return error response with safe defaults
      return {
        isValid: true, // Default to valid on error to not block workflow
        confidenceScore: 0,
        warnings: [{
          field: 'system',
          message: `AI validation unavailable: ${error.message}`,
          severity: 'low'
        }],
        recommendations: ['Manual review recommended due to AI validation error'],
        missingAnalyses: [],
        metadata: {
          error: true,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get response when service is disabled
   * @private
   */
  getDisabledResponse() {
    return {
      isValid: true,
      confidenceScore: 0,
      warnings: [],
      recommendations: [],
      missingAnalyses: [],
      metadata: {
        enabled: false,
        message: 'AI validation is currently disabled',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Save validation result to database
   * @param {number} formId - Form ID
   * @param {object} formData - Form data
   * @param {object} validationResult - Validation result
   * @returns {Promise<object>} - Saved record
   */
  async saveValidationResult(formId, formData, validationResult) {
    try {
      const insertQuery = `
        INSERT INTO ai_validations (
          form_id,
          form_type,
          form_data,
          validation_result,
          model_used,
          confidence_score,
          validation_time_ms,
          is_valid,
          warnings_count,
          recommendations_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await query(insertQuery, [
        formId,
        'eye_approval',
        JSON.stringify(formData),
        JSON.stringify(validationResult),
        validationResult.metadata?.model || 'unknown',
        validationResult.confidenceScore || 0,
        validationResult.metadata?.validationDuration || 0,
        validationResult.isValid,
        validationResult.warnings?.length || 0,
        validationResult.recommendations?.length || 0
      ]);

      console.log(`💾 Validation result saved with ID: ${result.rows[0].id}`);
      return result.rows[0];

    } catch (error) {
      console.error('❌ Error saving validation result:', error.message);
      // Don't throw - saving is optional
      return null;
    }
  }

  /**
   * Get validation history for a form
   * @param {number} formId - Form ID
   * @param {number} limit - Maximum number of results
   * @returns {Promise<array>} - Array of validation records
   */
  async getValidationHistory(formId, limit = 10) {
    try {
      const selectQuery = `
        SELECT 
          id,
          form_id,
          form_type,
          validation_result,
          model_used,
          confidence_score,
          validation_time_ms,
          is_valid,
          warnings_count,
          recommendations_count,
          user_override,
          created_at
        FROM ai_validations
        WHERE form_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await query(selectQuery, [formId, limit]);
      return result.rows;

    } catch (error) {
      console.error('❌ Error getting validation history:', error.message);
      return [];
    }
  }

  /**
   * Mark a validation as overridden by user
   * @param {number} validationId - Validation record ID
   * @returns {Promise<boolean>} - Success status
   */
  async markAsOverridden(validationId) {
    try {
      const updateQuery = `
        UPDATE ai_validations
        SET user_override = true
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, [validationId]);
      return result.rowCount > 0;

    } catch (error) {
      console.error('❌ Error marking validation as overridden:', error.message);
      return false;
    }
  }

  /**
   * Get validation statistics
   * @param {object} filters - Optional filters (date range, form type, etc.)
   * @returns {Promise<object>} - Statistics
   */
  async getStatistics(filters = {}) {
    try {
      let whereClause = '1=1';
      const params = [];

      if (filters.startDate) {
        params.push(filters.startDate);
        whereClause += ` AND created_at >= $${params.length}`;
      }

      if (filters.endDate) {
        params.push(filters.endDate);
        whereClause += ` AND created_at <= $${params.length}`;
      }

      if (filters.formType) {
        params.push(filters.formType);
        whereClause += ` AND form_type = $${params.length}`;
      }

      const statsQuery = `
        SELECT
          COUNT(*) as total_validations,
          AVG(confidence_score) as avg_confidence,
          AVG(validation_time_ms) as avg_duration_ms,
          SUM(CASE WHEN is_valid = true THEN 1 ELSE 0 END) as valid_count,
          SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid_count,
          SUM(CASE WHEN user_override = true THEN 1 ELSE 0 END) as override_count,
          AVG(warnings_count) as avg_warnings,
          AVG(recommendations_count) as avg_recommendations
        FROM ai_validations
        WHERE ${whereClause}
      `;

      const result = await query(statsQuery, params);
      const stats = result.rows[0];

      return {
        totalValidations: parseInt(stats.total_validations),
        averageConfidence: parseFloat(stats.avg_confidence || 0).toFixed(2),
        averageDuration: parseFloat(stats.avg_duration_ms || 0).toFixed(0) + 'ms',
        validCount: parseInt(stats.valid_count),
        invalidCount: parseInt(stats.invalid_count),
        overrideCount: parseInt(stats.override_count),
        averageWarnings: parseFloat(stats.avg_warnings || 0).toFixed(1),
        averageRecommendations: parseFloat(stats.avg_recommendations || 0).toFixed(1)
      };

    } catch (error) {
      console.error('❌ Error getting statistics:', error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Perform a quick validation check (without saving to database)
   * @param {object} formData - Form data to validate
   * @returns {Promise<object>} - Validation result
   */
  async quickValidate(formData) {
    return await this.validateEyeForm(formData, { saveToDatabase: false });
  }

  /**
   * Perform a comprehensive validation (with database save)
   * @param {number} formId - Form ID
   * @param {object} formData - Form data
   * @returns {Promise<object>} - Validation result with saved record
   */
  async comprehensiveValidate(formId, formData) {
    const result = await this.validateEyeForm(formData, { 
      saveToDatabase: true,
      formId: formId
    });
    
    return result;
  }

  /**
   * Check if the service is ready
   * @returns {Promise<object>} - Status information
   */
  async checkHealth() {
    try {
      // Check Ollama health
      const ollamaHealth = await ollamaService.checkHealth();
      
      // Check RAG service (knowledge base statistics)
      const ragStats = await ragService.getStatistics();
      
      // Check database connection
      const dbCheck = await query('SELECT 1');
      
      return {
        enabled: this.enabled,
        ollama: ollamaHealth,
        knowledgeBase: ragStats,
        database: dbCheck ? 'connected' : 'disconnected',
        status: ollamaHealth.available && ragStats.totalEntries > 0 ? 'ready' : 'limited',
        message: ollamaHealth.available 
          ? 'Service is operational' 
          : 'Ollama service unavailable - validations may be limited'
      };

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return {
        enabled: this.enabled,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Enable or disable the service
   * @param {boolean} enabled - Enable/disable flag
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`🔄 Medical validation service ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Validate specific fields only
   * @param {object} formData - Form data
   * @param {array} fields - Array of field names to validate
   * @returns {Promise<object>} - Validation result for specific fields
   */
  async validateFields(formData, fields) {
    // Create a subset of form data with only specified fields
    const subsetData = {};
    fields.forEach(field => {
      if (formData[field] !== undefined) {
        subsetData[field] = formData[field];
      }
    });

    return await this.quickValidate(subsetData);
  }

  /**
   * Batch validate multiple forms
   * @param {array} forms - Array of {formId, formData}
   * @returns {Promise<array>} - Array of validation results
   */
  async batchValidate(forms) {
    const results = [];
    
    console.log(`📦 Batch validating ${forms.length} forms...`);
    
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      try {
        const result = await this.validateEyeForm(form.formData, {
          saveToDatabase: true,
          formId: form.formId
        });
        results.push({
          formId: form.formId,
          success: true,
          result: result
        });
      } catch (error) {
        console.error(`❌ Error validating form ${form.formId}:`, error.message);
        results.push({
          formId: form.formId,
          success: false,
          error: error.message
        });
      }
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${forms.length} forms validated`);
      }
    }
    
    console.log(`✅ Batch validation complete: ${results.filter(r => r.success).length}/${forms.length} successful`);
    return results;
  }
}

// Export singleton instance
export default new MedicalValidationService();

