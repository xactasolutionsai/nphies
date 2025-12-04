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

class ProfessionalMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'professional';
  }

  /**
   * Build complete Prior Authorization Request Bundle for Professional type
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

    // Generate consistent IDs for all resources
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

    // Build all resources
    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '08.00' },
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds);
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    // Build MessageHeader (must be first)
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build attachments as Binary resources
    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Assemble bundle per NPHIES spec order
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
   * Build FHIR Claim resource for Professional Prior Authorization
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

    if (priorAuth.eligibility_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          reference: priorAuth.eligibility_ref
        }
      });
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
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: this.getClaimSubTypeCode(priorAuth.encounter_class || 'ambulatory', 'professional')
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

    // Related (for updates)
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

    // SupportingInfo
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
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
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    const encounterClass = priorAuth.encounter_class || 'ambulatory';
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
        code: this.getEncounterClassCode(encounterClass),
        display: this.getEncounterClassDisplay(encounterClass)
      }
    };

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period - format depends on encounter class
    const needsDateTime = ['daycase', 'inpatient'].includes(encounterClass);
    
    if (needsDateTime) {
      encounter.period = {
        start: this.formatDateTimeWithTimezone(priorAuth.encounter_start || new Date())
      };
      if (priorAuth.encounter_end) {
        encounter.period.end = this.formatDateTimeWithTimezone(priorAuth.encounter_end);
      }
    } else {
      // AMB: date-only format
      const startDateRaw = priorAuth.encounter_start || new Date();
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
}

export default ProfessionalMapper;

