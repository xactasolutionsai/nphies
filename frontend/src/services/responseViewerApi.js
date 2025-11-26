// Simple ResponseViewer API service with direct endpoints
class ResponseViewerApi {
  constructor() {
    this.baseUrl = 'http://localhost:8001/api/response-viewer';
  }

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${error.message}`);
      throw error;
    }
  }

  // Get claims with pagination
  async getClaims(page = 1, limit = 10) {
    return this.request(`/claims?page=${page}&limit=${limit}`);
  }

  // Get authorizations with pagination
  async getAuthorizations(page = 1, limit = 10) {
    return this.request(`/authorizations?page=${page}&limit=${limit}`);
  }

  // Get eligibility with pagination
  async getEligibility(page = 1, limit = 10) {
    return this.request(`/eligibility?page=${page}&limit=${limit}`);
  }

  // Get payments with pagination
  async getPayments(page = 1, limit = 10) {
    return this.request(`/payments?page=${page}&limit=${limit}`);
  }

  // Get dashboard statistics (fallback to main API)
  async getDashboardStats() {
    try {
      const response = await fetch('http://localhost:8001/api/dashboard/stats');
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