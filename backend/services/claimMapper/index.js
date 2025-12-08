/**
 * NPHIES Claim Mapper Factory
 * For Claims (use: "claim") - billing after services delivered
 * 
 * Claim mappers extend the Prior Authorization mappers and add claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - Additional required extensions vary by claim type:
 *   - Institutional: episode, accountingPeriod (for IP), patientInvoice on items
 *   - Vision: episode, patientInvoice on items (NO encounter, NO accountingPeriod)
 * 
 * Usage:
 *   import claimMapper, { getClaimMapper } from './services/claimMapper/index.js';
 *   const mapper = getClaimMapper('institutional');
 *   const bundle = mapper.buildClaimRequestBundle(data);
 */

import InstitutionalClaimMapper from './InstitutionalClaimMapper.js';
import VisionClaimMapper from './VisionClaimMapper.js';

const mapperInstances = {
  institutional: null,
  professional: null,
  dental: null,
  vision: null,
  pharmacy: null
};

export function getClaimMapper(claimType) {
  const normalizedType = (claimType || 'institutional').toLowerCase();
  
  const typeMapping = {
    'institutional': 'institutional',
    'inpatient': 'institutional',
    'daycase': 'institutional',
    'professional': 'professional',
    'dental': 'dental',
    'oral': 'dental',
    'vision': 'vision',
    'pharmacy': 'pharmacy'
  };
  
  const mappedType = typeMapping[normalizedType] || 'institutional';
  
  if (!mapperInstances[mappedType]) {
    switch (mappedType) {
      case 'institutional':
        mapperInstances.institutional = new InstitutionalClaimMapper();
        break;
      case 'vision':
        mapperInstances.vision = new VisionClaimMapper();
        break;
      // TODO: Add other mappers when implemented
      case 'professional':
      case 'dental':
      case 'pharmacy':
        // For now, use institutional as fallback
        mapperInstances[mappedType] = new InstitutionalClaimMapper();
        break;
      default:
        mapperInstances.institutional = new InstitutionalClaimMapper();
        return mapperInstances.institutional;
    }
  }
  
  return mapperInstances[mappedType];
}

function detectClaimType(data) {
  // Check explicit claim_type first
  if (data?.claim?.claim_type) return data.claim.claim_type;
  if (data?.claim_type) return data.claim_type;
  
  // Check prior auth type (when creating claim from PA)
  const paType = data?.priorAuth?.authorization_type || data?.prior_auth?.authorization_type;
  if (paType) return paType;
  
  // Detect by encounter class
  const encounterClass = data?.claim?.encounter_class || data?.encounter_class;
  if (['inpatient', 'daycase'].includes(encounterClass)) return 'institutional';
  
  return 'institutional';
}

class ClaimMapperProxy {
  buildClaimRequestBundle(data) {
    const claimType = detectClaimType(data);
    return getClaimMapper(claimType).buildClaimRequestBundle(data);
  }

  parseClaimResponse(responseBundle) {
    return getClaimMapper('institutional').parseClaimResponse(responseBundle);
  }

  validateClaimResponse(response) {
    return getClaimMapper('institutional').validateClaimResponse(response);
  }

  formatDate(date) {
    return getClaimMapper('institutional').formatDate(date);
  }

  formatDateTime(date) {
    return getClaimMapper('institutional').formatDateTime(date);
  }

  generateId() {
    return getClaimMapper('institutional').generateId();
  }
}

const claimMapperProxy = new ClaimMapperProxy();

export { InstitutionalClaimMapper, VisionClaimMapper, detectClaimType };
export default claimMapperProxy;
