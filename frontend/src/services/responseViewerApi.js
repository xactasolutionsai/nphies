import { API_BASE_URL, apiFetch } from '@/services/http';
// Simple ResponseViewer API service with direct endpoints
class ResponseViewerApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/response-viewer`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    // Spread options first so options.headers cannot replace the merged headers
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await apiFetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${error.message}`);
      throw error;
    }
  }

  // Build a query string from a params object, skipping empty values.
  // Accepts either a params object ({ page, limit, search, status, dateRange, sortBy, sortOrder })
  // or the legacy positional (page, limit) form.
  buildQuery(params = {}, limit) {
    const normalized = (typeof params === 'object' && params !== null)
      ? params
      : { page: params, limit };
    const search = new URLSearchParams();
    Object.entries(normalized).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') return;
      search.append(key, String(value));
    });
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }

  // Get claims with pagination/filters
  async getClaims(params = {}, limit) {
    return this.request(`/claims${this.buildQuery(params, limit)}`);
  }

  // Get authorizations with pagination/filters
  async getAuthorizations(params = {}, limit) {
    return this.request(`/authorizations${this.buildQuery(params, limit)}`);
  }

  // Get eligibility with pagination/filters
  async getEligibility(params = {}, limit) {
    return this.request(`/eligibility${this.buildQuery(params, limit)}`);
  }

  // Get payments with pagination/filters
  async getPayments(params = {}, limit) {
    return this.request(`/payments${this.buildQuery(params, limit)}`);
  }

  // Get dashboard statistics (fallback to main API)
  async getDashboardStats() {
    try {
      const response = await apiFetch(`${API_BASE_URL}/dashboard/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

export default new ResponseViewerApi();