/**
 * Prior Authorization API Service
 * Dedicated service for NPHIES Prior Authorization operations
 */

const API_BASE_URL = 'http://localhost:8001/api';

class PriorAuthApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

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
        const error = new Error(errorData.error || `HTTP error! status: ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Prior Auth API request failed:', error);
      throw error;
    }
  }

  // ============= CRUD Operations =============

  /**
   * Get all prior authorizations with filtering and pagination
   * @param {Object} params - Query parameters (page, limit, search, status, auth_type)
   */
  async getAll(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/prior-authorizations${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single prior authorization by ID with full details
   * @param {number|string} id - Prior authorization ID
   */
  async getById(id) {
    return this.request(`/prior-authorizations/${id}`);
  }

  /**
   * Create a new prior authorization
   * @param {Object} data - Prior authorization data including items, supporting_info, diagnoses, attachments
   */
  async create(data) {
    return this.request('/prior-authorizations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update an existing prior authorization (draft/error status only)
   * @param {number|string} id - Prior authorization ID
   * @param {Object} data - Updated data
   */
  async update(id, data) {
    return this.request(`/prior-authorizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a prior authorization (draft status only)
   * @param {number|string} id - Prior authorization ID
   */
  async delete(id) {
    return this.request(`/prior-authorizations/${id}`, {
      method: 'DELETE'
    });
  }

  // ============= NPHIES Workflow Operations =============

  /**
   * Send prior authorization to NPHIES
   * Builds FHIR bundle and submits to NPHIES API
   * @param {number|string} id - Prior authorization ID
   */
  async sendToNphies(id) {
    return this.request(`/prior-authorizations/${id}/send`, {
      method: 'POST'
    });
  }

  /**
   * Create and submit an update to existing authorization
   * Creates new PA record with is_update=true and reference to original
   * @param {number|string} id - Original prior authorization ID
   * @param {Object} data - Updated items, supporting_info, etc.
   */
  async submitUpdate(id, data = {}) {
    return this.request(`/prior-authorizations/${id}/update`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Cancel an existing authorization
   * Sends Task resource to NPHIES with cancel-request
   * @param {number|string} id - Prior authorization ID
   * @param {string} reason - Cancellation reason
   */
  async cancel(id, reason) {
    return this.request(`/prior-authorizations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  /**
   * Transfer authorization to another provider
   * Creates transfer request with transfer extension flag
   * @param {number|string} id - Prior authorization ID
   * @param {string} transferProviderId - Target provider ID
   * @param {string} reason - Transfer reason
   */
  async transfer(id, transferProviderId, reason) {
    return this.request(`/prior-authorizations/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ transfer_provider_id: transferProviderId, reason })
    });
  }

  /**
   * Poll for response on queued authorization
   * @param {number|string} id - Prior authorization ID
   */
  async poll(id) {
    return this.request(`/prior-authorizations/${id}/poll`);
  }

  // ============= FHIR Bundle Operations =============

  /**
   * Get FHIR bundle preview without sending to NPHIES
   * Useful for validation and debugging
   * @param {number|string} id - Prior authorization ID
   */
  async getBundle(id) {
    return this.request(`/prior-authorizations/${id}/bundle`);
  }

  // ============= Utility Methods =============

  /**
   * Get status color for UI display
   * @param {string} status - Authorization status
   */
  getStatusColor(status) {
    const colors = {
      draft: 'gray',
      pending: 'blue',
      queued: 'yellow',
      approved: 'green',
      partial: 'orange',
      denied: 'red',
      cancelled: 'gray',
      error: 'red'
    };
    return colors[status] || 'gray';
  }

  /**
   * Get status badge variant for UI components
   * @param {string} status - Authorization status
   */
  getStatusVariant(status) {
    const variants = {
      draft: 'outline',
      pending: 'default',
      queued: 'secondary',
      approved: 'success',
      partial: 'warning',
      denied: 'destructive',
      cancelled: 'outline',
      error: 'destructive'
    };
    return variants[status] || 'outline';
  }

  /**
   * Get authorization type display name
   * @param {string} authType - Authorization type key
   */
  getAuthTypeDisplay(authType) {
    const types = {
      institutional: 'Institutional',
      professional: 'Professional',
      pharmacy: 'Pharmacy',
      dental: 'Dental',
      vision: 'Vision'
    };
    return types[authType] || authType;
  }

  /**
   * Get encounter class display name
   * @param {string} encounterClass - Encounter class key
   */
  getEncounterClassDisplay(encounterClass) {
    const classes = {
      inpatient: 'Inpatient',
      outpatient: 'Outpatient',
      daycase: 'Day Case',
      emergency: 'Emergency',
      ambulatory: 'Ambulatory',
      home: 'Home Healthcare',
      telemedicine: 'Telemedicine'
    };
    return classes[encounterClass] || encounterClass;
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount value
   * @param {string} currency - Currency code (default: SAR)
   */
  formatAmount(amount, currency = 'SAR') {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format date for display
   * @param {string|Date} date - Date value
   */
  formatDate(date) {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  /**
   * Format datetime for display
   * @param {string|Date} datetime - DateTime value
   */
  formatDateTime(datetime) {
    if (!datetime) return '-';
    return new Intl.DateTimeFormat('en-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(datetime));
  }

  /**
   * Build initial form data for new prior authorization
   * @param {string} authType - Authorization type
   */
  getInitialFormData(authType = 'professional') {
    return {
      auth_type: authType,
      status: 'draft',
      priority: 'normal',
      currency: 'SAR',
      encounter_class: 'ambulatory',
      patient_id: '',
      provider_id: '',
      insurer_id: '',
      items: [],
      supporting_info: [],
      diagnoses: [],
      attachments: []
    };
  }

  /**
   * Build initial item data
   * @param {number} sequence - Item sequence number
   */
  getInitialItemData(sequence = 1) {
    return {
      sequence,
      product_or_service_code: '',
      product_or_service_display: '',
      quantity: 1,
      unit_price: 0,
      currency: 'SAR'
    };
  }

  /**
   * Build initial diagnosis data
   * @param {number} sequence - Diagnosis sequence number
   */
  getInitialDiagnosisData(sequence = 1) {
    return {
      sequence,
      diagnosis_code: '',
      diagnosis_display: '',
      diagnosis_type: 'principal'
    };
  }

  /**
   * Build initial supporting info data
   * @param {number} sequence - Supporting info sequence number
   * @param {string} category - Category type
   */
  getInitialSupportingInfoData(sequence = 1, category = 'info') {
    return {
      sequence,
      category,
      code: '',
      value_string: ''
    };
  }

  /**
   * Validate required fields before submission
   * @param {Object} data - Prior authorization data
   */
  validateRequiredFields(data) {
    const errors = [];

    if (!data.auth_type) {
      errors.push({ field: 'auth_type', message: 'Authorization type is required' });
    }
    if (!data.patient_id) {
      errors.push({ field: 'patient_id', message: 'Patient is required' });
    }
    if (!data.provider_id) {
      errors.push({ field: 'provider_id', message: 'Provider is required' });
    }
    if (!data.insurer_id) {
      errors.push({ field: 'insurer_id', message: 'Insurer is required' });
    }
    if (!data.items || data.items.length === 0) {
      errors.push({ field: 'items', message: 'At least one service item is required' });
    }

    // Validate items
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        if (!item.product_or_service_code) {
          errors.push({ 
            field: `items[${index}].product_or_service_code`, 
            message: `Item ${index + 1}: Service code is required` 
          });
        }
      });
    }

    // Pharmacy-specific validation
    if (data.auth_type === 'pharmacy') {
      const hasDaysSupply = data.supporting_info?.some(info => info.category === 'days-supply');
      if (!hasDaysSupply) {
        errors.push({ 
          field: 'supporting_info', 
          message: 'Days supply is required for pharmacy authorizations' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new PriorAuthApiService();

