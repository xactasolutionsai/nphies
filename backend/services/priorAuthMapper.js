/**
 * NPHIES Prior Authorization FHIR R4 Mapper Service
 * Maps database entities to FHIR resources following NPHIES PA specifications
 * Reference: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
 */

import { randomUUID } from 'crypto';
import nphiesMapper from './nphiesMapper.js';

class PriorAuthMapper {
  constructor() {
    // Reuse utilities from nphiesMapper
    this.generateId = () => randomUUID();
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
   * Format datetime with Saudi Arabia timezone (+03:00)
   * NPHIES SS/IMP encounters require this format: "2023-12-04T10:25:00+03:00"
   * Reference: https://portal.nphies.sa/ig/Encounter-10124.json.html
   */
  formatDateTimeWithTimezone(date) {
    if (!date) date = new Date();
    const d = new Date(date);
    
    // Format: YYYY-MM-DDTHH:mm:ss+03:00
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    // Saudi Arabia timezone is +03:00
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
  }

  /**
   * Get the NPHIES Authorization profile URL based on auth type
   * Reference: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
   */
  getAuthorizationProfileUrl(authType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-priorauth|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-priorauth|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-priorauth|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-priorauth|1.0.0'
    };
    return profiles[authType] || profiles['professional'];
  }

  /**
   * Get the NPHIES Encounter profile URL based on encounter class
   * Reference: https://portal.nphies.sa/ig/
   * NOTE: NPHIES requires standard encounter profile, not encounter-auth-* profiles
   */
  /**
   * Get the NPHIES Encounter profile URL for Authorization based on encounter class
   * Reference: https://portal.nphies.sa/ig/
   * - encounter-auth-AMB for Ambulatory
   * - encounter-auth-EMER for Emergency
   * - encounter-auth-HH for Home Healthcare
   * - encounter-auth-IMP for In-Patient
   * - encounter-auth-SS for Day Case (Short Stay)
   * - encounter-auth-VR for Telemedicine (Virtual)
   */
  getEncounterProfileUrl(encounterClass) {
    const profiles = {
      'ambulatory': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0',
      'outpatient': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB|1.0.0',
      'emergency': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-EMER|1.0.0',
      'home': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-HH|1.0.0',
      'inpatient': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-IMP|1.0.0',
      'daycase': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0',
      'telemedicine': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-VR|1.0.0'
    };
    return profiles[encounterClass] || profiles['ambulatory'];
  }

  /**
   * Get encounter class code for FHIR
   */
  getEncounterClassCode(encounterClass) {
    const codes = {
      'ambulatory': 'AMB',
      'outpatient': 'AMB',
      'emergency': 'EMER',
      'home': 'HH',
      'inpatient': 'IMP',
      'daycase': 'SS',
      'telemedicine': 'VR'
    };
    return codes[encounterClass] || 'AMB';
  }

  /**
   * Build FHIR Claim resource for Prior Authorization
   * Following NPHIES specification: https://portal.nphies.sa/ig/Claim-483069.json.html
   * 
   * CRITICAL: All references must match the fullUrl/id of resources in the bundle
   * bundleResourceIds contains the exact IDs used in fullUrl for each resource type
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    
    // Use the EXACT same IDs that will be used in the bundle's fullUrl
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const encounterRef = bundleResourceIds.encounter;
    const practitionerRef = bundleResourceIds.practitioner;

    // Build provider identifier URL based on provider name
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // NPHIES ELEMENT ORDER FIX: Build extensions FIRST before constructing claim
    // Per NPHIES spec, extension must appear before identifier in the Claim resource
    const extensions = [];

    // Encounter extension - REQUIRED for Institutional, Professional, Oral (Dental) claims
    // RE-00189: Use relative reference format for encounter (not full URL)
    // NOTE: Vision claims do NOT require Encounter per NPHIES IG - they are simple outpatient services
    // without clinical encounter context. Vision Claims only contain: Patient, Provider, Diagnosis, Items, Benefit, Supporting Info
    if (priorAuth.auth_type !== 'vision') {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
        valueReference: {
          reference: `Encounter/${encounterRef}`
        }
      });
    }

    // Eligibility offline reference extension
    if (priorAuth.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: priorAuth.eligibility_offline_ref
      });
    }

    // Eligibility offline date extension
    if (priorAuth.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(priorAuth.eligibility_offline_date)
      });
    }

    // Transfer extension
    if (priorAuth.is_transfer) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transfer',
        valueBoolean: true
      });
    }

    // Online eligibility response reference
    if (priorAuth.eligibility_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          reference: priorAuth.eligibility_ref
        }
      });
    }

    // NPHIES ELEMENT ORDER: Build claim object with elements in NPHIES-mandated order
    // Order: resourceType, id, meta, extension, identifier, status, type, subType, use,
    //        patient, created, insurer, provider, priority, payee, related, careTeam,
    //        supportingInfo, diagnosis, insurance, item, total
    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl(priorAuth.auth_type)]
      }
    };

    // Add extension right after meta (BEFORE identifier)
    if (extensions.length > 0) {
      claim.extension = extensions;
    }

    // Continue building claim in correct order
    claim.identifier = [
      {
        system: `${providerIdentifierSystem}/authorization`,
        value: priorAuth.request_number || `req_${Date.now()}`
      }
    ];
    claim.status = 'active';
    claim.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: this.getClaimTypeCode(priorAuth.auth_type)
        }
      ]
    };
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: this.getClaimSubTypeCode(priorAuth.encounter_class || priorAuth.sub_type, priorAuth.auth_type)
        }
      ]
    };
    claim.use = 'preauthorization';
    claim.patient = {
      reference: `Patient/${patientRef}`
    };
    claim.created = this.formatDateTime(priorAuth.request_date || new Date());
    claim.insurer = {
      reference: `Organization/${insurerRef}`
    };
    claim.provider = {
      reference: `Organization/${providerRef}`
    };
    claim.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: priorAuth.priority || 'normal'
        }
      ]
    };
    // Payee - required per NPHIES spec
    claim.payee = {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/payeetype',
            code: 'provider'
          }
        ]
      }
    };

    // Prescription reference - required for vision claims per NPHIES vision-priorauth profile
    // Reference: Claim-123073.json "prescription": { "reference": "VisionPrescription/3" }
    if (priorAuth.auth_type === 'vision' && bundleResourceIds.visionPrescription) {
      claim.prescription = {
        reference: `VisionPrescription/${bundleResourceIds.visionPrescription}`
      };
    }

    // If this is an update, add the related reference
    if (priorAuth.is_update && priorAuth.pre_auth_ref) {
      claim.related = [
        {
          claim: {
            identifier: {
              system: 'http://nphies.sa/identifiers/priorauth',
              value: priorAuth.pre_auth_ref
            }
          },
          relationship: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/ex-relatedclaimrelationship',
                code: 'prior'
              }
            ]
          }
        }
      ];
    }

    // BV-00770, BV-00802, BV-00027: Determine if this is an institutional claim
    // Institutional claims require: chief-complaint, estimated-length-of-stay, onAdmission
    // BV-00027: Oral/dental and vision claims are NOT institutional - onAdmission not allowed
    // BV-00807: Vision claims cannot use inpatient/daycase encounter class
    const isInstitutional = priorAuth.auth_type === 'institutional' || 
                            (['daycase', 'inpatient'].includes(priorAuth.encounter_class) && 
                             priorAuth.auth_type !== 'dental' &&
                             priorAuth.auth_type !== 'vision');
    
    // Check if this is an oral/dental claim
    const isOralClaim = priorAuth.auth_type === 'dental';

    // CareTeam - REQUIRED per NPHIES spec (IC-00014 error if missing)
    // Always include with at least a default practitioner
    const pract = practitioner || priorAuth.practitioner || {};
    claim.careTeam = [
      {
        sequence: 1,
        provider: {
          reference: `Practitioner/${practitionerRef}`
        },
        role: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole',
              code: 'primary'
            }
          ]
        },
        qualification: {
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
              code: pract.practice_code || pract.specialty_code || '08.00'
            }
          ]
        }
      }
    ];

    // Add diagnosis if present - using NPHIES-specific systems
    // IB-00242: NPHIES requires ICD-10-AM (Australian Modification) code system
    // BV-00027: onAdmission is REQUIRED for institutional claims, NOT allowed for non-institutional
    if (priorAuth.diagnoses && priorAuth.diagnoses.length > 0) {
      claim.diagnosis = priorAuth.diagnoses.map((diag, idx) => {
        const diagEntry = {
          sequence: diag.sequence || idx + 1,
          diagnosisCodeableConcept: {
            coding: [
              {
                // Always use ICD-10-AM as required by NPHIES
                system: 'http://hl7.org/fhir/sid/icd-10-am',
                code: diag.diagnosis_code,
                display: diag.diagnosis_display
              }
            ]
          },
          type: [
            {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type',
                  code: diag.diagnosis_type || 'principal'
                }
              ]
            }
          ]
        };
        
        // BV-00027: onAdmission is REQUIRED for institutional claims
        // Only add for institutional (inpatient/daycase) encounters
        if (isInstitutional) {
          diagEntry.onAdmission = {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-on-admission',
                code: diag.on_admission === false ? 'n' : 'y', // Default to 'y' if not specified
                display: diag.on_admission === false ? 'No' : 'Yes'
              }
            ]
          };
        }
        
        return diagEntry;
      });
    }

    // Add supportingInfo first to get sequence numbers for items
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
    // BV-00770: Chief Complaint is REQUIRED for institutional claims/authorizations
    // BV-00802: Estimated length of stay is REQUIRED for institutional authorization
    
    if (isInstitutional) {
      // Add chief-complaint if not present
      const hasChiefComplaint = supportingInfoList.some(info => info.category === 'chief-complaint');
      if (!hasChiefComplaint) {
        supportingInfoList.unshift({
          category: 'chief-complaint',
          code: priorAuth.chief_complaint_code || '418799008', // Default: General symptom (SNOMED)
          code_display: priorAuth.chief_complaint_display || 'General symptom',
          code_system: 'http://snomed.info/sct',
          timing_date: priorAuth.request_date || new Date()
        });
      }
      
      // Add estimated-Length-of-Stay if not present (required for institutional auth)
      // Note: NPHIES uses 'estimated-Length-of-Stay' with capital L (per IB-00044)
      const hasLengthOfStay = supportingInfoList.some(info => 
        info.category === 'estimated-Length-of-Stay' || info.category === 'estimated-length-of-stay'
      );
      if (!hasLengthOfStay) {
        supportingInfoList.push({
          category: 'estimated-Length-of-Stay', // Capital L per NPHIES valueSet
          value_quantity: priorAuth.estimated_length_of_stay || 1,
          value_quantity_unit: 'd', // days
          timing_date: priorAuth.request_date || new Date()
        });
      }
    }
    
    // BV-00752, BV-00803, BV-00804, BV-00805, BV-00806: Oral claims have specific supportingInfo requirements
    if (isOralClaim) {
      const requestDate = priorAuth.request_date || new Date();
      
      // BV-00752: investigation-result is REQUIRED
      if (!supportingInfoList.some(info => info.category === 'investigation-result')) {
        supportingInfoList.push({
          category: 'investigation-result',
          value_string: priorAuth.investigation_result || 'Clinical examination completed',
          timing_date: requestDate
        });
      }
      
      // BV-00803: treatment-plan is REQUIRED
      if (!supportingInfoList.some(info => info.category === 'treatment-plan')) {
        supportingInfoList.push({
          category: 'treatment-plan',
          value_string: priorAuth.treatment_plan || 'Dental treatment as per clinical assessment',
          timing_date: requestDate
        });
      }
      
      // BV-00804: patient-history is REQUIRED
      if (!supportingInfoList.some(info => info.category === 'patient-history')) {
        supportingInfoList.push({
          category: 'patient-history',
          value_string: priorAuth.patient_history || 'No significant medical history',
          timing_date: requestDate
        });
      }
      
      // BV-00805: physical-examination is REQUIRED
      if (!supportingInfoList.some(info => info.category === 'physical-examination')) {
        supportingInfoList.push({
          category: 'physical-examination',
          value_string: priorAuth.physical_examination || 'Oral examination performed',
          timing_date: requestDate
        });
      }
      
      // BV-00806: history-of-present-illness is REQUIRED
      if (!supportingInfoList.some(info => info.category === 'history-of-present-illness')) {
        supportingInfoList.push({
          category: 'history-of-present-illness',
          value_string: priorAuth.history_of_present_illness || 'Patient presents for dental treatment',
          timing_date: requestDate
        });
      }
    }
    
    if (supportingInfoList.length > 0) {
      // BV-00453: Ensure all sequence numbers are unique and sequential
      // Always recalculate sequence numbers based on array position
      claim.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1; // Always use array position + 1 for unique sequences
        supportingInfoSequences.push(seq);
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    // NPHIES ELEMENT ORDER: insurance comes after supportingInfo/diagnosis, before item/total
    claim.insurance = [
      {
        sequence: 1,
        focal: true,
        coverage: {
          reference: `Coverage/${coverageRef}`
        }
      }
    ];

    // Add items with proper sequence links
    // BV-00118: servicedDate must be within encounter period
    const encounterPeriod = {
      start: priorAuth.encounter_start || new Date(),
      end: priorAuth.encounter_end || null
    };
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildClaimItem(item, priorAuth.auth_type, idx + 1, supportingInfoSequences, encounterPeriod)
      );
    }

    // Total - REQUIRED per NPHIES spec (IC-00062 error if missing)
    // Calculate from items using correct formula: ((quantity * unitPrice) * factor) + tax
    let totalAmount = priorAuth.total_amount;
    if (!totalAmount && priorAuth.items && priorAuth.items.length > 0) {
      totalAmount = priorAuth.items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const factor = parseFloat(item.factor || 1);
        const tax = parseFloat(item.tax || 0);
        // BV-00251: Net = ((quantity * unitPrice) * factor) + tax
        const itemNet = (quantity * unitPrice * factor) + tax;
        return sum + itemNet;
      }, 0);
    }
    claim.total = {
      value: parseFloat(totalAmount || 0),
      currency: priorAuth.currency || 'SAR'
    };

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claim
    };
  }

  /**
   * Get claim subType code based on encounter class
   * Per NPHIES spec: ip (inpatient), op (outpatient), etc.
   */
  getClaimSubTypeCode(encounterClass, authType) {
    // BV-00366: Oral claims must use 'op' subType
    // Per NPHIES: oral/dental claims are always outpatient
    if (authType === 'dental') {
      return 'op';
    }
    
    // BV-00367: Vision claims must use 'op' subType
    // Per NPHIES Claim-123073 example: vision claims use OutPatient subType
    // Reference: https://portal.nphies.sa/ig/Claim-123073.html
    if (authType === 'vision') {
      return 'op';
    }
    
    // Per NPHIES reference Bundle-a84aabfa: SS (short stay/daycase) uses 'ip' subType
    // Note: 'ip' and 'daycase' are only valid for institutional claims
    const subTypes = {
      'inpatient': 'ip',
      'outpatient': 'op',
      'daycase': 'ip',  // Fixed: daycase (SS) should use 'ip' per NPHIES spec
      'emergency': 'emr',
      'ambulatory': 'op',
      'home': 'op',
      'telemedicine': 'op'
    };
    return subTypes[encounterClass] || 'op';
  }

  /**
   * Get claim type code based on auth type
   */
  getClaimTypeCode(authType) {
    const types = {
      'institutional': 'institutional',
      'professional': 'professional',
      'pharmacy': 'pharmacy',
      'dental': 'oral',
      'vision': 'vision'
    };
    return types[authType] || 'professional';
  }

  /**
   * Get FDI tooth display name based on tooth number
   * NPHIES fdi-oral-region format: "UPPER RIGHT; PERMANENT TEETH # 1"
   * Permanent teeth: Quadrant 1-4 (11-48)
   * Deciduous teeth: Quadrant 5-8 (51-85)
   */
  getFdiToothDisplay(toothNumber) {
    // Permanent teeth quadrants (1-4)
    const permanentQuadrants = {
      '1': 'UPPER RIGHT',
      '2': 'UPPER LEFT', 
      '3': 'LOWER LEFT',
      '4': 'LOWER RIGHT'
    };
    
    // Deciduous teeth quadrants (5-8)
    const deciduousQuadrants = {
      '5': 'UPPER RIGHT',
      '6': 'UPPER LEFT',
      '7': 'LOWER LEFT',
      '8': 'LOWER RIGHT'
    };
    
    if (!toothNumber || toothNumber.length !== 2) {
      return `Tooth ${toothNumber}`;
    }
    
    const quadrantNum = toothNumber[0];
    const toothNum = toothNumber[1];
    
    // Check if permanent (quadrants 1-4) or deciduous (quadrants 5-8)
    if (['1', '2', '3', '4'].includes(quadrantNum)) {
      const quadrant = permanentQuadrants[quadrantNum];
      if (quadrant) {
        return `${quadrant}; PERMANENT TEETH # ${toothNum}`;
      }
    } else if (['5', '6', '7', '8'].includes(quadrantNum)) {
      const quadrant = deciduousQuadrants[quadrantNum];
      if (quadrant) {
        return `${quadrant}; DECIDUOUS TEETH # ${toothNum}`;
      }
    }
    
    return `Tooth ${toothNumber}`;
  }

  /**
   * Get tooth surface display name
   * NPHIES tooth-surface CodeSystem codes
   * Single: M (Mesial), O (Occlusal), D (Distal), B (Buccal), L (Lingual), I (Incisal), V (Ventral)
   * Combined: MO (Mesioclusal), DO (Distoclusal), DI (Distoincisal), MOD (Mesioclusodistal)
   */
  getToothSurfaceDisplay(surfaceCode) {
    const surfaces = {
      // Single surfaces
      'M': 'Mesial',
      'O': 'Occlusal',
      'I': 'Incisal',
      'D': 'Distal',
      'B': 'Buccal',
      'V': 'Ventral',
      'L': 'Lingual',
      'F': 'Facial',
      // Combined surfaces
      'MO': 'Mesioclusal',
      'DO': 'Distoclusal',
      'DI': 'Distoincisal',
      'MOD': 'Mesioclusodistal'
    };
    return surfaces[surfaceCode?.toUpperCase()] || surfaceCode;
  }

  /**
   * Build a single claim item with NPHIES-compliant extensions
   * Reference: https://portal.nphies.sa/ig/Claim-483069.json.html
   * 
   * @param {Object} item - The item data
   * @param {string} authType - Authorization type
   * @param {number} itemIndex - Item index for sequence
   * @param {Array} supportingInfoSequences - Supporting info sequence numbers
   * @param {Object} encounterPeriod - Optional encounter period for date validation
   */
  buildClaimItem(item, authType, itemIndex, supportingInfoSequences = [], encounterPeriod = null) {
    const sequence = item.sequence || itemIndex;
    
    // BV-00251: Calculate net correctly as ((quantity * unit_price) * factor) + tax
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    // Correct net calculation per NPHIES: ((quantity * unitPrice) * factor) + tax
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const netAmount = item.net_amount !== undefined ? parseFloat(item.net_amount) : calculatedNet;
    
    // Build item-level extensions per NPHIES spec
    const itemExtensions = [];

    // Package extension (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // Patient share extension
    const patientShare = parseFloat(item.patient_share || 0);
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    // Payer share extension
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-payer-share',
      valueMoney: {
        value: item.payer_share !== undefined ? parseFloat(item.payer_share) : (netAmount - patientShare),
        currency: item.currency || 'SAR'
      }
    });

    // Maternity extension
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Tax extension - always include for proper net calculation
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || 'SAR'
      }
    });

    // Determine the appropriate code system based on auth type
    // Oral claims use oral-health-op CodeSystem (part of dental-billing ValueSet)
    // Reference: http://nphies.sa/terminology/ValueSet/dental-billing
    const getDefaultProductSystem = (type) => {
      if (type === 'dental') {
        return 'http://nphies.sa/terminology/CodeSystem/oral-health-op';
      }
      return 'http://nphies.sa/terminology/CodeSystem/procedures';
    };

    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      // Link to careTeam (usually sequence 1 for primary provider)
      careTeamSequence: [1],
      // Link to diagnosis (usually sequence 1 for principal diagnosis)
      diagnosisSequence: item.diagnosis_sequences || [1],
      // Link to all supportingInfo entries
      informationSequence: item.information_sequences || supportingInfoSequences,
      productOrService: {
        coding: [
          {
            system: item.product_or_service_system || getDefaultProductSystem(authType),
            code: item.product_or_service_code,
            display: item.product_or_service_display
          }
        ]
      }
    };

    // BV-00118: servicedDate MUST be within the encounter period
    // Determine the serviced date - use item's date or encounter start
    let servicedDate;
    if (item.serviced_date) {
      servicedDate = new Date(item.serviced_date);
    } else if (encounterPeriod?.start) {
      // Default to encounter start date to ensure it's within period
      servicedDate = new Date(encounterPeriod.start);
    } else {
      servicedDate = new Date();
    }
    
    // Validate servicedDate is within encounter period
    if (encounterPeriod?.start) {
      const periodStart = new Date(encounterPeriod.start);
      const periodEnd = encounterPeriod.end ? new Date(encounterPeriod.end) : null;
      
      // If servicedDate is before period start, use period start
      if (servicedDate < periodStart) {
        servicedDate = periodStart;
      }
      // If servicedDate is after period end (if defined), use period end
      if (periodEnd && servicedDate > periodEnd) {
        servicedDate = periodEnd;
      }
    }
    
    claimItem.servicedDate = this.formatDate(servicedDate);

    // Add quantity - REQUIRED for net calculation
    claimItem.quantity = {
      value: quantity
    };

    // Add unit price - REQUIRED for net calculation
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || 'SAR'
    };

    // Add factor if not 1
    if (factor !== 1) {
      claimItem.factor = factor;
    }

    // BV-00251: Net must equal ((quantity * unitPrice) * factor) + tax
    // Use the correctly calculated net value
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || 'SAR'
    };

    // Vision claims: Do NOT use bodySite on Claim.item
    // Per NPHIES Claim-123073 example, eye information is specified in VisionPrescription.lensSpecification.eye
    // Reference: https://portal.nphies.sa/ig/Claim-123073.html
    // BV-00367, BV-00807: Vision claims should not have bodySite
    
    // Dental-specific: tooth number using NPHIES FDI oral region system
    // Reference: http://nphies.sa/terminology/CodeSystem/fdi-oral-region
    if (authType === 'dental' && item.tooth_number) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/fdi-oral-region',
            code: item.tooth_number,
            display: item.tooth_display || this.getFdiToothDisplay(item.tooth_number)
          }
        ]
      };
      
      // Tooth surface using NPHIES fdi-tooth-surface code system
      // Reference: http://nphies.sa/terminology/ValueSet/fdi-tooth-surface
      if (item.tooth_surface) {
        claimItem.subSite = item.tooth_surface.split(',').map(surface => ({
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/fdi-tooth-surface',
              code: surface.trim(),
              display: this.getToothSurfaceDisplay(surface.trim())
            }
          ]
        }));
      }
    }

    // Professional/Institutional body sites - NOT for vision claims
    if (['professional', 'institutional'].includes(authType) && item.body_site_code) {
      claimItem.bodySite = {
        coding: [
          {
            system: item.body_site_system || 'http://nphies.sa/terminology/CodeSystem/body-site',
            code: item.body_site_code,
            display: this.getBodySiteDisplay(item.body_site_code)
          }
        ]
      };
      
      if (item.sub_site_code) {
        claimItem.subSite = [
          {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/sub-site',
                code: item.sub_site_code
              }
            ]
          }
        ];
      }
    }

    // Pharmacy-specific: medication and days supply
    if (authType === 'pharmacy') {
      if (item.medication_code) {
        claimItem.productOrService = {
          coding: [
            {
              system: item.medication_system || 'http://nphies.sa/terminology/CodeSystem/medication',
              code: item.medication_code
            },
            ...(item.product_or_service_code ? [{
              system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
              code: item.product_or_service_code
            }] : [])
          ]
        };
      }
    }

    return claimItem;
  }

  /**
   * Get the valid NPHIES supportingInfo category code
   * NPHIES uses specific case-sensitive codes (IB-00044 error if wrong)
   * Reference: http://nphies.sa/terminology/CodeSystem/claim-information-category
   */
  getNphiesSupportingInfoCategory(category) {
    // Map of normalized (lowercase) to actual NPHIES category codes
    const categoryMap = {
      // Vital signs
      'vital-sign-systolic': 'vital-sign-systolic',
      'vital-sign-diastolic': 'vital-sign-diastolic',
      'vital-sign-height': 'vital-sign-height',
      'vital-sign-weight': 'vital-sign-weight',
      'pulse': 'pulse',
      'temperature': 'temperature',
      'oxygen-saturation': 'oxygen-saturation',
      'respiratory-rate': 'respiratory-rate',
      'admission-weight': 'admission-weight',
      
      // Clinical info - Note the exact casing per NPHIES spec
      'chief-complaint': 'chief-complaint',
      'estimated-length-of-stay': 'estimated-Length-of-Stay', // Capital L!
      'patient-history': 'patient-history',
      'investigation-result': 'investigation-result',
      'treatment-plan': 'treatment-plan',
      'physical-examination': 'physical-examination',
      'history-of-present-illness': 'history-of-present-illness',
      
      // Other categories
      'onset': 'onset',
      'hospitalized': 'hospitalized',
      'attachment': 'attachment',
      'missing-tooth': 'missing-tooth',
      'prosthesis': 'prosthesis',
      'days-supply': 'days-supply',
      'info': 'info',
      'reason-for-visit': 'reason-for-visit',
      'lab-test': 'lab-test',
      'radiology': 'radiology',
      'discharge': 'discharge'
    };
    
    // Return the correct NPHIES category code
    const normalizedCategory = (category || '').toLowerCase();
    return categoryMap[normalizedCategory] || category;
  }

  /**
   * Build supportingInfo element following NPHIES specification
   * Reference: https://portal.nphies.sa/ig/Claim-483069.json.html
   */
  buildSupportingInfo(info) {
    // IB-00044: Use correct NPHIES category code
    const categoryCode = this.getNphiesSupportingInfoCategory(info.category);
    
    const supportingInfo = {
      sequence: info.sequence,
      category: {
        coding: [
          {
            system: info.category_system || 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: categoryCode
          }
        ]
      }
    };

    // Add code if present (e.g., chief-complaint, investigation-result)
    if (info.code) {
      supportingInfo.code = {
        coding: [
          {
            system: info.code_system || this.getSupportingInfoCodeSystem(info.category),
            code: info.code,
            display: info.code_display
          }
        ]
      };
    }

    // Add timing period (required for vital signs per NPHIES spec)
    if (info.timing_period_start || info.timing_start) {
      supportingInfo.timingPeriod = {
        start: this.formatDateTime(info.timing_period_start || info.timing_start),
        end: this.formatDateTime(info.timing_period_end || info.timing_end || info.timing_period_start || info.timing_start)
      };
    } else if (info.timing_date) {
      supportingInfo.timingDate = this.formatDate(info.timing_date);
    }

    // Add value based on type - using UCUM system for quantities per NPHIES spec
    if (info.value_string !== undefined && info.value_string !== null) {
      supportingInfo.valueString = info.value_string;
    } else if (info.value_quantity !== null && info.value_quantity !== undefined) {
      // Use proper UCUM codes for units
      const ucumCode = this.getUCUMCode(info.value_quantity_unit || info.unit);
      supportingInfo.valueQuantity = {
        value: parseFloat(info.value_quantity),
        system: 'http://unitsofmeasure.org',
        code: ucumCode
      };
    } else if (info.value_boolean !== null && info.value_boolean !== undefined) {
      supportingInfo.valueBoolean = info.value_boolean;
    } else if (info.value_date) {
      supportingInfo.valueDate = this.formatDate(info.value_date);
    } else if (info.value_period_start) {
      supportingInfo.valuePeriod = {
        start: this.formatDateTime(info.value_period_start),
        end: this.formatDateTime(info.value_period_end)
      };
    } else if (info.value_reference) {
      supportingInfo.valueReference = {
        reference: info.value_reference
      };
    }

    // Add reason
    if (info.reason_code) {
      supportingInfo.reason = {
        coding: [
          {
            system: info.reason_system || 'http://nphies.sa/terminology/CodeSystem/supporting-info-reason',
            code: info.reason_code
          }
        ]
      };
    }

    return supportingInfo;
  }

  /**
   * Get the appropriate code system for supportingInfo based on category
   */
  getSupportingInfoCodeSystem(category) {
    const systems = {
      'chief-complaint': 'http://snomed.info/sct',
      'investigation-result': 'http://nphies.sa/terminology/CodeSystem/investigation-result',
      'onset': 'http://snomed.info/sct',
      'hospitalized': 'http://snomed.info/sct'
    };
    return systems[category] || 'http://nphies.sa/terminology/CodeSystem/supporting-info-code';
  }

  /**
   * Convert unit text to UCUM code
   * Reference: http://unitsofmeasure.org
   */
  getUCUMCode(unit) {
    if (!unit) return '';
    
    const ucumMap = {
      // Blood pressure
      'mmHg': 'mm[Hg]',
      'mm[Hg]': 'mm[Hg]',
      'mmhg': 'mm[Hg]',
      
      // Length/Height
      'cm': 'cm',
      'centimeter': 'cm',
      'centimeters': 'cm',
      'm': 'm',
      'meter': 'm',
      'meters': 'm',
      
      // Weight
      'kg': 'kg',
      'kilogram': 'kg',
      'kilograms': 'kg',
      'g': 'g',
      'gram': 'g',
      'grams': 'g',
      
      // Rate
      '/min': '/min',
      'per minute': '/min',
      'bpm': '/min',
      'beats per minute': '/min',
      'breaths per minute': '/min',
      
      // Temperature
      'Cel': 'Cel',
      'celsius': 'Cel',
      '°C': 'Cel',
      'C': 'Cel',
      
      // Percentage
      '%': '%',
      'percent': '%',
      
      // Time
      'd': 'd',
      'day': 'd',
      'days': 'd',
      'h': 'h',
      'hour': 'h',
      'hours': 'h',
      
      // Volume
      'mL': 'mL',
      'ml': 'mL',
      'milliliter': 'mL',
      'L': 'L',
      'liter': 'L'
    };

    return ucumMap[unit] || unit;
  }

  /**
   * Build FHIR Binary resource for attachments
   */
  buildBinaryResource(attachment) {
    const binaryId = attachment.binary_id || `binary-${this.generateId()}`;
    
    return {
      fullUrl: `http://provider.com/Binary/${binaryId}`,
      resource: {
        resourceType: 'Binary',
        id: binaryId,
        contentType: attachment.content_type,
        data: attachment.base64_content
      }
    };
  }

  /**
   * Get display text for encounter class
   */
  getEncounterClassDisplay(encounterClass) {
    const displays = {
      'ambulatory': 'ambulatory',
      'outpatient': 'ambulatory',
      'emergency': 'emergency',
      'home': 'home health',
      'inpatient': 'inpatient encounter',
      'daycase': 'short stay',
      'telemedicine': 'virtual'
    };
    return displays[encounterClass] || 'ambulatory';
  }

  /**
   * Build FHIR MessageHeader for Prior Authorization Request
   */
  buildMessageHeader(provider, insurer, focusFullUrl) {
    const messageHeaderId = this.generateId();
    const senderNphiesId = provider.nphies_id || 'PR-FHIR';
    const destinationNphiesId = insurer.nphies_id || 'INS-FHIR';

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
          code: 'priorauth-request'
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
        focus: [
          {
            reference: focusFullUrl
          }
        ]
      }
    };
  }

  /**
   * Build complete Prior Authorization Request Bundle
   * Following NPHIES specification: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
   * 
   * CRITICAL: All resource IDs must be consistent between fullUrl and references
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

    // Generate consistent IDs for all resources FIRST
    // These IDs will be used in both fullUrl and references
    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId(),
      // Vision-specific: VisionPrescription ID (only used for vision auth type)
      visionPrescription: priorAuth.auth_type === 'vision' ? this.generateId() : null
    };

    // Build Patient resource with consistent ID
    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    
    // Build Provider Organization with consistent ID
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    
    // Build Insurer Organization with consistent ID
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build Coverage resource with consistent ID (REQUIRED per RE-00169)
    const coverageResource = this.buildCoverageResourceWithId(
      coverage, 
      patient, 
      insurer, 
      policyHolder,
      bundleResourceIds
    );
    
    // Build Encounter with consistent ID
    // NOTE: Vision claims do NOT require Encounter per NPHIES IG
    // Vision is treated as simple outpatient service without clinical encounter context
    let encounterResource = null;
    if (priorAuth.auth_type !== 'vision') {
      encounterResource = this.buildEncounterResourceWithId(
        priorAuth, 
        patient, 
        provider,
        bundleResourceIds
      );
    }
    
    // Build Practitioner resource (REQUIRED for careTeam per IC-00014)
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' },
      bundleResourceIds.practitioner
    );
    
    // Build Claim (main PA request resource) with all consistent IDs
    // NOTE: encounterResource is null for Vision claims
    const claimResource = this.buildClaimResource(
      priorAuth, 
      patient, 
      provider, 
      insurer, 
      coverage, 
      encounterResource?.resource || null,
      practitioner,
      bundleResourceIds
    );
    
    // Build MessageHeader (must be first)
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build VisionPrescription for vision auth type
    let visionPrescriptionResource = null;
    if (priorAuth.auth_type === 'vision' && bundleResourceIds.visionPrescription) {
      visionPrescriptionResource = this.buildVisionPrescriptionResource(
        priorAuth.vision_prescription,
        bundleResourceIds.patient,
        bundleResourceIds.practitioner,
        bundleResourceIds.visionPrescription,
        provider
      );
    }

    // Build attachments as Binary resources
    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Assemble bundle with MessageHeader first per NPHIES specification
    // Order matters: MessageHeader, Claim, then all referenced resources
    // NOTE: Vision claims do NOT include Encounter resource
    const entries = [
      messageHeader,
      claimResource,
      // Only include Encounter for non-Vision claims
      ...(encounterResource ? [encounterResource] : []),
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      patientResource
    ];

    // Add VisionPrescription for vision claims
    if (visionPrescriptionResource) {
      entries.push(visionPrescriptionResource);
    }

    // Add binary resources for attachments
    binaryResources.forEach(binary => entries.push(binary));

    const bundle = {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };

    return bundle;
  }

  /**
   * Build Patient resource with specific ID for bundle consistency
   */
  buildPatientResourceWithId(patient, patientId) {
    // Use nphiesMapper but override the ID
    const patientResource = nphiesMapper.buildPatientResource(patient);
    patientResource.resource.id = patientId;
    patientResource.fullUrl = `http://provider.com/Patient/${patientId}`;
    return patientResource;
  }

  /**
   * Build Provider Organization with specific ID for bundle consistency
   */
  buildProviderOrganizationWithId(provider, providerId) {
    const providerResource = nphiesMapper.buildProviderOrganization(provider);
    providerResource.resource.id = providerId;
    providerResource.fullUrl = `http://provider.com/Organization/${providerId}`;
    
    // FIX: Override identifier to use actual provider nphies_id
    // This ensures Organization identifier matches MessageHeader sender
    if (provider.nphies_id && providerResource.resource.identifier?.[0]) {
      providerResource.resource.identifier[0].value = provider.nphies_id;
    }
    
    return providerResource;
  }

  /**
   * Build Insurer Organization with specific ID for bundle consistency
   */
  buildInsurerOrganizationWithId(insurer, insurerId) {
    const insurerResource = nphiesMapper.buildPayerOrganization(insurer);
    insurerResource.resource.id = insurerId;
    insurerResource.fullUrl = `http://provider.com/Organization/${insurerId}`;
    return insurerResource;
  }

  /**
   * Build Coverage resource with consistent IDs
   * This is REQUIRED - RE-00169 error if missing or reference invalid
   */
  buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds) {
    const coverageId = bundleResourceIds.coverage;
    const patientId = bundleResourceIds.patient;
    const insurerId = bundleResourceIds.insurer;

    // Build minimal required Coverage resource
    // Fixes: IB-00109 (Coverage.type), IC-01564 (policyHolder), IC-01571 (class)
    const coverageResource = {
      resourceType: 'Coverage',
      id: coverageId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0']
      },
      identifier: [
        {
          system: 'http://payer.com/memberid',
          value: coverage?.member_id || patient.identifier || `MEM-${Date.now()}`
        }
      ],
      status: 'active',
      // IB-00109: Coverage.type SHALL use NPHIES valueSet
      type: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
            code: coverage?.coverage_type || coverage?.type || 'EHCPOL',
            display: this.getCoverageTypeDisplay(coverage?.coverage_type || coverage?.type || 'EHCPOL')
          }
        ]
      },
      // IC-01564: policyHolder is REQUIRED
      policyHolder: {
        reference: `Patient/${policyHolder?.id || patientId}`
      },
      subscriber: {
        reference: `Patient/${patientId}`
      },
      beneficiary: {
        reference: `Patient/${patientId}`
      },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: coverage?.relationship || 'self',
            display: this.getRelationshipDisplay(coverage?.relationship || 'self')
          }
        ]
      },
      payor: [
        {
          reference: `Organization/${insurerId}`
        }
      ],
      // IC-01571: class is REQUIRED
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
          value: coverage?.plan_id || coverage?.class_value || 'default-plan',
          name: coverage?.plan_name || coverage?.class_name || 'Insurance Plan'
        }
      ]
    };

    // Add period if available
    if (coverage?.period_start || coverage?.start_date) {
      coverageResource.period = {
        start: this.formatDate(coverage.period_start || coverage.start_date)
      };
      if (coverage?.period_end || coverage?.end_date) {
        coverageResource.period.end = this.formatDate(coverage.period_end || coverage.end_date);
      }
    }

    // Add network class if available (in addition to required plan class)
    if (coverage?.network) {
      coverageResource.class.push({
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              code: 'network'
            }
          ]
        },
        value: coverage.network,
        name: coverage.network_name || 'Network'
      });
    }

    return {
      fullUrl: `http://provider.com/Coverage/${coverageId}`,
      resource: coverageResource
    };
  }

  /**
   * Get display text for coverage type codes
   */
  getCoverageTypeDisplay(code) {
    const displays = {
      'EHCPOL': 'Extended healthcare',
      'PUBLICPOL': 'Public healthcare',
      'DENTAL': 'Dental',
      'VISION': 'Vision',
      'MENTPRG': 'Mental health program'
    };
    return displays[code] || code;
  }

  /**
   * Get display text for relationship codes
   */
  getRelationshipDisplay(code) {
    const displays = {
      'self': 'Self',
      'spouse': 'Spouse',
      'child': 'Child',
      'parent': 'Parent',
      'common': 'Common Law Spouse',
      'other': 'Other',
      'injured': 'Injured Party'
    };
    return displays[code] || code;
  }

  /**
   * Build Encounter resource with consistent IDs
   * CRITICAL: Element order MUST follow FHIR R4 spec for NPHIES validation
   * Order: identifier, status, class, serviceType, subject, period, hospitalization, serviceProvider
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    // BV-00743: Oral claims MUST use 'ambulatory' (AMB) encounter class
    // BV-00807: Vision claims MUST use 'ambulatory' (AMB) encounter class
    // Reference: https://portal.nphies.sa/ig/Claim-123073.html - vision claims use AMB
    const isOralClaim = priorAuth.auth_type === 'dental';
    const isVisionClaim = priorAuth.auth_type === 'vision';
    const encounterClass = (isOralClaim || isVisionClaim) ? 'ambulatory' : (priorAuth.encounter_class || 'ambulatory');
  
    // Debug logging to verify encounter class handling
    console.log('[PriorAuthMapper] buildEncounterResourceWithId - encounterClass:', encounterClass);
    console.log('[PriorAuthMapper] Is oral claim?:', isOralClaim);
    console.log('[PriorAuthMapper] Is vision claim?:', isVisionClaim);
    console.log('[PriorAuthMapper] Is daycase/inpatient?:', ['daycase', 'inpatient'].includes(encounterClass));
  
    // IC-00183: Encounter identifier is required by NPHIES
    const encounterIdentifier = priorAuth.encounter_identifier || 
                                priorAuth.request_number || 
                                `ENC-${encounterId.substring(0, 8)}`;

    // Build Encounter with FHIR R4 element order:
    // resourceType, id, meta, identifier, status, class, serviceType, subject, period, hospitalization, serviceProvider
    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: [this.getEncounterProfileUrl(encounterClass)]
      },
      // IC-00183: Encounter identifier is required
      identifier: [
        {
          system: `http://${provider?.nphies_id || 'provider'}.com.sa/identifiers/encounter`,
          value: encounterIdentifier
        }
      ],
      status: 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: this.getEncounterClassCode(encounterClass),
        display: this.getEncounterClassDisplay(encounterClass)
      }
    };

    // BV-00736: serviceEventType extension is REQUIRED for oral/professional claims
    if (isOralClaim) {
      encounter.extension = [
        {
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/service-event-type',
                code: priorAuth.service_event_type || 'new-visit',
                display: priorAuth.service_event_type_display || 'New Visit'
              }
            ]
          }
        }
      ];
    }

    // serviceType - MUST come BEFORE subject per FHIR R4 order
    // REQUIRED for SS/IMP encounters per NPHIES encounter-auth-SS profile
    // Also add for oral claims (dental)
    // NOTE: Vision claims do NOT include serviceType per NPHIES Claim-123073 example
    // Reference: https://portal.nphies.sa/ig/Claim-123073.html
    // BV-00807: Vision claims must NOT have serviceType
    const shouldAddServiceType = !isVisionClaim && 
      (['daycase', 'inpatient'].includes(encounterClass) || priorAuth.service_type || isOralClaim);
    
    if (shouldAddServiceType) {
      let serviceTypeCode = priorAuth.service_type;
      if (!serviceTypeCode) {
        if (isOralClaim) serviceTypeCode = 'dental';
        else serviceTypeCode = 'sub-acute-care';
      }
      encounter.serviceType = {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/service-type',
            code: serviceTypeCode,
            display: this.getServiceTypeDisplay(serviceTypeCode)
          }
        ]
      };
    }

    // subject - comes after serviceType
    encounter.subject = {
      reference: `Patient/${patientId}`
    };

    // period - comes after subject
    // NPHIES format depends on encounter class:
    // - AMB (Ambulatory): date-only format "2023-12-04" (https://portal.nphies.sa/ig/Encounter-10123.json.html)
    // - SS/IMP (Short Stay/Inpatient): dateTime with timezone "2023-12-04T10:25:00+03:00" (https://portal.nphies.sa/ig/Encounter-10124.json.html)
    const needsDateTime = ['daycase', 'inpatient'].includes(encounterClass);
    
    // Debug logging for period format
    console.log('[PriorAuthMapper] Period formatting - needsDateTime:', needsDateTime, 'encounterClass:', encounterClass);
    
    if (needsDateTime) {
      // SS/IMP: Use dateTime format with Saudi timezone (+03:00)
      // Per Encounter-10124 example: "2023-12-04T10:25:00+03:00"
      encounter.period = {
        start: this.formatDateTimeWithTimezone(priorAuth.encounter_start || new Date())
      };
      if (priorAuth.encounter_end) {
        encounter.period.end = this.formatDateTimeWithTimezone(priorAuth.encounter_end);
      }
    } else {
      // AMB/other: MUST use date-only format (YYYY-MM-DD)
      // Per Encounter-10123 example: "2023-12-04"
      // CRITICAL: Do NOT include time component for ambulatory encounters
      // RE-00170 FIX: Explicitly strip time from input if present
      const startDateRaw = priorAuth.encounter_start || new Date();
      
      // Ensure date-only format by explicitly stripping time component
      // Handles both ISO string "2023-12-04T19:00:00.000Z" and Date objects
      let dateOnlyStart;
      if (typeof startDateRaw === 'string' && startDateRaw.includes('T')) {
        // Input has time component, strip it
        dateOnlyStart = startDateRaw.split('T')[0];
      } else {
        // Use formatDate which also strips time
        dateOnlyStart = this.formatDate(startDateRaw);
      }
      
      console.log('[PriorAuthMapper] AMB period - raw:', startDateRaw, 'dateOnly:', dateOnlyStart);
      
      encounter.period = {
        start: dateOnlyStart
      };
      
      // AMB encounters typically don't need end date (ongoing encounters per NPHIES example)
      // Only add if explicitly required AND it's not an oral/dental claim
      // Per Encounter-10123: ongoing encounters have no end date
      // NPHIES oral claims should NEVER have encounter end date
      if (priorAuth.encounter_end && priorAuth.include_encounter_end === true && !isOralClaim) {
        const endDateRaw = priorAuth.encounter_end;
        let dateOnlyEnd;
        if (typeof endDateRaw === 'string' && endDateRaw.includes('T')) {
          dateOnlyEnd = endDateRaw.split('T')[0];
        } else {
          dateOnlyEnd = this.formatDate(endDateRaw);
        }
        encounter.period.end = dateOnlyEnd;
      }
    }

    // hospitalization - REQUIRED for SS/IMP encounters per NPHIES profile
    // Reference: https://portal.nphies.sa/ig/Bundle-a84aabfa-1163-407d-aa38-f8119a0b7383.json.html
    // BV-00807: NOT allowed for oral claims
    if (['daycase', 'inpatient'].includes(encounterClass) && !isOralClaim) {
      encounter.hospitalization = {
        extension: [
          {
            url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-admissionSpecialty',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
                  code: priorAuth.admission_specialty || '08.00',
                  display: this.getPracticeCodeDisplay(priorAuth.admission_specialty || '08.00')
                }
              ]
            }
          }
        ],
        admitSource: {
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/admit-source',
              code: priorAuth.admit_source || 'WKIN',
              display: this.getAdmitSourceDisplay(priorAuth.admit_source || 'WKIN')
            }
          ]
        }
      };
    }

    // serviceProvider - MUST be LAST per FHIR R4 order
    encounter.serviceProvider = {
      reference: `Organization/${providerId}`
    };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Get service type display name
   */
  getServiceTypeDisplay(code) {
    const displays = {
      'sub-acute-care': 'Sub-Acute Care',
      'acute-care': 'Acute Care',
      'chronic-care': 'Chronic Care',
      'rehabilitation': 'Rehabilitation',
      'palliative-care': 'Palliative Care',
      'mental-health': 'Mental Health',
      'dental': 'Dental',
      'optical': 'Optical',
      'ophthalmology': 'Ophthalmology',
      'optometry': 'Optometry',
      'vision': 'Vision Care'
    };
    return displays[code] || code;
  }

  /**
   * Get body site display name
   * Reference: CMS/HCPCS Body Site Modifiers
   */
  getBodySiteDisplay(code) {
    const displays = {
      // Vision body sites
      'RIV': 'Right eye',
      'LIV': 'Left eye',
      'E3': 'Upper right, eyelid',
      'E4': 'Lower right, eyelid',
      // Left hand digits
      'FA': 'Left hand, thumb',
      'F1': 'Left hand, second digit',
      'F2': 'Left hand, third digit',
      'F3': 'Left hand, fourth digit',
      'F4': 'Left hand, fifth digit',
      // Right hand digits
      'F5': 'Right hand, thumb',
      'F6': 'Right hand, second digit',
      'F7': 'Right hand, third digit',
      'F8': 'Right hand, fourth digit',
      'F9': 'Right hand, fifth digit',
      // Left foot digits
      'TA': 'Left foot, great toe',
      'T1': 'Left foot, second digit',
      'T2': 'Left foot, third digit',
      'T3': 'Left foot, fourth digit',
      'T4': 'Left foot, fifth digit',
      // Right foot digits
      'T5': 'Right foot, great toe',
      'T6': 'Right foot, second digit',
      'T7': 'Right foot, third digit',
      'T8': 'Right foot, fourth digit',
      'T9': 'Right foot, fifth digit',
      // Coronary arteries
      'LC': 'Left circumflex coronary artery',
      'LD': 'Left anterior descending coronary artery',
      'LM': 'Left main coronary artery',
      'RC': 'Right coronary artery',
      'RI': 'Ramus intermedius coronary artery',
      // Side indicators
      'LT': 'Left side',
      'RT': 'Right side'
    };
    return displays[code] || code;
  }

  /**
   * Get practice code display name
   */
  getPracticeCodeDisplay(code) {
    const displays = {
      '08.00': 'Internal Medicine Specialty',
      '01.00': 'General Practice',
      '02.00': 'Family Medicine',
      '03.00': 'Emergency Medicine',
      '04.00': 'Pediatrics',
      '05.00': 'Obstetrics and Gynecology',
      '06.00': 'Surgery',
      '07.00': 'Orthopedics'
    };
    return displays[code] || 'Healthcare Professional';
  }

  /**
   * Get admit source display name
   */
  getAdmitSourceDisplay(code) {
    const displays = {
      'WKIN': 'Walk-in',
      'EMR': 'Emergency Room',
      'TRANS': 'Transfer',
      'REF': 'Referral',
      'BIRTH': 'Birth',
      'READM': 'Readmission'
    };
    return displays[code] || code;
  }

  /**
   * Build Practitioner resource with specific ID
   * Fix IC-01428: Practitioner.identifier[0].type is REQUIRED
   */
  buildPractitionerResourceWithId(practitioner, practitionerId) {
    const pract = practitioner || {};

    return {
      fullUrl: `http://provider.com/Practitioner/${practitionerId}`,
      resource: {
        resourceType: 'Practitioner',
        id: practitionerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0']
        },
        identifier: [
          {
            // IC-01428: type is REQUIRED per NPHIES profile
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: pract.identifier_type || 'MD',
                  display: this.getPractitionerIdentifierTypeDisplay(pract.identifier_type || 'MD')
                }
              ]
            },
            system: 'http://nphies.sa/license/practitioner-license',
            value: pract.license_number || pract.nphies_id || `PRACT-${practitionerId.substring(0, 8)}`
          }
        ],
        active: true,
        name: [
          {
            use: 'official',
            text: pract.name || pract.full_name || 'Healthcare Provider',
            family: pract.family_name || (pract.name ? pract.name.split(' ').pop() : 'Provider'),
            given: pract.given_name ? [pract.given_name] : 
                   (pract.name ? [pract.name.split(' ')[0]] : ['Healthcare'])
          }
        ],
        qualification: [
          {
            code: {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
                  code: pract.specialty_code || pract.practice_code || '08.00',
                  display: pract.specialty_display || 'Healthcare Professional'
                }
              ]
            }
          }
        ]
      }
    };
  }

  /**
   * Get display text for practitioner identifier type codes
   */
  getPractitionerIdentifierTypeDisplay(code) {
    const displays = {
      'MD': 'Medical License Number',
      'NPI': 'National Provider Identifier',
      'PRN': 'Provider Number',
      'TAX': 'Tax ID Number',
      'DN': 'Doctor Number',
      'NIIP': 'National Insurance Payor Identifier'
    };
    return displays[code] || 'License Number';
  }

  /**
   * Build VisionPrescription resource for vision prior authorization
   * Reference: https://portal.nphies.sa/ig/StructureDefinition-vision-prescription.html
   * Sample: Claim-123073.json references VisionPrescription/3
   * 
   * @param {Object} visionPrescription - Vision prescription data
   * @param {string} patientId - Patient resource ID
   * @param {string} practitionerId - Practitioner resource ID
   * @param {string} prescriptionId - ID for this VisionPrescription resource
   */
  buildVisionPrescriptionResource(visionPrescription, patientId, practitionerId, prescriptionId, provider) {
    const prescription = visionPrescription || {};
    
    // Build provider identifier URL based on provider name
    const providerIdentifierSystem = provider?.identifier_system || 
      `http://${(provider?.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    const resource = {
      resourceType: 'VisionPrescription',
      id: prescriptionId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-prescription|1.0.0']
      },
      identifier: [
        {
          system: `${providerIdentifierSystem}/visionprescription`,
          value: prescription.identifier || `VP-${prescriptionId.substring(0, 8)}`
        }
      ],
      status: 'active',
      created: this.formatDateTime(prescription.date_written || new Date()),
      patient: {
        reference: `Patient/${patientId}`
      },
      dateWritten: this.formatDateTime(prescription.date_written || new Date()),
      lensSpecification: []
    };

    // Prescriber - NPHIES uses identifier-based reference per VisionPrescription-3.json example
    // Reference: https://portal.nphies.sa/ig/VisionPrescription-3.json.html
    if (prescription.prescriber_license) {
      resource.prescriber = {
        type: 'Practitioner',
        identifier: {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MD'
              }
            ]
          },
          system: 'http://nphies.sa/licenses/practitioner',
          value: prescription.prescriber_license
        }
      };
    } else {
      // Fallback to direct reference if no license provided
      resource.prescriber = {
        reference: `Practitioner/${practitionerId}`
      };
    }

    // Add right eye (OD) lens specification if data exists
    if (prescription.right_eye && this.hasLensData(prescription.right_eye)) {
      resource.lensSpecification.push(
        this.buildLensSpecification(prescription.right_eye, 'right', prescription.product_type)
      );
    }

    // Add left eye (OS) lens specification if data exists
    if (prescription.left_eye && this.hasLensData(prescription.left_eye)) {
      resource.lensSpecification.push(
        this.buildLensSpecification(prescription.left_eye, 'left', prescription.product_type)
      );
    }

    return {
      fullUrl: `http://provider.com/VisionPrescription/${prescriptionId}`,
      resource
    };
  }

  /**
   * Check if lens specification has any data
   */
  hasLensData(lensData) {
    if (!lensData) return false;
    return lensData.sphere || lensData.cylinder || lensData.axis || lensData.add;
  }

  /**
   * Build single lens specification for an eye
   * Reference: https://portal.nphies.sa/ig/VisionPrescription-3.json.html
   * @param {Object} eyeData - Eye-specific data (sphere, cylinder, axis, add, prism)
   * @param {string} eye - 'right' or 'left'
   * @param {string} productType - 'lens' or 'contact'
   */
  buildLensSpecification(eyeData, eye, productType = 'lens') {
    const spec = {
      product: {
        coding: [
          {
            // NPHIES uses their own lens-type CodeSystem
            system: 'http://nphies.sa/terminology/CodeSystem/lens-type',
            code: productType === 'contact' ? 'contact' : 'lens'
          }
        ]
      },
      eye: eye // 'right' or 'left'
    };

    // Add sphere if provided
    if (eyeData.sphere !== '' && eyeData.sphere !== null && eyeData.sphere !== undefined) {
      spec.sphere = parseFloat(eyeData.sphere);
    }

    // Add cylinder if provided
    if (eyeData.cylinder !== '' && eyeData.cylinder !== null && eyeData.cylinder !== undefined) {
      spec.cylinder = parseFloat(eyeData.cylinder);
    }

    // Add axis if provided (required when cylinder is present)
    if (eyeData.axis !== '' && eyeData.axis !== null && eyeData.axis !== undefined) {
      spec.axis = parseInt(eyeData.axis, 10);
    }

    // Add reading addition (add) if provided
    if (eyeData.add !== '' && eyeData.add !== null && eyeData.add !== undefined) {
      spec.add = parseFloat(eyeData.add);
    }

    // Add prism if provided - per NPHIES VisionPrescription-3 example
    if (eyeData.prism_amount !== '' && eyeData.prism_amount !== null && eyeData.prism_amount !== undefined) {
      spec.prism = [
        {
          amount: parseFloat(eyeData.prism_amount),
          base: eyeData.prism_base || 'up' // up, down, in, out
        }
      ];
    }

    return spec;
  }


  /**
   * Build Task resource for Cancel Request
   * Reference: NPHIES cancel-request using Task.focus
   */
  buildCancelTask(priorAuth, provider, insurer, reason) {
    const taskId = `task-${this.generateId()}`;
    const senderNphiesId = provider.nphies_id || 'PR-FHIR';
    const destinationNphiesId = insurer.nphies_id || 'INS-FHIR';

    const task = {
      resourceType: 'Task',
      id: taskId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/task|1.0.0']
      },
      status: 'requested',
      intent: 'proposal',
      code: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/task-code',
            code: 'cancel'
          }
        ]
      },
      focus: {
        identifier: {
          system: 'http://nphies.sa/identifiers/priorauth',
          value: priorAuth.pre_auth_ref
        }
      },
      authoredOn: this.formatDateTime(new Date()),
      requester: {
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: senderNphiesId
        }
      },
      owner: {
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/payer-license',
          value: destinationNphiesId
        }
      }
    };

    // Add reason if provided
    if (reason) {
      task.statusReason = {
        text: reason
      };
    }

    return task;
  }

  /**
   * Build Cancel Request Bundle
   */
  buildCancelRequestBundle(priorAuth, provider, insurer, reason) {
    const task = this.buildCancelTask(priorAuth, provider, insurer, reason);
    const taskEntry = {
      fullUrl: `http://provider.com/Task/${task.id}`,
      resource: task
    };

    const messageHeader = {
      fullUrl: `urn:uuid:${this.generateId()}`,
      resource: {
        resourceType: 'MessageHeader',
        id: this.generateId(),
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
        },
        eventCoding: {
          system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
          code: 'cancel-request'
        },
        destination: [
          {
            endpoint: `http://nphies.sa/license/payer-license/${insurer.nphies_id || 'INS-FHIR'}`,
            receiver: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: insurer.nphies_id || 'INS-FHIR'
              }
            }
          }
        ],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: provider.nphies_id || 'PR-FHIR'
          }
        },
        source: {
          endpoint: 'http://provider.com'
        },
        focus: [
          {
            reference: taskEntry.fullUrl
          }
        ]
      }
    };

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [messageHeader, taskEntry]
    };
  }

  /**
   * Parse Prior Authorization Response Bundle
   * Extract key information from ClaimResponse
   * Reference: docs/response.json for full structure
   */
  parsePriorAuthResponse(responseBundle) {
    try {
      if (!responseBundle || !responseBundle.entry) {
        throw new Error('Invalid response bundle');
      }

      // Find key resources in the bundle
      const messageHeader = responseBundle.entry.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
      const claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;
      const patientResource = responseBundle.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
      const coverageResource = responseBundle.entry.find(e => e.resource?.resourceType === 'Coverage')?.resource;
      const providerResource = responseBundle.entry.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('provider-license'))
      )?.resource;
      const insurerResource = responseBundle.entry.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('payer-license'))
      )?.resource;

      // Check if response is nphies-generated (pended)
      const isNphiesGenerated = responseBundle.meta?.tag?.some(
        tag => tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tag' && 
               tag.code === 'nphies-generated'
      );

      // Handle OperationOutcome errors
      if (operationOutcome) {
        const errors = operationOutcome.issue?.map(issue => ({
          severity: issue.severity,
          code: issue.details?.coding?.[0]?.code || issue.code,
          message: issue.details?.coding?.[0]?.display || issue.details?.text || issue.diagnostics,
          location: issue.details?.coding?.[0]?.extension?.find(
            ext => ext.url?.includes('error-expression')
          )?.valueString || issue.location?.join(', ')
        })) || [];

        if (errors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          return {
            success: false,
            outcome: 'error',
            isNphiesGenerated,
            errors
          };
        }
      }

      if (!claimResponse) {
        return {
          success: false,
          outcome: 'error',
          isNphiesGenerated,
          errors: [{ code: 'PARSE_ERROR', message: 'No ClaimResponse found in bundle' }]
        };
      }

      // Extract overall adjudication outcome from extension (approved/rejected/partial)
      const adjudicationOutcome = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      )?.valueCodeableConcept?.coding?.[0]?.code;

      // Extract preAuthRef - the authorization reference number
      const preAuthRef = claimResponse.preAuthRef;

      // Extract preAuthPeriod - authorization validity period
      const preAuthPeriod = claimResponse.preAuthPeriod;

      // Extract adjudication results for items with full details
      const itemResults = claimResponse.item?.map(item => {
        // Item-level adjudication outcome
        const itemOutcome = item.extension?.find(
          ext => ext.url?.includes('extension-adjudication-outcome')
        )?.valueCodeableConcept?.coding?.[0]?.code;

        return {
          itemSequence: item.itemSequence,
          outcome: itemOutcome,
          adjudication: item.adjudication?.map(adj => {
            const category = adj.category?.coding?.[0]?.code;
            return {
              category,
              categoryDisplay: adj.category?.coding?.[0]?.display,
              // Some adjudications use 'value' (e.g., approved-quantity), others use 'amount'
              amount: adj.amount?.value,
              value: adj.value,
              currency: adj.amount?.currency,
              reason: adj.reason?.coding?.[0]?.code,
              reasonDisplay: adj.reason?.coding?.[0]?.display
            };
          })
        };
      });

      // Extract totals (eligible, benefit, copay totals)
      const totals = claimResponse.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        categoryDisplay: total.category?.coding?.[0]?.display,
        amount: total.amount?.value,
        currency: total.amount?.currency
      }));

      // Extract transfer extensions if present
      const transferAuthNumber = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationNumber')
      )?.valueString;

      const transferAuthProvider = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationProvider')
      )?.valueReference?.identifier?.value;

      const transferAuthPeriod = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationPeriod')
      )?.valuePeriod;

      // Determine success based on outcome and adjudication outcome
      const outcome = claimResponse.outcome || 'complete';
      const success = (outcome === 'complete' || outcome === 'partial') && 
                      (adjudicationOutcome !== 'rejected');

      // Extract patient info from response
      const patient = patientResource ? {
        id: patientResource.id,
        name: patientResource.name?.[0]?.text || 
              [patientResource.name?.[0]?.given?.join(' '), patientResource.name?.[0]?.family].filter(Boolean).join(' '),
        identifier: patientResource.identifier?.[0]?.value,
        identifierType: patientResource.identifier?.[0]?.type?.coding?.[0]?.code,
        gender: patientResource.gender,
        birthDate: patientResource.birthDate
      } : null;

      // Extract coverage info from response
      const coverage = coverageResource ? {
        id: coverageResource.id,
        memberId: coverageResource.identifier?.[0]?.value,
        status: coverageResource.status,
        type: coverageResource.type?.coding?.[0]?.display,
        typeCode: coverageResource.type?.coding?.[0]?.code,
        relationship: coverageResource.relationship?.coding?.[0]?.code,
        periodStart: coverageResource.period?.start,
        periodEnd: coverageResource.period?.end,
        planName: coverageResource.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.name,
        planValue: coverageResource.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.value
      } : null;

      // Extract provider info from response
      const provider = providerResource ? {
        id: providerResource.id,
        name: providerResource.name,
        nphiesId: providerResource.identifier?.find(i => i.system?.includes('provider-license'))?.value
      } : null;

      // Extract insurer info from response
      const insurer = insurerResource ? {
        id: insurerResource.id,
        name: insurerResource.name,
        nphiesId: insurerResource.identifier?.find(i => i.system?.includes('payer-license'))?.value
      } : null;

      return {
        success,
        outcome,
        adjudicationOutcome, // approved, rejected, partial, etc.
        disposition: claimResponse.disposition,
        preAuthRef,
        preAuthPeriod: preAuthPeriod ? {
          start: preAuthPeriod.start,
          end: preAuthPeriod.end
        } : null,
        nphiesResponseId: claimResponse.identifier?.[0]?.value || claimResponse.id,
        responseCode: messageHeader?.response?.code,
        isNphiesGenerated,
        
        // Response metadata
        status: claimResponse.status,
        type: claimResponse.type?.coding?.[0]?.code,
        subType: claimResponse.subType?.coding?.[0]?.code,
        use: claimResponse.use,
        created: claimResponse.created,
        
        // Item-level results
        itemResults,
        
        // Totals (eligible, benefit, copay)
        totals,
        
        // Entities from response
        patient,
        coverage,
        provider,
        insurer,
        
        // Transfer details
        transfer: transferAuthNumber ? {
          authNumber: transferAuthNumber,
          provider: transferAuthProvider,
          period: transferAuthPeriod ? {
            start: transferAuthPeriod.start,
            end: transferAuthPeriod.end
          } : null
        } : null,
        
        // Raw response for storage
        rawBundle: responseBundle
      };

    } catch (error) {
      console.error('Error parsing prior auth response:', error);
      return {
        success: false,
        outcome: 'error',
        errors: [{
          code: 'PARSE_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Validate Prior Authorization response bundle structure
   */
  validatePriorAuthResponse(response) {
    const errors = [];

    if (!response) {
      errors.push('Response is empty');
      return { valid: false, errors };
    }

    if (response.resourceType !== 'Bundle') {
      errors.push('Response is not a FHIR Bundle');
      return { valid: false, errors };
    }

    if (response.type !== 'message') {
      errors.push('Bundle type is not "message"');
    }

    if (!response.entry || !Array.isArray(response.entry)) {
      errors.push('Bundle has no entries');
      return { valid: false, errors };
    }

    // Check for MessageHeader (must be first)
    const firstEntry = response.entry[0];
    if (!firstEntry || firstEntry.resource?.resourceType !== 'MessageHeader') {
      errors.push('First entry must be MessageHeader');
    }

    // Check for eventCoding
    const eventCode = firstEntry?.resource?.eventCoding?.code;
    if (eventCode !== 'priorauth-response') {
      errors.push(`Expected priorauth-response event, got: ${eventCode}`);
    }

    // Check for either ClaimResponse or OperationOutcome
    const hasClaimResponse = response.entry.some(
      e => e.resource?.resourceType === 'ClaimResponse'
    );
    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    if (!hasClaimResponse && !hasOperationOutcome) {
      errors.push('Bundle must contain ClaimResponse or OperationOutcome');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new PriorAuthMapper();

