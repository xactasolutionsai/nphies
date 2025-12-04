/**
 * Prior Authorization Mapper - Backward Compatibility Redirect
 * 
 * This file redirects to the new modular mapper structure.
 * The original monolithic mapper has been refactored into:
 * 
 * priorAuthMapper/
 * ├── index.js              - Factory + backward-compatible proxy
 * ├── BaseMapper.js         - Shared utilities
 * ├── ProfessionalMapper.js - Professional auth type
 * ├── InstitutionalMapper.js- Institutional/inpatient auth type
 * ├── DentalMapper.js       - Dental/oral auth type
 * ├── VisionMapper.js       - Vision auth type (no Encounter)
 * └── PharmacyMapper.js     - Pharmacy auth type
 * 
 * For new code, prefer importing specific mappers:
 *   import { getMapper, DentalMapper } from './priorAuthMapper/index.js';
 * 
 * The legacy monolithic mapper is preserved as priorAuthMapper.legacy.js
 */

// Re-export everything from the new modular structure
export * from './priorAuthMapper/index.js';

// Default export for backward compatibility
export { default } from './priorAuthMapper/index.js';

