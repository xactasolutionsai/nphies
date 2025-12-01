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
      'ambulatory': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB|1.0.0',
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

    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl(priorAuth.auth_type)]
      },
      identifier: [
        {
          system: `${providerIdentifierSystem}/authorization`,
          value: priorAuth.request_number || `req_${Date.now()}`
        }
      ],
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: this.getClaimTypeCode(priorAuth.auth_type)
          }
        ]
      },
      subType: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
            code: this.getClaimSubTypeCode(priorAuth.encounter_class || priorAuth.sub_type)
          }
        ]
      },
      use: 'preauthorization',
      patient: {
        reference: `Patient/${patientRef}`
      },
      created: this.formatDateTime(priorAuth.request_date || new Date()),
      insurer: {
        reference: `Organization/${insurerRef}`
      },
      provider: {
        reference: `Organization/${providerRef}`
      },
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/processpriority',
            code: priorAuth.priority || 'normal'
          }
        ]
      },
      // Payee - required per NPHIES spec
      payee: {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/payeetype',
              code: 'provider'
            }
          ]
        }
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: `Coverage/${coverageRef}`
          }
        }
      ]
    };

    // Build extensions array following NPHIES spec exactly
    const extensions = [];

    // Encounter extension - REQUIRED for institutional
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `http://provider.com/Encounter/${encounterRef}`
      }
    });

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

    if (extensions.length > 0) {
      claim.extension = extensions;
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
    if (priorAuth.diagnoses && priorAuth.diagnoses.length > 0) {
      claim.diagnosis = priorAuth.diagnoses.map((diag, idx) => ({
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
        ],
        ...(diag.on_admission !== undefined && diag.on_admission !== null && {
          onAdmission: {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-on-admission',
                code: diag.on_admission ? 'y' : 'n',
                display: diag.on_admission ? 'Yes' : 'No'
              }
            ]
          }
        })
      }));
    }

    // Add supportingInfo first to get sequence numbers for items
    let supportingInfoSequences = [];
    if (priorAuth.supporting_info && priorAuth.supporting_info.length > 0) {
      claim.supportingInfo = priorAuth.supporting_info.map((info, idx) => {
        const seq = info.sequence || idx + 1;
        supportingInfoSequences.push(seq);
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    // Add items with proper sequence links
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildClaimItem(item, priorAuth.auth_type, idx + 1, supportingInfoSequences)
      );
    }

    // Total - REQUIRED per NPHIES spec (IC-00062 error if missing)
    // Calculate from items if not provided
    let totalAmount = priorAuth.total_amount;
    if (!totalAmount && priorAuth.items && priorAuth.items.length > 0) {
      totalAmount = priorAuth.items.reduce((sum, item) => {
        return sum + parseFloat(item.net_amount || item.unit_price || 0);
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
  getClaimSubTypeCode(encounterClass) {
    // Per NPHIES reference Bundle-a84aabfa: SS (short stay/daycase) uses 'ip' subType
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
   * Build a single claim item with NPHIES-compliant extensions
   * Reference: https://portal.nphies.sa/ig/Claim-483069.json.html
   */
  buildClaimItem(item, authType, itemIndex, supportingInfoSequences = []) {
    const sequence = item.sequence || itemIndex;
    
    // Build item-level extensions per NPHIES spec
    const itemExtensions = [];

    // Package extension (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // Patient share extension
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: parseFloat(item.patient_share || 0),
        currency: item.currency || 'SAR'
      }
    });

    // Payer share extension
    const netAmount = parseFloat(item.net_amount || item.unit_price || 0);
    const patientShare = parseFloat(item.patient_share || 0);
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

    // Tax extension
    if (item.tax !== undefined && item.tax !== null) {
      itemExtensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
        valueMoney: {
          value: parseFloat(item.tax || 0),
          currency: item.currency || 'SAR'
        }
      });
    }

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
            system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
            code: item.product_or_service_code,
            display: item.product_or_service_display
          }
        ]
      }
    };

    // Add serviced date (required for most items)
    if (item.serviced_date) {
      claimItem.servicedDate = this.formatDate(item.serviced_date);
    } else {
      // Default to today if not specified
      claimItem.servicedDate = this.formatDate(new Date());
    }

    // Add quantity
    if (item.quantity) {
      claimItem.quantity = {
        value: parseFloat(item.quantity)
      };
    }

    // Add unit price
    if (item.unit_price) {
      claimItem.unitPrice = {
        value: parseFloat(item.unit_price),
        currency: item.currency || 'SAR'
      };
    }

    // Add net amount
    if (item.net_amount) {
      claimItem.net = {
        value: parseFloat(item.net_amount),
        currency: item.currency || 'SAR'
      };
    }

    // Body site for procedures
    if (item.body_site_code) {
      claimItem.bodySite = {
        coding: [
          {
            system: item.body_site_system || 'http://nphies.sa/terminology/CodeSystem/body-site',
            code: item.body_site_code
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

    // Dental-specific: tooth number
    if (authType === 'dental' && item.tooth_number) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://hl7.org/fhir/ex-tooth',
            code: item.tooth_number
          }
        ]
      };
      
      if (item.tooth_surface) {
        claimItem.subSite = item.tooth_surface.split(',').map(surface => ({
          coding: [
            {
              system: 'http://hl7.org/fhir/surface',
              code: surface.trim()
            }
          ]
        }));
      }
    }

    // Vision-specific: eye
    if (authType === 'vision' && item.eye) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://hl7.org/fhir/ex-visioneyecodes',
            code: item.eye
          }
        ]
      };
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
   * Build supportingInfo element following NPHIES specification
   * Reference: https://portal.nphies.sa/ig/Claim-483069.json.html
   */
  buildSupportingInfo(info) {
    const supportingInfo = {
      sequence: info.sequence,
      category: {
        coding: [
          {
            system: info.category_system || 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: info.category
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
      policyHolder: policyHolder?.id || this.generateId()
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
    const encounterResource = this.buildEncounterResourceWithId(
      priorAuth, 
      patient, 
      provider,
      bundleResourceIds
    );
    
    // Build Practitioner resource (REQUIRED for careTeam per IC-00014)
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' },
      bundleResourceIds.practitioner
    );
    
    // Build Claim (main PA request resource) with all consistent IDs
    const claimResource = this.buildClaimResource(
      priorAuth, 
      patient, 
      provider, 
      insurer, 
      coverage, 
      encounterResource.resource,
      practitioner,
      bundleResourceIds
    );
    
    // Build MessageHeader (must be first)
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build attachments as Binary resources
    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Assemble bundle with MessageHeader first per NPHIES specification
    // Order matters: MessageHeader, Claim, then all referenced resources
    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      patientResource
    ];

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
    const encounterClass = priorAuth.encounter_class || 'ambulatory';
  
    // Debug logging to verify encounter class handling
    console.log('[PriorAuthMapper] buildEncounterResourceWithId - encounterClass:', encounterClass);
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

    // serviceType - MUST come BEFORE subject per FHIR R4 order
    // REQUIRED for SS/IMP encounters per NPHIES encounter-auth-SS profile
    if (['daycase', 'inpatient'].includes(encounterClass) || priorAuth.service_type) {
      encounter.serviceType = {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/service-type',
            code: priorAuth.service_type || 'sub-acute-care',
            display: this.getServiceTypeDisplay(priorAuth.service_type || 'sub-acute-care')
          }
        ]
      };
    }

    // subject - comes after serviceType
    encounter.subject = {
      reference: `Patient/${patientId}`
    };

    // period - comes after subject
    encounter.period = {
      start: this.formatDateTime(priorAuth.encounter_start || new Date()),
      ...(priorAuth.encounter_end && {
        end: this.formatDateTime(priorAuth.encounter_end)
      })
    };

    // hospitalization - REQUIRED for SS/IMP encounters per NPHIES profile
    // Reference: https://portal.nphies.sa/ig/Bundle-a84aabfa-1163-407d-aa38-f8119a0b7383.json.html
    if (['daycase', 'inpatient'].includes(encounterClass)) {
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
      'optical': 'Optical'
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
   */
  parsePriorAuthResponse(responseBundle) {
    try {
      if (!responseBundle || !responseBundle.entry) {
        throw new Error('Invalid response bundle');
      }

      // Find key resources
      const messageHeader = responseBundle.entry.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
      const claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;

      // Check if response is nphies-generated (pended)
      const isNphiesGenerated = responseBundle.meta?.tag?.some(
        tag => tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tag' && 
               tag.code === 'nphies-generated'
      );

      // Handle OperationOutcome errors
      if (operationOutcome) {
        const errors = operationOutcome.issue?.map(issue => ({
          severity: issue.severity,
          code: issue.code,
          details: issue.details?.text || issue.diagnostics,
          location: issue.location?.join(', ')
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
          errors: [{ code: 'PARSE_ERROR', details: 'No ClaimResponse found in bundle' }]
        };
      }

      // Extract preAuthRef
      const preAuthRef = claimResponse.preAuthRef;

      // Extract preAuthPeriod
      const preAuthPeriod = claimResponse.preAuthPeriod;

      // Extract adjudication results for items
      const itemResults = claimResponse.item?.map(item => ({
        itemSequence: item.itemSequence,
        adjudication: item.adjudication?.map(adj => ({
          category: adj.category?.coding?.[0]?.code,
          amount: adj.amount?.value,
          currency: adj.amount?.currency,
          reason: adj.reason?.coding?.[0]?.code
        }))
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

      // Determine success based on outcome
      const outcome = claimResponse.outcome || 'complete';
      const success = outcome === 'complete' || outcome === 'partial';

      return {
        success,
        outcome,
        disposition: claimResponse.disposition,
        preAuthRef,
        preAuthPeriod: preAuthPeriod ? {
          start: preAuthPeriod.start,
          end: preAuthPeriod.end
        } : null,
        nphiesResponseId: claimResponse.identifier?.[0]?.value || claimResponse.id,
        responseCode: messageHeader?.response?.code,
        isNphiesGenerated,
        itemResults,
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
          details: error.message
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

