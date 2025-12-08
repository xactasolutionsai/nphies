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
    
    // Fields to remove (read-only, computed, or NPHIES response fields)
    const fieldsToRemove = [
      'id', 'prior_auth_id', 'created_at', 'updated_at', 
      'request_date', 'response_date', 'request_bundle', 'response_bundle',
      // Joined/computed fields
      'patient_name', 'patient_identifier', 'patient_gender', 'patient_birth_date',
      'provider_name', 'provider_nphies_id', 'provider_type',
      'insurer_name', 'insurer_nphies_id',
      'item_count', 'responses',
      // NPHIES response fields
      'pre_auth_ref', 'nphies_response_id', 'nphies_response',
      'bundle_id', 'response_bundle_id', 'approved_amount', 'approved_date',
      // Additional response/adjudication fields
      'adjudication_outcome', 'eligible_amount', 'benefit_amount', 'copay_amount',
      'eligibility_offline_ref', 'sub_type', 'outcome', 'disposition',
      'nphies_request_id', 'is_nphies_generated', 'pre_auth_period_start', 'pre_auth_period_end'
    ];
    
    // Create a clean copy for duplication
    const duplicateData = { ...data };
    fieldsToRemove.forEach(field => delete duplicateData[field]);
    
    // Reset to draft status with new request number
    duplicateData.status = 'draft';
    duplicateData.request_number = `DUP-${Date.now()}`;
    
    // Clean nested items - remove IDs so new ones are generated
    if (data.items && Array.isArray(data.items)) {
      duplicateData.items = data.items.map(item => {
        const { id, item_id, prior_auth_id, created_at, updated_at, 
                adjudication_status, adjudication_amount, adjudication_reason, ...cleanItem } = item;
        return cleanItem;
      });
    }
    
    // Clean nested supporting_info - remove IDs
    if (data.supporting_info && Array.isArray(data.supporting_info)) {
      duplicateData.supporting_info = data.supporting_info.map(info => {
        const { id, info_id, prior_auth_id, created_at, updated_at, ...cleanInfo } = info;
        return cleanInfo;
      });
    }
    
    // Clean nested diagnoses - remove IDs
    if (data.diagnoses && Array.isArray(data.diagnoses)) {
      duplicateData.diagnoses = data.diagnoses.map(diag => {
        const { id, diagnosis_id, prior_auth_id, created_at, updated_at, ...cleanDiag } = diag;
        return cleanDiag;
      });
    }
    
    // Clean nested attachments - remove IDs
    if (data.attachments && Array.isArray(data.attachments)) {
      duplicateData.attachments = data.attachments.map(att => {
        const { id, attachment_id, prior_auth_id, created_at, updated_at, binary_id, ...cleanAtt } = att;
        return cleanAtt;
      });
    }
    
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

  // Claim Submissions (NPHIES Claims - use: "claim")
  async getClaimSubmissions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/claim-submissions${queryString ? `?${queryString}` : ''}`);
  }

  async getClaimSubmission(id) {
    return this.request(`/claim-submissions/${id}`);
  }

  async createClaimSubmission(data) {
    return this.request('/claim-submissions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async createClaimFromPriorAuth(paId, data = null) {
    const options = {
      method: 'POST'
    };
    if (data) {
      options.body = JSON.stringify(data);
    }
    return this.request(`/claim-submissions/from-pa/${paId}`, options);
  }

  async updateClaimSubmission(id, data) {
    return this.request(`/claim-submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteClaimSubmission(id) {
    return this.request(`/claim-submissions/${id}`, {
      method: 'DELETE'
    });
  }

  async sendClaimSubmissionToNphies(id) {
    return this.request(`/claim-submissions/${id}/send`, {
      method: 'POST'
    });
  }

  async getClaimSubmissionBundle(id) {
    return this.request(`/claim-submissions/${id}/bundle`);
  }

  async previewClaimSubmissionBundle(formData) {
    return this.request('/claim-submissions/preview', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }
}

export default new ApiService();
