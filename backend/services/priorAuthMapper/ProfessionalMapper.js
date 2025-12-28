/**
 * NPHIES Professional Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-priorauth
 * 
 * Bundle Structure:
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (professional-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Practitioner
 * - Encounter (AMB, EMER, HH, VR profiles)
 */

import BaseMapper from './BaseMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class ProfessionalMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'professional';
  }

  /**
   * Build complete Prior Authorization Request Bundle for Professional type
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner, motherPatient } = data;

    // Generate consistent IDs for all resources
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

    // Build all resources
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
    
    // NOTE: Observation resources for lab tests are NOT part of standard NPHIES Professional PA
    // Per official example at: https://portal.nphies.sa/ig/Claim-173086.json.html
    // The official example does NOT include lab-test supportingInfo or Observation resources.
    // Commenting out to avoid RE-00165 and RE-00170 errors.
    //
    // console.log('[ProfessionalMapper] priorAuth.lab_observations:', priorAuth.lab_observations);
    // const observationResources = this.buildLabObservationResources(priorAuth, bundleResourceIds);
    // console.log('[ProfessionalMapper] Built observation resources:', observationResources.length);
    const observationResources = []; // Empty - not used in standard Professional PA
    
    // Build Claim resource (no observation IDs since they're not used)
    const claimResource = this.buildClaimResource(
      priorAuth, patient, provider, insurer, coverage, 
      encounterResource?.resource, practitioner, bundleResourceIds,
      [] // No observation IDs - not part of standard Professional PA
    );
    
    // Build MessageHeader (must be first)
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    // Assemble bundle per NPHIES spec order
    // RE-00005 fix: Organization resources (Provider and Insurer) must come BEFORE Claim
    // to ensure facility reference validation passes
    // Observation resources are included after patient
    // For newborn cases, add both newborn and mother patient resources
    // Note: Attachments are now embedded in supportingInfo as valueAttachment, not as separate Binary resources
    const entries = [
      messageHeader,
      providerResource,      // Must be before Claim for facility reference validation
      insurerResource,        // Must be before Claim for reference validation
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      newbornPatientResource, // Newborn patient
      ...(motherPatientResource ? [motherPatientResource] : []), // Mother patient if present
      ...observationResources
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
   * Build Observation resources for laboratory tests
   * Per NPHIES IG: Lab test details (LOINC codes) MUST be in Observation resources
   * These are referenced via Claim.supportingInfo with category = "laboratory"
   * 
   * @param {Object} priorAuth - Prior authorization data
   * @param {Object} bundleResourceIds - Resource IDs for bundle references
   * @returns {Array} Array of Observation bundle entries
   */
  buildLabObservationResources(priorAuth, bundleResourceIds) {
    const observations = [];
    const patientRef = bundleResourceIds.patient;
    
    // Check for lab_observations in priorAuth (new field for LOINC test details)
    // Handle both string (from DB) and array formats
    let labObservations = priorAuth.lab_observations || [];
    if (typeof labObservations === 'string') {
      try {
        labObservations = JSON.parse(labObservations);
      } catch (e) {
        console.error('[ProfessionalMapper] Failed to parse lab_observations:', e);
        labObservations = [];
      }
    }
    
    // Ensure it's an array
    if (!Array.isArray(labObservations)) {
      labObservations = [];
    }
    
    console.log('[ProfessionalMapper] Building lab observations, count:', labObservations.length);
    
    labObservations.forEach((labObs, index) => {
      const observationId = this.generateId();
      
      // Store observation ID for later reference in supportingInfo
      if (!bundleResourceIds.observations) {
        bundleResourceIds.observations = [];
      }
      bundleResourceIds.observations.push(observationId);
      
      // NPHIES requires the observation profile, NOT generic HL7 profile
      // Error RE-00170: "Referenced SHALL point to a valid profile"
      const observation = {
        resourceType: 'Observation',
        id: observationId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/observation|1.0.0']
        },
        status: labObs.status || 'registered', // registered = ordered but not yet performed
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: labObs.loinc_code,
              display: labObs.loinc_display || labObs.test_name
            }
          ],
          text: labObs.test_name || labObs.loinc_display
        },
        subject: {
          reference: `Patient/${patientRef}`
        },
        // NPHIES Fix: Use timezone-aware datetime format (+03:00) instead of UTC (Z)
        // Per NPHIES examples: "2024-12-16T10:30:00+03:00" format is required
        effectiveDateTime: this.formatDateTimeWithTimezone(labObs.effective_date || priorAuth.encounter_start || new Date())
      };

      // Add value if provided (for pre-existing results)
      // NPHIES Fix: Only add value if it's actually provided and non-empty
      // Per NPHIES: Observations with status='registered' should NOT have value fields
      // Error RE-00170 occurs if valueString is empty string ""
      // IMPORTANT: For status='registered' (pending tests), do NOT include any value
      const hasValue = labObs.value !== undefined && labObs.value !== null && labObs.value !== '';
      const isPendingTest = observation.status === 'registered';
      
      // Only add value for completed observations (status != 'registered')
      // NPHIES rejects observations with values when status is 'registered'
      if (hasValue && !isPendingTest) {
        // Check if value is numeric - if so, use valueQuantity (NPHIES prefers this for lab results)
        const numericValue = parseFloat(labObs.value);
        const isNumeric = !isNaN(numericValue);
        
        if (isNumeric && labObs.unit) {
          // Numeric value with units - use valueQuantity
          observation.valueQuantity = {
            value: numericValue,
            unit: labObs.unit,
            system: 'http://unitsofmeasure.org',
            code: labObs.unit_code || labObs.unit
          };
        } else if (isNumeric) {
          // Numeric value without units - still use valueQuantity
          observation.valueQuantity = {
            value: numericValue
          };
        } else {
          // Non-numeric value - use valueString
          observation.valueString = String(labObs.value);
        }
      }

      // Add note if provided
      if (labObs.note) {
        observation.note = [{ text: labObs.note }];
      }

      observations.push({
        fullUrl: `http://provider.com/Observation/${observationId}`,
        resource: observation
      });
    });

    return observations;
  }

  /**
   * Build FHIR Claim resource for Professional Prior Authorization
   * @param {Object} priorAuth - Prior authorization data
   * @param {Object} patient - Patient data
   * @param {Object} provider - Provider organization data
   * @param {Object} insurer - Insurer organization data
   * @param {Object} coverage - Coverage data
   * @param {Object} encounter - Encounter resource
   * @param {Object} practitioner - Practitioner data
   * @param {Object} bundleResourceIds - Resource IDs for bundle references
   * @param {Array} observationIds - Array of Observation resource IDs for lab tests
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds, observationIds = []) {
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

    // Encounter extension - REQUIRED for Professional claims
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

    // Add eligibility response extension
    // NPHIES supports two formats:
    // 1. Identifier-based (preferred per Claim-173086.json): { identifier: { system, value } }
    // 2. Reference-based: { reference: "CoverageEligibilityResponse/uuid" }
    // GE-00013: valueReference must have valid structure - either identifier OR reference, not empty
    if (priorAuth.eligibility_response_id) {
      // Identifier-based format (preferred per NPHIES Claim-173086.json example)
      const identifierSystem = priorAuth.eligibility_response_system || 
        `http://${(insurer.nphies_id || 'payer').toLowerCase()}.com.sa/identifiers/coverageeligibilityresponse`;
      
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
      // Reference-based format - eligibility_ref can be:
      // 1. Full reference: "CoverageEligibilityResponse/uuid"
      // 2. Just the ID: "uuid" (we'll treat as identifier value)
      if (priorAuth.eligibility_ref.includes('/')) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
          valueReference: {
            reference: priorAuth.eligibility_ref
          }
        });
      } else {
        // Treat as identifier value
        const identifierSystem = `http://${(insurer.nphies_id || 'payer').toLowerCase()}.com.sa/identifiers/coverageeligibilityresponse`;
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

    // Build claim in NPHIES-mandated order
    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl('professional')]
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
          code: 'professional'
        }
      ]
    };
    // BV-00365, BV-00034: Professional claims MUST use OP or EMR subType only
    let subTypeCode = priorAuth.sub_type || this.getClaimSubTypeCode(priorAuth.encounter_class || 'ambulatory', 'professional');
    if (!['op', 'emr'].includes(subTypeCode)) {
      console.warn(`[ProfessionalMapper] Invalid subType '${subTypeCode}' corrected to 'op' (BV-00365, BV-00034)`);
      subTypeCode = 'op';
    }
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: subTypeCode
        }
      ]
    };
    claim.use = 'preauthorization';
    claim.patient = { reference: `Patient/${patientRef}` };
    claim.created = this.formatDateTime(priorAuth.request_date || new Date());
    claim.insurer = { reference: `Organization/${insurerRef}` };
    claim.provider = { reference: `Organization/${providerRef}` };
    
    // BV-00905: Claim.facility SHALL be provided when associated with 'Ambulatory' outpatient or 'Virtual' telemedicine encounters
    // Check encounter resource class code directly (AMB or VR), or fall back to priorAuth.encounter_class
    const encounterClassCode = encounter?.class?.code;
    const encounterClass = priorAuth.encounter_class || 'ambulatory';
    const needsFacility = encounterClassCode === 'AMB' || encounterClassCode === 'VR' || 
                          encounterClass === 'ambulatory' || encounterClass === 'virtual' || encounterClass === 'telemedicine';
    
    if (needsFacility) {
      // Use full URL format to match the fullUrl of the provider Organization entry in the bundle
      // This fixes RE-00005: Claim facility is not referring to a valid resource
      claim.facility = { reference: `http://provider.com/Organization/${providerRef}` };
    }
    
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

    // Diagnosis
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
      }));
    }

    // SupportingInfo with REQUIRED chief-complaint for professional claims
    // BV-00779: Chief Complaint SHALL be provided in professional claim or authorization
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
    // Ensure chief-complaint is present (required per BV-00779)
    const hasChiefComplaint = supportingInfoList.some(info => info.category === 'chief-complaint');
    if (!hasChiefComplaint) {
      const clinicalInfo = priorAuth.clinical_info || {};
      const chiefComplaintText = clinicalInfo.chief_complaint || priorAuth.chief_complaint;
      
      if (chiefComplaintText) {
        // Free text format - use code.text per NPHIES Claim-173086.json example
        supportingInfoList.unshift({
          category: 'chief-complaint',
          code_text: chiefComplaintText
        });
      } else {
        // Default chief complaint if none provided
        supportingInfoList.unshift({
          category: 'chief-complaint',
          code_text: 'Patient presenting for evaluation'
        });
      }
    }
    
    // BV-00428: Fix onset supportingInfo - requires ICD-10 code and starting date
    // IB-00045: Onset code must use ICD-10-AM system, not SNOMED
    // Per NPHIES: https://portal.nphies.sa/ig/StructureDefinition-exsupportinginfo-onset.profile.json.html
    // - code (CodeableConcept with ICD-10-AM) is REQUIRED (min: 1)
    // - timingDate is REQUIRED (min: 1)
    const principalDiagnosis = priorAuth.diagnoses?.find(d => 
      (d.diagnosis_type || 'principal').toLowerCase() === 'principal'
    ) || priorAuth.diagnoses?.[0];
    
    supportingInfoList = supportingInfoList.map(info => {
      const category = (info.category || '').toLowerCase();
      if (category === 'onset') {
        // Per NPHIES spec: https://portal.nphies.sa/ig/StructureDefinition-exsupportinginfo-onset.profile.json.html
        // Extension.extension:code is REQUIRED (min: 1) with binding to diagnosis-icd-10-am ValueSet
        // Extension.extension:timingDate is REQUIRED (min: 1)
        
        // BV-00428: Onset requires ICD-10 code for symptoms/illness
        // IB-00045: Code must use a value from the specified ValueSet (diagnosis-icd-10-am)
        const currentCode = (info.code || '').trim();
        const isInvalidCode = !currentCode || 
                             currentCode.toLowerCase() === 'onset' || 
                             currentCode === '' ||
                             // Check if code system is wrong (should be ICD-10-AM)
                             (info.code_system && info.code_system !== 'http://hl7.org/fhir/sid/icd-10-am');
        
        if (isInvalidCode) {
          if (principalDiagnosis?.diagnosis_code) {
            info.code = principalDiagnosis.diagnosis_code;
            info.code_display = principalDiagnosis.diagnosis_display;
          } else {
            // If no diagnosis available, remove onset to avoid validation error
            // BV-00428 requires both ICD-10 code and date - can't satisfy without diagnosis
            console.warn('[ProfessionalMapper] Onset supportingInfo requires ICD-10 code but no diagnosis found. Removing onset entry.');
            return null; // Will be filtered out
          }
        }
        
        // Force ICD-10-AM system for onset (BV-00428, IB-00045)
        // Per NPHIES spec: code must bind to http://nphies.sa/terminology/ValueSet/diagnosis-icd-10-am
        // The ValueSet uses system: http://hl7.org/fhir/sid/icd-10-am
        info.code_system = 'http://hl7.org/fhir/sid/icd-10-am';
        
        // BV-00428: Convert value_string date to timing_date if it looks like a date
        // Per NPHIES spec: timingDate is REQUIRED (min: 1)
        if (info.value_string && !info.timing_date && !info.timing_period_start) {
          // Try to parse date string (format: DD-MM-YYYY or YYYY-MM-DD)
          const dateStr = info.value_string.trim();
          let parsedDate = null;
          
          // Try DD-MM-YYYY format (e.g., "24-12-2025")
          const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
          if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          } else {
            // Try YYYY-MM-DD format
            parsedDate = new Date(dateStr);
          }
          
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            info.timing_date = parsedDate;
            // Remove value_string since we're using timing_date (per NPHIES spec, use timingDate not valueString)
            delete info.value_string;
          } else {
            // If value_string is not a valid date and no timing_date exists, use encounter start date as fallback
            // Per NPHIES spec: timingDate is REQUIRED
            if (priorAuth.encounter_start) {
              const encounterStart = new Date(priorAuth.encounter_start);
              if (!isNaN(encounterStart.getTime())) {
                info.timing_date = encounterStart;
                delete info.value_string;
              }
            }
          }
        }
        
        // Ensure timingDate is present (REQUIRED per NPHIES spec - min: 1)
        if (!info.timing_date && !info.timing_period_start) {
          // Use encounter start date or request date as fallback
          const fallbackDate = priorAuth.encounter_start || priorAuth.request_date || new Date();
          info.timing_date = new Date(fallbackDate);
        }
        
        // Ensure code is present (REQUIRED per NPHIES spec - min: 1)
        // Double-check after all processing
        if (!info.code && principalDiagnosis?.diagnosis_code) {
          info.code = principalDiagnosis.diagnosis_code;
          info.code_display = principalDiagnosis.diagnosis_display;
        }
        
        // GE-00013: Remove all value fields from onset - per NPHIES spec, onset only requires:
        // - category (onset)
        // - code (CodeableConcept with ICD-10-AM)
        // - timingDate
        // Onset should NOT have valueQuantity, valueString, valueBoolean, valueDate, valuePeriod, or valueReference
        delete info.value_quantity;
        delete info.value_quantity_unit;
        delete info.value_string;
        delete info.value_boolean;
        delete info.value_date;
        delete info.value_period_start;
        delete info.value_period_end;
        delete info.value_reference;
        info._isOnset = true; // Flag to prevent buildSupportingInfo from adding value fields
      }
      return info;
    }).filter(Boolean); // Remove null entries (invalid onset without diagnosis)

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

    // Build supportingInfo array
    const supportingInfoArray = [];
    let sequenceCounter = 1;
    
    // Add regular supporting info items
    supportingInfoList.forEach(info => {
      supportingInfoSequences.push(sequenceCounter);
      supportingInfoArray.push(this.buildSupportingInfo({ ...info, sequence: sequenceCounter }));
      sequenceCounter++;
    });
    
    // NOTE: lab-test supportingInfo with Observation references is NOT part of standard
    // NPHIES Professional Prior Authorization per official example at:
    // https://portal.nphies.sa/ig/Claim-173086.json.html
    // The official example only uses: vital signs, chief-complaint, investigation-result,
    // patient-history, treatment-plan, physical-examination, history-of-present-illness
    // 
    // Lab observations may be required for specific Communication test cases, not standard PA.
    // Commenting out to avoid RE-00165 and RE-00170 errors.
    //
    // if (observationIds && observationIds.length > 0) {
    //   observationIds.forEach(obsId => {
    //     const labSupportingInfo = {
    //       sequence: sequenceCounter,
    //       category: {
    //         coding: [
    //           {
    //             system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
    //             code: 'lab-test',
    //             display: 'Laboratory Test'
    //           }
    //         ]
    //       },
    //       valueReference: {
    //         reference: `Observation/${obsId}`
    //       }
    //     };
    //     supportingInfoSequences.push(sequenceCounter);
    //     supportingInfoArray.push(labSupportingInfo);
    //     sequenceCounter++;
    //   });
    // }
    
    if (supportingInfoArray.length > 0) {
      claim.supportingInfo = supportingInfoArray;
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
        this.buildClaimItemProfessional(item, idx + 1, supportingInfoSequences, encounterPeriod)
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
   * Build claim item for Professional auth type
   */
  buildClaimItemProfessional(item, itemIndex, supportingInfoSequences, encounterPeriod) {
    const claimItem = this.buildClaimItem(item, 'professional', itemIndex, supportingInfoSequences, encounterPeriod);
    
    // Add body site if provided (hands/feet/coronary)
    if (item.body_site_code) {
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

    return claimItem;
  }

  /**
   * Build Encounter resource for Professional auth type
   * Reference: https://portal.nphies.sa/ig/Encounter-10122.json.html
   * 
   * Required fields per NPHIES:
   * - For EMER encounters: triageCategory, triageDate, serviceEventType extensions
   * - serviceType (acute-care, sub-acute-care, etc.)
   * - priority (for emergency encounters)
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    let encounterClass = priorAuth.encounter_class || 'ambulatory';
    
    // BV-00755: If subType=EMR then Encounter.class MUST be EMER
    const subTypeCode = priorAuth.sub_type || 'op';
    if (subTypeCode === 'emr' && encounterClass !== 'emergency') {
      console.warn(`[ProfessionalMapper] BV-00755 violation: subType=EMR requires encounter.class=EMER. Correcting encounter class from '${encounterClass}' to 'emergency'`);
      encounterClass = 'emergency';
    }
    const encounterIdentifier = priorAuth.encounter_identifier || 
                                priorAuth.request_number || 
                                `ENC-${encounterId.substring(0, 8)}`;

    // Build extensions based on encounter class
    const extensions = [];

    // For Emergency encounters (EMER), add triage and service event extensions
    // BV-00733, BV-00734: Triage date and category are REQUIRED for emergency
    if (encounterClass === 'emergency') {
      // Triage Category - REQUIRED for EMER (BV-00734)
      const triageCategory = priorAuth.triage_category || 'U'; // Default to Urgent if not provided
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
      const triageDate = priorAuth.triage_date || priorAuth.encounter_start || new Date();
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageDate',
        valueDateTime: this.formatDateTimeWithTimezone(triageDate)
      });
    }

    // Service Event Type - REQUIRED for professional encounters (BV-00736)
    const serviceEventType = priorAuth.service_event_type || 'ICSE'; // Default to Initial if not provided
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
        system: `http://${NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider'}.com.sa/identifiers/encounter`,
        value: encounterIdentifier
      }
    ];

    // Status - 'in-progress' for active encounters, 'planned' for future
    encounter.status = priorAuth.encounter_status || 'in-progress';

    // Class
    encounter.class = {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: this.getEncounterClassCode(encounterClass),
      display: this.getEncounterClassDisplay(encounterClass)
    };

    // Service Type - required per NPHIES
    if (priorAuth.service_type) {
      encounter.serviceType = {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: priorAuth.service_type,
          display: this.getServiceTypeDisplay(priorAuth.service_type)
        }]
      };
    }

    // Priority - required for emergency encounters
    if (encounterClass === 'emergency' || priorAuth.encounter_priority) {
      const priorityCode = priorAuth.encounter_priority || 'EM';
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

    // Period - BV-00811: Date time format up to seconds SHALL be mandatory
    // All encounter classes require datetime format with seconds (including AMB)
    // Format: "2025-12-24T00:00:00.000Z" or with timezone "2025-12-24T00:00:00.000+03:00"
    encounter.period = {
      start: this.formatDateTimeWithTimezone(priorAuth.encounter_start || new Date())
    };
    if (priorAuth.encounter_end) {
      encounter.period.end = this.formatDateTimeWithTimezone(priorAuth.encounter_end);
    }

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Get triage category display text
   * Reference: http://nphies.sa/terminology/CodeSystem/triage-category
   * Reference: https://portal.nphies.sa/ig/ValueSet-triage-category.html
   * Valid codes: IR, U, VU, NU, SER
   */
  getTriageCategoryDisplay(code) {
    const displays = {
      'IR': 'Immediate resuscitation',
      'VU': 'Very Urgent',
      'U': 'Urgent',
      'NU': 'Non-Urgent',
      'SER': 'Standard ER'
    };
    return displays[code] || code;
  }

  /**
   * Get service event type display text
   * Reference: http://nphies.sa/terminology/CodeSystem/service-event-type
   */
  getServiceEventTypeDisplay(code) {
    const displays = {
      'ICSE': 'Initial client service event',
      'SCSE': 'Subsequent client service event'
    };
    return displays[code] || code;
  }

  /**
   * Get encounter priority display text
   * Reference: http://terminology.hl7.org/CodeSystem/v3-ActPriority
   */
  getEncounterPriorityDisplay(code) {
    const displays = {
      'A': 'ASAP',
      'CR': 'callback results',
      'CS': 'callback for scheduling',
      'CSP': 'callback placer for scheduling',
      'CSR': 'contact recipient for scheduling',
      'EL': 'elective',
      'EM': 'emergency',
      'P': 'preop',
      'PRN': 'as needed',
      'R': 'routine',
      'RR': 'rush reporting',
      'S': 'stat',
      'T': 'timing critical',
      'UD': 'use as directed',
      'UR': 'urgent'
    };
    return displays[code] || code;
  }

  /**
   * Get emergency arrival code display text
   * Reference: https://portal.nphies.sa/ig/CodeSystem-emergency-arrival-code.html
   * Valid codes per NPHIES ValueSet: unknown, PV, ACDA, OGV, GCDA, other, MOHA, EMSAA, GMA, AMA, GEMSA, GPA, POV
   */
  getEmergencyArrivalCodeDisplay(code) {
    const displays = {
      'unknown': 'Not stated/unknown',
      'PV': 'Personal Vehicle',
      'ACDA': 'Air Civil Defense Ambulance',
      'OGV': 'Other Government Vehicles',
      'GCDA': 'Ground Civil Defense Ambulance',
      'other': 'Other',
      'MOHA': 'Ground MOH Ambulance',
      'EMSAA': 'EMS Air Ambulance',
      'GMA': 'Ground Military Ambulance',
      'AMA': 'Air Military Ambulance',
      'GEMSA': 'Ground EMS Ambulance',
      'GPA': 'Ground Private Ambulance',
      'POV': 'Police Vehicle'
    };
    return displays[code] || code;
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
}

export default ProfessionalMapper;

