const API_BASE_URL = 'http://localhost:8001/api';

// Request throttling and caching
const requestQueue = new Map();
const cache = new Map();
const REQUEST_DELAY = 100; // 100ms delay between requests
const CACHE_DURATION = 30000; // 30 seconds cache

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Throttle requests to prevent rate limiting
    const now = Date.now();
    const lastRequest = requestQueue.get(url) || 0;
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
    }
    
    requestQueue.set(url, Date.now());

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 429) {
          // If rate limited, wait and retry once
          console.warn('Rate limited, waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryResponse = await fetch(url, config);
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            const error = new Error(`HTTP error! status: ${retryResponse.status}`);
            error.response = { status: retryResponse.status, data: errorData };
            throw error;
          }
          const data = await retryResponse.json();
          cache.set(cacheKey, { data, timestamp: Date.now() });
          return data;
        }
        // Parse error response and attach to error
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }
      
      const data = await response.json();
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Patients
  async getPatients(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/patients${queryString ? `?${queryString}` : ''}`);
  }

  async getPatient(id) {
    return this.request(`/patients/${id}`);
  }

  // Providers
  async getProviders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/providers${queryString ? `?${queryString}` : ''}`);
  }

  async getProvider(id) {
    return this.request(`/providers/${id}`);
  }

  // Insurers
  async getInsurers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/insurers${queryString ? `?${queryString}` : ''}`);
  }

  async getInsurer(id) {
    return this.request(`/insurers/${id}`);
  }

  // Authorizations
  async getAuthorizations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/authorizations${queryString ? `?${queryString}` : ''}`);
  }

  async getAuthorization(id) {
    return this.request(`/authorizations/${id}`);
  }

  // Eligibility
  async getEligibility(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/eligibility${queryString ? `?${queryString}` : ''}`);
  }

  async getEligibilityRecord(id) {
    return this.request(`/eligibility/${id}`);
  }

  // Claims
  async getClaims(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/claims${queryString ? `?${queryString}` : ''}`);
  }

  async getClaim(id) {
    return this.request(`/claims/${id}`);
  }

  // Claim Batches
  async getClaimBatches(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/claim-batches${queryString ? `?${queryString}` : ''}`);
  }

  async getClaimBatch(id) {
    return this.request(`/claim-batches/${id}`);
  }

  // Payments
  async getPayments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/payments${queryString ? `?${queryString}` : ''}`);
  }

  async getPayment(id) {
    return this.request(`/payments/${id}`);
  }

  // Dashboard statistics
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Standard Approvals
  async getStandardApprovals(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/standard-approvals${queryString ? `?${queryString}` : ''}`);
  }

  async getStandardApproval(id) {
    return this.request(`/standard-approvals/${id}`);
  }

  async createStandardApproval(data) {
    return this.request('/standard-approvals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateStandardApproval(id, data) {
    return this.request(`/standard-approvals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteStandardApproval(id) {
    return this.request(`/standard-approvals/${id}`, {
      method: 'DELETE'
    });
  }

  // Dental Approvals
  async getDentalApprovals(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/dental-approvals${queryString ? `?${queryString}` : ''}`);
  }

  async getDentalApproval(id) {
    return this.request(`/dental-approvals/${id}`);
  }

  async createDentalApproval(data) {
    return this.request('/dental-approvals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDentalApproval(id, data) {
    return this.request(`/dental-approvals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteDentalApproval(id) {
    return this.request(`/dental-approvals/${id}`, {
      method: 'DELETE'
    });
  }

  // Eye Approvals
  async getEyeApprovals(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/eye-approvals${queryString ? `?${queryString}` : ''}`);
  }

  async getEyeApproval(id) {
    return this.request(`/eye-approvals/${id}`);
  }

  async createEyeApproval(data) {
    return this.request('/eye-approvals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateEyeApproval(id, data) {
    return this.request(`/eye-approvals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteEyeApproval(id) {
    return this.request(`/eye-approvals/${id}`, {
      method: 'DELETE'
    });
  }

  // General Requests
  async getGeneralRequests(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/general-requests${queryString ? `?${queryString}` : ''}`);
  }

  async getGeneralRequest(id) {
    return this.request(`/general-requests/${id}`);
  }

  async createGeneralRequest(data) {
    return this.request('/general-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateGeneralRequest(id, data) {
    return this.request(`/general-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteGeneralRequest(id) {
    return this.request(`/general-requests/${id}`, {
      method: 'DELETE'
    });
  }

  // Search functionality
  async search(query, entity) {
    return this.request(`/search?q=${encodeURIComponent(query)}&entity=${entity}`);
  }

  // NPHIES Eligibility Methods
  async checkNphiesEligibility(data) {
    return this.request('/eligibility/check-nphies', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Check eligibility using dynamic data (supports manual entry or existing records)
   * Uses UPSERT logic to store patient, insurer, and coverage data
   * @param {Object} data - Request data with patientId/patientData, insurerId/insurerData, coverageId/coverageData
   */
  async checkDynamicEligibility(data) {
    return this.request('/eligibility/check-dynamic', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Preview the FHIR bundle that would be sent to NPHIES
   * Does NOT send the request, only builds and returns the bundle
   * @param {Object} data - Same structure as checkDynamicEligibility
   */
  async previewEligibilityRequest(data) {
    return this.request('/eligibility/preview', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getNphiesEligibilityDetails(id) {
    return this.request(`/eligibility/${id}/nphies-details`);
  }

  async getPatientCoverages(patientId) {
    return this.request(`/eligibility/patient/${patientId}/coverages`);
  }

  // Prior Authorizations (NPHIES-compliant)
  async getPriorAuthorizations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/prior-authorizations${queryString ? `?${queryString}` : ''}`);
  }

  async getPriorAuthorization(id) {
    return this.request(`/prior-authorizations/${id}`);
  }

  async createPriorAuthorization(data) {
    return this.request('/prior-authorizations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updatePriorAuthorization(id, data) {
    return this.request(`/prior-authorizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deletePriorAuthorization(id) {
    return this.request(`/prior-authorizations/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Duplicate a prior authorization with a new ID
   * Fetches the original, strips ID-specific fields, and creates a new draft
   */
  async duplicatePriorAuthorization(id) {
    // Fetch the original prior authorization
    const original = await this.getPriorAuthorization(id);
    const data = original.data || original;
    
    // Create a copy without ID-specific fields
    const duplicateData = {
      ...data,
      // Reset status to draft
      status: 'draft',
      // Generate new request number with timestamp
      request_number: `DUP-${Date.now()}`,
      // Clear NPHIES-specific response fields
      pre_auth_ref: null,
      nphies_response_id: null,
      nphies_response: null,
      bundle_id: null,
      response_bundle_id: null,
      // Update dates
      request_date: new Date().toISOString().split('T')[0],
      created_at: undefined,
      updated_at: undefined
    };
    
    // Remove the original ID so a new one is generated
    delete duplicateData.id;
    delete duplicateData.prior_auth_id;
    
    // Create the duplicate
    return this.createPriorAuthorization(duplicateData);
  }

  // Prior Authorization NPHIES Workflow Operations
  async sendPriorAuthorizationToNphies(id) {
    return this.request(`/prior-authorizations/${id}/send`, {
      method: 'POST'
    });
  }

  async submitPriorAuthorizationUpdate(id, data = {}) {
    return this.request(`/prior-authorizations/${id}/update`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async cancelPriorAuthorization(id, reason) {
    return this.request(`/prior-authorizations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async transferPriorAuthorization(id, transferProviderId, reason) {
    return this.request(`/prior-authorizations/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ transfer_provider_id: transferProviderId, reason })
    });
  }

  async pollPriorAuthorizationResponse(id) {
    return this.request(`/prior-authorizations/${id}/poll`);
  }

  async getPriorAuthorizationBundle(id) {
    return this.request(`/prior-authorizations/${id}/bundle`);
  }

  /**
   * Preview the FHIR bundle that would be sent to NPHIES (without saving)
   * @param {Object} formData - Form data for the prior authorization
   */
  async previewPriorAuthorizationBundle(formData) {
    return this.request('/prior-authorizations/preview', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }

  /**
   * Test send the FHIR bundle to NPHIES for validation (without saving to DB)
   * @param {Object} formData - Form data for the prior authorization
   */
  async testSendPriorAuthorization(formData) {
    return this.request('/prior-authorizations/test-send', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }
}

export default new ApiService();
