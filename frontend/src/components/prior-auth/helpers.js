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

/**
 * Get initial data for a service item
 * @param {number} sequence - Item sequence number
 * @returns {object} Initial item data object
 */
export const getInitialItemData = (sequence) => ({
  sequence,
  product_or_service_code: '',
  product_or_service_display: '',
  quantity: 1,
  unit_price: '',
  net_amount: ''
});

/**
 * Get initial data for a diagnosis entry
 * @param {number} sequence - Diagnosis sequence number
 * @returns {object} Initial diagnosis data object
 */
export const getInitialDiagnosisData = (sequence) => ({
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
  sequence,
  category,
  code: '',
  value_string: '',
  value_quantity: ''
});

