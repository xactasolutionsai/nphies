const API_BASE_URL = 'http://localhost:8001/api';

// Request throttling and caching
const requestQueue = new Map();
const cache = new Map();
const REQUEST_DELAY = 100; // 100ms delay between requests
const CACHE_DURATION = 30000; // 30 seconds cache

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    
    // Only cache GET requests - POST/PUT/DELETE should always be fresh
    // This fixes the issue where AI validation returns stale cached results
    const shouldCache = method === 'GET' && !endpoint.includes('/validate') && !endpoint.includes('/ai-validation');
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // Check cache first (only for cacheable requests)
    if (shouldCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
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
          if (shouldCache) {
            cache.set(cacheKey, { data, timestamp: Date.now() });
          }
          return data;
        }
        // Parse error response and attach to error
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }
      
      const data = await response.json();
      if (shouldCache) {
        cache.set(cacheKey, { data, timestamp: Date.now() });
      }
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

  // Payment Reconciliations (nphies)
  async getPaymentReconciliations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/payment-reconciliation${queryString ? `?${queryString}` : ''}`);
  }

  async getPaymentReconciliation(id) {
    return this.request(`/payment-reconciliation/${id}`);
  }

  async getPaymentReconciliationStats() {
    return this.request('/payment-reconciliation/stats');
  }

  async getPaymentReconciliationsForClaim(claimId) {
    return this.request(`/payment-reconciliation/claim/${claimId}`);
  }

  async getPaymentReconciliationBundle(id) {
    return this.request(`/payment-reconciliation/${id}/bundle`);
  }

  /**
   * Simulate a payment reconciliation from an approved claim (for testing)
   * @param {number|string} claimId - The claim ID to simulate payment for
   */
  async simulatePaymentReconciliation(claimId) {
    return this.request(`/payment-reconciliation/simulate/${claimId}`, {
      method: 'POST'
    });
  }

  /**
   * Poll NPHIES for pending PaymentReconciliation messages
   * @param {string} providerId - Optional provider ID to poll for
   */
  async pollPaymentReconciliations(providerId = null) {
    return this.request('/payment-reconciliation/poll', {
      method: 'POST',
      body: JSON.stringify({ providerId })
    });
  }

  /**
   * Preview the PaymentReconciliation bundle that would be generated (without saving)
   * @param {number|string} claimId - The claim ID to preview payment for
   */
  async previewSimulatePaymentReconciliation(claimId) {
    return this.request(`/payment-reconciliation/preview-simulate/${claimId}`);
  }

  /**
   * Preview the poll request bundle (without sending)
   * @param {string} providerId - Optional provider ID
   */
  async previewPollPaymentReconciliation(providerId = null) {
    const params = providerId ? `?providerId=${providerId}` : '';
    return this.request(`/payment-reconciliation/preview-poll${params}`);
  }

  // Send Payment Notice acknowledgement to NPHIES
  async sendPaymentNoticeAcknowledgement(reconciliationId) {
    return this.request(`/payment-reconciliation/${reconciliationId}/acknowledge`, {
      method: 'POST'
    });
  }

  // Preview Payment Notice bundle (without sending)
  async previewPaymentNotice(reconciliationId) {
    return this.request(`/payment-reconciliation/${reconciliationId}/preview-acknowledge`);
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

  async getCoverages(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/coverages${queryString ? `?${queryString}` : ''}`);
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
    return this.request(`/prior-authorizations/${id}/poll`, {
      method: 'POST'
    });
  }

  /**
   * Preview the poll bundle that would be sent to NPHIES (without actually polling)
   * @param {number} id - Prior Authorization ID
   */
  async previewPollBundle(id) {
    return this.request(`/prior-authorizations/${id}/poll/preview`);
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

  // ============================================================================
  // NPHIES COMMUNICATION METHODS
  // ============================================================================

  /**
   * Send UNSOLICITED Communication (Test Case #1)
   * HCP proactively sends additional information to HIC for a pended authorization
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} payloads[].contentType - 'string', 'attachment', or 'reference'
   * @param {string} payloads[].contentString - Free text content (for contentType='string')
   * @param {Object} payloads[].attachment - Attachment object (for contentType='attachment')
   * @param {number[]} payloads[].claimItemSequences - Array of item sequence numbers this relates to
   */
  async sendUnsolicitedCommunication(priorAuthId, payloads) {
    return this.request(`/prior-authorizations/${priorAuthId}/communication/unsolicited`, {
      method: 'POST',
      body: JSON.stringify({ payloads })
    });
  }

  /**
   * Preview Communication bundle without sending
   * Returns the exact FHIR bundle that would be sent to NPHIES
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {Array} payloads - Payload objects
   * @param {string} type - 'unsolicited' or 'solicited'
   * @param {number} communicationRequestId - For solicited type
   */
  async previewCommunicationBundle(priorAuthId, payloads, type = 'unsolicited', communicationRequestId = null) {
    return this.request(`/prior-authorizations/${priorAuthId}/communication/preview`, {
      method: 'POST',
      body: JSON.stringify({ payloads, type, communicationRequestId })
    });
  }

  /**
   * Send SOLICITED Communication (Test Case #2)
   * HCP responds to CommunicationRequest from HIC with additional information/attachments
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {number} communicationRequestId - CommunicationRequest ID to respond to
   * @param {Array} payloads - Array of payload objects (typically attachments)
   */
  async sendSolicitedCommunication(priorAuthId, communicationRequestId, payloads) {
    return this.request(`/prior-authorizations/${priorAuthId}/communication/solicited`, {
      method: 'POST',
      body: JSON.stringify({ communicationRequestId, payloads })
    });
  }

  /**
   * Get CommunicationRequests from HIC for a Prior Authorization
   * These are requests from the insurer asking for additional information
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {boolean} pendingOnly - If true, only return unanswered requests
   */
  async getCommunicationRequests(priorAuthId, pendingOnly = false) {
    const params = pendingOnly ? '?pending=true' : '';
    return this.request(`/prior-authorizations/${priorAuthId}/communication-requests${params}`);
  }

  /**
   * Get sent Communications for a Prior Authorization
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   */
  async getCommunications(priorAuthId) {
    return this.request(`/prior-authorizations/${priorAuthId}/communications`);
  }

  /**
   * Get a single Communication by ID
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {number} communicationId - Communication ID
   */
  async getCommunication(priorAuthId, communicationId) {
    return this.request(`/prior-authorizations/${priorAuthId}/communications/${communicationId}`);
  }

  /**
   * Poll for acknowledgment of a specific Communication
   * Use when communication has acknowledgment_status = 'queued'
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {string} communicationId - Communication UUID
   */
  async pollCommunicationAcknowledgment(priorAuthId, communicationId) {
    return this.request(`/prior-authorizations/${priorAuthId}/communications/${communicationId}/poll-acknowledgment`, {
      method: 'POST'
    });
  }

  /**
   * Poll for all queued acknowledgments for a Prior Authorization
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   */
  async pollAllQueuedAcknowledgments(priorAuthId) {
    return this.request(`/prior-authorizations/${priorAuthId}/communications/poll-all-acknowledgments`, {
      method: 'POST'
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

  // ICD-10 Codes
  /**
   * Search ICD-10 codes for async dropdown
   * Returns array of { value, label } for react-select
   * @param {string} searchTerm - Search term to filter codes
   * @param {number} limit - Max results (default 50)
   */
  async searchIcd10Codes(searchTerm = '', limit = 50) {
    const params = new URLSearchParams();
    if (searchTerm) params.append('q', searchTerm);
    params.append('limit', limit.toString());
    return this.request(`/nphies-codes/icd10/search?${params.toString()}`);
  }

  /**
   * Get ICD-10 codes with full pagination support
   * @param {Object} params - Query parameters (search, type, limit, offset)
   */
  async getIcd10Codes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/nphies-codes/icd10${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single ICD-10 code by code value
   * @param {string} code - ICD-10 code (e.g., "A00.1")
   */
  async getIcd10Code(code) {
    return this.request(`/nphies-codes/icd10/${encodeURIComponent(code)}`);
  }

  // Medication Codes
  /**
   * Search medication codes for async dropdown
   * Returns array of { value, label, medication } for react-select
   * @param {string} searchTerm - Search term to filter medications
   * @param {number} limit - Max results (default 50)
   */
  async searchMedicationCodes(searchTerm = '', limit = 50) {
    const params = new URLSearchParams();
    if (searchTerm) params.append('q', searchTerm);
    params.append('limit', limit.toString());
    return this.request(`/nphies-codes/medications/search?${params.toString()}`);
  }

  /**
   * Get medication codes with full pagination support
   * @param {Object} params - Query parameters (search, limit, offset)
   */
  async getMedicationCodes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/nphies-codes/medications${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single medication by GTIN code
   * @param {string} code - GTIN code (e.g., "06281147005347")
   */
  async getMedicationByCode(code) {
    return this.request(`/nphies-codes/medications/${encodeURIComponent(code)}`);
  }

  // Medication Safety Analysis (AI-powered)
  /**
   * Analyze medication safety using AI
   * Checks for drug interactions, age warnings, pregnancy warnings, side effects
   * @param {Array} medications - Array of medication objects with name/activeIngredient
   * @param {Object} patientContext - Patient context (age, gender, pregnant, allergies, diagnosis)
   */
  async analyzeMedicationSafety(medications, patientContext = {}) {
    return this.request('/medication-safety/analyze', {
      method: 'POST',
      body: JSON.stringify({ medications, patientContext })
    });
  }

  /**
   * Get AI-powered medication suggestions based on diagnosis
   * @param {string} diagnosis - Patient diagnosis
   * @param {number} patientAge - Patient age
   * @param {string} patientGender - Patient gender
   * @param {boolean} emergencyCase - Is this an emergency case
   */
  async getMedicationSuggestions(diagnosis, patientAge, patientGender, emergencyCase = false) {
    return this.request('/medication-safety/suggest', {
      method: 'POST',
      body: JSON.stringify({ diagnosis, patientAge, patientGender, emergencyCase })
    });
  }

  /**
   * Check drug interactions between medications
   * @param {Array} medications - Array of medication objects
   */
  async checkDrugInteractions(medications) {
    return this.request('/medication-safety/check-interactions', {
      method: 'POST',
      body: JSON.stringify({ medications })
    });
  }

  // ============================================================================
  // AI Prior Authorization Validation (biomistral-powered)
  // ============================================================================

  /**
   * Validate prior authorization form data with AI
   * Analyzes vitals, clinical info, diagnoses, and items for potential rejection risks
   * @param {Object} formData - Complete prior authorization form data
   */
  async validatePriorAuth(formData) {
    return this.request('/ai-validation/validate-prior-auth', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }

  /**
   * Enhance clinical text using AI
   * Expands brief notes into structured clinical documentation
   * @param {string} text - Original clinical text
   * @param {string} field - Field type (history_of_present_illness, physical_examination, etc.)
   * @param {Object} context - Additional context (chief complaint, diagnosis, requested service)
   */
  async enhanceClinicalText(text, field, context = {}) {
    return this.request('/ai-validation/enhance-clinical', {
      method: 'POST',
      body: JSON.stringify({ text, field, context })
    });
  }

  /**
   * Suggest SNOMED codes from free text
   * @param {string} text - Clinical text to analyze
   * @param {string} category - Category (chief_complaint, diagnosis, etc.)
   */
  async suggestSnomedCodes(text, category = 'chief_complaint') {
    return this.request('/ai-validation/suggest-snomed', {
      method: 'POST',
      body: JSON.stringify({ text, category })
    });
  }

  /**
   * Check medical necessity for prior authorization
   * Assesses whether services are medically necessary based on documentation
   * @param {Object} formData - Prior authorization form data
   */
  async checkMedicalNecessity(formData) {
    return this.request('/ai-validation/check-medical-necessity', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }

  /**
   * Check AI prior auth validation service health
   */
  async checkPriorAuthValidationHealth() {
    return this.request('/ai-validation/prior-auth/health');
  }

  /**
   * Validate eye approval form with AI
   * @param {Object} formData - Eye approval form data
   */
  async validateEyeForm(formData) {
    return this.request('/ai-validation/validate-eye-form', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }

  /**
   * Get AI validation history for a form
   * @param {string} formId - Form ID to get history for
   * @param {number} limit - Max results
   */
  async getAIValidationHistory(formId, limit = 10) {
    return this.request(`/ai-validation/history/${formId}?limit=${limit}`);
  }

  /**
   * Mark AI validation as overridden by user
   * @param {string} validationId - Validation ID to mark as overridden
   */
  async markValidationOverridden(validationId) {
    return this.request(`/ai-validation/override/${validationId}`, {
      method: 'POST'
    });
  }

  /**
   * Get AI validation statistics
   * @param {Object} filters - Filters (startDate, endDate, formType)
   */
  async getAIValidationStatistics(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    return this.request(`/ai-validation/statistics${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Check AI validation service health
   */
  async checkAIValidationHealth() {
    return this.request('/ai-validation/health');
  }

  /**
   * Search medical knowledge base
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @param {string} category - Category filter
   */
  async searchMedicalKnowledge(query, limit = 5, category = null) {
    return this.request('/ai-validation/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit, category })
    });
  }
}

/**
 * Extract a human-readable error message from an error object
 * Handles cases where error.response.data.error is an object instead of a string
 * @param {Error} error - The error object from a catch block
 * @returns {string} - A human-readable error message
 */
export function extractErrorMessage(error) {
  const errorData = error?.response?.data?.error;
  
  // If errorData is a string, return it directly
  if (typeof errorData === 'string') {
    return errorData;
  }
  
  // If errorData is an object, extract the message
  if (typeof errorData === 'object' && errorData !== null) {
    return errorData.message || errorData.details || errorData.code || JSON.stringify(errorData);
  }
  
  // Fallback to other possible error locations
  return error?.response?.data?.message || error?.message || 'An unexpected error occurred';
}

export default new ApiService();
