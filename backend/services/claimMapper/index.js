/**
 * NPHIES Claim Mapper Factory
 * For Claims (use: "claim") - billing after services delivered
 * 
 * Usage:
 *   import claimMapper, { getClaimMapper } from './services/claimMapper/index.js';
 *   const mapper = getClaimMapper('institutional');
 *   const bundle = mapper.buildClaimRequestBundle(data);
 */

import BaseClaimMapper from './BaseClaimMapper.js';
import InstitutionalClaimMapper from './InstitutionalClaimMapper.js';

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
      // TODO: Add other mappers when implemented
      case 'professional':
      case 'dental':
      case 'vision':
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
  if (data?.claim?.claim_type) return data.claim.claim_type;
  if (data?.claim_type) return data.claim_type;
  
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

export { BaseClaimMapper, InstitutionalClaimMapper, detectClaimType };
export default claimMapperProxy;
