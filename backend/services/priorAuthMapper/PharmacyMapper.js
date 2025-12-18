/**
 * NPHIES Pharmacy Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth
 * Reference: https://portal.nphies.sa/ig/StructureDefinition-pharmacy-priorauth.html
 * Example: https://portal.nphies.sa/ig/Claim-483074.json.html
 * 
 * Bundle Structure (per NPHIES example Claim-483074):
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (pharmacy-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * 
 * NOTE: Per NPHIES example Claim-483074.json:
 * - NO Encounter required for pharmacy claims
 * - NO careTeam/Practitioner required for pharmacy claims
 * - NO supportingInfo in the example (days-supply may be optional)
 * 
 * Special Requirements per NPHIES:
 * - Must use 'pharmacy' claim type (http://terminology.hl7.org/CodeSystem/claim-type)
 * - Must use 'op' subType (outpatient only for pharmacy)
 * - ProductOrService uses medication-codes CodeSystem (http://nphies.sa/terminology/CodeSystem/medication-codes)
 * - Item extensions REQUIRED:
 *   - extension-package (boolean)
 *   - extension-patient-share (Money)
 *   - extension-prescribed-Medication (CodeableConcept) - for pharmacy claims
 *   - extension-pharmacist-Selection-Reason (CodeableConcept) - for pharmacy claims
 *   - extension-pharmacist-substitute (CodeableConcept) - for pharmacy claims
 *   - extension-maternity (boolean)
 * 
 * Constraints:
 * - BV-00002: claim type must be pharmacy
 * - BV-00036: subType must be op for pharmacy
 * - BV-00043: productOrService must use medication-codes
 */

import BaseMapper from './BaseMapper.js';

class PharmacyMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'pharmacy';
  }

  /**
   * Get medication code system - NPHIES uses unified medication-codes system
   * Reference: http://nphies.sa/terminology/CodeSystem/medication-codes
   * This system includes GTIN, NUPCO, MOH, NHIC codes
   */
  getMedicationCodeSystem(codeType) {
    // NPHIES uses a unified medication-codes system for all medication codes
    // The codeType parameter is kept for backward compatibility but the system is unified
    const systems = {
      'gtin': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'nupco': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'moh': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'nhic': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'scientific': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'medication': 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      'default': 'http://nphies.sa/terminology/CodeSystem/medication-codes'
    };
    return systems[codeType?.toLowerCase()] || systems['default'];
  }

  /**
   * Get pharmacist selection reason display text
   * Reference: http://nphies.sa/terminology/CodeSystem/pharmacist-selection-reason
   */
  getPharmacistSelectionReasonDisplay(code) {
    const displays = {
      'patient-request': 'patient request',
      'out-of-stock': 'out of stock',
      'formulary-drug': 'formulary drug',
      'therapeutic-alternative': 'therapeutic alternative',
      'other': 'other'
    };
    return displays[code] || code;
  }

  /**
   * Get pharmacist substitute display text
   * Reference: http://nphies.sa/terminology/CodeSystem/pharmacist-substitute
   */
  getPharmacistSubstituteDisplay(code) {
    const displays = {
      'Irreplaceable': 'SFDA Irreplaceable drugs',
      'Replaceable': 'SFDA Replaceable drugs',
      'Therapeutic-alternative': 'Therapeutic alternative',
      'Not-substituted': 'Not substituted'
    };
    return displays[code] || code;
  }

  /**
   * Build complete Prior Authorization Request Bundle for Pharmacy type
   * Per NPHIES example Claim-483074.json:
   * - NO Encounter resource
   * - NO Practitioner resource
   * - NO careTeam in Claim
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId()
    };

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    
    // Build Claim resource (no encounter, no practitioner per NPHIES example)
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage, null, null, bundleResourceIds);
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Bundle entries per NPHIES example - NO Encounter, NO Practitioner
    const entries = [
      messageHeader,
      claimResource,
      coverageResource,
      providerResource,
      insurerResource,
      patientResource,
      ...binaryResources
    ];

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };
  }

  /**
   * Build FHIR Claim resource for Pharmacy Prior Authorization
   * Reference: https://portal.nphies.sa/ig/StructureDefinition-pharmacy-priorauth.html
   * Example: https://portal.nphies.sa/ig/Claim-483074.json.html
   * 
   * Per NPHIES example Claim-483074.json:
   * - type: 'pharmacy' (required)
   * - subType: 'op' (outpatient only, required)
   * - NO encounter extension
   * - NO careTeam
   * - NO supportingInfo (not in example)
   * - NO onAdmission for diagnosis
   * - Item extensions specific to pharmacy
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build claim-level extensions (optional for pharmacy)
    // NOTE: Per NPHIES example Claim-483074.json, NO extensions are present
    const extensions = [];

    // Eligibility offline reference (optional)
    if (priorAuth.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: priorAuth.eligibility_offline_ref
      });
    }

    // Eligibility offline date (optional)
    if (priorAuth.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(priorAuth.eligibility_offline_date)
      });
    }

    // Transfer extension (optional)
    if (priorAuth.is_transfer) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transfer',
        valueBoolean: true
      });
    }

    // Newborn extension - for newborn patient authorization requests
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (priorAuth.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    // Eligibility reference (optional - must be valid FHIR reference format)
    if (priorAuth.eligibility_ref && priorAuth.eligibility_ref.includes('/')) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          reference: priorAuth.eligibility_ref
        }
      });
    }

    // Build claim resource following NPHIES pharmacy-priorauth profile
    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl('pharmacy')]
      }
    };

    // Add extensions if any
    if (extensions.length > 0) {
      claim.extension = extensions;
    }

    // Identifier (required)
    claim.identifier = [
      {
        system: `${providerIdentifierSystem}/authorization`,
        value: priorAuth.request_number || `req_${Date.now()}`
      }
    ];

    // Status (required) - always 'active' for new requests
    claim.status = 'active';

    // Type (required) - must be 'pharmacy' for pharmacy claims
    claim.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'pharmacy'
        }
      ]
    };

    // SubType (required) - must be 'op' (outpatient) for pharmacy claims
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: priorAuth.sub_type || 'op' // Default to 'op' (OutPatient) for pharmacy
        }
      ]
    };

    // Use (required) - always 'preauthorization' for prior auth
    claim.use = 'preauthorization';

    // Patient reference (required)
    claim.patient = { reference: `Patient/${patientRef}` };

    // Created date (required) - format with timezone per NPHIES spec
    claim.created = this.formatDateTimeWithTimezone(priorAuth.request_date || new Date());

    // Insurer reference (required)
    claim.insurer = { reference: `Organization/${insurerRef}` };

    // Provider reference (required)
    claim.provider = { reference: `Organization/${providerRef}` };

    // Priority (required)
    claim.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: priorAuth.priority || 'normal'
        }
      ]
    };

    // Payee (optional but typically included)
    claim.payee = {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/payeetype',
            code: priorAuth.payee_type || 'provider'
          }
        ]
      }
    };

    // Related (optional - for updates/modifications)
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

    // NOTE: Per NPHIES example Claim-483074.json, NO careTeam for pharmacy claims

    // Diagnosis (required - at least one)
    if (priorAuth.diagnoses && priorAuth.diagnoses.length > 0) {
      claim.diagnosis = priorAuth.diagnoses.map((diag, idx) => ({
        sequence: diag.sequence || idx + 1,
        diagnosisCodeableConcept: {
          coding: [
            {
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
        // Note: NO onAdmission for pharmacy claims per NPHIES spec
      }));
    }

    // SupportingInfo - days-supply is REQUIRED for pharmacy claims per BV-00376
    // The item.informationSequence MUST reference the days-supply supportingInfo
    let supportingInfoList = [];
    let daysSupplySequence = null;
    let currentSequence = 1;
    
    // First, add days-supply (REQUIRED for pharmacy)
    // Get days_supply from items or use default
    const daysSupplyValue = priorAuth.items?.[0]?.days_supply || priorAuth.days_supply || 30;
    supportingInfoList.push({
      sequence: currentSequence,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'days-supply'
        }]
      },
      timingDate: this.formatDate(priorAuth.request_date || new Date()),
      valueQuantity: {
        value: parseInt(daysSupplyValue),
        unit: 'd',
        system: 'http://unitsofmeasure.org',
        code: 'd'
      }
    });
    daysSupplySequence = currentSequence;
    currentSequence++;
    
    // Add other supporting info if provided (but NOT days-supply again)
    if (priorAuth.supporting_info && priorAuth.supporting_info.length > 0) {
      priorAuth.supporting_info.forEach(info => {
        // Skip if it's days-supply (already added above)
        if (info.category === 'days-supply' || info.category === 'days_supply') {
          return;
        }
        supportingInfoList.push(this.buildSupportingInfo({ ...info, sequence: currentSequence }));
        currentSequence++;
      });
    }

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn authorization should include birth-weight
    if (priorAuth.is_newborn && priorAuth.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => 
        info.category?.coding?.[0]?.code === 'birth-weight' || info.category === 'birth-weight'
      );
      if (!hasBirthWeight) {
        supportingInfoList.push(this.buildSupportingInfo({
          sequence: currentSequence,
          category: 'birth-weight',
          value_quantity: parseFloat(priorAuth.birth_weight),
          value_quantity_unit: 'g'  // grams per NPHIES standard
        }));
        currentSequence++;
      }
    }
    
    claim.supportingInfo = supportingInfoList;

    // Insurance (required)
    claim.insurance = [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageRef}` }
      }
    ];

    // Items with medication codes (required - at least one)
    const encounterPeriod = {
      start: priorAuth.encounter_start || new Date(),
      end: null
    };
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      // Pass daysSupplySequence to link items to days-supply supportingInfo (REQUIRED per BV-00376)
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildPharmacyClaimItem(item, idx + 1, daysSupplySequence, encounterPeriod)
      );
    }

    // Total (required)
    let totalAmount = priorAuth.total_amount;
    if (!totalAmount && priorAuth.items && priorAuth.items.length > 0) {
      totalAmount = priorAuth.items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const factor = parseFloat(item.factor || 1);
        const tax = parseFloat(item.tax || 0);
        return sum + (quantity * unitPrice * factor) + tax;
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
   * Build claim item for Pharmacy with medication codes
   * Reference: https://portal.nphies.sa/ig/StructureDefinition-pharmacy-priorauth.html
   * Example: https://portal.nphies.sa/ig/Claim-483074.json.html
   * 
   * Required Extensions for Pharmacy Items:
   * - extension-package (boolean) - whether item is a package
   * - extension-patient-share (Money) - patient's share amount
   * - extension-prescribed-Medication (CodeableConcept) - originally prescribed medication
   * - extension-pharmacist-Selection-Reason (CodeableConcept) - reason for pharmacist selection
   * - extension-pharmacist-substitute (CodeableConcept) - substitution status
   * - extension-maternity (boolean) - maternity related
   * 
   * IMPORTANT: informationSequence MUST reference the days-supply supportingInfo (BV-00376)
   */
  buildPharmacyClaimItem(item, itemIndex, daysSupplySequence, encounterPeriod) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const patientShare = parseFloat(item.patient_share || 0);
    
    // Extract and validate medication code FIRST (needed for extensions and productOrService)
    // Handle empty strings by treating them as undefined
    const medicationCode = (item.medication_code && item.medication_code.trim()) || 
                           (item.product_or_service_code && item.product_or_service_code.trim());
    const medicationDisplay = (item.medication_name && item.medication_name.trim()) || 
                              (item.product_or_service_display && item.product_or_service_display.trim());
    
    // Validate medication code exists (required for pharmacy)
    if (!medicationCode) {
      console.error(`[PharmacyMapper] ERROR: Item ${sequence} missing medication_code - this will cause NPHIES rejection`);
      throw new Error(`Medication code is required for pharmacy item ${sequence}`);
    }
    
    // Build pharmacy-specific extensions per NPHIES spec
    const itemExtensions = [];

    // 1. extension-package (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // 2. extension-patient-share (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    // 3. extension-prescribed-Medication (required for pharmacy)
    // This is the originally prescribed medication code - use same code as productOrService if not specified
    const prescribedMedicationCode = (item.prescribed_medication_code && item.prescribed_medication_code.trim()) || 
                                     medicationCode; // Use the validated medicationCode from above
    
    // Always include prescribed medication (required per NPHIES)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-prescribed-Medication',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
            code: prescribedMedicationCode
          }
        ]
      }
    });

    // 4. extension-pharmacist-Selection-Reason (required for pharmacy)
    const selectionReason = item.pharmacist_selection_reason || 'patient-request';
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-Selection-Reason',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/pharmacist-selection-reason',
            code: selectionReason
          }
        ]
      }
    });

    // 5. extension-pharmacist-substitute (required for pharmacy)
    const substituteCode = item.pharmacist_substitute || 'Irreplaceable';
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-substitute',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/pharmacist-substitute',
            code: substituteCode,
            display: this.getPharmacistSubstituteDisplay(substituteCode)
          }
        ]
      }
    });

    // 6. extension-maternity (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Build the claim item
    // IMPORTANT: informationSequence MUST reference the days-supply supportingInfo per BV-00376
    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: [daysSupplySequence] // MUST reference days-supply (required for pharmacy)
    };

    // ProductOrService using NPHIES medication-codes system
    // (medicationCode and medicationDisplay already extracted and validated above)
    
    // Build productOrService coding - only include display if it has a value
    const productOrServiceCoding = {
      system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      code: medicationCode
    };
    
    // Only add display if it has a non-empty value
    if (medicationDisplay) {
      productOrServiceCoding.display = medicationDisplay;
    }
    
    claimItem.productOrService = {
      coding: [productOrServiceCoding]
    };

    // Determine serviced date
    let servicedDate;
    if (item.serviced_date) {
      servicedDate = new Date(item.serviced_date);
    } else if (encounterPeriod?.start) {
      servicedDate = new Date(encounterPeriod.start);
    } else {
      servicedDate = new Date();
    }
    
    // Validate servicedDate is within encounter period
    if (encounterPeriod?.start) {
      const periodStart = new Date(encounterPeriod.start);
      const periodEnd = encounterPeriod.end ? new Date(encounterPeriod.end) : null;
      
      if (servicedDate < periodStart) {
        servicedDate = periodStart;
      }
      if (periodEnd && servicedDate > periodEnd) {
        servicedDate = periodEnd;
      }
    }
    
    claimItem.servicedDate = this.formatDate(servicedDate);

    // Quantity (required)
    claimItem.quantity = { value: quantity };

    // UnitPrice (required)
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || 'SAR'
    };

    // Factor (optional, only include if not 1)
    if (factor !== 1) {
      claimItem.factor = factor;
    }

    // Net (required)
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || 'SAR'
    };

    return claimItem;
  }

  /**
   * Build Encounter resource for Pharmacy auth type
   * 
   * NOTE: Per NPHIES example Claim-483074.json, Encounter is NOT included
   * in pharmacy prior authorization requests. This method is kept for
   * backwards compatibility but is NOT called in buildPriorAuthRequestBundle.
   * 
   * Reference: https://portal.nphies.sa/ig/StructureDefinition-encounter-auth-AMB.html
   * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB
   * @deprecated Not used for pharmacy claims per NPHIES example
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    // Pharmacy MUST use ambulatory (AMB) encounter class
    const encounterIdentifier = priorAuth.encounter_identifier || 
                                priorAuth.request_number || 
                                `ENC-${encounterId.substring(0, 8)}`;

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        // Use AMB-specific profile for pharmacy encounters
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB|1.0.0']
      },
      identifier: [
        {
          system: `http://${provider?.nphies_id || 'provider'}.com.sa/identifiers/encounter`,
          value: encounterIdentifier
        }
      ],
      // Status: 'planned' for prior auth, 'finished' for claims
      status: priorAuth.encounter_status || 'planned',
      // Class: MUST be AMB for pharmacy
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      }
    };

    // Subject (required)
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period - date-only format for AMB encounters per NPHIES spec
    const startDateRaw = priorAuth.encounter_start || new Date();
    let dateOnlyStart;
    if (typeof startDateRaw === 'string' && startDateRaw.includes('T')) {
      dateOnlyStart = startDateRaw.split('T')[0];
    } else {
      dateOnlyStart = this.formatDate(startDateRaw);
    }
    
    encounter.period = { start: dateOnlyStart };

    // ServiceProvider (required)
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    // ServiceType (optional but recommended for pharmacy)
    if (priorAuth.service_type) {
      encounter.serviceType = {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/service-type',
            code: priorAuth.service_type,
            display: this.getServiceTypeDisplay(priorAuth.service_type)
          }
        ]
      };
    }

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Validate pharmacy prior authorization data before building
   * Returns array of validation errors
   */
  validatePharmacyData(data) {
    const errors = [];
    const { priorAuth, patient, provider, insurer } = data;

    // Required fields validation
    if (!patient) {
      errors.push('Patient data is required');
    }
    if (!provider) {
      errors.push('Provider data is required');
    }
    if (!insurer) {
      errors.push('Insurer data is required');
    }

    // Pharmacy-specific validations
    if (!priorAuth.items || priorAuth.items.length === 0) {
      errors.push('At least one medication item is required for pharmacy prior authorization');
    }

    if (!priorAuth.diagnoses || priorAuth.diagnoses.length === 0) {
      errors.push('At least one diagnosis is required for pharmacy prior authorization');
    }

    // Validate medication codes
    if (priorAuth.items) {
      priorAuth.items.forEach((item, idx) => {
        if (!item.medication_code && !item.product_or_service_code) {
          errors.push(`Item ${idx + 1}: Medication code is required`);
        }
      });
    }

    return errors;
  }
}

export default PharmacyMapper;

