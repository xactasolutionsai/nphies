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
import { NPHIES_CONFIG } from '../../config/nphies.js';

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
      'form-not-available': 'Dosage form not available',
      'Others': 'Others : specify',
      'Irreplaceable': 'SFDA Irreplaceable drugs',
      'strength-not-available': 'Strength not available at pharmacy store'
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
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, motherPatient } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId(),
      motherPatient: (priorAuth.is_newborn && motherPatient) ? (motherPatient.patient_id || this.generateId()) : null
    };

    // For newborn cases, patient is the newborn, and we also need mother patient resource
    const newbornPatientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build mother patient resource if provided (for newborn requests)
    const motherPatientResource = (priorAuth.is_newborn && motherPatient && bundleResourceIds.motherPatient) 
      ? this.buildPatientResourceWithId(motherPatient, bundleResourceIds.motherPatient) 
      : null;
    
    // For newborn cases, pass motherPatient and motherPatientId to buildCoverageResourceWithId
    const coverageResource = this.buildCoverageResourceWithId(
      coverage, 
      patient, 
      insurer, 
      policyHolder, 
      bundleResourceIds,
      motherPatient,
      bundleResourceIds.motherPatient
    );
    
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
    // For newborn cases, add both newborn and mother patient resources
    const entries = [
      messageHeader,
      claimResource,
      coverageResource,
      providerResource,
      insurerResource,
      newbornPatientResource, // Newborn patient
      ...(motherPatientResource ? [motherPatientResource] : []), // Mother patient if present
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

    // NPHIES supports two formats:
    // 1. Identifier-based (preferred per NPHIES profile): { identifier: { system, value } }
    // 2. Reference-based: { reference: "CoverageEligibilityResponse/uuid" }
    // IC-01428: valueReference must include identifier per NPHIES cardinality rules
    if (priorAuth.eligibility_response_id) {
      const identifierSystem = priorAuth.eligibility_response_system || 
        `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/coverageeligibilityresponse`;
      
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          identifier: {
            system: identifierSystem,
            value: priorAuth.eligibility_response_id
          }
        }
      });
    } else if (priorAuth.eligibility_ref) {
      if (priorAuth.eligibility_ref.includes('/')) {
        const refParts = priorAuth.eligibility_ref.split('/');
        const refId = refParts[refParts.length - 1];
        const identifierSystem = priorAuth.eligibility_response_system || 
          `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/coverageeligibilityresponse`;
        
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
          valueReference: {
            identifier: {
              system: identifierSystem,
              value: refId
            }
          }
        });
      } else {
        const identifierSystem = priorAuth.eligibility_response_system || 
          `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/coverageeligibilityresponse`;
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
          valueReference: {
            identifier: {
              system: identifierSystem,
              value: priorAuth.eligibility_ref
            }
          }
        });
      }
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

    // BV-00368: Pharmacy claims MUST use OP subType only
    if (priorAuth.sub_type && priorAuth.sub_type !== 'op') {
      console.warn(`[PharmacyMapper] Invalid subType '${priorAuth.sub_type}' corrected to 'op' (BV-00368)`);
    }
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: 'op' // Force OP always - BV-00368: Pharmacy must be OP only
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

    // Related (for resubmission of rejected/partial authorizations or updates)
    const related = this.buildClaimRelated(priorAuth, providerIdentifierSystem);
    if (related) {
      claim.related = related;
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
    // Support for MULTIPLE days-supply entries per usecase requirement
    let supportingInfoList = [];
    let daysSupplySequences = []; // Array to track all days-supply sequence numbers
    let currentSequence = 1;
    
    // Process all supporting_info entries from the database (including multiple days-supply entries)
    // IMPORTANT: Reassign sequences sequentially to ensure uniqueness (regardless of DB sequences)
    // This prevents duplicate sequence numbers in the FHIR output
    if (priorAuth.supporting_info && priorAuth.supporting_info.length > 0) {
      // Sort by original sequence from DB to maintain relative order
      const sortedSupportingInfo = [...priorAuth.supporting_info].sort((a, b) => 
        (a.sequence || 0) - (b.sequence || 0)
      );
      
      sortedSupportingInfo.forEach(info => {
        // Assign sequential sequence numbers (1, 2, 3, ...) to ensure uniqueness
        const sequence = currentSequence++;
        
        // Process days-supply entries - ALL of them, not just the first one
        if (info.category === 'days-supply' || info.category === 'days_supply') {
          const daysSupplyValue = info.value_quantity || priorAuth.items?.[0]?.days_supply || priorAuth.days_supply || 30;
          const daysSupplyEntry = {
            sequence: sequence,
            category: {
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
                code: 'days-supply'
              }]
            },
            timingDate: info.timing_date ? this.formatDate(info.timing_date) : this.formatDate(priorAuth.request_date || new Date()),
            valueQuantity: {
              value: parseInt(daysSupplyValue),
              unit: 'd',
              system: 'http://unitsofmeasure.org',
              code: 'd'
            }
          };
          supportingInfoList.push(daysSupplyEntry);
          // Track this days-supply sequence
          daysSupplySequences.push(sequence);
        } else {
          // Process other supporting info categories - use sequential sequence
          supportingInfoList.push(this.buildSupportingInfo({ ...info, sequence: sequence }));
        }
      });
    }
    
    // If no days-supply entries found in supporting_info, add a default one (backward compatibility)
    const hasDaysSupply = supportingInfoList.some(info => 
      info.category?.coding?.[0]?.code === 'days-supply' || info.category === 'days-supply'
    );
    if (!hasDaysSupply) {
      const daysSupplyValue = priorAuth.items?.[0]?.days_supply || priorAuth.days_supply || 30;
      const defaultSequence = currentSequence++;
      supportingInfoList.push({
        sequence: defaultSequence,
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
      daysSupplySequences.push(defaultSequence);
    }
    
    // Sort supportingInfoList by sequence to ensure proper ordering (already sequential, but good practice)
    supportingInfoList.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn authorization should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (priorAuth.is_newborn && priorAuth.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => 
        info.category?.coding?.[0]?.code === 'birth-weight' || info.category === 'birth-weight'
      );
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(priorAuth.birth_weight) / 1000;
        supportingInfoList.push(this.buildSupportingInfo({
          sequence: currentSequence++,
          category: 'birth-weight',
          value_quantity: weightInKg,
          value_quantity_unit: 'kg'  // NPHIES BV-00509: must use 'kg' from UCUM
        }));
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
      // Build items with item-specific informationSequence linking
      // Pass supportingInfoList to enable auto-matching by days_supply value
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildPharmacyClaimItem(item, idx + 1, supportingInfoList, encounterPeriod)
      ).filter(Boolean);
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
   * Build claim item for Pharmacy with medication codes or medical devices
   * Reference: https://portal.nphies.sa/ig/StructureDefinition-pharmacy-priorauth.html
   * Example: https://portal.nphies.sa/ig/Claim-483074.json.html
   * 
   * Required Extensions for Pharmacy Medication Items:
   * - extension-package (boolean) - whether item is a package
   * - extension-patient-share (Money) - patient's share amount
   * - extension-prescribed-Medication (CodeableConcept) - originally prescribed medication
   * - extension-pharmacist-Selection-Reason (CodeableConcept) - reason for pharmacist selection
   * - extension-pharmacist-substitute (CodeableConcept) - substitution status
   * - extension-maternity (boolean) - maternity related
   * 
   * Required Extensions for Medical Device Items:
   * - extension-package (boolean)
   * - extension-patient-share (Money)
   * - extension-maternity (boolean)
   * - NO medication-specific extensions
   * 
   * IMPORTANT: informationSequence MUST reference the days-supply supportingInfo (BV-00376)
   * Auto-matches item.days_supply to supporting_info.value_quantity to find the correct sequence
   */
  buildPharmacyClaimItem(item, itemIndex, supportingInfoList, encounterPeriod) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const patientShare = parseFloat(item.patient_share || 0);
    
    // Determine item type (medication or device) - use explicit item_type from database
    const itemType = item.item_type || 'medication'; // Default to medication if not set
    const isDevice = itemType === 'device';
    
    // Extract product/service code - different handling for devices vs medications
    let productCode, productDisplay, codeSystem;
    
    if (isDevice) {
      // Medical device items use medical-devices code system
      productCode = (item.product_or_service_code && item.product_or_service_code.trim()) || 
                    (item.medication_code && item.medication_code.trim());
      productDisplay = (item.product_or_service_display && item.product_or_service_display.trim()) ||
                       (item.medication_name && item.medication_name.trim());
      codeSystem = 'http://nphies.sa/terminology/CodeSystem/medical-devices';
    } else {
      // Medication items use medication-codes system
      productCode = (item.medication_code && item.medication_code.trim()) || 
                    (item.product_or_service_code && item.product_or_service_code.trim());
      productDisplay = (item.medication_name && item.medication_name.trim()) || 
                       (item.product_or_service_display && item.product_or_service_display.trim());
      codeSystem = 'http://nphies.sa/terminology/CodeSystem/medication-codes';
    }
    
    // Log warning if product code is missing (items without codes will be skipped)
    if (!productCode) {
      console.warn(`[PharmacyMapper] WARNING: Item ${sequence} missing ${isDevice ? 'device' : 'medication'}_code - skipping item`);
      return null;
    }
    
    // Build pharmacy-specific extensions per NPHIES spec
    const itemExtensions = [];

    // 1. extension-package (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // 2. extension-patient-share (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    // Medication-specific extensions (NOT for medical devices)
    if (!isDevice) {
      // 3. extension-prescribed-Medication (required for medications only)
      const prescribedMedicationCode = (item.prescribed_medication_code && item.prescribed_medication_code.trim()) || 
                                       productCode;
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

      // 4. extension-pharmacist-Selection-Reason (required for medications only)
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

      // 5. extension-pharmacist-substitute (optional for medications)
      // Only include if pharmacist_substitute is provided
      if (item.pharmacist_substitute && item.pharmacist_substitute.trim()) {
        const substituteCode = item.pharmacist_substitute.trim();
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
      }
    }

    // 6. extension-maternity (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Determine informationSequence: auto-match item.days_supply to supporting_info.value_quantity
    // IMPORTANT: Medical devices do NOT have days-supply, so they should NOT link to days-supply supportingInfo
    let informationSequences = [];
    
    if (isDevice) {
      // Medical devices don't have days-supply - use explicitly provided sequences if any, otherwise empty array
      // Devices may link to other supporting info (vital signs, etc.) but not days-supply
      if (item.information_sequences && Array.isArray(item.information_sequences) && item.information_sequences.length > 0) {
        informationSequences = item.information_sequences;
      }
      // If no sequences provided for device, leave empty (no days-supply linking)
    } else {
      // Medication items: link to days-supply supportingInfo (BV-00376)
      if (item.information_sequences && Array.isArray(item.information_sequences) && item.information_sequences.length > 0) {
        // Use explicitly provided sequences from item (if user manually selected)
        informationSequences = item.information_sequences;
      } else if (item.days_supply && supportingInfoList && supportingInfoList.length > 0) {
        // Auto-match: find days-supply supporting info with matching value_quantity
        const itemDaysSupply = parseInt(item.days_supply);
        const matchingDaysSupply = supportingInfoList.filter(info => {
          const isDaysSupply = info.category?.coding?.[0]?.code === 'days-supply' || 
                              info.category === 'days-supply';
          if (!isDaysSupply) return false;
          const daysValue = parseInt(info.valueQuantity?.value || info.value_quantity || 0);
          return daysValue === itemDaysSupply;
        });
        
        if (matchingDaysSupply.length > 0) {
          // Use the matching sequence(s) - if multiple match, use all
          informationSequences = matchingDaysSupply.map(info => info.sequence);
        } else {
          // No exact match found - use first available days-supply as fallback
          const firstDaysSupply = supportingInfoList.find(info => 
            info.category?.coding?.[0]?.code === 'days-supply' || info.category === 'days-supply'
          );
          if (firstDaysSupply) {
            informationSequences = [firstDaysSupply.sequence];
          }
        }
      }
      
      // If still no sequences for medication, log warning and default to first days-supply
      if (informationSequences.length === 0) {
        console.warn(`[PharmacyMapper] WARNING: Medication item ${sequence} (days_supply: ${item.days_supply}) could not be matched to any days-supply supportingInfo`);
        // Default to sequence 1 as last resort (assuming days-supply is at sequence 1)
        const firstDaysSupply = supportingInfoList?.find(info => 
          info.category?.coding?.[0]?.code === 'days-supply' || info.category === 'days-supply'
        );
        if (firstDaysSupply) {
          informationSequences = [firstDaysSupply.sequence];
        } else {
          informationSequences = [1]; // Fallback
        }
      }
    }

    // Build the claim item
    // IMPORTANT: informationSequence MUST reference the days-supply supportingInfo per BV-00376 (for medications only)
    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      diagnosisSequence: item.diagnosis_sequences || [1],
      // Only include informationSequence if not empty (devices may have empty array)
      ...(informationSequences.length > 0 && { informationSequence: informationSequences })
    };

    // ProductOrService using appropriate code system (medication-codes or medical-devices)
    const productOrServiceCoding = {
      system: codeSystem,
      code: productCode
    };
    
    // Only add display if it has a non-empty value
    if (productDisplay) {
      productOrServiceCoding.display = productDisplay;
    }
    
    // Support shadow billing (dual coding) for unlisted/non-standard codes
    // When shadow_code is present, add a secondary provider-specific coding
    const productOrServiceCodings = [productOrServiceCoding];
    if (item.shadow_code && item.shadow_code_system) {
      const shadowCoding = {
        system: item.shadow_code_system,
        code: item.shadow_code
      };
      if (item.shadow_code_display) {
        shadowCoding.display = item.shadow_code_display;
      }
      productOrServiceCodings.push(shadowCoding);
    }
    
    claimItem.productOrService = {
      coding: productOrServiceCodings
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
    
    // Validate servicedDate is within encounter period (with time validation)
    // If serviced_date is date-only, default to current time
    if (encounterPeriod?.start) {
      const periodStart = new Date(encounterPeriod.start);
      
      // If servicedDate doesn't have a time component (is at midnight or was date-only),
      // default to current time while keeping the date part
      const isMidnight = servicedDate.getHours() === 0 && 
                        servicedDate.getMinutes() === 0 && 
                        servicedDate.getSeconds() === 0;
      
      // Check if original serviced_date was a date-only string (no time component)
      const originalServicedDateStr = typeof item.serviced_date === 'string' 
        ? item.serviced_date 
        : (item.serviced_date instanceof Date ? item.serviced_date.toISOString() : String(item.serviced_date || ''));
      const hasTimeInOriginal = originalServicedDateStr.includes('T') || originalServicedDateStr.match(/\d{2}:\d{2}/);
      
      if (isMidnight && item.serviced_date && !hasTimeInOriginal) {
        // Date-only was provided, use current time with the same date
        const now = new Date();
        const datePart = servicedDate.toISOString().split('T')[0];
        const timePart = now.toTimeString().split(' ')[0]; // Get HH:mm:ss
        servicedDate = new Date(`${datePart}T${timePart}`);
      }
      
      // Validate: serviced_date should be >= encounter_start (with time)
      if (servicedDate < periodStart) {
        servicedDate = periodStart; // Auto-correct to encounter start
      }
      
      // Check if servicedDate is after encounter end (if end date exists)
      if (encounterPeriod.end) {
        const periodEnd = new Date(encounterPeriod.end);
        if (servicedDate > periodEnd) {
          servicedDate = periodEnd; // Auto-correct to encounter end
        }
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
          system: `http://${NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider'}.com.sa/identifiers/encounter`,
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

    // Items are optional - no validation required for item count or medication codes

    if (!priorAuth.diagnoses || priorAuth.diagnoses.length === 0) {
      errors.push('At least one diagnosis is required for pharmacy prior authorization');
    }

    return errors;
  }
}

export default PharmacyMapper;

