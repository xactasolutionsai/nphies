/**
 * NPHIES FHIR R4 Mapper Service
 * Maps database entities to FHIR resources following NPHIES specifications
 * Reference: https://portal.nphies.sa/ig/
 */

import { randomUUID } from 'crypto';
import nphiesCodeService from './nphiesCodeService.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

class NphiesMapper {
  constructor() {
    // Initialize code service cache on first use
    this.codesInitialized = false;
  }

  /**
   * Initialize codes from database (call once at startup or first use)
   */
  async initializeCodes() {
    if (!this.codesInitialized) {
      await nphiesCodeService.loadCodes();
      this.codesInitialized = true;
    }
  }
  /**
   * Generate a unique ID for FHIR resources
   */
  generateId() {
    return randomUUID();
  }

  /**
   * Format date to FHIR date format (YYYY-MM-DD)
   */
  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Format datetime to FHIR dateTime format
   */
  formatDateTime(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  /**
   * Split full name into family and given names
   */
  splitName(fullName) {
    if (!fullName) return { family: '', given: [] };
    const parts = fullName.trim().split(' ');
    return {
      family: parts[parts.length - 1] || '',
      given: parts.slice(0, -1).length > 0 ? parts.slice(0, -1) : [parts[0]]
    };
  }

  /**
   * Build FHIR Patient resource
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-patient.html
   * Supports both DB format (snake_case) and raw format (camelCase)
   * 
   * NPHIES Identifier Rules:
   * - National ID (NI): 10 digits starting with 1, system: http://nphies.sa/identifier/nationalid
   * - Iqama (PRC): 10 digits starting with 2, system: http://nphies.sa/identifier/iqama
   * - Passport (PPN): varies, system: http://nphies.sa/identifier/passportnumber
   * - MRN (MR): provider-specific, system: http://provider.com/identifier/mrn
   * 
   * @param {Object} patient - Patient data
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildPatientResource(patient, partialMode = false) {
    if (!patient) return null;
    const nameInfo = this.splitName(patient.name);
    // Support both formats: patient_id (DB) or patientId (raw)
    const patientId = `patient-${(patient.patient_id || patient.patientId)?.toString() || this.generateId()}`;
    
    // Support both formats for identifier_type
    let identifierType = patient.identifier_type || patient.identifierType || 'national_id';
    const birthDate = patient.birth_date || patient.birthDate;
    const gender = patient.gender ? patient.gender.toLowerCase() : 'unknown';
    const identifierValue = (patient.identifier || patient.patient_id || patient.patientId)?.toString() || '';

    // Auto-detect and correct identifier type based on value pattern for Saudi IDs
    // This prevents NPHIES validation errors IB-00343 and BV-00797
    if (identifierValue && /^\d{10}$/.test(identifierValue)) {
      if (identifierValue.startsWith('1') && identifierType !== 'national_id') {
        console.log(`[NphiesMapper] Auto-correcting identifier type from '${identifierType}' to 'national_id' (value starts with 1)`);
        identifierType = 'national_id';
      } else if (identifierValue.startsWith('2') && identifierType !== 'iqama') {
        console.log(`[NphiesMapper] Auto-correcting identifier type from '${identifierType}' to 'iqama' (value starts with 2)`);
        identifierType = 'iqama';
      }
    }

    // Determine identifier system and code based on type
    const getIdentifierConfig = (type) => {
      switch (type) {
        case 'passport':
          return {
            code: 'PPN',
            display: 'Passport Number',
            system: 'http://nphies.sa/identifier/passportnumber'
          };
        case 'iqama':
          return {
            code: 'PRC',
            display: 'Permanent Resident Card',
            system: 'http://nphies.sa/identifier/iqama'
          };
        case 'mrn':
          return {
            code: 'MR',
            display: 'Medical Record Number',
            system: 'http://provider.com/identifier/mrn'
          };
        case 'national_id':
        default:
          return {
            code: 'NI',
            display: 'National Identifier',
            system: 'http://nphies.sa/identifier/nationalid'
          };
      }
    };

    const identifierConfig = getIdentifierConfig(identifierType);
    
    // Get occupation code - default to 'business' if not provided
    const occupation = patient.occupation || 'business';

    return {
      fullUrl: `http://provider.com/Patient/${patientId}`,
      resource: {
        resourceType: 'Patient',
        id: patientId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0']
        },
        // Occupation extension at resource level (required by NPHIES)
        extension: [
          {
            url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/occupation',
                  code: occupation
                }
              ]
            }
          }
        ],
        identifier: [
          {
            extension: [
              {
                url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-identifier-country',
                valueCodeableConcept: {
                  coding: [
                    {
                      system: 'urn:iso:std:iso:3166',
                      code: 'SAU',
                      display: 'Saudi Arabia'
                    }
                  ]
                }
              }
            ],
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: identifierConfig.code,
                  display: identifierConfig.display
                }
              ]
            },
            system: identifierConfig.system,
            value: (patient.identifier || patient.patient_id || patient.patientId)?.toString() || 'UNKNOWN'
          }
        ],
        active: true,
        name: [
          {
            use: 'official',
            text: patient.name,
            family: nameInfo.family,
            given: nameInfo.given
          }
        ],
        // NPHIES FIX: Only include telecom if phone is provided (don't send empty arrays)
        ...(patient.phone && {
          telecom: [
            {
              system: 'phone',
              value: patient.phone
            }
          ]
        }),
        gender: gender,
        _gender: {
          extension: [
            {
              url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-administrative-gender',
              valueCodeableConcept: {
                coding: [
                  {
                    system: 'http://nphies.sa/terminology/CodeSystem/ksa-administrative-gender',
                    code: gender
                  }
                ]
              }
            }
          ]
        },
        // Only include birthDate if it has a valid value (FHIR doesn't allow null)
        ...(birthDate && { birthDate: this.formatDate(birthDate) }),
        deceasedBoolean: false,
        // NPHIES FIX: Only include address if provided (don't send empty arrays)
        ...(patient.address && {
          address: [
            {
              use: 'home',
              text: patient.address,
              line: [patient.address],
              city: patient.city || 'Riyadh',
              country: 'Saudi Arabia'
            }
          ]
        }),
        // maritalStatus is REQUIRED by NPHIES (1..1 cardinality)
        maritalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
              code: this.getMaritalStatusCode(patient.marital_status || patient.maritalStatus)
            }
          ]
        }
      }
    };
  }

  /**
   * Get FHIR marital status code from input
   * @param {string} status - Marital status string
   * @returns {string} FHIR marital status code
   */
  getMaritalStatusCode(status) {
    if (!status) return 'U'; // Unknown as default
    
    const statusMap = {
      'married': 'M',
      'single': 'S',
      'divorced': 'D',
      'widowed': 'W',
      'unknown': 'U',
      // Direct codes
      'M': 'M',
      'S': 'S', 
      'D': 'D',
      'W': 'W',
      'U': 'U'
    };
    
    return statusMap[status.toLowerCase()] || 'U';
  }

  /**
   * Build FHIR Organization resource for Provider
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-provider-organization.html
   * Supports both DB format (snake_case) and raw format (camelCase)
   * @param {Object} provider - Provider data
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildProviderOrganization(provider, partialMode = false) {
    if (!provider) return null;
    const providerId = (provider.provider_id || provider.providerId)?.toString() || this.generateId();
    // Use centralized NPHIES Provider ID from config
    const nphiesId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
    const providerName = provider.provider_name || provider.providerName || provider.name || 'Provider Organization';
    const rawProviderType = provider.provider_type || provider.providerType || '1';

    // Convert text provider types to NPHIES numeric codes
    // NPHIES ValueSet: http://nphies.sa/terminology/CodeSystem/provider-type
    // Reference: https://portal.nphies.sa/ig/CodeSystem-provider-type.html
    const getProviderTypeCode = (type) => {
      const typeMap = {
        // Text values -> NPHIES codes
        'hospital': '1',
        'polyclinic': '2',
        'pharmacy': '3',
        'optical': '4',
        'optical_shop': '4',
        'clinic': '5',
        'dental': '5',
        'dental_clinic': '5',
        'vision': '5',
        'vision_clinic': '5',
        // Already numeric codes
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5'
      };
      return typeMap[type?.toLowerCase()] || '1'; // Default to Hospital
    };

    const providerType = getProviderTypeCode(rawProviderType);

    // Get provider type display text per NPHIES ValueSet
    // Reference: https://portal.nphies.sa/ig/CodeSystem-provider-type.html
    const getProviderTypeDisplay = (code) => {
      const displays = {
        '1': 'Hospital',
        '2': 'Polyclinic',
        '3': 'Pharmacy',
        '4': 'Optical Shop',
        '5': 'Clinic'  // Used for Dental, Vision, Professional clinics
      };
      return displays[code] || 'Healthcare Provider';
    };

    return {
      fullUrl: `http://provider.com/Organization/${providerId}`,
      resource: {
        resourceType: 'Organization',
        id: providerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0']
        },
        extension: [
          {
            url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/provider-type',
                  code: providerType,
                  display: getProviderTypeDisplay(providerType)
                }
              ]
            }
          }
        ],
        identifier: [
          {
            system: 'http://nphies.sa/license/provider-license',
            value: nphiesId
          }
        ],
        active: true,
        type: [
          {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                code: 'prov'
              }
            ]
          }
        ],
        name: providerName,
        address: provider.address ? [
          {
            use: 'work',
            text: provider.address,
            line: [provider.address],
            city: provider.city || 'Riyadh',
            country: 'Saudi Arabia'
          }
        ] : []
      }
    };
  }

  /**
   * Build FHIR Organization resource for Payer/Insurer
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-insurer-organization.html
   * Supports both DB format (snake_case) and raw format (camelCase)
   * @param {Object} insurer - Insurer data
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildPayerOrganization(insurer, partialMode = false) {
    if (!insurer) return null;
    const insurerId = (insurer.insurer_id || insurer.insurerId)?.toString() || this.generateId();
    // Static NPHIES test ID for now (TODO: use database value in production)
    const nphiesId = 'INS-FHIR';
    const insurerName = insurer.insurer_name || insurer.insurerName || insurer.name || 'Insurance Organization';

    return {
      fullUrl: `http://provider.com/Organization/${insurerId}`,
      resource: {
        resourceType: 'Organization',
        id: insurerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-organization|1.0.0']
        },
        identifier: [
          {
            use: 'official',
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'NII'
                }
              ]
            },
            system: 'http://nphies.sa/license/payer-license',
            value: nphiesId
          }
        ],
        active: true,
        type: [
          {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                code: 'ins',
                display: 'Insurance Company'
              }
            ]
          }
        ],
        name: insurerName,
        address: insurer.address ? [
          {
            use: 'work',
            text: insurer.address,
            line: [insurer.address],
            city: 'Riyadh',
            country: 'Saudi Arabia'
          }
        ] : []
      }
    };
  }

  /**
   * Build FHIR PolicyHolder Organization resource
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-policyholder-organization.html
   * Example: Organization/13 in NPHIES eligibility example
   * @param {Object} policyHolder - PolicyHolder data
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildPolicyHolderOrganization(policyHolder, partialMode = false) {
    if (!policyHolder) return null;
    // Support both DB format (snake_case) and raw format (camelCase)
    const policyHolderId = policyHolder?.policy_holder_id || policyHolder?.policyHolderId || this.generateId();
    const name = policyHolder?.name || 'Policy Holder Organization';
    const identifier = policyHolder?.identifier || '5009';
    const identifierSystem = policyHolder?.identifier_system || policyHolder?.identifierSystem || 'http://nphies.sa/identifiers/organization';
    const isActive = policyHolder?.is_active !== undefined ? policyHolder.is_active : true;

    return {
      fullUrl: `http://provider.com/Organization/${policyHolderId}`,
      resource: {
        resourceType: 'Organization',
        id: policyHolderId.toString(),
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/policyholder-organization|1.0.0']
        },
        identifier: [
          {
            system: identifierSystem,
            value: identifier
          }
        ],
        active: isActive,
        name: name
      }
    };
  }

  /**
   * Build FHIR Coverage resource
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-coverage.html
   * Supports both DB format (snake_case) and raw format (camelCase)
   * @param {Object} coverage - Coverage data
   * @param {Object} patient - Patient data (newborn patient in newborn cases)
   * @param {Object} insurer - Insurer data  
   * @param {Object} policyHolder - Optional PolicyHolder Organization data
   * @param {Object} motherPatient - Optional mother patient data (for newborn requests)
   * @param {string} newbornPatientId - Optional newborn patient resource ID
   * @param {string} motherPatientResourceId - Optional mother patient resource ID
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildCoverageResource(coverage, patient, insurer, policyHolder = null, motherPatient = null, newbornPatientId = null, motherPatientResourceId = null, partialMode = false) {
    if (!coverage) return null;
    const coverageId = `coverage-${(coverage.coverage_id || coverage.coverageId)?.toString() || this.generateId()}`;
    // Use the provided patient resource IDs if available (from built Patient resources), otherwise generate/derive from patient object
    // In partial mode, patient might be null
    const patientId = newbornPatientId || (patient ? `patient-${(patient.patient_id || patient.patientId)?.toString() || this.generateId()}` : this.generateId());
    const insurerId = insurer ? (insurer.insurer_id || insurer.insurerId)?.toString() : null;
    
    // Support both formats
    const policyNumber = coverage.policy_number || coverage.policyNumber;
    const isActive = coverage.is_active !== undefined ? coverage.is_active : coverage.isActive !== undefined ? coverage.isActive : true;
    const coverageType = coverage.coverage_type || coverage.coverageType || 'EHCPOL';
    const memberId = coverage.member_id || coverage.memberId;
    const startDate = coverage.start_date || coverage.startDate;
    const endDate = coverage.end_date || coverage.endDate;
    const planName = coverage.plan_name || coverage.planName;
    const planValue = coverage.plan_value || coverage.planValue;
    const network = coverage.network;
    const dependent = coverage.dependent || coverage.dependent_number;
    // For newborn cases, relationship should be "child" (newborn is child of mother subscriber)
    const relationship = motherPatient ? 'child' : (coverage.relationship || 'self');

    // Get display text for coverage type
    const getCoverageTypeDisplay = (code) => {
      const displays = {
        'EHCPOL': 'extended healthcare',
        'PUBLICPOL': 'public healthcare',
        'DENTAL': 'dental care',
        'MENTPOL': 'mental health',
        'DRUGPOL': 'drug policy'
      };
      return displays[code] || code;
    };

    // Determine policyHolder reference
    // Per NPHIES example: policyHolder should be Organization (employer), not Patient
    let policyHolderRef;
    if (policyHolder) {
      const policyHolderId = policyHolder.policy_holder_id || policyHolder.policyHolderId;
      policyHolderRef = { reference: `Organization/${policyHolderId}` };
    } else {
      // Fallback to Patient reference if no policyHolder organization
      // For newborn cases, use mother as policyHolder
      const policyHolderPatientId = motherPatientResourceId || (motherPatient 
        ? `patient-${(motherPatient.patient_id || motherPatient.patientId)?.toString() || this.generateId()}`
        : patientId);
      policyHolderRef = { reference: `Patient/${policyHolderPatientId}` };
    }

    // For newborn cases: subscriber = mother, beneficiary = newborn
    // Per NPHIES example: Newborn Elig Request.json
    // Use the provided mother patient resource ID if available, otherwise derive from motherPatient object
    const subscriberPatientId = motherPatientResourceId || (motherPatient 
      ? `patient-${(motherPatient.patient_id || motherPatient.patientId)?.toString() || this.generateId()}`
      : patientId);
    const beneficiaryPatientId = patientId; // Always the newborn/primary patient

    return {
      fullUrl: `http://provider.com/Coverage/${coverageId}`,
      resource: {
        resourceType: 'Coverage',
        id: coverageId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0']
        },
        identifier: [
          {
            system: 'http://provider.com/identifiers/memberid',
            value: memberId || policyNumber
          }
        ],
        status: isActive ? 'active' : 'cancelled',
        type: {
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
              code: coverageType,
              display: getCoverageTypeDisplay(coverageType)
            }
          ]
        },
        // policyHolder is REQUIRED by NPHIES - Organization (employer) or Patient
        policyHolder: policyHolderRef,
        // For newborn: subscriber = mother, beneficiary = newborn
        subscriber: {
          reference: `Patient/${subscriberPatientId}`
        },
        beneficiary: {
          reference: `Patient/${beneficiaryPatientId}`
        },
        ...(dependent && {
          dependent: dependent
        }),
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: relationship,
              display: relationship.charAt(0).toUpperCase() + relationship.slice(1)
            }
          ]
        },
        // Only include payor if insurerId exists
        ...(insurerId && {
          payor: [
            {
              reference: `Organization/${insurerId}`
            }
          ]
        }),
        class: [
          {
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                  code: 'plan'
                }
              ]
            },
            value: planValue || planName || 'Standard',
            name: planName || 'Insurance Plan'
          }
        ],
        ...(network && {
          network: network
        })
      }
    };
  }

  /**
   * Build FHIR CoverageEligibilityRequest resource
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-eligibility-request.html
   * Supports discovery mode (no coverage) per NPHIES specification
   * @param {Object} data - Request data including purpose, servicedDate, isNewborn, isTransfer, locationId, partialMode
   * @param {Object} patient - Patient data
   * @param {Object} provider - Provider data
   * @param {Object} insurer - Insurer data
   * @param {Object|null} coverage - Coverage data (optional for discovery mode)
   * @param {string} patientResourceId - Optional patient resource ID
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildCoverageEligibilityRequest(data, patient, provider, insurer, coverage, patientResourceId = null, partialMode = false) {
    // Generate simple request ID like NPHIES example: "req_161959"
    const requestId = `req_${Date.now().toString().slice(-6)}`;
    // Use the provided patient resource ID if available (from built Patient resource), otherwise generate/derive from patient object
    // In partial mode, patient/provider/insurer might be null
    const patientId = patientResourceId || (patient ? `patient-${(patient.patient_id || patient.patientId)?.toString() || this.generateId()}` : null);
    const providerId = provider ? ((provider.provider_id || provider.providerId)?.toString() || this.generateId()) : null;
    const insurerId = insurer ? ((insurer.insurer_id || insurer.insurerId)?.toString() || this.generateId()) : null;

    // Build extensions array for Newborn and Transfer flags
    const extensions = [];
    
    // Newborn extension - for newborn eligibility checks (coverage is mother's)
    if (data.isNewborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }
    
    // Transfer extension - for transfer of care requests
    if (data.isTransfer) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transfer',
        valueBoolean: true
      });
    }

    // Format serviced date - use servicedPeriod per NPHIES spec
    // In partial mode, only include if explicitly provided
    const servicedDate = data.servicedDate 
      ? this.formatDate(data.servicedDate) 
      : (partialMode ? null : this.formatDate(new Date()));

    // Simple numeric ID for the resource (like NPHIES example: "19596")
    const resourceId = Date.now().toString().slice(-5);
    
    const resource = {
      resourceType: 'CoverageEligibilityRequest',
      id: resourceId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/eligibility-request|1.0.0']
      },
      // Add extensions if any exist
      ...(extensions.length > 0 && { extension: extensions }),
      identifier: [
        {
          system: 'http://provider.com/identifiers/coverageeligibilityrequest',
          value: requestId
        }
      ],
      status: 'active',
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/processpriority',
            code: 'normal'
          }
        ]
      },
      // Only include purpose if provided (in partial mode it might be undefined)
      ...(data.purpose && { purpose: data.purpose }),
      ...(!data.purpose && !partialMode && { purpose: ['benefits', 'validation'] }),
      // Only include patient reference if patientId exists
      ...(patientId && {
        patient: {
          reference: `Patient/${patientId}`
        }
      }),
      // Use servicedPeriod instead of servicedDate per NPHIES example
      // Only include if servicedDate is provided
      ...(servicedDate && {
        servicedPeriod: {
          start: servicedDate,
          end: servicedDate
        },
        created: servicedDate
      }),
      // Only include provider reference if providerId exists
      ...(providerId && {
        provider: {
          reference: `Organization/${providerId}`
        }
      }),
      // Only include insurer reference if insurerId exists
      ...(insurerId && {
        insurer: {
          reference: `Organization/${insurerId}`
        }
      }),
      // Add facility reference to Location per NPHIES spec
      ...(data.locationId && {
        facility: {
          reference: `Location/${data.locationId}`
        }
      })
    };

    // Add insurance/coverage reference only if coverage is provided
    // Discovery mode doesn't require coverage per NPHIES spec
    if (coverage) {
      const coverageId = `coverage-${(coverage.coverage_id || coverage.coverageId)?.toString() || this.generateId()}`;
      resource.insurance = [
        {
          coverage: {
            reference: `Coverage/${coverageId}`
          }
        }
      ];
    }

    return {
      fullUrl: `http://provider.com/CoverageEligibilityRequest/${resourceId}`,
      resource
    };
  }

  /**
   * Build FHIR MessageHeader resource
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-message-header.html
   * Uses identifier format for sender/receiver as required by NPHIES (NOT reference format)
   * @param {string} eventCode - Event code for the message
   * @param {Object} sender - Sender organization data
   * @param {Object} destination - Destination organization data
   * @param {string} focusFullUrl - Full URL of the focus resource
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildMessageHeader(eventCode, sender, destination, focusFullUrl, partialMode = false) {
    const messageHeaderId = this.generateId();
    // Use centralized NPHIES Provider ID from config
    const senderNphiesId = NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
    const destinationNphiesId = 'INS-FHIR';

    return {
      fullUrl: `urn:uuid:${messageHeaderId}`,
      resource: {
        resourceType: 'MessageHeader',
        id: messageHeaderId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
        },
        eventCoding: {
          system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
          code: eventCode
        },
        destination: [
          {
            endpoint: `http://nphies.sa/license/payer-license/${destinationNphiesId}`,
            receiver: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: destinationNphiesId
              }
            }
          }
        ],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: senderNphiesId
          }
        },
        source: {
          endpoint: 'http://provider.com'
        },
        ...(focusFullUrl && {
          focus: [
            {
              reference: focusFullUrl
            }
          ]
        })
      }
    };
  }

  /**
   * Build FHIR Location resource for the provider facility
   * Following NPHIES specification: https://portal.nphies.sa/ig/StructureDefinition-location.html
   * @param {Object} provider - Provider data
   * @param {boolean} partialMode - If true, only include fields that have values
   */
  buildLocationResource(provider, partialMode = false) {
    if (!provider) return null;
    const locationId = this.generateId();
    const locationLicense = provider.location_license || provider.locationLicense || 'GACH';
    const providerName = provider.provider_name || provider.providerName || provider.name || 'Healthcare Facility';
    const providerId = (provider.provider_id || provider.providerId)?.toString() || this.generateId();

    return {
      fullUrl: `http://provider.com/Location/${locationId}`,
      resource: {
        resourceType: 'Location',
        id: locationId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/location|1.0.0']
        },
        identifier: [
          {
            system: 'http://nphies.sa/license/location-license',
            value: locationLicense
          }
        ],
        status: 'active',
        name: providerName,
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
                code: 'GACH'
              }
            ]
          }
        ],
        managingOrganization: {
          reference: `Organization/${providerId}`
        }
      }
    };
  }

  /**
   * Build complete FHIR Bundle for eligibility request
   * Following NPHIES specification: https://portal.nphies.sa/ig/usecase-eligibility.html
   * Example: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.html
   * Supports discovery mode where coverage is optional
   * @param {Object} data - Contains patient, provider, insurer, coverage (optional), policyHolder (optional), purpose, servicedDate, isNewborn, isTransfer, partialMode
   */
  buildEligibilityRequestBundle(data) {
    const { patient, provider, insurer, coverage, policyHolder, purpose, servicedDate, isNewborn, isTransfer, motherPatient, partialMode } = data;

    // In partial mode, we only include resources that have actual data
    // This is used for preview to show only what the user has filled in
    
    // Build individual resources first to get their fullUrls and IDs
    // For newborn cases, patient is the newborn, and we also need mother patient resource
    const newbornPatientResource = patient ? this.buildPatientResource(patient, partialMode) : null;
    const newbornPatientId = newbornPatientResource ? newbornPatientResource.resource.id : null;
    
    const providerResource = provider ? this.buildProviderOrganization(provider, partialMode) : null;
    const insurerResource = insurer ? this.buildPayerOrganization(insurer, partialMode) : null;
    const locationResource = provider ? this.buildLocationResource(provider, partialMode) : null;
    
    // Build mother patient resource if provided (for newborn requests)
    const motherPatientResource = (isNewborn && motherPatient) ? this.buildPatientResource(motherPatient, partialMode) : null;
    const motherPatientId = motherPatientResource ? motherPatientResource.resource.id : null;
    
    // Build PolicyHolder Organization if provided (employer/company that holds the policy)
    const policyHolderResource = policyHolder ? this.buildPolicyHolderOrganization(policyHolder, partialMode) : null;
    
    // Coverage is optional for discovery mode
    // For newborn cases, pass motherPatient and the generated patient IDs to buildCoverageResource
    const coverageResource = coverage 
      ? this.buildCoverageResource(coverage, patient, insurer, policyHolder, motherPatient, newbornPatientId, motherPatientId, partialMode) 
      : null;
    
    // Pass locationId and patient ID to eligibility request for facility reference
    const eligibilityRequest = this.buildCoverageEligibilityRequest(
      { 
        purpose, 
        servicedDate, 
        isNewborn, 
        isTransfer,
        locationId: locationResource ? locationResource.resource.id : null,
        partialMode
      },
      patient,
      provider,
      insurer,
      coverage,
      newbornPatientId,
      partialMode
    );

    // Build message header (must be first entry in bundle)
    // Use full URL for focus reference as required by NPHIES
    const messageHeader = this.buildMessageHeader(
      'eligibility-request',
      provider,
      insurer,
      eligibilityRequest ? eligibilityRequest.fullUrl : null,
      partialMode
    );

    // Assemble bundle with MessageHeader first per NPHIES specification
    // Bundle structure per NPHIES example (Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959):
    // 1. MessageHeader
    // 2. CoverageEligibilityRequest
    // 3. Coverage (if not discovery mode)
    // 4. PolicyHolder Organization (if provided)
    // 5. Provider Organization
    // 6. Patient
    // 7. Insurer Organization
    // 8. Location
    const entries = [];
    
    // In partial mode, only add resources that exist
    if (messageHeader) entries.push(messageHeader);
    if (eligibilityRequest) entries.push(eligibilityRequest);
    
    // Add coverage only if provided (not in discovery mode)
    if (coverageResource) {
      entries.push(coverageResource);
    }

    // Add PolicyHolder Organization if provided
    if (policyHolderResource) {
      entries.push(policyHolderResource);
    }
    
    // Add remaining resources in NPHIES order
    // For newborn cases, add both newborn and mother patient resources
    if (providerResource) entries.push(providerResource);
    
    // Add patient resources (newborn first, then mother if present)
    if (newbornPatientResource) entries.push(newbornPatientResource);
    if (motherPatientResource) {
      entries.push(motherPatientResource);
    }
    
    if (insurerResource) entries.push(insurerResource);
    if (locationResource) entries.push(locationResource);

    const bundle = {
      resourceType: 'Bundle',
      id: this.generateId(), // Unique ID for each request (required by NPHIES)
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };

    // In partial mode, clean up the bundle to remove empty fields
    if (partialMode) {
      return this.removeEmptyFields(bundle);
    }

    return bundle;
  }

  /**
   * Remove empty/null/undefined fields from an object recursively
   * Used in partial mode to clean up the FHIR bundle
   * @param {any} obj - Object to clean
   * @returns {any} Cleaned object
   */
  removeEmptyFields(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      const filtered = obj
        .map(item => this.removeEmptyFields(item))
        .filter(item => item !== undefined && item !== null && item !== '');
      return filtered.length > 0 ? filtered : undefined;
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      
      if (typeof value === 'object') {
        const cleanedValue = this.removeEmptyFields(value);
        if (cleanedValue !== undefined && 
            (Array.isArray(cleanedValue) ? cleanedValue.length > 0 : Object.keys(cleanedValue).length > 0)) {
          cleaned[key] = cleanedValue;
        }
      } else {
        cleaned[key] = value;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  /**
   * Parse FHIR eligibility response bundle
   * Extracts key information including Site Eligibility extension
   * Reference: https://portal.nphies.sa/ig/usecase-eligibility.html
   */
  parseEligibilityResponse(responseBundle) {
    try {
      if (!responseBundle || !responseBundle.entry) {
        throw new Error('Invalid response bundle');
      }

      // Find key resources in the bundle
      const messageHeader = responseBundle.entry.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
      const eligibilityResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'CoverageEligibilityResponse')?.resource;
      const patient = responseBundle.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
      const coverage = responseBundle.entry.find(e => e.resource?.resourceType === 'Coverage')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;

      // Check if response is nphies-generated (timeout scenario)
      const isNphiesGenerated = responseBundle.meta?.tag?.some(
        tag => tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tag' && 
               tag.code === 'nphies-generated'
      );

      // Check for errors in OperationOutcome
      if (operationOutcome) {
        return {
          success: false,
          outcome: 'error',
          isNphiesGenerated,
          errors: operationOutcome.issue?.map(issue => ({
            severity: issue.severity,
            code: issue.code,
            details: issue.details?.text || issue.diagnostics,
            location: issue.location?.join(', ')
          })) || []
        };
      }

      if (!eligibilityResponse) {
        return {
          success: false,
          outcome: 'error',
          isNphiesGenerated,
          errors: [{ code: 'PARSE_ERROR', details: 'No eligibility response found in bundle' }]
        };
      }

      // Extract Site Eligibility extension from CoverageEligibilityResponse
      // This indicates whether the patient is eligible to have services covered
      const siteEligibility = this.extractSiteEligibility(eligibilityResponse);

      // Extract errors from CoverageEligibilityResponse.error array
      const responseErrors = this.extractResponseErrors(eligibilityResponse);

      // Parse benefits from insurance items
      const benefits = this.extractBenefits(eligibilityResponse);

      // Determine success based on outcome and errors
      const outcome = eligibilityResponse.outcome || 'complete';
      const hasErrors = outcome === 'error' || responseErrors.length > 0;

      return {
        success: !hasErrors,
        outcome,
        disposition: eligibilityResponse.disposition,
        inforce: eligibilityResponse.insurance?.[0]?.inforce,
        nphiesResponseId: eligibilityResponse.identifier?.[0]?.value || eligibilityResponse.id,
        responseCode: messageHeader?.response?.code,
        isNphiesGenerated,
        siteEligibility,
        purpose: eligibilityResponse.purpose,
        responseStatus: eligibilityResponse.status,
        benefits,
        patient: patient ? {
          name: patient.name?.[0]?.text,
          identifier: patient.identifier?.[0]?.value,
          identifierType: patient.identifier?.[0]?.type?.coding?.[0]?.display,
          identifierCountry: patient.identifier?.[0]?.extension?.find(
            e => e.url?.includes('extension-identifier-country')
          )?.valueCodeableConcept?.coding?.[0]?.display ||
          patient.identifier?.[0]?.extension?.find(
            e => e.url?.includes('extension-identifier-country')
          )?.valueCodeableConcept?.coding?.[0]?.code,
          gender: patient.gender,
          birthDate: patient.birthDate,
          phone: patient.telecom?.find(t => t.system === 'phone')?.value,
          occupation: patient.extension?.find(e => e.url?.includes('extension-occupation'))?.valueCodeableConcept?.coding?.[0]?.code,
          maritalStatus: patient.maritalStatus?.coding?.[0]?.code,
          active: patient.active,
          deceased: patient.deceasedBoolean
        } : null,
        coverage: coverage ? {
          policyNumber: coverage.identifier?.[0]?.value,
          memberId: coverage.identifier?.[0]?.value,
          type: coverage.type?.coding?.[0]?.display || coverage.type?.coding?.[0]?.code,
          typeCode: coverage.type?.coding?.[0]?.code,
          status: coverage.status,
          // Extract all class information
          classes: coverage.class?.map(c => ({
            type: c.type?.coding?.[0]?.code,
            value: c.value,
            name: c.name
          })) || [],
          planName: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.name || 
                    coverage.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.value,
          planValue: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.value,
          planClass: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'class')?.value,
          groupName: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'group')?.name ||
                     coverage.class?.find(c => c.type?.coding?.[0]?.code === 'group')?.value,
          groupValue: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'group')?.value,
          network: coverage.network,
          dependent: coverage.dependent,
          relationship: coverage.relationship?.coding?.[0]?.code,
          periodStart: coverage.period?.start,
          periodEnd: coverage.period?.end,
          subrogation: coverage.subrogation,
          costToBeneficiary: coverage.costToBeneficiary?.map(cost => ({
            type: cost.type?.coding?.[0]?.code,
            typeDisplay: cost.type?.coding?.[0]?.display || this.getCostTypeDisplay(cost.type?.coding?.[0]?.code),
            value: cost.valueQuantity?.value ?? cost.valueMoney?.value,
            unit: cost.valueQuantity ? '%' : cost.valueMoney?.currency
          })) || []
        } : null,
        insurer: this.extractInsurerFromResponse(responseBundle),
        servicedPeriod: eligibilityResponse.servicedPeriod,
        errors: responseErrors
      };

    } catch (error) {
      console.error('Error parsing eligibility response:', error);
      return {
        success: false,
        outcome: 'error',
        errors: [{ 
          code: 'PARSE_ERROR', 
          details: error.message 
        }]
      };
    }
  }

  /**
   * Extract Site Eligibility extension from CoverageEligibilityResponse
   * Reference: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-siteEligibility
   * @param {Object} eligibilityResponse - The CoverageEligibilityResponse resource
   * @returns {Object|null} Site eligibility info with code and display
   */
  extractSiteEligibility(eligibilityResponse) {
    if (!eligibilityResponse?.extension) return null;

    const siteEligibilityExt = eligibilityResponse.extension.find(
      ext => ext.url === 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-siteEligibility'
    );

    if (!siteEligibilityExt?.valueCodeableConcept?.coding?.[0]) return null;

    const coding = siteEligibilityExt.valueCodeableConcept.coding[0];
    return {
      code: coding.code,
      display: coding.display || this.getSiteEligibilityDisplay(coding.code),
      system: coding.system
    };
  }

  /**
   * Get display text for site eligibility code
   * Uses database codes with fallback to hardcoded values
   * @param {string} code - The site eligibility code
   * @returns {string} Human-readable display text
   */
  getSiteEligibilityDisplay(code) {
    // Try code service first
    const display = nphiesCodeService.getSiteEligibilityDisplaySync(code);
    if (display !== code) return display;
    
    // Fallback to hardcoded
    const fallback = {
      'eligible': 'Patient is eligible for coverage at this site',
      'not-eligible': 'Patient is not eligible for coverage at this site',
      'not-in-network': 'Provider is not in the patient\'s network',
      'plan-expired': 'Patient\'s plan has expired',
      'coverage-suspended': 'Patient\'s coverage is suspended',
      'benefit-exhausted': 'Patient\'s benefits have been exhausted'
    };
    return fallback[code] || code;
  }

  /**
   * Get display text for cost type code
   * Uses database codes with fallback to hardcoded values
   * @param {string} code - The cost type code
   * @returns {string} Human-readable display text
   */
  getCostTypeDisplay(code) {
    // Try code service first
    const display = nphiesCodeService.getCopayTypeDisplaySync(code);
    if (display !== code) return display;
    
    // Fallback to hardcoded (for backward compatibility)
    const fallback = {
      'copaypct': 'Copay Percentage',
      'maxcopay': 'Maximum Copay',
      'copay': 'Copay Amount',
      'deductible': 'Deductible',
      'coinsurance': 'Coinsurance',
      'gpvisit': 'GP Visit Copay',
      'spvisit': 'Specialist Visit Copay',
      'emergency': 'Emergency Copay',
      'inpatient': 'Inpatient Copay',
      'outpatient': 'Outpatient Copay',
      'pharmacy': 'Pharmacy Copay',
      'dental': 'Dental Copay',
      'vision': 'Vision Copay'
    };
    return fallback[code] || code;
  }

  /**
   * Extract insurer details from response bundle
   * @param {Object} responseBundle - The response bundle
   * @returns {Object|null} Insurer details
   */
  extractInsurerFromResponse(responseBundle) {
    const insurerOrg = responseBundle.entry?.find(
      e => e.resource?.resourceType === 'Organization' && 
           e.resource?.type?.some(t => t.coding?.some(c => c.code === 'ins'))
    )?.resource;

    if (!insurerOrg) return null;

    return {
      name: insurerOrg.name,
      nphiesId: insurerOrg.identifier?.find(i => i.system?.includes('payer-license'))?.value,
      address: insurerOrg.address?.[0]?.text,
      city: insurerOrg.address?.[0]?.city,
      country: insurerOrg.address?.[0]?.country,
      active: insurerOrg.active
    };
  }

  /**
   * Extract errors from CoverageEligibilityResponse.error array
   * @param {Object} eligibilityResponse - The CoverageEligibilityResponse resource
   * @returns {Array} Array of error objects
   */
  extractResponseErrors(eligibilityResponse) {
    if (!eligibilityResponse?.error) return [];

    return eligibilityResponse.error.map(err => {
      const coding = err.code?.coding?.[0];
      const expression = coding?.extension?.find(
        ext => ext.url?.includes('extension-error-expression')
      )?.valueString;

      return {
        code: coding?.code || 'UNKNOWN',
        message: coding?.display || 'Unknown error',
        location: expression || null,
        system: coding?.system
      };
    });
  }

  /**
   * Extract benefits from eligibility response insurance items
   * @param {Object} eligibilityResponse - The CoverageEligibilityResponse resource
   * @returns {Array} Array of benefit objects
   */
  extractBenefits(eligibilityResponse) {
    const benefits = [];
    
    if (!eligibilityResponse?.insurance?.length) return benefits;

    const insurance = eligibilityResponse.insurance[0];
    
    if (!insurance.item) return benefits;

    // Use code service for lookups (falls back to code if not found)
    const getCategoryName = (code) => nphiesCodeService.getBenefitCategoryDisplaySync(code);
    const getNetworkDisplay = (code) => nphiesCodeService.getNetworkDisplaySync(code);
    const getTermDisplay = (code) => nphiesCodeService.getTermDisplaySync(code);

    insurance.item.forEach(item => {
      const categoryCode = item.category?.coding?.[0]?.code;
      const networkCode = item.network?.coding?.[0]?.code;
      const termCode = item.term?.coding?.[0]?.code;

      const benefit = {
        categoryCode,
        category: item.name || getCategoryName(categoryCode),
        description: item.description || '',
        network: getNetworkDisplay(networkCode),
        networkCode,
        term: getTermDisplay(termCode),
        termCode,
        unit: item.unit?.coding?.[0]?.code || 'individual',
        excluded: item.excluded || false,
        benefitDetails: []
      };

      // Extract all benefit details (multiple per item)
      if (item.benefit) {
        item.benefit.forEach(b => {
          const benefitType = b.type?.coding?.[0]?.code;
          const benefitDetail = {
            type: benefitType,
            typeDisplay: this.getBenefitTypeDisplay(benefitType)
          };

          // Handle different value types
          if (b.allowedMoney) {
            benefitDetail.allowedValue = b.allowedMoney.value;
            benefitDetail.allowedCurrency = b.allowedMoney.currency;
            benefitDetail.allowedDisplay = `${b.allowedMoney.value.toLocaleString()} ${b.allowedMoney.currency}`;
          } else if (b.allowedUnsignedInt !== undefined) {
            benefitDetail.allowedValue = b.allowedUnsignedInt;
            benefitDetail.allowedDisplay = benefitType?.includes('percent') ? `${b.allowedUnsignedInt}%` : b.allowedUnsignedInt.toString();
          } else if (b.allowedString) {
            benefitDetail.allowedValue = b.allowedString;
            benefitDetail.allowedDisplay = b.allowedString;
          }

          if (b.usedMoney) {
            benefitDetail.usedValue = b.usedMoney.value;
            benefitDetail.usedCurrency = b.usedMoney.currency;
            benefitDetail.usedDisplay = `${b.usedMoney.value.toLocaleString()} ${b.usedMoney.currency}`;
          } else if (b.usedUnsignedInt !== undefined) {
            benefitDetail.usedValue = b.usedUnsignedInt;
            benefitDetail.usedDisplay = b.usedUnsignedInt.toString();
          }

          // Calculate remaining if both allowed and used are present
          if (typeof benefitDetail.allowedValue === 'number' && typeof benefitDetail.usedValue === 'number') {
            benefitDetail.remainingValue = benefitDetail.allowedValue - benefitDetail.usedValue;
            benefitDetail.remainingDisplay = `${benefitDetail.remainingValue.toLocaleString()} ${benefitDetail.allowedCurrency || ''}`;
          }

          benefit.benefitDetails.push(benefitDetail);
        });
      }

      // For backward compatibility, extract primary benefit values
      const primaryBenefit = benefit.benefitDetails.find(d => d.type === 'benefit');
      if (primaryBenefit) {
        benefit.allowed = primaryBenefit.allowedValue;
        benefit.allowedCurrency = primaryBenefit.allowedCurrency;
        benefit.used = primaryBenefit.usedValue;
        benefit.usedCurrency = primaryBenefit.usedCurrency;
        benefit.remaining = primaryBenefit.remainingValue;
      }

      benefits.push(benefit);
    });

    return benefits;
  }

  /**
   * Get display text for benefit type code
   * Uses database codes with fallback to hardcoded values
   * @param {string} code - The benefit type code
   * @returns {string} Human-readable display text
   */
  getBenefitTypeDisplay(code) {
    // Try code service first
    const display = nphiesCodeService.getBenefitTypeDisplaySync(code);
    if (display !== code) return display;
    
    // Fallback to hardcoded
    const fallback = {
      'benefit': 'Benefit Limit',
      'approval-limit': 'Approval Limit',
      'copay-percent': 'Copay %',
      'copay-maximum': 'Max Copay',
      'copay': 'Copay',
      'deductible': 'Deductible',
      'coinsurance': 'Coinsurance',
      'room': 'Room Type',
      'visit': 'Visit Limit'
    };
    return fallback[code] || code;
  }

  /**
   * Get the code service instance for direct access
   * @returns {NphiesCodeService} The code service
   */
  getCodeService() {
    return nphiesCodeService;
  }
}

export default new NphiesMapper();

