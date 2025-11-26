const API_BASE_URL = 'http://localhost:8001/api';

class AIValidationService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/ai-validation`;
    this.enabled = import.meta.env.VITE_AI_VALIDATION_ENABLED !== 'false';
  }

  /**
   * Make a request to the AI validation API
   * @private
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('AI Validation API Error:', error);
      throw error;
    }
  }

  /**
   * Validate an eye approval form
   * @param {object} formData - Form data to validate
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Validation result
   */
  async validateForm(formData, options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'AI validation is disabled',
        data: {
          isValid: true,
          confidenceScore: 0,
          warnings: [],
          recommendations: [],
          missingAnalyses: [],
          metadata: { enabled: false }
        }
      };
    }

    try {
      const response = await this.request('/validate-eye-form', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          saveToDatabase: options.saveToDatabase !== false,
          formId: options.formId || null
        })
      });

      return response;

    } catch (error) {
      console.error('Error validating form:', error);
      
      // Return a graceful fallback response
      return {
        success: false,
        error: error.message,
        data: {
          isValid: true, // Default to valid on error
          confidenceScore: 0,
          warnings: [{
            field: 'system',
            message: `AI validation temporarily unavailable: ${error.message}`,
            severity: 'low'
          }],
          recommendations: ['Manual review recommended due to AI validation error'],
          missingAnalyses: [],
          metadata: {
            error: true,
            errorMessage: error.message
          }
        }
      };
    }
  }

  /**
   * Get validation history for a form
   * @param {number} formId - Form ID
   * @param {number} limit - Maximum number of records
   * @returns {Promise<array>} - Validation history
   */
  async getValidationHistory(formId, limit = 10) {
    try {
      const response = await this.request(`/history/${formId}?limit=${limit}`, {
        method: 'GET'
      });

      return response.data || [];

    } catch (error) {
      console.error('Error getting validation history:', error);
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
      const response = await this.request(`/override/${validationId}`, {
        method: 'POST'
      });

      return response.success === true;

    } catch (error) {
      console.error('Error marking validation as overridden:', error);
      return false;
    }
  }

  /**
   * Get validation statistics
   * @param {object} filters - Optional filters
   * @returns {Promise<object>} - Statistics
   */
  async getStatistics(filters = {}) {
    try {
      const params = new URLSearchParams(filters).toString();
      const endpoint = params ? `/statistics?${params}` : '/statistics';
      
      const response = await this.request(endpoint, {
        method: 'GET'
      });

      return response.data || {};

    } catch (error) {
      console.error('Error getting statistics:', error);
      return {};
    }
  }

  /**
   * Check AI validation service health
   * @returns {Promise<object>} - Health status
   */
  async checkHealth() {
    try {
      const response = await this.request('/health', {
        method: 'GET'
      });

      return response.data || { status: 'unknown' };

    } catch (error) {
      console.error('Error checking health:', error);
      return {
        status: 'error',
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Search medical knowledge base
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @param {string} category - Optional category filter
   * @returns {Promise<array>} - Search results
   */
  async searchKnowledge(query, limit = 5, category = null) {
    try {
      const response = await this.request('/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit, category })
      });

      return response.data || [];

    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  /**
   * Get knowledge base statistics
   * @returns {Promise<object>} - Knowledge base stats
   */
  async getKnowledgeStats() {
    try {
      const response = await this.request('/knowledge/stats', {
        method: 'GET'
      });

      return response.data || {};

    } catch (error) {
      console.error('Error getting knowledge stats:', error);
      return {};
    }
  }

  /**
   * Check if AI validation is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Enable or disable the service
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Export singleton instance
const aiValidationService = new AIValidationService();
export default aiValidationService;

