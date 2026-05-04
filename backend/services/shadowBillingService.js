/**
 * Shadow Billing Service
 * Auto-detects whether a product/service code is a standard NPHIES code or an internal code.
 * When internal, it triggers shadow billing: the original code becomes the shadow_code,
 * and an appropriate NPHIES unlisted code is assigned as the primary code.
 *
 * Detection: DB lookup + hardcoded whitelist of Section 4.5 unlisted codes.
 * Any code not found → treated as non-NPHIES → unlisted + shadow billing.
 *
 * Respects code_entry_mode: auto-detection is SKIPPED when the user explicitly
 * chose a code via 'nphies' or 'shadow_billing' mode on the frontend.
 */

import { query } from '../db.js';

// Section 4.5 unlisted codes are valid NPHIES codes that must never be shadow-billed.
// These exist in the NPHIES Clinical Standards Code Lists per the Shadow Billing Guideline V1.7.
const SECTION_4_5_UNLISTED_CODES = new Set([
  '83500-00-80',      // Unlisted ambulance service (Transportation)
  '83700-00-00',      // Unlisted services yet to be defined (KSA service codes)
  '99999-99-99',      // Unlisted procedure code (Procedures)
  '99999-99-91',      // Unlisted dental procedure code (Dental)
  '99999-99-92',      // Unlisted imaging code (Imaging)
  '73050-39-70',      // Unlisted chemistry tests (Laboratory)
  '73100-09-80',      // Unlisted hematology and coagulation procedure
  '73150-01-20',      // Unlisted urinalysis
  '73200-03-60',      // Unlisted cytopathology procedure
  '73200-10-60',      // Unlisted surgical pathology procedure
  '73250-03-80',      // Unlisted transfusion medicine procedure
  '73350-06-00',      // Unlisted molecular pathology procedure
  '73400-00-40',      // Unlisted in vivo laboratory services
  '73400-05-10',      // Unlisted reproductive medicine laboratory procedure
  '99999999999991',   // Unlisted nutritional supplements (Other)
  '99999999999992',   // Unlisted nutritional supplements (Enteral feeds)
  '99999999999993',   // Unlisted other non-medications
  '99999999999994',   // Unlisted nutritional supplements (Infant formula)
  '99999999999995',   // Unlisted cosmetic
  '99999999999996',   // Unlisted herbal and vitamins
  '99999999999997',   // Unlisted OTC
  '99999999999998',   // Unlisted chemotherapy
  '99999999999999',   // Unlisted other medications
  '99999',            // Unlisted medical devices (SFDA_GMDN)
  '9999',             // Unlisted Out-Patient Dental Code (ADA)
]);

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
   * Check whether a code exists in the NPHIES catalog.
   * Checks: Section 4.5 whitelist → medication_codes table → nphies_codes table.
   * Any code not found → returns false → forces unlisted + shadow billing.
   */
  async isValidNphiesCode(code, systemUrl) {
    if (!code) return false;
    await this.ensureLoaded();

    const codeStr = String(code).trim();
    const key = this._systemKey(systemUrl);

    if (SECTION_4_5_UNLISTED_CODES.has(codeStr)) return true;

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
   * Normalize pharmacy items so they flow through the same product_or_service_code
   * pipeline as the other auth types. Pharmacy medication items store the code in
   * `medication_code` (and a display in `medication_name`). Without this copy, the
   * early-return on `!item.product_or_service_code` below would skip them and no
   * auto-detection would ever run for pharmacy.
   */
  _normalizePharmacyItem(item, claimType) {
    if (claimType !== 'pharmacy') return;
    if (item.product_or_service_code) return;
    if (!item.medication_code) return;

    item.product_or_service_code = item.medication_code;
    if (!item.product_or_service_display && item.medication_name) {
      item.product_or_service_display = item.medication_name;
    }
    if (!item.product_or_service_system) {
      item.product_or_service_system = item.item_type === 'device'
        ? 'http://nphies.sa/terminology/CodeSystem/medical-devices'
        : 'http://nphies.sa/terminology/CodeSystem/medication-codes';
    }
  }

  /**
   * Process a single item for shadow billing auto-detection.
   *
   * Skips auto-detection when:
   *   - code_entry_mode is 'nphies' or 'shadow_billing' (user explicitly chose the code)
   *   - shadow_code is already set (backwards-compatible manual flow)
   *
   * For 'manual' mode or unset mode (old records): checks whether product_or_service_code
   * exists in the NPHIES catalog. If not found → shadow billing triggered.
   *
   * Pharmacy items are normalized first so their `medication_code` participates in
   * the same validation pipeline used by every other auth type.
   *
   * Recursively processes item.details[] as well.
   */
  async processItem(item, claimType, providerDomain) {
    if (!item) return item;

    this._normalizePharmacyItem(item, claimType);

    if (!item.product_or_service_code) return item;

    const mode = item.code_entry_mode;
    if (mode === 'nphies') {
      // User explicitly selected a NPHIES standard code — there is no internal
      // non-standard code, so clear any stale shadow_code that might have
      // persisted from a previous edit (e.g. user switched modes mid-flow).
      if (item.shadow_code) {
        console.log(
          `[ShadowBillingService] Clearing stale shadow_code '${item.shadow_code}' ` +
          `for item in 'nphies' mode (code: '${item.product_or_service_code}')`
        );
        item.shadow_code = null;
        item.shadow_code_system = null;
        item.shadow_code_display = null;
      }
      // Pharmacy: wipe stale medication_code so mappers use product_or_service_code
      if (claimType === 'pharmacy' && item.product_or_service_code) {
        item.medication_code = null;
        item.medication_name = null;
      }
      // Still process sub-items (package details may need auto-detection)
      if (item.details && Array.isArray(item.details)) {
        for (const detail of item.details) {
          await this.processItem(detail, claimType, providerDomain);
        }
      }
      return item;
    }

    if (mode === 'shadow_billing') {
      // NPHIES Shadow Billing Guideline Section 3.4: the productOrService.coding
      // array must carry BOTH the NPHIES unlisted/standard code (primary) and
      // the provider's internal non-standard code (secondary). Preserve the
      // user-entered shadow_code and back-fill shadow_code_system from the
      // provider domain when it isn't already set.
      if (item.shadow_code) {
        if (!item.shadow_code_system) {
          item.shadow_code_system = this.getShadowCodeSystem(
            providerDomain,
            item.is_package === true
          );
        }
        if (!item.shadow_code_display) {
          console.warn(
            `[ShadowBillingService] shadow_code '${item.shadow_code}' has no display ` +
            `(NPHIES Section 3.4 expects a human-readable description).`
          );
        }
      }
      // Pharmacy: wipe stale medication_code so mappers use product_or_service_code
      if (claimType === 'pharmacy' && item.product_or_service_code) {
        item.medication_code = null;
        item.medication_name = null;
      }
      // Still process sub-items (package details may need auto-detection)
      if (item.details && Array.isArray(item.details)) {
        for (const detail of item.details) {
          await this.processItem(detail, claimType, providerDomain);
        }
      }
      return item;
    }

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

      // Pharmacy: clear medication_code/name so PharmacyMapper does not fall back
      // to the pre-shadow-billing value and accidentally send it as the primary code.
      if (claimType === 'pharmacy') {
        item.medication_code = null;
        item.medication_name = null;
      }

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
