/**
 * NPHIES Institutional Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-claim
 * Reference: https://portal.nphies.sa/ig/Claim-483070.json.html
 * 
 * This mapper extends the Prior Auth InstitutionalMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: institutional-claim (instead of institutional-priorauth)
 * - encounter.status: 'finished' (instead of 'planned')
 * 
 * Required Extensions (per NPHIES validation):
 * - extension-accountingPeriod (REQUIRED per IC-01620, must be FIRST, day must be "01" per BV-01010)
 * - extension-encounter (required)
 * - extension-eligibility-offline-reference (optional)
 * - extension-eligibility-offline-date (optional)
 * - extension-episode (required)
 * - extension-condition-onset on diagnosis
 * - extension-patientInvoice on items (required)
 * 
 * Item Extensions:
 * - extension-package (required)
 * - extension-tax (required)
 * - extension-patient-share (required)
 * - extension-patientInvoice (required)
 * - extension-maternity (required)
 */

import InstitutionalPAMapper from '../priorAuthMapper/InstitutionalMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class InstitutionalClaimMapper extends InstitutionalPAMapper {
  constructor() {
    super();
    this.claimType = 'institutional';
  }

  /**
   * Get the NPHIES Claim profile URL (override PA profile)
   */
  getClaimProfileUrl(claimType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-claim|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-claim|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-claim|1.0.0'
    };
    return profiles[claimType] || profiles['institutional'];
  }

  /**
   * Build complete Claim Request Bundle for Institutional type
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, practitioner, motherPatient } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
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
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: claim.practice_code || '08.00' },
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildClaimEncounterResource(claim, patient, provider, bundleResourceIds);
    const claimResource = this.buildClaimResource(claim, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    const entries = [
      messageHeader, claimResource, encounterResource, coverageResource,
      practitionerResource, providerResource, insurerResource, newbornPatientResource,
      ...(motherPatientResource ? [motherPatientResource] : []) // Mother patient if present
    ].filter(Boolean);

    // NOTE: Attachments should NOT be added as separate Binary resources
    // They are already included in supportingInfo as valueAttachment (embedded data)
    // Adding Binary resources causes GE-00013 error (invalid meta structure)
    // Following NPHIES examples: attachments are embedded in supportingInfo only

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0'] },
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
   * Build FHIR Claim resource for Institutional Claim
   * Extends PA claim with claim-specific fields
   */
  buildClaimResource(claim, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions per NPHIES validation requirements
    // Order: accountingPeriod (FIRST per IC-01620), encounter, eligibility-offline-*, episode
    const extensions = [];

    // 1. AccountingPeriod extension (REQUIRED per IC-01620, must be FIRST)
    // BV-01010: Day must be defaulted to "01" (e.g., "2025-12-01" not "2025-12-08")
    const serviceDate = new Date(claim.service_date || claim.request_date || new Date());
    const accountingPeriodDate = `${serviceDate.getFullYear()}-${String(serviceDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });
    
    // 2. Encounter extension (required)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: { reference: `Encounter/${bundleResourceIds.encounter}` }
    });

    // 3. Eligibility offline reference (optional - add before episode per NPHIES example)
    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    // 4. Eligibility offline date (optional - add before episode per NPHIES example)
    if (claim.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(claim.eligibility_offline_date)
      });
    }

    // 5. Episode extension (required for institutional claims)
    const episodeId = claim.episode_identifier || `provider_EpisodeID_${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: { 
        system: `${providerIdentifierSystem}/episode`, 
        value: episodeId 
      }
    });

    // 6. Newborn extension - for newborn patient claims
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (claim.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: { profile: [this.getClaimProfileUrl('institutional')] },
      extension: extensions,
      identifier: [{ 
        system: `${providerIdentifierSystem}/claim`, 
        value: claim.claim_number || `req_${Date.now()}` 
      }],
      status: 'active',
      type: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/claim-type', 
          code: 'institutional' 
        }] 
      },
      subType: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype', 
          code: claim.sub_type || 'ip' 
        }] 
      },
      use: 'claim',  // Changed from 'preauthorization'
      patient: { reference: `Patient/${bundleResourceIds.patient}` },
      created: this.formatDateTimeWithTimezone(claim.request_date || new Date()),
      insurer: { reference: `Organization/${bundleResourceIds.insurer}` },
      provider: { reference: `Organization/${bundleResourceIds.provider}` },
      priority: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/processpriority', 
          code: claim.priority || 'normal' 
        }] 
      },
      payee: { 
        type: { 
          coding: [{ 
            system: 'http://terminology.hl7.org/CodeSystem/payeetype', 
            code: 'provider' 
          }] 
        } 
      }
    };

    // CareTeam
    const pract = practitioner || claim.practitioner || {};
    const practiceCode = claim.practice_code || pract.practice_code || pract.specialty_code || '08.00';
    claimResource.careTeam = [{
      sequence: 1,
      provider: { reference: `Practitioner/${bundleResourceIds.practitioner}` },
      role: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole', 
          code: 'primary' 
        }] 
      },
      qualification: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/practice-codes', 
          code: practiceCode 
        }] 
      }
    }];

    // SupportingInfo
    let supportingInfoSequences = [];
    let supportingInfoList = [...(claim.supporting_info || [])];
    
    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn claim should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (claim.is_newborn && claim.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => {
        const category = (info.category || '').toLowerCase();
        return category === 'birth-weight';
      });
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(claim.birth_weight) / 1000;
        supportingInfoList.push({
          category: 'birth-weight',
          value_quantity: weightInKg,
          value_quantity_unit: 'kg'
        });
      }
    }
    
    // Add ICU hours supportingInfo (for institutional inpatient/daycase)
    // Check if icu_hours is a valid number (not null, undefined, empty string, or 0)
    const icuHoursValue = claim.icu_hours != null && claim.icu_hours !== '' 
      ? parseFloat(claim.icu_hours) 
      : null;
    if (icuHoursValue != null && !isNaN(icuHoursValue) && icuHoursValue > 0 && 
        ['inpatient', 'daycase'].includes(claim.encounter_class)) {
      const hasIcuHours = supportingInfoList.some(info => {
        const category = (info.category || '').toLowerCase();
        return category === 'icu-hours';
      });
      if (!hasIcuHours) {
        supportingInfoList.push({
          category: 'icu-hours',
          value_quantity: icuHoursValue,
          value_quantity_unit: 'h'
        });
      }
    }

    // Add attachments as supportingInfo entries with valueAttachment
    // Following NPHIES examples: attachments are embedded in supportingInfo, not as separate Binary resources
    if (claim.attachments && Array.isArray(claim.attachments) && claim.attachments.length > 0) {
      claim.attachments.forEach(attachment => {
        // Only include attachments that have base64_content
        if (attachment && attachment.base64_content && attachment.content_type) {
          const hasAttachment = supportingInfoList.some(info => {
            // Check if this attachment is already in supportingInfo (by comparing file name or content)
            return info.category === 'attachment' && 
                   info.value_attachment && 
                   info.value_attachment.title === (attachment.file_name || attachment.title);
          });
          if (!hasAttachment) {
            supportingInfoList.push({
              category: 'attachment',
              value_attachment: {
                contentType: attachment.content_type,
                data: attachment.base64_content,
                title: attachment.file_name || attachment.title || 'Attachment',
                creation: attachment.created_at ? this.formatDate(attachment.created_at) : this.formatDate(new Date())
              }
            });
          }
        }
      });
    }
    
    if (supportingInfoList.length > 0) {
      claimResource.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    // Diagnosis with condition-onset extension (required for claims)
    if (claim.diagnoses?.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => {
        // NPHIES requires icd-10-am system, not icd-10 (IB-00242)
        let diagnosisSystem = diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am';
        if (diagnosisSystem === 'http://hl7.org/fhir/sid/icd-10') {
          diagnosisSystem = 'http://hl7.org/fhir/sid/icd-10-am';
        }
        
        return {
          extension: [{
            url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-condition-onset',
            valueCodeableConcept: { 
              coding: [{ 
                system: 'http://nphies.sa/terminology/CodeSystem/condition-onset', 
                code: diag.condition_onset || 'NR' 
              }] 
            }
          }],
          sequence: diag.sequence || idx + 1,
          diagnosisCodeableConcept: { 
            coding: [{ 
              system: diagnosisSystem, 
              code: diag.diagnosis_code, 
              display: diag.diagnosis_display 
            }] 
          },
          type: [{ 
            coding: [{ 
              system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type', 
              code: diag.diagnosis_type || 'principal' 
            }] 
          }],
          onAdmission: { 
            coding: [{ 
              system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-on-admission', 
              code: diag.on_admission === false ? 'n' : 'y' 
            }] 
          }
        };
      });
    }

    // Insurance
    claimResource.insurance = [{ 
      sequence: 1, 
      focal: true, 
      coverage: { reference: `Coverage/${bundleResourceIds.coverage}` } 
    }];

    // Items with claim-specific extensions (patientInvoice required)
    const encounterPeriod = { 
      start: claim.encounter_start || claim.service_date || new Date(), 
      end: claim.encounter_end 
    };
    if (claim.items?.length > 0) {
      claimResource.item = claim.items.map((item, idx) => 
        this.buildClaimItem(item, idx + 1, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim)
      );
    }

    // Total - BV-00059: Must equal sum of item net values
    // Calculate total from items to ensure accuracy
    let totalAmount = 0;
    if (claim.items?.length > 0) {
      totalAmount = claim.items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const factor = parseFloat(item.factor || 1);
        const tax = parseFloat(item.tax || 0);
        return sum + (quantity * unitPrice * factor) + tax;
      }, 0);
    } else if (claim.total_amount) {
      totalAmount = parseFloat(claim.total_amount);
    }
    claimResource.total = { 
      value: totalAmount, 
      currency: claim.currency || 'SAR' 
    };

    return { 
      fullUrl: `http://provider.com/Claim/${claimId}`, 
      resource: claimResource 
    };
  }

  /**
   * Build claim item with all required extensions for institutional claims
   * Per NPHIES spec, patientInvoice is REQUIRED (IC-01454)
   */
  buildClaimItem(item, sequence, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim) {
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    const calculatedNet = (quantity * unitPrice * factor) + tax;

    // All extensions are required for institutional claims
    const itemExtensions = [
      // Package extension (required)
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package', 
        valueBoolean: item.is_package || false 
      },
      // Tax extension (required)
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax', 
        valueMoney: { value: tax, currency: item.currency || claim?.currency || 'SAR' } 
      },
      // Patient share extension (required)
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share', 
        valueMoney: { value: parseFloat(item.patient_share || 0), currency: item.currency || claim?.currency || 'SAR' } 
      },
      // PatientInvoice extension (REQUIRED for claims - IC-01454)
      {
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
        valueIdentifier: { 
          system: `${providerIdentifierSystem}/patientInvoice`, 
          value: item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}/${claim?.claim_number || 'IP-' + Date.now()}`
        }
      },
      // Maternity extension (required)
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity', 
        valueBoolean: item.is_maternity || false 
      }
    ];

    // Use item's serviced_date if available, otherwise fall back to encounter start or today
    let servicedDate = item.serviced_date || encounterPeriod?.start || new Date();

    const claimItem = {
      extension: itemExtensions,
      sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: item.information_sequences || supportingInfoSequences,
      productOrService: {
        coding: [{
          system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
          code: item.product_or_service_code,
          display: item.product_or_service_display
        }]
      },
      servicedDate: this.formatDate(servicedDate),
      quantity: { value: quantity },
      unitPrice: { value: unitPrice, currency: item.currency || claim?.currency || 'SAR' },
      net: { value: calculatedNet, currency: item.currency || claim?.currency || 'SAR' }
    };

    // Add detail array for package items (BV-00036: required when package=true)
    if (item.is_package === true && item.details && Array.isArray(item.details) && item.details.length > 0) {
      claimItem.detail = item.details.map((detail, idx) => {
        const detailQuantity = parseFloat(detail.quantity || 1);
        const detailUnitPrice = parseFloat(detail.unit_price || 0);
        const detailFactor = parseFloat(detail.factor || 1);
        const detailNet = (detailQuantity * detailUnitPrice * detailFactor);

        return {
          sequence: detail.sequence || (idx + 1),
          productOrService: {
            coding: [{
              system: detail.product_or_service_system || item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
              code: detail.product_or_service_code,
              display: detail.product_or_service_display
            }]
          },
          quantity: { value: detailQuantity },
          unitPrice: { 
            value: detailUnitPrice, 
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          },
          net: { 
            value: detailNet, 
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          }
        };
      });
    }

    return claimItem;
  }

  /**
   * Build Encounter resource for Claims (status: finished instead of planned)
   * 
   * NPHIES Validation Requirements for Claims with encounter end date:
   * - BV-00759: dischargeDisposition SHALL be provided when encounter end date is provided
   * - BV-00758: extension-dischargeSpecialty SHALL be provided when encounter end date is provided  
   * - BV-00744: extension-intendedLengthOfStay SHALL be provided for Inpatient/DayCase
   */
  buildClaimEncounterResource(claim, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const encounterClass = claim.encounter_class || 'daycase';
    const encounterIdentifier = claim.encounter_identifier || claim.claim_number || `ENC-${encounterId.substring(0, 8)}`;
    const providerNphiesId = NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider';

    // Build hospitalization extensions
    const hospitalizationExtensions = [
      // Admission Specialty (always required)
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-admissionSpecialty', 
        valueCodeableConcept: { 
          coding: [{ 
            system: 'http://nphies.sa/terminology/CodeSystem/practice-codes', 
            code: claim.admission_specialty || claim.practice_code || '08.00',
            display: this.getPracticeCodeDisplay(claim.admission_specialty || claim.practice_code || '08.00')
          }] 
        } 
      }
    ];

    // BV-00744: intendedLengthOfStay is REQUIRED for Inpatient (IMP) or DayCase (SS)
    // DT-01540: Must use valueCodeableConcept with intended-length-of-stay CodeSystem
    // IB-00419: Must use codes from the specified ValueSet
    // Valid codes: ISD (Intended same day), IO (Intended overnight)
    // Reference: https://portal.nphies.sa/ig/Encounter-10135.json.html
    const isInpatientOrDaycase = ['inpatient', 'daycase', 'IMP', 'SS'].includes(encounterClass);
    if (isInpatientOrDaycase) {
      // Determine intended length of stay code
      // ISD = Intended same day (day case), IO = Intended overnight (inpatient)
      let intendedLengthCode = claim.intended_length_of_stay_code;
      let intendedLengthDisplay = claim.intended_length_of_stay_display;
      
      if (!intendedLengthCode) {
        // Default based on encounter class
        if (encounterClass === 'daycase' || encounterClass === 'SS') {
          intendedLengthCode = 'ISD';
          intendedLengthDisplay = 'Intended same day';
        } else {
          intendedLengthCode = 'IO';
          intendedLengthDisplay = 'Intended overnight';
        }
      }
      
      hospitalizationExtensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-intendedLengthOfStay',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/intended-length-of-stay',
            code: intendedLengthCode,
            display: intendedLengthDisplay || this.getIntendedLengthOfStayDisplay(intendedLengthCode)
          }]
        }
      });
    }

    // BV-00758: dischargeSpecialty is REQUIRED when encounter end date is provided
    if (claim.encounter_end) {
      hospitalizationExtensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-dischargeSpecialty',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
            code: claim.discharge_specialty || claim.admission_specialty || claim.practice_code || '08.00',
            display: this.getPracticeCodeDisplay(claim.discharge_specialty || claim.admission_specialty || claim.practice_code || '08.00')
          }]
        }
      });
    }

    const hospitalization = {
      extension: hospitalizationExtensions,
      admitSource: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/admit-source', 
          code: claim.admit_source || 'WKIN',
          display: this.getAdmitSourceDisplay(claim.admit_source || 'WKIN')
        }] 
      }
    };

    // BV-00759: dischargeDisposition is REQUIRED when encounter end date is provided
    if (claim.encounter_end) {
      hospitalization.dischargeDisposition = {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/discharge-disposition',
          code: claim.discharge_disposition || 'home',
          display: this.getDischargeDispositionDisplay(claim.discharge_disposition || 'home')
        }]
      };
    }

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: { profile: [this.getEncounterProfileUrl(encounterClass)] },
      identifier: [{ 
        system: `http://${providerNphiesId.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.sa/identifiers/encounter`, 
        value: encounterIdentifier 
      }],
      status: 'finished',  // Changed from 'planned' for claims
      class: { 
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 
        code: this.getEncounterClassCode(encounterClass), 
        display: this.getEncounterClassDisplay(encounterClass) 
      },
      serviceType: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/service-type', 
          code: claim.service_type || 'acute-care', 
          display: this.getServiceTypeDisplay(claim.service_type || 'acute-care') 
        }] 
      },
      subject: { reference: `Patient/${bundleResourceIds.patient}` },
      period: { 
        start: this.formatDateTimeWithTimezone(claim.encounter_start || claim.service_date || new Date()) 
      },
      hospitalization,
      serviceProvider: { reference: `Organization/${bundleResourceIds.provider}` }
    };

    if (claim.encounter_end) {
      encounter.period.end = this.formatDateTimeWithTimezone(claim.encounter_end);
    }

    return { 
      fullUrl: `http://provider.com/Encounter/${encounterId}`, 
      resource: encounter 
    };
  }

  /**
   * Get display text for discharge disposition codes
   */
  getDischargeDispositionDisplay(code) {
    const displays = {
      'home': 'Home',
      'other-hcf': 'Other healthcare facility',
      'hosp': 'Hospitalization',
      'long': 'Long-term care',
      'aadvice': 'Left against advice',
      'exp': 'Expired',
      'psy': 'Psychiatric hospital',
      'rehab': 'Rehabilitation',
      'snf': 'Skilled nursing facility',
      'oth': 'Other'
    };
    return displays[code] || code;
  }

  /**
   * Get display text for intended length of stay codes
   * Reference: http://nphies.sa/terminology/CodeSystem/intended-length-of-stay
   * Valid codes from ValueSet: ISD, IO
   * Reference: https://portal.nphies.sa/ig/Encounter-10135.json.html
   */
  getIntendedLengthOfStayDisplay(code) {
    const displays = {
      'ISD': 'Intended same day',
      'IO': 'Intended overnight'
    };
    return displays[code] || code;
  }

  /**
   * Parse Claim Response Bundle
   */
  parseClaimResponse(responseBundle) {
    // Reuse the PA response parser - structure is the same
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default InstitutionalClaimMapper;
