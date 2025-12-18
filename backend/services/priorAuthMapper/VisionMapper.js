/**
 * NPHIES Vision Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-priorauth
 * 
 * Bundle Structure:
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (vision-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Practitioner
 * - VisionPrescription (REQUIRED - contains lens specifications)
 * - NO Encounter resource
 * 
 * Special Requirements:
 * - BV-00367: Must use 'op' subType
 * - BV-00354: NO encounter reference allowed
 * - BV-00374: NO bodySite on items
 * - VisionPrescription with lensSpecification is REQUIRED
 * - ProductOrService uses science-codes or vision-codes
 */

import BaseMapper from './BaseMapper.js';

class VisionMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'vision';
  }

  /**
   * Get vision product type display
   */
  getVisionProductDisplay(productCode) {
    const products = {
      'lens': 'Lens',
      'contact': 'Contact Lens',
      'frame': 'Frame',
      'services': 'Services',
      'glasses': 'Glasses',
      'sunglasses': 'Sunglasses'
    };
    return products[productCode] || productCode;
  }

  /**
   * Build complete Prior Authorization Request Bundle for Vision type
   * Note: Vision claims do NOT include Encounter resource (BV-00354)
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner, visionPrescription } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      visionPrescription: this.generateId(),
      policyHolder: policyHolder?.id || this.generateId()
    };

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner || { name: 'Default Practitioner', specialty_code: '11.00' }, // Ophthalmology specialty
      bundleResourceIds.practitioner
    );
    
    // VisionPrescription resource
    const visionPrescriptionResource = this.buildVisionPrescriptionResource(
      visionPrescription || priorAuth.vision_prescription || {},
      bundleResourceIds.patient,
      bundleResourceIds.practitioner,
      bundleResourceIds.visionPrescription,
      provider
    );
    
    const claimResource = this.buildClaimResource(
      priorAuth, patient, provider, insurer, coverage, 
      null, // NO encounter for vision
      practitioner, 
      bundleResourceIds,
      visionPrescriptionResource
    );
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Vision bundle: NO Encounter, but includes VisionPrescription
    const entries = [
      messageHeader,
      claimResource,
      visionPrescriptionResource, // VisionPrescription instead of Encounter
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
   * Build FHIR Claim resource for Vision Prior Authorization
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds, visionPrescriptionResource) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const practitionerRef = bundleResourceIds.practitioner;
    const visionPrescriptionRef = bundleResourceIds.visionPrescription;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions - NO encounter extension for vision
    const extensions = [];

    // BV-00354: Vision claims do NOT reference an encounter
    // NO extension-encounter

    // VisionPrescription reference extension (if applicable)
    if (visionPrescriptionRef) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-prescription',
        valueReference: {
          reference: `VisionPrescription/${visionPrescriptionRef}`
        }
      });
    }

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
        profile: [this.getAuthorizationProfileUrl('vision')]
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
          code: 'vision'
        }
      ]
    };
    // BV-00367: Vision must use 'op' subType
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

    // Prescription reference for vision claims
    if (visionPrescriptionRef) {
      claim.prescription = { reference: `VisionPrescription/${visionPrescriptionRef}` };
    }

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
    const practiceCode = priorAuth.practice_code || pract.practice_code || pract.specialty_code || '11.00'; // Ophthalmology
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
        // NO onAdmission for vision claims
      }));
    }

    // SupportingInfo
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn authorization should include birth-weight
    if (priorAuth.is_newborn && priorAuth.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => info.category === 'birth-weight');
      if (!hasBirthWeight) {
        supportingInfoList.push({
          category: 'birth-weight',
          value_quantity: parseFloat(priorAuth.birth_weight),
          value_quantity_unit: 'g'  // grams per NPHIES standard
        });
      }
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

    // Items - Vision items have NO bodySite (BV-00374)
    const servicedDate = priorAuth.request_date || new Date();
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildVisionClaimItem(item, idx + 1, supportingInfoSequences, servicedDate)
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
   * Build claim item for Vision - NO bodySite allowed (BV-00374)
   */
  buildVisionClaimItem(item, itemIndex, supportingInfoSequences, servicedDate) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    
    // Build item-level extensions
    const itemExtensions = [];

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    const patientShare = parseFloat(item.patient_share || 0);
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-payer-share',
      valueMoney: {
        value: item.payer_share !== undefined ? parseFloat(item.payer_share) : (calculatedNet - patientShare),
        currency: item.currency || 'SAR'
      }
    });

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || 'SAR'
      }
    });

    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: item.information_sequences || supportingInfoSequences,
      productOrService: {
        coding: [
          {
            // IB-00030: Vision claims use 'procedures' CodeSystem, NOT 'scientific-codes'
            system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
            code: item.product_or_service_code,
            display: item.product_or_service_display
          }
        ]
      },
      servicedDate: this.formatDate(item.serviced_date || servicedDate),
      quantity: { value: quantity },
      unitPrice: {
        value: unitPrice,
        currency: item.currency || 'SAR'
      },
      net: {
        value: calculatedNet,
        currency: item.currency || 'SAR'
      }
      // BV-00374: NO bodySite for vision claims
    };

    if (factor !== 1) {
      claimItem.factor = factor;
    }

    return claimItem;
  }

  /**
   * Build VisionPrescription resource with lens specifications
   */
  buildVisionPrescriptionResource(visionPrescription, patientId, practitionerId, prescriptionId, provider) {
    const prescription = visionPrescription || {};
    
    const resource = {
      resourceType: 'VisionPrescription',
      id: prescriptionId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-prescription|1.0.0']
      },
      identifier: [
        {
          system: `http://${provider?.nphies_id || 'provider'}.com.sa/identifiers/prescription`,
          value: prescription.prescription_number || `RX-${prescriptionId.substring(0, 8)}`
        }
      ],
      status: 'active',
      created: this.formatDateTime(prescription.date_written || new Date()),
      patient: { reference: `Patient/${patientId}` },
      dateWritten: this.formatDate(prescription.date_written || new Date()),
      prescriber: { reference: `Practitioner/${practitionerId}` },
      lensSpecification: []
    };

    // Build lens specifications
    const lensSpecs = prescription.lens_specifications || [];
    
    if (lensSpecs.length === 0) {
      // Default: build from right_eye/left_eye fields if present
      if (prescription.right_eye) {
        resource.lensSpecification.push(
          this.buildLensSpecification(prescription.right_eye, 'right', prescription.product_type)
        );
      }
      if (prescription.left_eye) {
        resource.lensSpecification.push(
          this.buildLensSpecification(prescription.left_eye, 'left', prescription.product_type)
        );
      }
    } else {
      // Use provided lens specifications
      lensSpecs.forEach(spec => {
        resource.lensSpecification.push(
          this.buildLensSpecification(spec, spec.eye, spec.product_type)
        );
      });
    }

    // Ensure at least one lens specification exists
    if (resource.lensSpecification.length === 0) {
      resource.lensSpecification.push(
        this.buildLensSpecification({}, 'right', 'lens')
      );
    }

    return {
      fullUrl: `http://provider.com/VisionPrescription/${prescriptionId}`,
      resource
    };
  }

  /**
   * Build individual lens specification
   * Per NPHIES VisionPrescription example: uses lens-type CodeSystem, no display field
   */
  buildLensSpecification(eyeData, eye, productType) {
    const data = eyeData || {};
    
    const lensSpec = {
      product: {
        coding: [
          {
            // NPHIES requires lens-type CodeSystem, NOT ex-visionprescriptionproduct
            system: 'http://nphies.sa/terminology/CodeSystem/lens-type',
            code: productType || data.product || 'lens'
            // Note: NO display field per NPHIES specification
          }
        ]
      },
      eye: eye || data.eye || 'right'
    };

    // Helper to check if value is valid for numeric field (not null, undefined, empty string, or NaN)
    const isValidNumeric = (val) => val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val));
    
    // Sphere (SPH) - required
    if (isValidNumeric(data.sphere)) {
      lensSpec.sphere = parseFloat(data.sphere);
    }

    // Cylinder (CYL)
    if (isValidNumeric(data.cylinder)) {
      lensSpec.cylinder = parseFloat(data.cylinder);
    }

    // Axis
    if (isValidNumeric(data.axis)) {
      lensSpec.axis = parseInt(data.axis);
    }

    // Add (for reading/bifocal)
    if (isValidNumeric(data.add)) {
      lensSpec.add = parseFloat(data.add);
    }

    // Power (for contacts)
    if (isValidNumeric(data.power)) {
      lensSpec.power = parseFloat(data.power);
    }

    // Back curve (for contacts)
    if (isValidNumeric(data.back_curve)) {
      lensSpec.backCurve = parseFloat(data.back_curve);
    }

    // Diameter (for contacts)
    if (isValidNumeric(data.diameter)) {
      lensSpec.diameter = parseFloat(data.diameter);
    }

    // Duration
    if (isValidNumeric(data.duration_value)) {
      lensSpec.duration = {
        value: parseFloat(data.duration_value),
        unit: data.duration_unit || 'month',
        system: 'http://unitsofmeasure.org',
        code: data.duration_unit === 'year' ? 'a' : 'mo'
      };
    }

    // Color (for contacts/sunglasses)
    if (data.color) {
      lensSpec.color = data.color;
    }

    // Brand
    if (data.brand) {
      lensSpec.brand = data.brand;
    }

    // Note
    if (data.note) {
      lensSpec.note = [{ text: data.note }];
    }

    // Prism - only add if valid amount and base are provided
    if (data.prism && Array.isArray(data.prism)) {
      const validPrisms = data.prism
        .filter(p => isValidNumeric(p.amount) && p.base)
        .map(p => ({
          amount: parseFloat(p.amount),
          base: p.base
        }));
      if (validPrisms.length > 0) {
        lensSpec.prism = validPrisms;
      }
    } else if (isValidNumeric(data.prism_amount) && data.prism_base) {
      lensSpec.prism = [{
        amount: parseFloat(data.prism_amount),
        base: data.prism_base
      }];
    }

    return lensSpec;
  }

  /**
   * NO Encounter for Vision - this method returns null
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    // BV-00354: Vision claims do NOT have an Encounter
    return null;
  }
}

export default VisionMapper;

