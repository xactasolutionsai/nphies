// Helper functions for Prior Authorization Form

/**
 * Format amount with currency
 * @param {number|string} amount - The amount to format
 * @param {string} currency - Currency code (default: 'SAR')
 * @returns {string} Formatted amount string
 */
export const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null || amount === '') return `0.00 ${currency}`;
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

// Client-only React key for editable list rows. Stripped before sending (see stripRowKeys).
let rowKeyCounter = 0;
export const newRowKey = () => `row-${++rowKeyCounter}`;

/**
 * Ensure every row in a list has a stable client-side `_rowKey`.
 * @param {Array} rows
 * @returns {Array}
 */
export const withRowKeys = (rows) =>
  Array.isArray(rows) ? rows.map(row => (row && row._rowKey ? row : { ...row, _rowKey: newRowKey() })) : rows;

/**
 * Remove client-side `_rowKey` fields from a list of rows (and their package details).
 * @param {Array} rows
 * @returns {Array}
 */
export const stripRowKeys = (rows) =>
  Array.isArray(rows)
    ? rows.map(row => {
        if (!row || typeof row !== 'object') return row;
        const { _rowKey, ...rest } = row;
        if (Array.isArray(rest.details)) rest.details = stripRowKeys(rest.details);
        return rest;
      })
    : rows;

/**
 * Get initial data for a service item
 * @param {number} sequence - Item sequence number
 * @param {string} authType - Authorization type (e.g., 'pharmacy', 'dental', etc.)
 * @returns {object} Initial item data object
 */
export const getInitialItemData = (sequence, authType = '') => {
  const baseItem = {
    _rowKey: newRowKey(),
    sequence,
    product_or_service_code: '',
    product_or_service_display: '',
    code_entry_mode: 'nphies',
    shadow_billing_type: '',
    quantity: 1,
    unit_price: '',
    net_amount: '',
    patient_share: 0,
    is_package: false,
    is_maternity: false,
    manual_code_entry: false
  };

  // Add pharmacy-specific fields
  if (authType === 'pharmacy') {
    return {
      ...baseItem,
      medication_code: '',
      medication_name: '',
      prescribed_medication_code: '',
      pharmacist_selection_reason: 'patient-request',
      // Only set when a substitution actually happened (NPHIES pharmacist-substitute is optional)
      pharmacist_substitute: null,
      days_supply: 30,
      shadow_code: '',
      shadow_code_system: '',
      shadow_code_display: ''
    };
  }

  return baseItem;
};

/**
 * Get initial data for a diagnosis entry
 * @param {number} sequence - Diagnosis sequence number
 * @returns {object} Initial diagnosis data object
 */
export const getInitialDiagnosisData = (sequence) => ({
  _rowKey: newRowKey(),
  sequence,
  diagnosis_code: '',
  diagnosis_display: '',
  diagnosis_type: 'principal'
});

/**
 * Get initial data for supporting info entry
 * @param {number} sequence - Supporting info sequence number
 * @param {string} category - Category type (default: 'info')
 * @returns {object} Initial supporting info data object
 */
export const getInitialSupportingInfoData = (sequence, category = 'info') => ({
  _rowKey: newRowKey(),
  sequence,
  category,
  code: '',
  value_string: '',
  value_quantity: ''
});

/**
 * Get initial data for a lab observation entry
 * Per NPHIES IG: Lab test details MUST be in Observation resources with LOINC codes
 * These are referenced via Claim.supportingInfo with category = "laboratory"
 * 
 * @param {number} sequence - Observation sequence number
 * @returns {object} Initial lab observation data object
 */
export const getInitialLabObservationData = (sequence) => ({
  _rowKey: newRowKey(),
  sequence,
  loinc_code: '',
  loinc_display: '',
  test_name: '',
  value: '',
  value_type: 'quantity', // 'quantity' or 'string'
  unit: '',
  unit_code: '',
  status: 'registered', // registered = ordered but not yet performed
  effective_date: '',
  note: ''
});

