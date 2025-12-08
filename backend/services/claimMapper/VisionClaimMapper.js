/**
 * NPHIES Vision Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-claim
 * Reference: https://portal.nphies.sa/ig/Claim-123773.json.html
 * 
 * This mapper extends the Prior Auth VisionMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: vision-claim (instead of vision-priorauth)
 * 
 * Extensions (per NPHIES validation):
 * - extension-accountingPeriod (required per IC-01620, day must be "01" per BV-01010)
 * - extension-episode (required)
 * NOTE: NPHIES example Claim-123773.json only shows episode extension!
 * 
 * SupportingInfo:
 * - Per NPHIES example (Claim-123773.json), supportingInfo is OPTIONAL
 * - If included, must follow BV-00530: non-chief-complaint categories with "code" 
 *   element must have code.coding[] (not just code.text)
 * - For free-text categories: use valueString ONLY (no code element)
 * - For investigation-result: must use proper coded value from CodeSystem
 * 
 * Item Extensions (per NPHIES example):
 * - extension-patient-share (required)
 * - extension-tax (required)
 * - extension-patientInvoice (required)
 * 
 * Vision Claims DO NOT have:
 * - Encounter resource (BV-00354)
 * - extension-encounter
 * - extension-condition-onset on diagnosis
 * - onAdmission on diagnosis
 * - extension-package on items
 * - extension-maternity on items
 * 
 * Total Calculation (BV-00059):
 * - Claim total MUST equal sum of all item net values
 */

import VisionPAMapper from '../priorAuthMapper/VisionMapper.js';

class VisionClaimMapper extends VisionPAMapper {
  constructor() {
    super();
    this.claimType = 'vision';
  }

  /**
   * Get the NPHIES Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-claim|1.0.0';
  }

  /**
   * Build complete Claim Request Bundle for Vision type
   * Note: Vision claims do NOT include Encounter resource (BV-00354)
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId()
    };

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: claim.practice_code || '11.09' }, // Ophthalmology
      bundleResourceIds.practitioner
    );
    
    const claimResource = this.buildVisionClaimResource(claim, patient, provider, insurer, coverage, practitioner, bundleResourceIds);
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // Vision bundle: NO Encounter resource
    const entries = [
      messageHeader,
      claimResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      patientResource
    ].filter(Boolean);

    if (claim.attachments?.length > 0) {
      claim.attachments.forEach(att => entries.push(this.buildBinaryResource(att)));
    }

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
   * Build FHIR Claim resource for Vision Claim
   * Per NPHIES example: https://portal.nphies.sa/ig/Claim-123773.json.html
   */
  buildVisionClaimResource(claim, patient, provider, insurer, coverage, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions per NPHIES validation requirements
    // Note: Although Claim-123773.json example doesn't show accountingPeriod,
    // NPHIES validation (IC-01620) explicitly requires it as the FIRST extension
    const extensions = [];
    
    // 1. AccountingPeriod extension (required per NPHIES validation IC-01620)
    // Must be FIRST extension as per error: "Bundle.entry[1].resource.extension[0].AccountingPeriod"
    // BV-01010: Day must be defaulted to "01" (e.g., "2025-12-01" not "2025-12-08")
    const serviceDate = new Date(claim.service_date || claim.request_date || new Date());
    const accountingPeriodDate = `${serviceDate.getFullYear()}-${String(serviceDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });
    
    // 2. Episode extension (required)
    const episodeId = claim.episode_identifier || `EpisodeID_${this.formatDate(new Date()).replace(/-/g, '')}_${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: { 
        system: `${providerIdentifierSystem}/episode`, 
        value: episodeId 
      }
    });

    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: { profile: [this.getClaimProfileUrl()] },
      extension: extensions,
      identifier: [{ 
        system: `${providerIdentifierSystem}/claim`, 
        value: claim.claim_number || `req_${Date.now()}` 
      }],
      status: 'active',
      type: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/claim-type', 
          code: 'vision' 
        }] 
      },
      subType: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype', 
          code: 'op'  // Vision is always outpatient
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
    const practiceCode = claim.practice_code || pract.practice_code || pract.specialty_code || '11.09'; // Ophthalmology
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

    // Diagnosis - Vision claims have NO condition-onset extension and NO onAdmission
    if (claim.diagnoses?.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => ({
        sequence: diag.sequence || idx + 1,
        diagnosisCodeableConcept: { 
          coding: [{ 
            system: 'http://hl7.org/fhir/sid/icd-10-am', 
            code: diag.diagnosis_code, 
            display: diag.diagnosis_display 
          }] 
        },
        type: [{ 
          coding: [{ 
            system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type', 
            code: diag.diagnosis_type || 'principal' 
          }] 
        }]
        // NO onAdmission for vision claims
        // NO extension-condition-onset for vision claims
      }));
    }

    // SupportingInfo - Per NPHIES example (Claim-123773.json), supportingInfo is OPTIONAL
    // Only include if claim has actual supporting info data from the PA
    // Do NOT add default/placeholder values - this causes BV-00530 errors
    let supportingInfoSequences = [];
    const existingSupportingInfo = claim.supporting_info || [];
    
    if (existingSupportingInfo.length > 0) {
      // Process existing supporting info, ensuring proper structure for each category
      const processedSupportingInfo = this.processVisionSupportingInfo(existingSupportingInfo);
      if (processedSupportingInfo.length > 0) {
        claimResource.supportingInfo = processedSupportingInfo.map((info, idx) => {
          const seq = idx + 1;
          supportingInfoSequences.push(seq);
          return this.buildSupportingInfo({ ...info, sequence: seq });
        });
      }
    }
    // If no supporting info exists, don't add any - per NPHIES example

    // Insurance
    claimResource.insurance = [{ 
      sequence: 1, 
      focal: true, 
      coverage: { reference: `Coverage/${bundleResourceIds.coverage}` } 
    }];

    // Items with vision-specific extensions
    const claimServicedDate = claim.service_date || claim.request_date || new Date();
    if (claim.items?.length > 0) {
      claimResource.item = claim.items.map((item, idx) => 
        this.buildVisionClaimItem(item, idx + 1, claimServicedDate, providerIdentifierSystem, claim, supportingInfoSequences)
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
   * Process existing supportingInfo for Vision Claims
   * Per NPHIES example (Claim-123773.json), supportingInfo is OPTIONAL.
   * 
   * BV-00530: If supportingInfo "code" element is provided and category is not 
   * 'chief-complaint', then code.coding[] with actual coded values is required.
   * 
   * This method ensures existing supporting info has the correct structure:
   * - investigation-result: must have code.coding with actual coded value
   * - other categories: use valueString only (remove code_text to avoid BV-00530)
   */
  processVisionSupportingInfo(existingSupportingInfo = []) {
    return existingSupportingInfo.map(info => {
      const category = (info.category || '').toLowerCase();
      
      // For investigation-result, ensure proper code structure
      if (category === 'investigation-result') {
        // If it already has a proper code, use it; otherwise set default INP
        if (info.code) {
          return {
            ...info,
            code_text: undefined, // Remove code_text to avoid BV-00530
            value_string: undefined // Remove valueString when using code
          };
        } else {
          return {
            category: 'investigation-result',
            code: info.code || 'INP',
            code_system: info.code_system || 'http://nphies.sa/terminology/CodeSystem/investigation-result',
            code_display: info.code_display || 'INP - Investigation(s) not performed'
          };
        }
      }
      
      // For all other categories, use valueString ONLY (no code element)
      // This avoids BV-00530 error
      return {
        category: info.category,
        value_string: info.value_string || info.code_text || info.code_display || ''
        // Explicitly NOT including code, code_text, code_system, code_display
      };
    }).filter(info => {
      // Filter out entries with empty values
      if (info.code) return true;
      if (info.value_string && info.value_string.trim()) return true;
      return false;
    });
  }

  /**
   * Build claim item for Vision Claims
   * Per NPHIES example: only patient-share, tax, patientInvoice extensions
   * NO extension-package, NO extension-maternity
   */
  buildVisionClaimItem(item, sequence, servicedDate, providerIdentifierSystem, claim, supportingInfoSequences = []) {
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    const calculatedNet = (quantity * unitPrice * factor) + tax;

    // Vision claim item extensions per NPHIES example
    // Order: patient-share, tax, patientInvoice
    const itemExtensions = [
      // Patient share extension
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share', 
        valueMoney: { 
          value: parseFloat(item.patient_share || 0), 
          currency: item.currency || claim?.currency || 'SAR' 
        } 
      },
      // Tax extension
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax', 
        valueMoney: { 
          value: tax, 
          currency: item.currency || claim?.currency || 'SAR' 
        } 
      },
      // PatientInvoice extension (required)
      {
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
        valueIdentifier: { 
          system: `${providerIdentifierSystem}/patientInvoice`, 
          value: item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}-${item.product_or_service_code || 'Proc'}`
        }
      }
    ];

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
      servicedDate: this.formatDate(item.serviced_date || servicedDate),
      quantity: { value: quantity },
      unitPrice: { value: unitPrice, currency: item.currency || claim?.currency || 'SAR' },
      net: { value: calculatedNet, currency: item.currency || claim?.currency || 'SAR' }
    };

    // Add factor if not 1
    if (factor !== 1) {
      claimItem.factor = factor;
    }

    return claimItem;
  }

  /**
   * Parse Claim Response Bundle
   */
  parseClaimResponse(responseBundle) {
    // Reuse the PA response parser - structure is the same
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default VisionClaimMapper;
