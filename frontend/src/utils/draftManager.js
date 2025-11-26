/**
 * Draft Manager
 * Handles auto-saving and loading of form drafts from localStorage
 */

const DRAFT_KEY = 'generalRequestDraft';
const DRAFT_TIMESTAMP_KEY = 'generalRequestDraftTimestamp';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Save draft to localStorage
 * @param {Object} formData - Form data to save
 * @returns {boolean} Success status
 */
export const saveDraft = (formData) => {
  try {
    const timestamp = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    localStorage.setItem(DRAFT_TIMESTAMP_KEY, timestamp);
    return true;
  } catch (error) {
    console.error('Error saving draft:', error);
    return false;
  }
};

/**
 * Load draft from localStorage
 * @returns {Object|null} Draft data or null if not found
 */
export const loadDraft = () => {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    const timestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY);
    
    if (!draft) {
      return null;
    }
    
    return {
      data: JSON.parse(draft),
      timestamp: timestamp ? new Date(timestamp) : null
    };
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
};

/**
 * Clear draft from localStorage
 * @returns {boolean} Success status
 */
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing draft:', error);
    return false;
  }
};

/**
 * Check if draft exists
 * @returns {boolean} True if draft exists
 */
export const hasDraft = () => {
  return localStorage.getItem(DRAFT_KEY) !== null;
};

/**
 * Get draft age in minutes
 * @returns {number|null} Age in minutes or null if no draft
 */
export const getDraftAge = () => {
  const timestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY);
  if (!timestamp) return null;
  
  const draftDate = new Date(timestamp);
  const now = new Date();
  const ageMs = now - draftDate;
  return Math.floor(ageMs / 60000); // Convert to minutes
};

/**
 * Format draft timestamp for display
 * @returns {string|null} Formatted timestamp or null
 */
export const getDraftTimestampFormatted = () => {
  const timestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY);
  if (!timestamp) return null;
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
};

/**
 * Hook for auto-saving
 * Usage: const { startAutoSave, stopAutoSave } = useAutoSave(formData, saveDraft);
 */
export class AutoSaver {
  constructor(saveCallback, interval = AUTO_SAVE_INTERVAL) {
    this.saveCallback = saveCallback;
    this.interval = interval;
    this.timerId = null;
  }
  
  start(data) {
    this.stop(); // Clear any existing timer
    this.timerId = setInterval(() => {
      if (this.saveCallback && typeof this.saveCallback === 'function') {
        this.saveCallback(data);
      }
    }, this.interval);
  }
  
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
  
  saveNow(data) {
    if (this.saveCallback && typeof this.saveCallback === 'function') {
      this.saveCallback(data);
    }
  }
}

/**
 * Create auto-saver instance
 * @param {Function} saveCallback - Callback function to save data
 * @param {number} interval - Auto-save interval in milliseconds
 * @returns {AutoSaver} AutoSaver instance
 */
export const createAutoSaver = (saveCallback, interval = AUTO_SAVE_INTERVAL) => {
  return new AutoSaver(saveCallback, interval);
};

