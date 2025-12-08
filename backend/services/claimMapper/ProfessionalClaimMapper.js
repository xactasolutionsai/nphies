/**
 * NPHIES Professional Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim
 * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
 * 
 * This mapper extends the Prior Auth ProfessionalMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: professional-claim (instead of professional-priorauth)
 * - encounter.status: 'finished' (instead of 'planned' or 'in-progress')
 * 
 * Bundle Structure (per NPHIES example Claim-173386):
 * - MessageHeader (eventCoding = claim-request)
 * - Claim (professional-claim profile)
 * - Encounter (REQUIRED for professional claims - AMB/EMER/HH/VR profiles)
 * - Coverage
 * - Practitioner
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Patient
 * 
 * Claim-Level Extensions (per NPHIES example):
 * - extension-encounter (REQUIRED)
 * - extension-authorization-offline-date (optional)
 * - extension-episode (REQUIRED)
 * 
 * Required SupportingInfo categories for Professional Claims:
 * - vital-sign-* (systolic, diastolic, height, weight, pulse, temperature)
 * - chief-complaint (REQUIRED - BV-00779)
 * - oxygen-saturation
 * - respiratory-rate
 * - patient-history (REQUIRED - BV-00804)
 * - investigation-result (REQUIRED - BV-00752)
 * - treatment-plan (REQUIRED - BV-00803)
 * - physical-examination (REQUIRED - BV-00805)
 * - history-of-present-illness (REQUIRED - BV-00806)
 * 
 * Item Extensions (required):
 * - extension-patient-share (Money)
 * - extension-package (boolean)
 * - extension-tax (Money)
 * - extension-patientInvoice (Identifier) - REQUIRED for claims
 * - extension-maternity (boolean)
 */

import ProfessionalPAMapper from '../priorAuthMapper/ProfessionalMapper.js';

class ProfessionalClaimMapper extends ProfessionalPAMapper {
  constructor() {
    super();
    this.claimType = 'professional';
  }

  /**
   * Get the NPHIES Professional Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0';
  }

  /**
   * Build complete Claim Request Bundle for Professional type
   * Per NPHIES example Claim-173386.json:
   * - Encounter IS required
   * - Practitioner IS required
   * - preAuthRef may be included in insurance
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

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

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: claim.practice_code || '08.00' },
      bundleResourceIds.practitioner
    );
    
    // Build Encounter resource for claims (status: finished)
    const encounterResource = this.buildClaimEncounterResource(claim, patient, provider, bundleResourceIds);
    
    // Build Claim resource
    const claimResource = this.buildProfessionalClaimResource(
      claim, patient, provider, insurer, coverage, 
      encounterResource?.resource, practitioner, bundleResourceIds
    );
    
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build binary resources for attachments
    const binaryResources = [];
    if (claim.attachments && claim.attachments.length > 0) {
      claim.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Bundle entries per NPHIES example order
    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      patientResource,
      ...binaryResources
    ].filter(Boolean);

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
   * Build FHIR Claim resource for Professional Claim
   * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
   * 
   * Key differences from Prior Auth:
   * - use: 'claim' (not 'preauthorization')
   * - profile: professional-claim
   * - insurance.preAuthRef may be included
   * - extension-patientInvoice on items is REQUIRED
   * - extension-tax on items is REQUIRED
   * - Required supportingInfo categories for claims
   */
  buildProfessionalClaimResource(claim, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const encounterRef = bundleResourceIds.encounter;
    const practitionerRef = bundleResourceIds.practitioner;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build claim-level extensions per NPHIES example Claim-173386
    const extensions = [];

    // 1. Encounter extension (REQUIRED for professional claims)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `Encounter/${encounterRef}`
      }
    });

    // 2. Authorization offline date (REQUIRED when preAuthRef is used per BV-00462)
    // If preAuthRef is provided, authorizationOffLineDate MUST be provided
    if (claim.authorization_offline_date || claim.pre_auth_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date',
        valueDateTime: this.formatDateTimeWithTimezone(claim.authorization_offline_date || claim.service_date || new Date())
      });
    }

    // 3. Episode extension (REQUIRED)
    const episodeId = claim.episode_id || claim.episode_identifier || `provider_EpisodeID_${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/episode`,
        value: episodeId
      }
    });

    // 4. AccountingPeriod (REQUIRED per error IC-01620)
    // Per NPHIES spec, this extension requires valueDate (NOT valuePeriod)
    // Per NPHIES error BV-01010, the day must be "01" (first day of month)
    const accountingDate = new Date(claim.accounting_period_start || claim.service_date || new Date());
    const accountingPeriodDate = `${accountingDate.getFullYear()}-${String(accountingDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });

    // 6. Eligibility offline reference (optional)
    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    // 7. Eligibility offline date (optional)
    if (claim.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(claim.eligibility_offline_date)
      });
    }

    // Build claim resource following NPHIES professional-claim profile
    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getClaimProfileUrl()]
      }
    };

    // Add extensions
    if (extensions.length > 0) {
      claimResource.extension = extensions;
    }

    // Identifier (required)
    claimResource.identifier = [
      {
        system: `${providerIdentifierSystem}/claim`,
        value: claim.claim_number || `req_${Date.now()}`
      }
    ];

    // Status (required)
    claimResource.status = 'active';

    // Type (required) - must be 'professional'
    claimResource.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional'
        }
      ]
    };

    // SubType (required) - emr (Emergency), amb (Ambulatory), etc.
    const subTypeCode = claim.sub_type || this.getClaimSubTypeCode(claim.encounter_class || 'ambulatory', 'professional');
    claimResource.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: subTypeCode
        }
      ]
    };

    // Use (required) - 'claim' for claims (not 'preauthorization')
    claimResource.use = 'claim';

    // Patient reference (required)
    claimResource.patient = { reference: `Patient/${patientRef}` };

    // Created date (required)
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

    // CareTeam (required)
    const pract = practitioner || claim.practitioner || {};
    const practiceCode = claim.practice_code || pract.practice_code || pract.specialty_code || '08.00';
    claimResource.careTeam = [
      {
        sequence: 1,
        provider: { reference: `Practitioner/${practitionerRef}` },
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
              code: practiceCode
            }
          ]
        }
      }
    ];

    // SupportingInfo - Build with required categories per NPHIES professional claim example
    const supportingInfoResult = this.buildProfessionalClaimSupportingInfo(claim, providerIdentifierSystem);
    claimResource.supportingInfo = supportingInfoResult.supportingInfo;
    const supportingInfoSequences = supportingInfoResult.sequences;

    // Diagnosis (required - at least one)
    // IMPORTANT: Per NPHIES error IB-00242, diagnosis system MUST be icd-10-am, NOT icd-10
    if (claim.diagnoses && claim.diagnoses.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => {
        // Force correct ICD-10-AM system
        let diagSystem = diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am';
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
          // Note: NO onAdmission for professional claims per NPHIES spec
        };
      });
    }

    // Insurance (required) - with optional preAuthRef for claims
    const insuranceEntry = {
      sequence: 1,
      focal: true,
      coverage: { reference: `Coverage/${coverageRef}` }
    };

    // PreAuthRef is optional for professional claims (reference to approved prior authorization)
    if (claim.pre_auth_ref) {
      insuranceEntry.preAuthRef = [claim.pre_auth_ref];
    }

    claimResource.insurance = [insuranceEntry];

    // Items with claim-specific extensions
    const encounterPeriod = {
      start: claim.encounter_start || claim.service_date || new Date(),
      end: claim.encounter_end
    };

    let builtItems = [];
    if (claim.items && claim.items.length > 0) {
      builtItems = claim.items.map((item, idx) => 
        this.buildProfessionalClaimItem(item, idx + 1, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim)
      );
      claimResource.item = builtItems;
    }

    // Total (required) - MUST equal sum of all item.net values per BV-00059
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
   * Build supportingInfo for Professional Claims
   * Per NPHIES example Claim-173386, professional claims require:
   * - Vital signs (systolic, diastolic, height, weight, pulse, temperature, oxygen-saturation, respiratory-rate)
   * - chief-complaint (REQUIRED - BV-00779)
   * - patient-history (REQUIRED - BV-00804)
   * - investigation-result (REQUIRED - BV-00752)
   * - treatment-plan (REQUIRED - BV-00803)
   * - physical-examination (REQUIRED - BV-00805)
   * - history-of-present-illness (REQUIRED - BV-00806)
   */
  buildProfessionalClaimSupportingInfo(claim, providerIdentifierSystem) {
    const existingSupportingInfo = claim.supporting_info || [];
    let supportingInfoList = [];
    let sequenceNum = 1;
    const sequences = [];

    // Valid investigation-result codes per NPHIES CodeSystem
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

    const currentDateTime = this.formatDateTimeWithTimezone(new Date());

    // 1. vital-sign-systolic
    const existingSystolic = getExisting('vital-sign-systolic');
    if (existingSystolic || claim.vital_signs?.systolic) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'vital-sign-systolic'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingSystolic?.value_quantity || claim.vital_signs?.systolic || 120),
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 2. vital-sign-diastolic
    const existingDiastolic = getExisting('vital-sign-diastolic');
    if (existingDiastolic || claim.vital_signs?.diastolic) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'vital-sign-diastolic'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingDiastolic?.value_quantity || claim.vital_signs?.diastolic || 80),
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 3. vital-sign-height
    const existingHeight = getExisting('vital-sign-height');
    if (existingHeight || claim.vital_signs?.height) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'vital-sign-height'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingHeight?.value_quantity || claim.vital_signs?.height || 170),
          system: 'http://unitsofmeasure.org',
          code: 'cm'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 4. vital-sign-weight
    const existingWeight = getExisting('vital-sign-weight');
    if (existingWeight || claim.vital_signs?.weight) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'vital-sign-weight'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingWeight?.value_quantity || claim.vital_signs?.weight || 70),
          system: 'http://unitsofmeasure.org',
          code: 'kg'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 5. pulse
    const existingPulse = getExisting('pulse');
    if (existingPulse || claim.vital_signs?.pulse) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'pulse'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingPulse?.value_quantity || claim.vital_signs?.pulse || 72),
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 6. temperature
    const existingTemperature = getExisting('temperature');
    if (existingTemperature || claim.vital_signs?.temperature) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'temperature'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseFloat(existingTemperature?.value_quantity || claim.vital_signs?.temperature || 37),
          system: 'http://unitsofmeasure.org',
          code: 'Cel'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 7. chief-complaint (REQUIRED - BV-00779)
    const existingChiefComplaint = getExisting('chief-complaint');
    const chiefComplaintEntry = {
      sequence: sequenceNum,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'chief-complaint'
        }]
      }
    };
    
    // Per NPHIES example Claim-173386, chief-complaint uses code.coding for SNOMED codes
    if (existingChiefComplaint?.code || existingChiefComplaint?.code_system) {
      chiefComplaintEntry.code = {
        coding: [{
          system: existingChiefComplaint.code_system || 'http://snomed.info/sct',
          code: existingChiefComplaint.code,
          display: existingChiefComplaint.code_display || existingChiefComplaint.code_text
        }]
      };
    } else if (claim.chief_complaint_code) {
      chiefComplaintEntry.code = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: claim.chief_complaint_code,
          display: claim.chief_complaint || claim.chief_complaint_display
        }]
      };
    } else {
      // Free text format - use code.text per NPHIES spec
      chiefComplaintEntry.code = {
        text: existingChiefComplaint?.code_text || claim.chief_complaint || 'Patient presenting for evaluation'
      };
    }
    
    supportingInfoList.push(chiefComplaintEntry);
    sequences.push(sequenceNum++);

    // 8. oxygen-saturation
    const existingOxygenSaturation = getExisting('oxygen-saturation');
    if (existingOxygenSaturation || claim.vital_signs?.oxygen_saturation) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'oxygen-saturation'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingOxygenSaturation?.value_quantity || claim.vital_signs?.oxygen_saturation || 98),
          system: 'http://unitsofmeasure.org',
          code: '%'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 9. respiratory-rate
    const existingRespiratoryRate = getExisting('respiratory-rate');
    if (existingRespiratoryRate || claim.vital_signs?.respiratory_rate) {
      supportingInfoList.push({
        sequence: sequenceNum,
        category: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: 'respiratory-rate'
          }]
        },
        timingPeriod: {
          start: currentDateTime,
          end: currentDateTime
        },
        valueQuantity: {
          value: parseInt(existingRespiratoryRate?.value_quantity || claim.vital_signs?.respiratory_rate || 16),
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
      sequences.push(sequenceNum++);
    }

    // 10. patient-history (REQUIRED - BV-00804)
    const existingPatientHistory = getExisting('patient-history');
    supportingInfoList.push({
      sequence: sequenceNum,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'patient-history'
        }]
      },
      valueString: existingPatientHistory?.value_string || claim.patient_history || 'No systemic disease'
    });
    sequences.push(sequenceNum++);

    // 11. investigation-result (REQUIRED - BV-00752)
    const existingInvestigation = getExisting('investigation-result');
    let investigationResultCode = existingInvestigation?.code || claim.investigation_result_code || 'INP';
    // Validate the code is in the allowed list
    if (!validInvestigationCodes.includes(investigationResultCode)) {
      investigationResultCode = 'INP';
    }
    supportingInfoList.push({
      sequence: sequenceNum,
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
    sequences.push(sequenceNum++);

    // 12. treatment-plan (REQUIRED - BV-00803)
    const existingTreatmentPlan = getExisting('treatment-plan');
    supportingInfoList.push({
      sequence: sequenceNum,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'treatment-plan'
        }]
      },
      valueString: existingTreatmentPlan?.value_string || claim.treatment_plan || 'Analgesic Drugs'
    });
    sequences.push(sequenceNum++);

    // 13. physical-examination (REQUIRED - BV-00805)
    const existingPhysicalExam = getExisting('physical-examination');
    supportingInfoList.push({
      sequence: sequenceNum,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'physical-examination'
        }]
      },
      valueString: existingPhysicalExam?.value_string || claim.physical_examination || 'Stable'
    });
    sequences.push(sequenceNum++);

    // 14. history-of-present-illness (REQUIRED - BV-00806)
    const existingHistoryPresentIllness = getExisting('history-of-present-illness');
    supportingInfoList.push({
      sequence: sequenceNum,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'history-of-present-illness'
        }]
      },
      valueString: existingHistoryPresentIllness?.value_string || claim.history_of_present_illness || 'No history'
    });
    sequences.push(sequenceNum++);

    return {
      supportingInfo: supportingInfoList,
      sequences: sequences
    };
  }

  /**
   * Build claim item for Professional Claim with all required extensions
   * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
   * 
   * Required Extensions for Professional Claim Items:
   * - extension-patient-share (Money) - patient's share amount
   * - extension-package (boolean) - whether item is a package
   * - extension-tax (Money) - tax amount (REQUIRED for claims)
   * - extension-patientInvoice (Identifier) - REQUIRED for claims
   * - extension-maternity (boolean) - maternity related
   */
  buildProfessionalClaimItem(item, itemIndex, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const patientShare = parseFloat(item.patient_share || 0);
    
    // Build professional-specific extensions per NPHIES claim example
    const itemExtensions = [];

    // 1. extension-patient-share (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || claim?.currency || 'SAR'
      }
    });

    // 2. extension-package (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // 3. extension-tax (required for claims)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || claim?.currency || 'SAR'
      }
    });

    // 4. extension-patientInvoice (REQUIRED for claims)
    const patientInvoice = item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}/${claim?.claim_number || 'OP-' + Date.now()}`;
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/patientInvoice`,
        value: patientInvoice
      }
    });

    // 5. extension-maternity (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Build the claim item
    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1]
    };

    // ProductOrService (required) - MUST use NPHIES services CodeSystem per IB-00030
    // Valid codes must be from http://nphies.sa/terminology/CodeSystem/services ValueSet
    const productCode = item.product_or_service_code || item.service_code;
    const productDisplay = item.product_or_service_display || item.service_display;
    
    if (!productCode) {
      console.error(`[ProfessionalClaimMapper] ERROR: Item ${sequence} missing product_or_service_code`);
      throw new Error(`Service code (product_or_service_code) is required for professional claim item ${sequence}`);
    }
    
    // Force the correct NPHIES services system - IB-00030 requires codes from this ValueSet
    const productOrServiceCoding = {
      system: 'http://nphies.sa/terminology/CodeSystem/services',
      code: productCode
    };
    
    if (productDisplay) {
      productOrServiceCoding.display = productDisplay;
    }
    
    claimItem.productOrService = {
      coding: [productOrServiceCoding]
    };

    // Serviced date
    let servicedDate = item.serviced_date ? new Date(item.serviced_date) : 
                       (encounterPeriod?.start ? new Date(encounterPeriod.start) : new Date());
    claimItem.servicedDate = this.formatDate(servicedDate);

    // Quantity (required)
    claimItem.quantity = { value: quantity };

    // UnitPrice (required)
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || claim?.currency || 'SAR'
    };

    // Net (required)
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || claim?.currency || 'SAR'
    };

    return claimItem;
  }

  /**
   * Build Encounter resource for Professional Claims (status: finished)
   * Reference: https://portal.nphies.sa/ig/Encounter-10131.json.html (from example)
   * 
   * Key differences from Prior Auth:
   * - status: 'finished' (instead of 'in-progress' or 'planned')
   * - hospitalization.dischargeDisposition may be included
   */
  buildClaimEncounterResource(claim, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    const encounterClass = claim.encounter_class || 'ambulatory';
    const encounterIdentifier = claim.encounter_identifier || 
                                claim.claim_number || 
                                `ENC-${encounterId.substring(0, 8)}`;
    const providerNphiesId = provider?.nphies_id || 'provider';

    // Build extensions based on encounter class
    const extensions = [];

    // For Emergency encounters (EMER), add required emergency-specific extensions
    if (encounterClass === 'emergency') {
      // Triage Category - REQUIRED for EMER (BV-00734)
      const triageCategory = claim.triage_category || 'U';
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageCategory',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/triage-category',
            code: triageCategory,
            display: this.getTriageCategoryDisplay(triageCategory)
          }]
        }
      });

      // Triage Date - REQUIRED for EMER (BV-00733)
      const triageDate = claim.triage_date || claim.encounter_start || new Date();
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageDate',
        valueDateTime: this.formatDateTimeWithTimezone(triageDate)
      });

      // Emergency Arrival Code - REQUIRED for EMER (BV-00732)
      // Per NPHIES: Emergency arrival mode (walk-in, ambulance, etc.)
      const arrivalCode = claim.emergency_arrival_code || claim.arrival_code || 'WKIN';
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyArrivalCode',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/emergency-arrival-code',
            code: arrivalCode,
            display: this.getEmergencyArrivalCodeDisplay(arrivalCode)
          }]
        }
      });

      // Emergency Service Start - REQUIRED for EMER (BV-00735)
      // Per NPHIES: Time when emergency service started
      const emergencyServiceStart = claim.emergency_service_start || claim.encounter_start || new Date();
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyServiceStart',
        valueDateTime: this.formatDateTimeWithTimezone(emergencyServiceStart)
      });

      // Transport Type for Emergency (optional)
      const transportType = claim.transport_type || 'GEMA'; // Default to Ground EMS Ambulance
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transportType',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/transport-type',
            code: transportType,
            display: this.getTransportTypeDisplay(transportType)
          }]
        }
      });

      // Discharge Disposition for Emergency (optional but typically included)
      const dischargeDisposition = claim.discharge_disposition || 'DED'; // Default to "Died in ED" if not provided, adjust as needed
      if (claim.discharge_disposition) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-dischargeDisposition',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/discharge-disposition',
              code: claim.discharge_disposition
            }]
          }
        });
      }

      // Diagnosis on Discharge for Emergency (optional)
      if (claim.discharge_diagnosis_code) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-diagnosisOnDischarge',
          valueCodeableConcept: {
            coding: [{
              system: 'http://hl7.org/fhir/sid/icd-10-am',
              code: claim.discharge_diagnosis_code,
              display: claim.discharge_diagnosis_display
            }]
          }
        });
      }
    }

    // Service Event Type - REQUIRED for professional encounters (BV-00736)
    const serviceEventType = claim.service_event_type || 'ICSE';
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType',
      valueCodeableConcept: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-event-type',
          code: serviceEventType,
          display: this.getServiceEventTypeDisplay(serviceEventType)
        }]
      }
    });

    // Discharge Date for claims (encounter is finished)
    if (claim.encounter_end || claim.discharge_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-dischargeDate',
        valueDateTime: this.formatDateTimeWithTimezone(claim.encounter_end || claim.discharge_date)
      });
    }

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: [this.getEncounterProfileUrl(encounterClass)]
      }
    };

    // Add extensions if any
    if (extensions.length > 0) {
      encounter.extension = extensions;
    }

    encounter.identifier = [
      {
        system: `http://${providerNphiesId.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.sa/identifiers/encounter`,
        value: encounterIdentifier
      }
    ];

    // Status - 'finished' for claims
    encounter.status = 'finished';

    // Class
    encounter.class = {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: this.getEncounterClassCode(encounterClass),
      display: this.getEncounterClassDisplay(encounterClass)
    };

    // Service Type (required)
    if (claim.service_type) {
      encounter.serviceType = {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: claim.service_type,
          display: this.getServiceTypeDisplay(claim.service_type)
        }]
      };
    }

    // Priority for emergency encounters
    if (encounterClass === 'emergency' || claim.encounter_priority) {
      const priorityCode = claim.encounter_priority || 'EM';
      encounter.priority = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: priorityCode,
          display: this.getEncounterPriorityDisplay(priorityCode)
        }]
      };
    }

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period
    const needsDateTime = ['daycase', 'inpatient', 'emergency'].includes(encounterClass);
    
    if (needsDateTime) {
      encounter.period = {
        start: this.formatDateTimeWithTimezone(claim.encounter_start || claim.service_date || new Date())
      };
      if (claim.encounter_end) {
        encounter.period.end = this.formatDateTimeWithTimezone(claim.encounter_end);
      }
    } else {
      // AMB: date-only format
      const startDateRaw = claim.encounter_start || claim.service_date || new Date();
      let dateOnlyStart;
      if (typeof startDateRaw === 'string' && startDateRaw.includes('T')) {
        dateOnlyStart = startDateRaw.split('T')[0];
      } else {
        dateOnlyStart = this.formatDate(startDateRaw);
      }
      
      encounter.period = { start: dateOnlyStart };
    }

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Get transport type display text
   * Reference: http://nphies.sa/terminology/CodeSystem/transport-type
   */
  getTransportTypeDisplay(code) {
    const displays = {
      'GEMA': 'Ground EMS Ambulance',
      'AEMA': 'Air EMS Ambulance',
      'WEMA': 'Water EMS Ambulance',
      'OTHR': 'Other'
    };
    return displays[code] || code;
  }

  /**
   * Get emergency arrival code display text
   * Reference: http://nphies.sa/terminology/CodeSystem/emergency-arrival-code
   */
  getEmergencyArrivalCodeDisplay(code) {
    const displays = {
      'WKIN': 'Walk-in',
      'AMBL': 'Ambulance',
      'POL': 'Police',
      'TRNS': 'Transfer from another facility',
      'OTHR': 'Other'
    };
    return displays[code] || code;
  }

  /**
   * Parse Claim Response
   * Inherits from parent but can be extended for professional-specific parsing
   */
  parseClaimResponse(responseBundle) {
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default ProfessionalClaimMapper;
