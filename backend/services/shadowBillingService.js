/**
 * Shadow Billing Service
 * Auto-detects whether a product/service code is a standard NPHIES code or an internal code.
 * When internal, it triggers shadow billing: the original code becomes the shadow_code,
 * and an appropriate NPHIES unlisted code is assigned as the primary code.
 *
 * Detection uses a 2-layer approach:
 *   Layer 1 - DB lookup (medication_codes for GTIN, nphies_codes for others)
 *   Layer 2 - Pattern matching (SBS, GTIN, ADA, GMDN formats)
 */

import { query } from '../db.js';

const NPHIES_CODE_PATTERNS = {
  'http://nphies.sa/terminology/CodeSystem/procedures':       /^\d{5}-\d{2}-\d{2}$/,
  'http://nphies.sa/terminology/CodeSystem/services':         /^\d{5}-\d{2}-\d{2}$/,
  'http://nphies.sa/terminology/CodeSystem/imaging':          /^\d{5}-\d{2}-\d{2}$/,
  'http://nphies.sa/terminology/CodeSystem/laboratory':       /^\d{5}-\d{2}-\d{2}$/,
  'http://nphies.sa/terminology/CodeSystem/medication-codes': /^\d{14}$/,
  'http://nphies.sa/terminology/CodeSystem/medical-devices':  /^\d{5}$/,
  'http://nphies.sa/terminology/CodeSystem/oral-health-op':   /^\d{3,5}$/,
  'http://nphies.sa/terminology/CodeSystem/lens-type':        /^\d{5}-\d{2}-\d{2}$/,
  'http://nphies.sa/terminology/CodeSystem/scientific-codes': /^\d{6,18}$/,
};

const SBS_PATTERN = /^\d{5}-\d{2}-\d{2}$/;
const GTIN_PATTERN = /^\d{14}$/;

const UNLISTED_CODES = {
  procedures:          { code: '99999-99-99',     display: 'Unlisted Procedure' },
  services:            { code: '83700-00-00',     display: 'Unlisted services yet to be defined' },
  imaging:             { code: '99999-99-92',     display: 'Unlisted Imaging' },
  laboratory:          { code: '73050-39-70',     display: 'Unlisted chemistry tests' },
  transportation:      { code: '83500-00-80',     display: 'Unlisted ambulance service' },
  'medication-codes':  { code: '99999999999999',  display: 'Unlisted Medication' },
  'medical-devices':   { code: '99999',           display: 'Unlisted Medical Device' },
  'oral-health-op':    { code: '9999',            display: 'Unlisted Out-Patient Dental Code' },
  'lens-type':         { code: '99999-99-99',     display: 'Unlisted Optical' },
  'scientific-codes':  { code: '99999-99-99',     display: 'Unlisted Scientific Code' },
};

const CLAIM_TYPE_DEFAULT_SYSTEMS = {
  pharmacy:      'http://nphies.sa/terminology/CodeSystem/medication-codes',
  professional:  'http://nphies.sa/terminology/CodeSystem/services',
  institutional: 'http://nphies.sa/terminology/CodeSystem/procedures',
  oral:          'http://nphies.sa/terminology/CodeSystem/oral-health-op',
  dental:        'http://nphies.sa/terminology/CodeSystem/oral-health-op',
  vision:        'http://nphies.sa/terminology/CodeSystem/procedures',
};

class ShadowBillingService {
  constructor() {
    this.medicationCodesCache = new Set();
    this.nphiesCodesCache = new Map();
    this.cacheExpiry = 60 * 60 * 1000;
    this.lastLoaded = null;
    this.isLoading = false;
  }

  async ensureLoaded() {
    if (this.lastLoaded && Date.now() - this.lastLoaded < this.cacheExpiry) return;
    if (this.isLoading) {
      while (this.isLoading) await new Promise(r => setTimeout(r, 100));
      return;
    }
    this.isLoading = true;
    try {
      await Promise.all([this._loadMedicationCodes(), this._loadNphiesCodes()]);
      this.lastLoaded = Date.now();
    } catch (err) {
      console.error('[ShadowBillingService] Error loading codes:', err.message);
    } finally {
      this.isLoading = false;
    }
  }

  async _loadMedicationCodes() {
    try {
      const result = await query('SELECT code FROM medication_codes');
      this.medicationCodesCache.clear();
      for (const row of result.rows) {
        this.medicationCodesCache.add(row.code);
      }
      console.log(`[ShadowBillingService] Loaded ${this.medicationCodesCache.size} medication codes`);
    } catch (err) {
      console.error('[ShadowBillingService] Error loading medication codes:', err.message);
    }
  }

  async _loadNphiesCodes() {
    try {
      const result = await query(`
        SELECT cs.code as system_code, c.code
        FROM nphies_codes c
        JOIN nphies_code_systems cs ON c.code_system_id = cs.code_system_id
        WHERE c.is_active = true AND cs.is_active = true
      `);
      this.nphiesCodesCache.clear();
      for (const row of result.rows) {
        if (!this.nphiesCodesCache.has(row.system_code)) {
          this.nphiesCodesCache.set(row.system_code, new Set());
        }
        this.nphiesCodesCache.get(row.system_code).add(row.code);
      }
      console.log(`[ShadowBillingService] Loaded ${result.rows.length} NPHIES codes`);
    } catch (err) {
      console.error('[ShadowBillingService] Error loading NPHIES codes:', err.message);
    }
  }

  /**
   * Extract the short key from a full NPHIES system URL.
   * e.g. "http://nphies.sa/terminology/CodeSystem/procedures" → "procedures"
   */
  _systemKey(systemUrl) {
    if (!systemUrl) return null;
    const parts = systemUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Check whether a code is a valid NPHIES code for the given system.
   * Layer 1: DB lookup in medication_codes and nphies_codes.
   * Layer 2: Pattern matching against known NPHIES code formats.
   */
  async isNphiesCode(code, systemUrl) {
    if (!code) return false;
    await this.ensureLoaded();

    const codeStr = String(code).trim();
    const key = this._systemKey(systemUrl);

    // Layer 1: DB lookup
    if (key === 'medication-codes' && this.medicationCodesCache.has(codeStr)) return true;

    if (key && this.nphiesCodesCache.has(key)) {
      if (this.nphiesCodesCache.get(key).has(codeStr)) return true;
    }

    // Layer 2: Pattern matching
    const pattern = systemUrl ? NPHIES_CODE_PATTERNS[systemUrl] : null;
    if (pattern && pattern.test(codeStr)) return true;

    // Fallback when no system URL provided
    if (!systemUrl) {
      if (SBS_PATTERN.test(codeStr)) return true;
      if (GTIN_PATTERN.test(codeStr) && this.medicationCodesCache.has(codeStr)) return true;
    }

    return false;
  }

  getUnlistedCode(systemUrl) {
    const key = this._systemKey(systemUrl);
    return UNLISTED_CODES[key] || UNLISTED_CODES['procedures'];
  }

  getShadowCodeSystem(providerDomain, isPackage) {
    const base = providerDomain || 'http://provider.com.sa';
    const domain = base.startsWith('http') ? base : `http://${base}`;
    return isPackage ? `${domain}/package` : `${domain}/product-or-service`;
  }

  /**
   * Process a single item for shadow billing auto-detection.
   *
   * If shadow_code is already set (backwards-compatible manual flow), leave it untouched.
   * Otherwise check whether product_or_service_code is a valid NPHIES code:
   *   YES → no change
   *   NO  → move original code to shadow_code, assign unlisted NPHIES code as primary
   *
   * Recursively processes item.details[] as well.
   */
  async processItem(item, claimType, providerDomain) {
    if (!item || !item.product_or_service_code) return item;

    // Backwards compatibility: if shadow_code was explicitly provided, skip auto-detection
    if (item.shadow_code) return item;

    const system = item.product_or_service_system
      || CLAIM_TYPE_DEFAULT_SYSTEMS[claimType]
      || 'http://nphies.sa/terminology/CodeSystem/procedures';

    const isValid = await this.isNphiesCode(item.product_or_service_code, system);

    if (!isValid) {
      const originalCode = item.product_or_service_code;
      const originalDisplay = item.product_or_service_display || '';

      item.shadow_code = originalCode;
      item.shadow_code_display = originalDisplay;
      item.shadow_code_system = this.getShadowCodeSystem(providerDomain, item.is_package === true);

      const unlisted = this.getUnlistedCode(system);
      item.product_or_service_code = unlisted.code;
      item.product_or_service_display = unlisted.display;
      item.product_or_service_system = system;

      console.log(
        `[ShadowBillingService] Shadow billing detected for code '${originalCode}' → ` +
        `unlisted '${unlisted.code}' (${this._systemKey(system)})`
      );
    }

    // Process sub-items (package details)
    if (item.details && Array.isArray(item.details)) {
      for (const detail of item.details) {
        await this.processItem(detail, claimType, providerDomain);
      }
    }

    return item;
  }

  /**
   * Process all items in a submission for shadow billing auto-detection.
   */
  async processItems(items, claimType, providerDomain) {
    if (!items || !Array.isArray(items)) return items;
    for (const item of items) {
      await this.processItem(item, claimType, providerDomain);
    }
    return items;
  }

  async refresh() {
    this.lastLoaded = null;
    await this.ensureLoaded();
  }
}

const shadowBillingService = new ShadowBillingService();
export default shadowBillingService;
