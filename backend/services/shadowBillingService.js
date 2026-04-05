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
   * Check whether an item's shadow billing fields are reversed.
   * Uses system-ownership (not code validation) for reliable detection.
   * Returns true if the primary code sits on a NPHIES system but is invalid,
   * meaning the user/provider code ended up at coding[0] instead of the NPHIES code.
   */
  _isReversedOrInvalid(item, system) {
    if (!item.shadow_code || !item.shadow_code_system) return false;

    const primaryIsNphies = item.product_or_service_system?.includes('nphies.sa');
    const shadowIsProvider = !item.shadow_code_system?.includes('nphies.sa');

    if (!primaryIsNphies || !shadowIsProvider) {
      return true;
    }
    return false;
  }

  /**
   * Process a single item for shadow billing auto-detection.
   *
   * When shadow_code is already set, validates the coding placement using
   * system-ownership detection. If the primary code on a NPHIES system is
   * invalid, clears shadow fields and re-runs the full unlisted assignment
   * (no fragile auto-swap).
   *
   * Recursively processes item.details[] as well.
   */
  async processItem(item, claimType, providerDomain) {
    if (!item || !item.product_or_service_code) return item;

    const system = item.product_or_service_system
      || CLAIM_TYPE_DEFAULT_SYSTEMS[claimType]
      || 'http://nphies.sa/terminology/CodeSystem/procedures';

    if (item.shadow_code) {
      const primaryIsNphies = item.product_or_service_system?.includes('nphies.sa');
      const shadowIsProvider = !item.shadow_code_system?.includes('nphies.sa');

      if (primaryIsNphies && shadowIsProvider) {
        const primaryValid = await this.isValidNphiesCode(item.product_or_service_code, system);
        if (primaryValid) {
          // Correct state: valid NPHIES code at primary, provider code at shadow
          if (item.details && Array.isArray(item.details)) {
            for (const detail of item.details) {
              await this.processItem(detail, claimType, providerDomain);
            }
          }
          return item;
        }
      }

      // Codes are reversed or invalid -- recover the user's original code,
      // clear shadow fields, and fall through to fresh unlisted assignment.
      const userCode = primaryIsNphies
        ? item.product_or_service_code   // user code is sitting on NPHIES system
        : item.shadow_code;              // user code is at shadow (systems themselves reversed)
      const userDisplay = primaryIsNphies
        ? (item.product_or_service_display || '')
        : (item.shadow_code_display || '');

      console.log(
        `[ShadowBillingService] Detected misplaced shadow billing for code '${userCode}'. ` +
        `Clearing and re-processing.`
      );

      item.product_or_service_code = userCode;
      item.product_or_service_display = userDisplay;
      item.product_or_service_system = system;
      item.shadow_code = null;
      item.shadow_code_system = null;
      item.shadow_code_display = null;
      // Fall through to normal processing below
    }

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
        `[ShadowBillingService] Shadow billing assigned: '${originalCode}' → ` +
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
