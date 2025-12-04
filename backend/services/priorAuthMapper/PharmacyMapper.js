/**
 * NPHIES Pharmacy Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth
 * 
 * Bundle Structure:
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (pharmacy-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Practitioner
 * - Encounter (AMB profile only)
 * 
 * Special Requirements:
 * - Must use 'pharmacy' claim type
 * - Must use 'op' subType
 * - days-supply supportingInfo is REQUIRED
 * - ProductOrService uses medication CodeSystems (GTIN, NUPCO, MOH, NHIC)
 * - MedicationRequest reference may be included
 */

import BaseMapper from './BaseMapper.js';

class PharmacyMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'pharmacy';
  }

  /**
   * Get medication code system based on code type
   */
  getMedicationCodeSystem(codeType) {
    const systems = {
      'gtin': 'http://nphies.sa/terminology/CodeSystem/gtin',
      'nupco': 'http://nphies.sa/terminology/CodeSystem/nupco-codes',
      'moh': 'http://nphies.sa/terminology/CodeSystem/moh-medications',
      'nhic': 'http://nphies.sa/terminology/CodeSystem/nhic-medications',
      'scientific': 'http://nphies.sa/terminology/CodeSystem/scientific-codes'
    };
    return systems[codeType?.toLowerCase()] || systems['scientific'];
  }

  /**
   * Build complete Prior Authorization Request Bundle for Pharmacy type
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

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
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' }, // Internal Medicine (pharmacy prescriber)
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds);
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

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

    // Encounter extension for pharmacy
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
        profile: [this.getAuthorizationProfileUrl('pharmacy')]
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
          code: 'pharmacy'
        }
      ]
    };
    // Pharmacy uses 'op' subType
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: 'op'
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

    // CareTeam
    const pract = practitioner || priorAuth.practitioner || {};
    const practiceCode = priorAuth.practice_code || pract.practice_code || pract.specialty_code || '08.00'; // Default prescriber specialty
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
        // NO onAdmission for pharmacy claims
      }));
    }

    // SupportingInfo with REQUIRED days-supply
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
    // days-supply is REQUIRED for pharmacy
    const hasDaysSupply = supportingInfoList.some(info => info.category === 'days-supply');
    if (!hasDaysSupply) {
      supportingInfoList.unshift({
        category: 'days-supply',
        value_quantity: priorAuth.days_supply || 30, // Default 30 days
        value_quantity_unit: 'd',
        timing_date: priorAuth.request_date || new Date()
      });
    }
    
    if (supportingInfoList.length > 0) {
      claim.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
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

    // Items with medication codes
    const encounterPeriod = {
      start: priorAuth.encounter_start || new Date(),
      end: null
    };
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildPharmacyClaimItem(item, idx + 1, supportingInfoSequences, encounterPeriod)
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
   * Build claim item for Pharmacy with medication codes
   */
  buildPharmacyClaimItem(item, itemIndex, supportingInfoSequences, encounterPeriod) {
    const claimItem = this.buildClaimItem(item, 'pharmacy', itemIndex, supportingInfoSequences, encounterPeriod);
    
    // Override productOrService to use medication code system
    const codeSystem = item.medication_code_type 
      ? this.getMedicationCodeSystem(item.medication_code_type)
      : (item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/scientific-codes');
    
    claimItem.productOrService = {
      coding: [
        {
          system: codeSystem,
          code: item.medication_code || item.product_or_service_code,
          display: item.medication_name || item.product_or_service_display
        }
      ]
    };

    // Add medication-specific details extension
    if (item.medication_form || item.medication_strength || item.medication_route) {
      if (!claimItem.extension) {
        claimItem.extension = [];
      }
      
      if (item.medication_form) {
        claimItem.extension.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-medication-form',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: item.medication_form_code || item.medication_form,
                display: item.medication_form
              }
            ]
          }
        });
      }
    }

    return claimItem;
  }

  /**
   * Build Encounter resource for Pharmacy auth type
   * Pharmacy uses AMB (ambulatory) encounter class only
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    // Pharmacy uses ambulatory encounter
    const encounterClass = 'ambulatory';
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
          system: `http://${provider?.nphies_id || 'provider'}.com.sa/identifiers/encounter`,
          value: encounterIdentifier
        }
      ],
      status: 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      }
    };

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period - date-only format for AMB
    const startDateRaw = priorAuth.encounter_start || new Date();
    let dateOnlyStart;
    if (typeof startDateRaw === 'string' && startDateRaw.includes('T')) {
      dateOnlyStart = startDateRaw.split('T')[0];
    } else {
      dateOnlyStart = this.formatDate(startDateRaw);
    }
    
    encounter.period = { start: dateOnlyStart };

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }
}

export default PharmacyMapper;

