/**
 * NPHIES Code Service
 * Loads and caches NPHIES codes from the database
 * Provides lookup functions for code display values
 */

import { query } from '../db.js';

class NphiesCodeService {
  constructor() {
    // Cache for loaded codes
    this.cache = new Map();
    this.cacheExpiry = 60 * 60 * 1000; // 1 hour cache
    this.lastLoaded = null;
    this.lastFailed = null;
    this.retryAfterFailureMs = 60 * 1000; // Don't hit the database on every lookup while it is down
    this.loadingPromise = null;
  }

  /**
   * Load all codes from database into cache (concurrent callers share one load)
   */
  async loadCodes() {
    if (!this.loadingPromise) {
      this.loadingPromise = this._loadCodes().finally(() => { this.loadingPromise = null; });
    }
    return this.loadingPromise;
  }

  async _loadCodes() {
    try {
      const result = await query(`
        SELECT 
          cs.code as system_code,
          c.code,
          c.display_en,
          c.display_ar,
          c.description
        FROM nphies_codes c
        JOIN nphies_code_systems cs ON c.code_system_id = cs.code_system_id
        WHERE c.is_active = true AND cs.is_active = true
        ORDER BY cs.code, c.sort_order
      `);

      // Build the new cache before swapping it in so lookups never see a half-filled cache
      const cache = new Map();
      for (const row of result.rows) {
        const systemCode = row.system_code;
        if (!cache.has(systemCode)) {
          cache.set(systemCode, new Map());
        }
        cache.get(systemCode).set(row.code, {
          displayEn: row.display_en,
          displayAr: row.display_ar,
          description: row.description
        });
      }

      this.cache = cache;
      this.lastLoaded = Date.now();
      this.lastFailed = null;
      console.log(`[NPHIES Codes] Loaded ${result.rows.length} codes from database`);

    } catch (error) {
      this.lastFailed = Date.now();
      console.error('[NPHIES Codes] Error loading codes:', error.message);
      // Don't throw - allow fallback to hardcoded values
    }
  }

  /**
   * Check if cache needs refresh
   */
  needsRefresh() {
    if (this.lastFailed && Date.now() - this.lastFailed < this.retryAfterFailureMs) return false;
    if (!this.lastLoaded) return true;
    return Date.now() - this.lastLoaded > this.cacheExpiry;
  }

  /**
   * Ensure codes are loaded
   */
  async ensureLoaded() {
    if (this.needsRefresh()) {
      await this.loadCodes();
    }
  }

  /**
   * Sync lookups cannot wait for the database; start a background load so later
   * lookups return display text instead of raw codes.
   */
  triggerBackgroundLoad() {
    if (process.env.NODE_ENV === 'test' || this.loadingPromise || !this.needsRefresh()) return;
    this.loadCodes().catch(() => {});
  }

  /**
   * Get display value for a code
   * @param {string} systemCode - The code system (e.g., 'benefit-category')
   * @param {string} code - The code value
   * @param {string} lang - Language ('en' or 'ar'), defaults to 'en'
   * @returns {string} The display value or the code itself if not found
   */
  async getDisplay(systemCode, code, lang = 'en') {
    await this.ensureLoaded();
    
    const system = this.cache.get(systemCode);
    if (!system) return code;
    
    const codeData = system.get(code);
    if (!codeData) return code;
    
    return lang === 'ar' && codeData.displayAr 
      ? codeData.displayAr 
      : codeData.displayEn || code;
  }

  /**
   * Get all codes for a system
   * @param {string} systemCode - The code system
   * @returns {Array} Array of {code, displayEn, displayAr}
   */
  async getAllCodes(systemCode) {
    await this.ensureLoaded();
    
    const system = this.cache.get(systemCode);
    if (!system) return [];
    
    return Array.from(system.entries()).map(([code, data]) => ({
      code,
      displayEn: data.displayEn,
      displayAr: data.displayAr,
      description: data.description
    }));
  }

  /**
   * Get synchronous display (uses cache, returns code if not cached)
   * Use this in sync contexts where you can't await
   * @param {string} systemCode - The code system
   * @param {string} code - The code value
   * @param {string} lang - Language ('en' or 'ar')
   * @returns {string} The display value or code
   */
  getDisplaySync(systemCode, code, lang = 'en') {
    this.triggerBackgroundLoad();
    const system = this.cache.get(systemCode);
    if (!system) return code;
    
    const codeData = system.get(code);
    if (!codeData) return code;
    
    return lang === 'ar' && codeData.displayAr 
      ? codeData.displayAr 
      : codeData.displayEn || code;
  }

  // ============================================
  // Convenience methods for common code systems
  // ============================================

  async getBenefitCategoryDisplay(code, lang = 'en') {
    return this.getDisplay('benefit-category', code, lang);
  }

  async getCoverageTypeDisplay(code, lang = 'en') {
    return this.getDisplay('coverage-type', code, lang);
  }

  async getCopayTypeDisplay(code, lang = 'en') {
    return this.getDisplay('coverage-copay-type', code, lang);
  }

  async getBenefitTypeDisplay(code, lang = 'en') {
    return this.getDisplay('benefit-type', code, lang);
  }

  async getSiteEligibilityDisplay(code, lang = 'en') {
    return this.getDisplay('site-eligibility', code, lang);
  }

  async getProviderTypeDisplay(code, lang = 'en') {
    return this.getDisplay('provider-type', code, lang);
  }

  async getMaritalStatusDisplay(code, lang = 'en') {
    return this.getDisplay('marital-status', code, lang);
  }

  async getRelationshipDisplay(code, lang = 'en') {
    return this.getDisplay('subscriber-relationship', code, lang);
  }

  async getNetworkDisplay(code, lang = 'en') {
    return this.getDisplay('benefit-network', code, lang);
  }

  async getTermDisplay(code, lang = 'en') {
    return this.getDisplay('benefit-term', code, lang);
  }

  // ============================================
  // Sync versions for use in mapper
  // ============================================

  getBenefitCategoryDisplaySync(code) {
    return this.getDisplaySync('benefit-category', code);
  }

  getCoverageTypeDisplaySync(code) {
    return this.getDisplaySync('coverage-type', code);
  }

  getCopayTypeDisplaySync(code) {
    return this.getDisplaySync('coverage-copay-type', code);
  }

  getBenefitTypeDisplaySync(code) {
    return this.getDisplaySync('benefit-type', code);
  }

  getSiteEligibilityDisplaySync(code) {
    return this.getDisplaySync('site-eligibility', code);
  }

  getProviderTypeDisplaySync(code) {
    return this.getDisplaySync('provider-type', code);
  }

  getNetworkDisplaySync(code) {
    return this.getDisplaySync('benefit-network', code);
  }

  getTermDisplaySync(code) {
    return this.getDisplaySync('benefit-term', code);
  }

  /**
   * Force refresh of cache
   */
  async refresh() {
    this.lastLoaded = null;
    this.lastFailed = null;
    await this.loadCodes();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = new Map();
    this.lastLoaded = null;
    this.lastFailed = null;
  }
}

// Export singleton instance
const nphiesCodeService = new NphiesCodeService();
export default nphiesCodeService;

