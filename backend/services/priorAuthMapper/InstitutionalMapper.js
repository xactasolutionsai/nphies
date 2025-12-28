/**
 * NPHIES Institutional Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-priorauth
 * 
 * Bundle Structure:
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (institutional-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Practitioner
 * - Encounter (IMP or SS profiles - requires hospitalization block)
 * 
 * Special Requirements:
 * - BV-00770: chief-complaint is REQUIRED
 * - BV-00802: estimated-Length-of-Stay is REQUIRED
 * - BV-00027: onAdmission is REQUIRED on diagnosis
 * - hospitalization block with admitSource and admissionSpecialty
 */

import BaseMapper from './BaseMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class InstitutionalMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'institutional';
  }

  /**
   * Build complete Prior Authorization Request Bundle for Institutional type
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner, motherPatient } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
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
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' },
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds);
    
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
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
   * Build FHIR Claim resource for Institutional Prior Authorization
   * Includes required institutional fields: chief-complaint, estimated-length-of-stay, onAdmission
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const encounterRef = bundleResourceIds.encounter;
    const practitionerRef = bundleResourceIds.practitioner;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions
    const extensions = [];

    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `Encounter/${encounterRef}`
      }
    });

    if (priorAuth.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: priorAuth.eligibility_offline_ref
      });
    }

    if (priorAuth.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(priorAuth.eligibility_offline_date)
      });
    }

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

    // Only add eligibility reference if it's a valid FHIR reference format
    // Must be in format "ResourceType/id" (e.g., "CoverageEligibilityResponse/uuid")
    if (priorAuth.eligibility_ref && priorAuth.eligibility_ref.includes('/')) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          reference: priorAuth.eligibility_ref
        }
      });
    }

    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl('institutional')]
      }
    };

    if (extensions.length > 0) {
      claim.extension = extensions;
    }

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
          code: 'institutional'
        }
      ]
    };
    // BV-00364, BV-00032: Institutional claims MUST use IP subType only
    if (priorAuth.sub_type !== 'ip') {
      console.warn(`[InstitutionalMapper] Invalid subType '${priorAuth.sub_type}' corrected to 'ip' (BV-00364, BV-00032)`);
    }
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: 'ip' // Force IP always - BV-00364, BV-00032: Institutional must be IP only
        }
      ]
    };
    claim.use = 'preauthorization';
    claim.patient = { reference: `Patient/${patientRef}` };
    claim.created = this.formatDateTime(priorAuth.request_date || new Date());
    claim.insurer = { reference: `Organization/${insurerRef}` };
    claim.provider = { reference: `Organization/${providerRef}` };
    claim.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: priorAuth.priority || 'normal'
        }
      ]
    };
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

    // Related (for resubmission of rejected/partial authorizations or updates)
    const related = this.buildClaimRelated(priorAuth, providerIdentifierSystem);
    if (related) {
      claim.related = related;
    }

    // CareTeam
    const pract = practitioner || priorAuth.practitioner || {};
    const practiceCode = priorAuth.practice_code || pract.practice_code || pract.specialty_code || '08.00';
    claim.careTeam = [
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

    // Diagnosis with onAdmission (REQUIRED for institutional - BV-00027)
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
        ],
        // BV-00027: onAdmission is REQUIRED for institutional
        onAdmission: {
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-on-admission',
              code: diag.on_admission === false ? 'n' : 'y',
              display: diag.on_admission === false ? 'No' : 'Yes'
            }
          ]
        }
      }));
    }

    // SupportingInfo with REQUIRED institutional fields
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
    // BV-00770: chief-complaint is REQUIRED for institutional
    const hasChiefComplaint = supportingInfoList.some(info => info.category === 'chief-complaint');
    if (!hasChiefComplaint) {
      supportingInfoList.unshift({
        category: 'chief-complaint',
        code: priorAuth.chief_complaint_code || '418799008',
        code_display: priorAuth.chief_complaint_display || 'General symptom',
        code_system: 'http://snomed.info/sct',
        timing_date: priorAuth.request_date || new Date()
      });
    }
    
    // BV-00802: estimated-Length-of-Stay is REQUIRED for institutional
    const hasLengthOfStay = supportingInfoList.some(info => 
      info.category === 'estimated-Length-of-Stay' || info.category === 'estimated-length-of-stay'
    );
    if (!hasLengthOfStay) {
      supportingInfoList.push({
        category: 'estimated-Length-of-Stay',
        value_quantity: priorAuth.estimated_length_of_stay || 1,
        value_quantity_unit: 'd',
        timing_date: priorAuth.request_date || new Date()
      });
    }

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn authorization should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (priorAuth.is_newborn && priorAuth.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => info.category === 'birth-weight');
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(priorAuth.birth_weight) / 1000;
        supportingInfoList.push({
          category: 'birth-weight',
          value_quantity: weightInKg,
          value_quantity_unit: 'kg'  // NPHIES BV-00509: must use 'kg' from UCUM
        });
      }
    }

    // Add ICU hours supportingInfo (for institutional inpatient/daycase)
    // Check if icu_hours is a valid number (not null, undefined, empty string, or 0)
    const icuHoursValue = priorAuth.icu_hours != null && priorAuth.icu_hours !== '' 
      ? parseFloat(priorAuth.icu_hours) 
      : null;
    if (icuHoursValue != null && !isNaN(icuHoursValue) && icuHoursValue > 0 && 
        ['inpatient', 'daycase'].includes(priorAuth.encounter_class)) {
      const hasIcuHours = supportingInfoList.some(info => info.category === 'icu-hours');
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
    if (priorAuth.attachments && Array.isArray(priorAuth.attachments) && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        // Only include attachments that have base64_content
        if (attachment && attachment.base64_content && attachment.content_type) {
          supportingInfoList.push({
            category: 'attachment',
            value_attachment: {
              contentType: attachment.content_type,
              data: attachment.base64_content,
              title: attachment.file_name || attachment.title || 'Attachment',
              creation: attachment.uploaded_at ? this.formatDate(attachment.uploaded_at) : this.formatDate(new Date())
            }
          });
        }
      });
    }
    
    if (supportingInfoList.length > 0) {
      claim.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
        
        // Note: Attachments are standalone and not linked to supportingInfo via valueReference
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    // Insurance
    claim.insurance = [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageRef}` }
      }
    ];

    // Items
    const encounterPeriod = {
      start: priorAuth.encounter_start || new Date(),
      end: priorAuth.encounter_end || null
    };
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildClaimItem(item, 'institutional', idx + 1, supportingInfoSequences, encounterPeriod)
      );
    }

    // Total
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
   * Build Encounter resource for Institutional auth type
   * Requires hospitalization block with admitSource and admissionSpecialty
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    // BV-00741, BV-00807: Institutional encounters MUST use IMP or SS only
    let encounterClass = priorAuth.encounter_class || 'daycase';
    if (!['inpatient', 'daycase'].includes(encounterClass)) {
      console.warn(`[InstitutionalMapper] Invalid encounter class '${encounterClass}' corrected to 'daycase' (BV-00741, BV-00807)`);
      encounterClass = 'daycase';
    }
    const encounterIdentifier = priorAuth.encounter_identifier || 
                                priorAuth.request_number || 
                                `ENC-${encounterId.substring(0, 8)}`;

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: [this.getEncounterProfileUrl(encounterClass)]
      },
      identifier: [
        {
          system: `http://${NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider'}.com.sa/identifiers/encounter`,
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

    // ServiceType - REQUIRED for SS/IMP encounters
    const serviceTypeCode = priorAuth.service_type || 'sub-acute-care';
    encounter.serviceType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: serviceTypeCode,
          display: this.getServiceTypeDisplay(serviceTypeCode)
        }
      ]
    };

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period - Institutional uses dateTime format with timezone
    encounter.period = {
      start: this.formatDateTimeWithTimezone(priorAuth.encounter_start || new Date())
    };
    if (priorAuth.encounter_end) {
      encounter.period.end = this.formatDateTimeWithTimezone(priorAuth.encounter_end);
    }

    // Hospitalization - REQUIRED for Institutional (SS/IMP)
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

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }
}

export default InstitutionalMapper;

