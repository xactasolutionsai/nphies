/**
 * Shadow Billing Service
 * Auto-detects whether a product/service code is a standard NPHIES code or an internal code.
 * When internal, it triggers shadow billing: the original code becomes the shadow_code,
 * and an appropriate NPHIES unlisted code is assigned as the primary code.
 *
 * Detection: DB lookup only (medication_codes for GTIN, nphies_codes for others).
 * Any code not found in DB → treated as non-NPHIES → unlisted + shadow billing.
 */

import { query } from '../db.js';

// Default unlisted codes per NPHIES code system category (Section 4.5 of Shadow Billing Guideline V1.7)
const UNLISTED_CODES = {
  procedures:          { code: '99999-99-99',     display: 'Unlisted procedure code' },
  services:            { code: '83700-00-00',     display: 'Unlisted services yet to be defined' },
  imaging:             { code: '99999-99-92',     display: 'Unlisted imaging code' },
  laboratory:          { code: '73050-39-70',     display: 'Unlisted chemistry tests' },
  transportation:      { code: '83500-00-80',     display: 'Unlisted ambulance service' },
  'medication-codes':  { code: '99999999999999',  display: 'Unlisted other medications' },
  'medical-devices':   { code: '99999',           display: 'Unlisted medical devices' },
  'oral-health-op':    { code: '9999',            display: 'Unlisted Out-Patient Dental Code' },
  'lens-type':         { code: '99999-99-99',     display: 'Unlisted procedure code' },
  'scientific-codes':  { code: '99999-99-99',     display: 'Unlisted procedure code' },
};

// Full laboratory unlisted codes per subcategory (Section 4.5)
const LABORATORY_UNLISTED_CODES = {
  'chemistry':            { code: '73050-39-70', display: 'Unlisted chemistry tests' },
  'hematology':           { code: '73100-09-80', display: 'Unlisted hematology and coagulation procedure' },
  'urinalysis':           { code: '73150-01-20', display: 'Unlisted urinalysis' },
  'cytopathology':        { code: '73200-03-60', display: 'Unlisted cytopathology procedure' },
  'surgical-pathology':   { code: '73200-10-60', display: 'Unlisted surgical pathology procedure' },
  'transfusion':          { code: '73250-03-80', display: 'Unlisted transfusion medicine procedure' },
  'molecular-pathology':  { code: '73350-06-00', display: 'Unlisted molecular pathology procedure' },
  'in-vivo':              { code: '73400-00-40', display: 'Unlisted in vivo laboratory services' },
  'reproductive':         { code: '73400-05-10', display: 'Unlisted reproductive medicine laboratory procedure' },
};

// Full GTIN/medication unlisted codes per subcategory (Section 4.5)
const MEDICATION_UNLISTED_CODES = {
  'nutritional-other':     { code: '99999999999991', display: 'Unlisted nutritional supplements (Other nutritional substitute)' },
  'nutritional-enteral':   { code: '99999999999992', display: 'Unlisted nutritional supplements (Enteral feeds)' },
  'non-medications':       { code: '99999999999993', display: 'Unlisted other non-medications' },
  'nutritional-infant':    { code: '99999999999994', display: 'Unlisted nutritional supplements (Mother\'s milk substitute (baby/infant formula))' },
  'cosmetic':              { code: '99999999999995', display: 'Unlisted cosmetic' },
  'herbal-vitamins':       { code: '99999999999996', display: 'Unlisted herbal and vitamins' },
  'otc':                   { code: '99999999999997', display: 'Unlisted OTC' },
  'chemotherapy':          { code: '99999999999998', display: 'Unlisted chemotherapy' },
  'other-medications':     { code: '99999999999999', display: 'Unlisted other medications' },
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
   * Check whether a code exists in the NPHIES catalog (DB lookup only).
   * medication_codes table for GTIN, nphies_codes table for all others.
   * Any code not found → returns false → forces unlisted + shadow billing.
   */
  async isValidNphiesCode(code, systemUrl) {
    if (!code) return false;
    await this.ensureLoaded();

    const codeStr = String(code).trim();
    const key = this._systemKey(systemUrl);

    if (key === 'medication-codes' && this.medicationCodesCache.has(codeStr)) return true;

    if (key && this.nphiesCodesCache.has(key)) {
      if (this.nphiesCodesCache.get(key).has(codeStr)) return true;
    }

    return false;
  }

  /**
   * Select the correct unlisted code based on both the coding system and claim type.
   * Dental has two unlisted codes: 9999 (ADA oral-health-op) and 99999-99-91 (SBS dental).
   */
  getUnlistedCode({ systemUrl, claimType }) {
    const key = this._systemKey(systemUrl);

    if (key === 'oral-health-op') {
      return { code: '9999', display: 'Unlisted Out-Patient Dental Code' };
    }

    if (claimType === 'dental' || claimType === 'oral') {
      return { code: '99999-99-91', display: 'Unlisted dental procedure code' };
    }

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
   * Otherwise check whether product_or_service_code exists in NPHIES catalog:
   *   YES → no change (valid NPHIES code)
   *   NO  → shadow billing triggered: move original to shadow_code, assign unlisted NPHIES code
   *
   * Recursively processes item.details[] as well.
   */
  async processItem(item, claimType, providerDomain) {
    if (!item || !item.product_or_service_code) return item;

    if (item.shadow_code) return item;

    const system = item.product_or_service_system
      || CLAIM_TYPE_DEFAULT_SYSTEMS[claimType]
      || 'http://nphies.sa/terminology/CodeSystem/procedures';

    const isValid = await this.isValidNphiesCode(item.product_or_service_code, system);

    if (!isValid) {
      const originalCode = item.product_or_service_code;
      const originalDisplay = item.product_or_service_display || '';

      item.shadow_code = originalCode;
      item.shadow_code_display = originalDisplay;
      item.shadow_code_system = this.getShadowCodeSystem(providerDomain, item.is_package === true);

      const unlisted = this.getUnlistedCode({ systemUrl: system, claimType });
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
