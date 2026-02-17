/**
 * NPHIES Pharmacy Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim
 * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
 * 
 * This mapper extends the Prior Auth PharmacyMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: pharmacy-claim (instead of pharmacy-priorauth)
 * - preAuthRef: Required reference to prior authorization
 * 
 * Bundle Structure (per NPHIES example Claim-483078):
 * - MessageHeader (eventCoding = claim-request)
 * - Claim (pharmacy-claim profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - NO Encounter required for pharmacy claims
 * - NO Practitioner required for pharmacy claims
 * 
 * Claim-Level Extensions (per NPHIES example):
 * - extension-batch-identifier (optional)
 * - extension-batch-number (optional)
 * - extension-batch-period (optional)
 * - extension-authorization-offline-date (optional)
 * - extension-episode (optional)
 * 
 * Item Extensions (required):
 * - extension-patient-share (Money)
 * - extension-package (boolean)
 * - extension-tax (Money)
 * - extension-patientInvoice (Identifier) - REQUIRED for claims
 * - extension-prescribed-Medication (CodeableConcept)
 * - extension-pharmacist-Selection-Reason (CodeableConcept)
 * - extension-maternity (boolean)
 * 
 * Key Differences from Prior Auth:
 * - type.use = 'claim' (not 'preauthorization')
 * - insurance.preAuthRef is REQUIRED (reference to approved PA)
 * - extension-patientInvoice on items is REQUIRED
 * - extension-tax on items is REQUIRED
 */

import PharmacyPAMapper from '../priorAuthMapper/PharmacyMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class PharmacyClaimMapper extends PharmacyPAMapper {
  constructor() {
    super();
    this.claimType = 'pharmacy';
  }

  /**
   * Get the NPHIES Pharmacy Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim|1.0.0';
  }

  /**
   * Build complete Claim Request Bundle for Pharmacy type
   * Per NPHIES example Claim-483078.json:
   * - NO Encounter resource
   * - NO Practitioner resource
   * - preAuthRef is required in insurance
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, motherPatient } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId(),
      motherPatient: (claim.is_newborn && motherPatient) ? (motherPatient.patient_id || this.generateId()) : null
    };

    // For newborn cases, patient is the newborn, and we also need mother patient resource
    const newbornPatientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build mother patient resource if provided (for newborn requests)
    const motherPatientResource = (claim.is_newborn && motherPatient && bundleResourceIds.motherPatient) 
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
    const claimResource = this.buildPharmacyClaimResource(claim, patient, provider, insurer, coverage, bundleResourceIds);
    
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // NOTE: Attachments should NOT be added as separate Binary resources
    // They are already included in supportingInfo as valueAttachment (embedded data)
    // Adding Binary resources causes GE-00013 error (invalid meta structure)
    // Following NPHIES examples: attachments are embedded in supportingInfo only

    // Bundle entries per NPHIES example - NO Encounter, NO Practitioner
    const entries = [
      messageHeader,
      claimResource,
      coverageResource,
      providerResource,
      insurerResource,
      newbornPatientResource, // Newborn patient
      ...(motherPatientResource ? [motherPatientResource] : []) // Mother patient if present
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
   * Build MessageHeader for Claim Request (override PA message header)
   */
  buildClaimMessageHeader(provider, insurer, focusFullUrl) {
    const messageHeaderId = this.generateId();
    const senderNphiesId = provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
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
          code: 'claim-request'  // Changed from 'priorauth-request'
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
   * Build FHIR Claim resource for Pharmacy Claim
   * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
   * 
   * Key differences from Prior Auth:
   * - use: 'claim' (not 'preauthorization')
   * - profile: pharmacy-claim
   * - insurance.preAuthRef required
   * - extension-patientInvoice on items required
   * - extension-tax on items required
   * - Batch extensions (batch-identifier, batch-number, batch-period)
   * - extension-authorization-offline-date
   * - extension-episode
   */
  buildPharmacyClaimResource(claim, patient, provider, insurer, coverage, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build claim-level extensions per NPHIES example Claim-483078
    // IMPORTANT: Per NPHIES IC-01428, IC-01453, IC-01620 errors, certain extensions are REQUIRED
    const extensions = [];

    // Batch identifier (optional but recommended)
    const batchId = claim.batch_identifier || `batch-${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/batch`,
        value: batchId
      }
    });

    // Batch number (optional but recommended)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number',
      valuePositiveInt: parseInt(claim.batch_number) || 1
    });

    // Batch period (optional but recommended)
    const batchDate = this.formatDate(claim.batch_period_start || claim.service_date || new Date());
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period',
      valuePeriod: {
        start: batchDate,
        end: this.formatDate(claim.batch_period_end || claim.batch_period_start || claim.service_date || new Date())
      }
    });

    // Authorization offline date (REQUIRED per error IC-01620 - accountingPeriod related)
    // This is the date when the authorization was done offline
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date',
      valueDateTime: this.formatDateTimeWithTimezone(claim.authorization_offline_date || claim.service_date || new Date())
    });

    // Episode (REQUIRED per error IC-01453)
    // Per NPHIES example Claim-483078, episode is required for pharmacy claims
    const episodeId = claim.episode_id || `EpisodeID-${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/episode`,
        value: episodeId
      }
    });

    // AccountingPeriod (REQUIRED per error IC-01620)
    // Per NPHIES error DT-01287, this extension requires valueDate (NOT valuePeriod)
    // Per NPHIES error BV-01010, the day must be "01" (first day of month)
    const accountingDate = new Date(claim.accounting_period_start || claim.service_date || new Date());
    const accountingPeriodDate = `${accountingDate.getFullYear()}-${String(accountingDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });

    // Eligibility offline reference (optional)
    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    // Newborn extension - for newborn patient claims
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (claim.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    // Build claim resource following NPHIES pharmacy-claim profile
    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getClaimProfileUrl()]
      }
    };

    // Add extensions if any
    if (extensions.length > 0) {
      claimResource.extension = extensions;
    }

    // Identifier (required)
    claimResource.identifier = [
      {
        system: `${providerIdentifierSystem}/claim`,
        value: claim.claim_number || `clm_${Date.now()}`
      }
    ];

    // Status (required) - always 'active' for new claims
    claimResource.status = 'active';

    // Type (required) - must be 'pharmacy' for pharmacy claims
    claimResource.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'pharmacy'
        }
      ]
    };

    // BV-00368: Pharmacy claims MUST use OP subType only
    claimResource.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: 'op' // Force OP always - BV-00368: Pharmacy must be OP only
        }
      ]
    };

    // Use (required) - 'claim' for claims (not 'preauthorization')
    claimResource.use = 'claim';

    // Patient reference (required)
    claimResource.patient = { reference: `Patient/${patientRef}` };

    // Created date (required) - format with timezone per NPHIES spec
    claimResource.created = this.formatDateTimeWithTimezone(claim.request_date || new Date());

    // Insurer reference (required)
    claimResource.insurer = { reference: `Organization/${insurerRef}` };

    // Provider reference (required)
    claimResource.provider = { reference: `Organization/${providerRef}` };

    // Priority (required)
    claimResource.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: claim.priority || 'normal'
        }
      ]
    };

    // Payee (optional but typically included)
    claimResource.payee = {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/payeetype',
            code: claim.payee_type || 'provider'
          }
        ]
      }
    };

    // SupportingInfo - Use existing supporting_info from claim data (from PA or claim form)
    // Then add any missing required categories with defaults
    // Per NPHIES errors BV-00752, BV-00803, BV-00804, BV-00805, BV-00806 - these are all required
    // Support for MULTIPLE days-supply entries per usecase requirement
    const existingSupportingInfo = claim.supporting_info || [];
    let supportingInfoList = [];
    let sequenceNum = 1;

    // Valid investigation-result codes per https://portal.nphies.sa/ig/CodeSystem-investigation-result.html
    const validInvestigationCodes = ['INP', 'IRA', 'other', 'NA', 'IRP'];
    const investigationCodeDisplayMap = {
      'INP': 'Investigation(s) not performed',
      'IRA': 'Investigation results attached',
      'other': 'Other',
      'NA': 'Not applicable',
      'IRP': 'Investigation results pending'
    };

    // Helper to check if a category exists in existing supporting info
    const hasCategory = (cat) => existingSupportingInfo.some(info => 
      (info.category || '').toLowerCase() === cat.toLowerCase()
    );
    
    // Helper to get existing supporting info by category
    const getExisting = (cat) => existingSupportingInfo.find(info => 
      (info.category || '').toLowerCase() === cat.toLowerCase()
    );
    
    // Helper to get ALL existing supporting info entries by category (for multiple days-supply)
    const getAllExisting = (cat) => existingSupportingInfo.filter(info => 
      (info.category || '').toLowerCase() === cat.toLowerCase()
    );

    // 1. Days-supply entries are created per-item (see Step after other supportingInfo)
    // Skip days-supply here -- they will be appended after other supportingInfo entries
    // so that each item gets its own dedicated days-supply entry with a unique sequence.

    // 2. investigation-result (required per BV-00752)
    // Per IB-00045: Valid codes are: INP, IRA, other, NA, IRP
    const existingInvestigation = getExisting('investigation-result');
    let investigationResultCode = existingInvestigation?.code || claim.investigation_result_code || 'NA';
    // Validate the code is in the allowed list
    if (!validInvestigationCodes.includes(investigationResultCode)) {
      investigationResultCode = 'NA';
    }
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'investigation-result'
        }]
      },
      code: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/investigation-result',
          code: investigationResultCode,
          display: existingInvestigation?.code_display || investigationCodeDisplayMap[investigationResultCode]
        }]
      }
    });

    // 3. treatment-plan (required per BV-00803)
    const existingTreatmentPlan = getExisting('treatment-plan');
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'treatment-plan'
        }]
      },
      valueString: existingTreatmentPlan?.value_string || claim.treatment_plan || 'Medication therapy as prescribed'
    });

    // 4. patient-history (required per BV-00804)
    const existingPatientHistory = getExisting('patient-history');
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'patient-history'
        }]
      },
      valueString: existingPatientHistory?.value_string || claim.patient_history || 'No significant past medical history'
    });

    // 5. physical-examination (required per BV-00805)
    const existingPhysicalExam = getExisting('physical-examination');
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'physical-examination'
        }]
      },
      valueString: existingPhysicalExam?.value_string || claim.physical_examination || 'Within normal limits'
    });

    // 6. history-of-present-illness (required per BV-00806)
    const existingHistoryPresentIllness = getExisting('history-of-present-illness');
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'history-of-present-illness'
        }]
      },
      valueString: existingHistoryPresentIllness?.value_string || claim.history_of_present_illness || claim.chief_complaint || 'Patient presents with symptoms requiring medication'
    });

    // 7. birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn claim should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (claim.is_newborn && claim.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => 
        info.category?.coding?.[0]?.code === 'birth-weight' || info.category === 'birth-weight'
      );
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(claim.birth_weight) / 1000;
        supportingInfoList.push({
          sequence: sequenceNum++,
          category: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
              code: 'birth-weight'
            }]
          },
          valueQuantity: {
            value: weightInKg,
            system: 'http://unitsofmeasure.org',
            code: 'kg'
          }
        });
      }
    }

    // Create per-item days-supply entries (1-to-1 mapping: each item gets its own days-supply)
    const itemDaysSupplyMap = {}; // Maps item index -> days-supply sequence number
    if (claim.items && claim.items.length > 0) {
      claim.items.forEach((item, idx) => {
        const daysSupplyValue = parseInt(item.days_supply || claim.days_supply || 30);
        const daysSupplySequence = sequenceNum++;
        supportingInfoList.push({
          sequence: daysSupplySequence,
          category: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
              code: 'days-supply'
            }]
          },
          valueQuantity: {
            value: daysSupplyValue,
            system: 'http://unitsofmeasure.org',
            code: 'd'
          }
        });
        itemDaysSupplyMap[idx] = daysSupplySequence;
      });
    }

    // Sort supportingInfoList by sequence
    supportingInfoList.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    claimResource.supportingInfo = supportingInfoList;

    // Diagnosis (required - at least one)
    // IMPORTANT: Per NPHIES error IB-00242, diagnosis system MUST be icd-10-am, NOT icd-10
    if (claim.diagnoses && claim.diagnoses.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => {
        // Force correct ICD-10-AM system - NPHIES rejects plain icd-10
        let diagSystem = diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am';
        // Fix common incorrect system values
        if (diagSystem === 'http://hl7.org/fhir/sid/icd-10' || 
            diagSystem === 'icd-10' || 
            diagSystem === 'ICD-10') {
          diagSystem = 'http://hl7.org/fhir/sid/icd-10-am';
        }
        
        return {
          sequence: diag.sequence || idx + 1,
          diagnosisCodeableConcept: {
            coding: [
              {
                system: diagSystem,
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
        };
      });
    }

    // Insurance (required) - with preAuthRef for claims
    const insuranceEntry = {
      sequence: 1,
      focal: true,
      coverage: { reference: `Coverage/${coverageRef}` }
    };

    // PreAuthRef is REQUIRED for claims (reference to approved prior authorization)
    if (claim.pre_auth_ref) {
      insuranceEntry.preAuthRef = [claim.pre_auth_ref];
    }

    claimResource.insurance = [insuranceEntry];

    // Items with medication codes or medical devices (required - at least one)
    // Build items first, then calculate total from item net values
    // Per-item days-supply linking via itemDaysSupplyMap
    let builtItems = [];
    if (claim.items && claim.items.length > 0) {
      builtItems = claim.items.map((item, idx) => 
        this.buildPharmacyClaimItemForClaim(item, idx + 1, supportingInfoList, providerIdentifierSystem, itemDaysSupplyMap[idx])
      );
      claimResource.item = builtItems;
    }

    // Total (required) - MUST equal sum of all item.net values per BV-00059
    // Calculate total from the actual built items to ensure consistency
    let totalAmount = 0;
    if (builtItems.length > 0) {
      totalAmount = builtItems.reduce((sum, item) => {
        return sum + (item.net?.value || 0);
      }, 0);
    } else if (claim.total_amount) {
      totalAmount = parseFloat(claim.total_amount);
    }
    claimResource.total = {
      value: parseFloat(totalAmount.toFixed(2)),
      currency: claim.currency || 'SAR'
    };

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claimResource
    };
  }

  /**
   * Build claim item for Pharmacy Claim with all required extensions
   * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
   * 
   * Required Extensions for Pharmacy Medication Claim Items:
   * - extension-patient-share (Money) - patient's share amount
   * - extension-package (boolean) - whether item is a package
   * - extension-tax (Money) - tax amount (REQUIRED for claims)
   * - extension-patientInvoice (Identifier) - REQUIRED for claims
   * - extension-prescribed-Medication (CodeableConcept) - originally prescribed medication
   * - extension-pharmacist-Selection-Reason (CodeableConcept) - reason for pharmacist selection
   * - extension-maternity (boolean) - maternity related
   * 
   * Required Extensions for Medical Device Claim Items:
   * - extension-patient-share (Money)
   * - extension-package (boolean)
   * - extension-tax (Money)
   * - extension-patientInvoice (Identifier)
   * - extension-maternity (boolean)
   * - NO medication-specific extensions
   * 
   * NOTE: extension-pharmacist-substitute is NOT in the claim example, only in prior auth
   * Each item receives its pre-assigned days-supply sequence via itemDaysSupplySequence.
   */
  buildPharmacyClaimItemForClaim(item, itemIndex, supportingInfoList, providerIdentifierSystem, itemDaysSupplySequence) {
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
    
    // Validate product code exists (required)
    if (!productCode) {
      console.error(`[PharmacyClaimMapper] ERROR: Item ${sequence} missing ${isDevice ? 'device' : 'medication'}_code`);
      throw new Error(`${isDevice ? 'Device' : 'Medication'} code is required for pharmacy item ${sequence}`);
    }
    
    // Build pharmacy-specific extensions per NPHIES claim example
    const itemExtensions = [];

    // 1. extension-patient-share (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    // 2. extension-package (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // 3. extension-tax (required for claims - all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || 'SAR'
      }
    });

    // 4. extension-patientInvoice (REQUIRED for claims - all items)
    const patientInvoice = item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}-${sequence}`;
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/patientInvoice`,
        value: patientInvoice
      }
    });

    // Medication-specific extensions (NOT for medical devices)
    if (!isDevice) {
      // 5. extension-prescribed-Medication (required for medications only)
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

      // 6. extension-pharmacist-Selection-Reason (required for medications only)
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
    }

    // 7. extension-maternity (required for all items)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Determine informationSequence: use the pre-assigned per-item days-supply sequence
    // ALL pharmacy items (medications AND devices) must link to their own days-supply entry (BV-00376)
    let informationSequences = [];
    
    if (item.information_sequences && Array.isArray(item.information_sequences) && item.information_sequences.length > 0) {
      // Use explicitly provided sequences from item (if user manually selected)
      informationSequences = item.information_sequences;
    } else if (itemDaysSupplySequence) {
      // Use the pre-assigned per-item days-supply sequence (1-to-1 mapping)
      informationSequences = [itemDaysSupplySequence];
    } else {
      // Fallback: find first available days-supply in supportingInfoList
      console.warn(`[PharmacyClaimMapper] WARNING: Item ${sequence} has no pre-assigned days-supply sequence, using fallback`);
      const firstDaysSupply = supportingInfoList?.find(info => 
        info.category?.coding?.[0]?.code === 'days-supply'
      );
      if (firstDaysSupply) {
        informationSequences = [firstDaysSupply.sequence];
      }
    }

    // Build the claim item
    // IMPORTANT: informationSequence MUST reference the days-supply supportingInfo per BV-00376
    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      diagnosisSequence: item.diagnosis_sequences || [1],
      ...(informationSequences.length > 0 && { informationSequence: informationSequences })
    };

    // ProductOrService using appropriate code system (medication-codes or medical-devices)
    const productOrServiceCoding = {
      system: codeSystem,
      code: productCode
    };
    
    if (productDisplay) {
      productOrServiceCoding.display = productDisplay;
    }
    
    claimItem.productOrService = {
      coding: [productOrServiceCoding]
    };

    // Serviced date
    const servicedDate = item.serviced_date ? new Date(item.serviced_date) : new Date();
    claimItem.servicedDate = this.formatDate(servicedDate);

    // Quantity (required)
    claimItem.quantity = { value: quantity };

    // UnitPrice (required)
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || 'SAR'
    };

    // Net (required)
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || 'SAR'
    };

    // Add detail array for package items (BV-00036: required when package=true)
    if (item.is_package === true && item.details && Array.isArray(item.details) && item.details.length > 0) {
      claimItem.detail = item.details.map((detail, idx) => {
        const detailQuantity = parseFloat(detail.quantity || 1);
        const detailUnitPrice = parseFloat(detail.unit_price || 0);
        const detailFactor = parseFloat(detail.factor || 1);
        // BV-00434: detail net must equal ((quantity * unit price) * factor) + tax
        // For now, detail items don't have tax field, so use 0 (or could proportionally allocate parent item tax)
        const detailTax = parseFloat(detail.tax || 0);
        const detailNet = (detailQuantity * detailUnitPrice * detailFactor) + detailTax;

        // Use same code system as parent item (medication-codes or medical-devices)
        const detailCodeSystem = detail.product_or_service_system || codeSystem;

        return {
          sequence: detail.sequence || (idx + 1),
          productOrService: {
            coding: [{
              system: detailCodeSystem,
              code: detail.product_or_service_code,
              display: detail.product_or_service_display
            }]
          },
          quantity: { value: detailQuantity },
          unitPrice: { 
            value: detailUnitPrice, 
            currency: detail.currency || item.currency || 'SAR' 
          },
          ...(detailFactor !== 1 ? { factor: detailFactor } : {}),
          net: { 
            value: detailNet, 
            currency: detail.currency || item.currency || 'SAR' 
          }
        };
      });
    }

    return claimItem;
  }

  /**
   * Parse Claim Response
   * Inherits from parent but can be extended for pharmacy-specific parsing
   */
  parseClaimResponse(responseBundle) {
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default PharmacyClaimMapper;
