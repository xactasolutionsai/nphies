/**
 * Form Validation Utilities
 * Provides validation functions for the General Request Wizard
 */

/**
 * Get value from nested object using dot notation path
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot notation path (e.g., 'patient.fullName')
 * @returns {*} The value at the path, or undefined
 */
export const getValueByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
};

/**
 * Set value in nested object using dot notation path
 * @param {Object} obj - The object to modify
 * @param {string} path - Dot notation path
 * @param {*} value - The value to set
 * @returns {Object} New object with updated value
 */
export const setValueByPath = (obj, path, value) => {
  const keys = path.split('.');
  const newObj = { ...obj };
  let current = newObj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] = { ...current[key] };
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return newObj;
};

/**
 * Validate required fields
 * @param {Object} data - Form data to validate
 * @param {Array<string>} requiredPaths - Array of dot notation paths for required fields
 * @returns {Object} Object with path as key and error message as value
 */
export const validateRequiredFields = (data, requiredPaths) => {
  const errors = {};
  
  if (!requiredPaths || requiredPaths.length === 0) {
    return errors;
  }
  
  requiredPaths.forEach(path => {
    const value = getValueByPath(data, path);
    
    // Check if value is empty
    if (value === null || value === undefined) {
      errors[path] = 'This field is required';
    } else if (typeof value === 'string' && value.trim() === '') {
      errors[path] = 'This field is required';
    } else if (Array.isArray(value) && value.length === 0) {
      errors[path] = 'At least one item is required';
    }
  });
  
  return errors;
};

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  if (!email) return true; // Empty is valid (use required check separately)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (basic international format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export const isValidPhone = (phone) => {
  if (!phone) return true; // Empty is valid (use required check separately)
  // Accept formats like: +966511223344, 0511223344, +1-555-123-4567
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate date format and logic
 * @param {string} dateStr - Date string to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowPast - Allow past dates
 * @param {boolean} options.allowFuture - Allow future dates
 * @returns {Object} { isValid: boolean, error: string }
 */
export const validateDate = (dateStr, options = {}) => {
  const { allowPast = true, allowFuture = true } = options;
  
  if (!dateStr) {
    return { isValid: true, error: null }; // Empty is valid
  }
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  if (!allowPast && date < now) {
    return { isValid: false, error: 'Date cannot be in the past' };
  }
  
  if (!allowFuture && date > now) {
    return { isValid: false, error: 'Date cannot be in the future' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate ID number format (Saudi ID example)
 * @param {string} idNumber - ID number to validate
 * @returns {Object} { isValid: boolean, error: string }
 */
export const validateIdNumber = (idNumber) => {
  if (!idNumber) {
    return { isValid: true, error: null }; // Empty is valid
  }
  
  // Saudi national ID: 10 digits starting with 1 or 2
  // Iqama: 10 digits starting with other numbers
  const idRegex = /^[0-9]{10}$/;
  
  if (!idRegex.test(idNumber)) {
    return { isValid: false, error: 'ID must be 10 digits' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate all fields for a step
 * @param {Object} data - Form data
 * @param {Array<string>} requiredFields - Required field paths for the step
 * @returns {Object} Errors object
 */
export const validateStep = (data, requiredFields = []) => {
  let errors = {};
  
  // Validate required fields
  errors = { ...errors, ...validateRequiredFields(data, requiredFields) };
  
  // Email validation
  const email = getValueByPath(data, 'patient.email');
  if (email && !isValidEmail(email)) {
    errors['patient.email'] = 'Invalid email format';
  }
  
  const providerEmail = getValueByPath(data, 'provider.email');
  if (providerEmail && !isValidEmail(providerEmail)) {
    errors['provider.email'] = 'Invalid email format';
  }
  
  // Phone validation
  const phone = getValueByPath(data, 'patient.contactPhone');
  if (phone && !isValidPhone(phone)) {
    errors['patient.contactPhone'] = 'Invalid phone format';
  }
  
  const providerPhone = getValueByPath(data, 'provider.contactPhone');
  if (providerPhone && !isValidPhone(providerPhone)) {
    errors['provider.contactPhone'] = 'Invalid phone format';
  }
  
  // ID number validation
  const idNumber = getValueByPath(data, 'patient.idNumber');
  const idValidation = validateIdNumber(idNumber);
  if (!idValidation.isValid) {
    errors['patient.idNumber'] = idValidation.error;
  }
  
  return errors;
};

/**
 * Check if step has errors
 * @param {Object} errors - Errors object
 * @param {Array<string>} fieldPaths - Field paths to check
 * @returns {boolean} True if any field in the step has errors
 */
export const hasStepErrors = (errors, fieldPaths) => {
  if (!errors || Object.keys(errors).length === 0) return false;
  if (!fieldPaths || fieldPaths.length === 0) return false;
  
  return fieldPaths.some(path => errors[path]);
};

