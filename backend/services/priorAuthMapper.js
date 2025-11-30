/**
 * NPHIES Prior Authorization FHIR R4 Mapper Service
 * Maps database entities to FHIR resources following NPHIES PA specifications
 * Reference: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
 */

import { randomUUID } from 'crypto';
import nphiesMapper from './nphiesMapper.js';

class PriorAuthMapper {
  constructor() {
    // Reuse utilities from nphiesMapper
    this.generateId = () => randomUUID();
  }

  /**
   * Format date to FHIR date format (YYYY-MM-DD)
   */
  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Format datetime to FHIR dateTime format
   */
  formatDateTime(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  /**
   * Get the NPHIES Authorization profile URL based on auth type
   * Reference: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
   */
  getAuthorizationProfileUrl(authType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-priorauth|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-priorauth|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-priorauth|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-priorauth|1.0.0'
    };
    return profiles[authType] || profiles['professional'];
  }

  /**
   * Get the NPHIES Encounter profile URL based on encounter class
   * Reference: https://portal.nphies.sa/ig/
   */
  getEncounterProfileUrl(encounterClass) {
    const profiles = {
      'ambulatory': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB|1.0.0',
      'outpatient': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-AMB|1.0.0',
      'emergency': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-EMER|1.0.0',
      'home': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-HH|1.0.0',
      'inpatient': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-IMP|1.0.0',
      'daycase': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-SS|1.0.0',
      'telemedicine': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter-auth-VR|1.0.0'
    };
    return profiles[encounterClass] || profiles['ambulatory'];
  }

  /**
   * Get encounter class code for FHIR
   */
  getEncounterClassCode(encounterClass) {
    const codes = {
      'ambulatory': 'AMB',
      'outpatient': 'AMB',
      'emergency': 'EMER',
      'home': 'HH',
      'inpatient': 'IMP',
      'daycase': 'SS',
      'telemedicine': 'VR'
    };
    return codes[encounterClass] || 'AMB';
  }

  /**
   * Build FHIR Claim resource for Prior Authorization
   * Following NPHIES specification
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage) {
    const claimId = `claim-${priorAuth.id || this.generateId()}`;
    const patientId = `patient-${patient.patient_id || patient.patientId}`;
    const providerId = provider.provider_id || provider.providerId;
    const insurerId = insurer.insurer_id || insurer.insurerId;
    const coverageId = `coverage-${coverage?.coverage_id || coverage?.coverageId || this.generateId()}`;

    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl(priorAuth.auth_type)]
      },
      identifier: [
        {
          system: 'http://provider.com/identifiers/priorauth',
          value: priorAuth.request_number || `PA-${Date.now()}`
        }
      ],
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: this.getClaimTypeCode(priorAuth.auth_type)
          }
        ]
      },
      subType: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
            code: 'op' // outpatient by default, can be ip for inpatient
          }
        ]
      },
      use: 'preauthorization',
      patient: {
        reference: `Patient/${patientId}`
      },
      created: this.formatDateTime(priorAuth.request_date || new Date()),
      insurer: {
        reference: `Organization/${insurerId}`
      },
      provider: {
        reference: `Organization/${providerId}`
      },
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/processpriority',
            code: priorAuth.priority || 'normal'
          }
        ]
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: `Coverage/${coverageId}`
          }
        }
      ]
    };

    // Add extensions for update/transfer
    const extensions = [];

    // If this is an update, add the related reference
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

    // Transfer extension
    if (priorAuth.is_transfer) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transfer',
        valueBoolean: true
      });
    }

    // Eligibility reference extension
    if (priorAuth.eligibility_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          identifier: {
            system: 'http://nphies.sa/identifiers/eligibility',
            value: priorAuth.eligibility_ref
          }
        }
      });
    }

    // Eligibility offline extension
    if (priorAuth.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline',
        valueDate: this.formatDate(priorAuth.eligibility_offline_date)
      });
    }

    if (extensions.length > 0) {
      claim.extension = extensions;
    }

    // Add diagnosis if present
    if (priorAuth.diagnoses && priorAuth.diagnoses.length > 0) {
      claim.diagnosis = priorAuth.diagnoses.map(diag => ({
        sequence: diag.sequence,
        diagnosisCodeableConcept: {
          coding: [
            {
              system: diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10',
              code: diag.diagnosis_code,
              display: diag.diagnosis_display
            }
          ]
        },
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/ex-diagnosistype',
                code: diag.diagnosis_type || 'principal'
              }
            ]
          }
        ],
        ...(diag.on_admission !== null && {
          onAdmission: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/ex-diagnosis-on-admission',
                code: diag.on_admission ? 'y' : 'n'
              }
            ]
          }
        })
      }));
    }

    // Add items
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map(item => this.buildClaimItem(item, priorAuth.auth_type));
    }

    // Add supportingInfo
    if (priorAuth.supporting_info && priorAuth.supporting_info.length > 0) {
      claim.supportingInfo = priorAuth.supporting_info.map(info => this.buildSupportingInfo(info));
    }

    // Add total if present
    if (priorAuth.total_amount) {
      claim.total = {
        value: parseFloat(priorAuth.total_amount),
        currency: priorAuth.currency || 'SAR'
      };
    }

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claim
    };
  }

  /**
   * Get claim type code based on auth type
   */
  getClaimTypeCode(authType) {
    const types = {
      'institutional': 'institutional',
      'professional': 'professional',
      'pharmacy': 'pharmacy',
      'dental': 'oral',
      'vision': 'vision'
    };
    return types[authType] || 'professional';
  }

  /**
   * Build a single claim item
   */
  buildClaimItem(item, authType) {
    const claimItem = {
      sequence: item.sequence,
      productOrService: {
        coding: [
          {
            system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
            code: item.product_or_service_code,
            display: item.product_or_service_display
          }
        ]
      }
    };

    // Add quantity
    if (item.quantity) {
      claimItem.quantity = {
        value: parseFloat(item.quantity)
      };
    }

    // Add unit price
    if (item.unit_price) {
      claimItem.unitPrice = {
        value: parseFloat(item.unit_price),
        currency: item.currency || 'SAR'
      };
    }

    // Add net amount
    if (item.net_amount) {
      claimItem.net = {
        value: parseFloat(item.net_amount),
        currency: item.currency || 'SAR'
      };
    }

    // Add serviced date/period for completed items (required for updates)
    if (item.serviced_date) {
      claimItem.servicedDate = this.formatDate(item.serviced_date);
    } else if (item.serviced_period_start) {
      claimItem.servicedPeriod = {
        start: this.formatDate(item.serviced_period_start),
        end: this.formatDate(item.serviced_period_end)
      };
    }

    // Body site for procedures
    if (item.body_site_code) {
      claimItem.bodySite = {
        coding: [
          {
            system: item.body_site_system || 'http://nphies.sa/terminology/CodeSystem/body-site',
            code: item.body_site_code
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

    // Dental-specific: tooth number
    if (authType === 'dental' && item.tooth_number) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://hl7.org/fhir/ex-tooth',
            code: item.tooth_number
          }
        ]
      };
      
      if (item.tooth_surface) {
        claimItem.subSite = item.tooth_surface.split(',').map(surface => ({
          coding: [
            {
              system: 'http://hl7.org/fhir/surface',
              code: surface.trim()
            }
          ]
        }));
      }
    }

    // Vision-specific: eye
    if (authType === 'vision' && item.eye) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://hl7.org/fhir/ex-visioneyecodes',
            code: item.eye
          }
        ]
      };
    }

    // Pharmacy-specific: medication and days supply
    if (authType === 'pharmacy') {
      if (item.medication_code) {
        claimItem.productOrService = {
          coding: [
            {
              system: item.medication_system || 'http://nphies.sa/terminology/CodeSystem/medication',
              code: item.medication_code
            },
            ...(item.product_or_service_code ? [{
              system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
              code: item.product_or_service_code
            }] : [])
          ]
        };
      }
    }

    return claimItem;
  }

  /**
   * Build supportingInfo element
   */
  buildSupportingInfo(info) {
    const supportingInfo = {
      sequence: info.sequence,
      category: {
        coding: [
          {
            system: info.category_system || 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: info.category
          }
        ]
      }
    };

    // Add code if present
    if (info.code) {
      supportingInfo.code = {
        coding: [
          {
            system: info.code_system || 'http://nphies.sa/terminology/CodeSystem/supporting-info-code',
            code: info.code,
            display: info.code_display
          }
        ]
      };
    }

    // Add value based on type
    if (info.value_string) {
      supportingInfo.valueString = info.value_string;
    } else if (info.value_quantity !== null && info.value_quantity !== undefined) {
      supportingInfo.valueQuantity = {
        value: parseFloat(info.value_quantity),
        unit: info.value_quantity_unit
      };
    } else if (info.value_boolean !== null && info.value_boolean !== undefined) {
      supportingInfo.valueBoolean = info.value_boolean;
    } else if (info.value_date) {
      supportingInfo.valueDate = this.formatDate(info.value_date);
    } else if (info.value_period_start) {
      supportingInfo.valuePeriod = {
        start: this.formatDate(info.value_period_start),
        end: this.formatDate(info.value_period_end)
      };
    } else if (info.value_reference) {
      supportingInfo.valueReference = {
        reference: info.value_reference
      };
    }

    // Add timing
    if (info.timing_date) {
      supportingInfo.timingDate = this.formatDate(info.timing_date);
    } else if (info.timing_period_start) {
      supportingInfo.timingPeriod = {
        start: this.formatDate(info.timing_period_start),
        end: this.formatDate(info.timing_period_end)
      };
    }

    // Add reason
    if (info.reason_code) {
      supportingInfo.reason = {
        coding: [
          {
            system: info.reason_system || 'http://nphies.sa/terminology/CodeSystem/supporting-info-reason',
            code: info.reason_code
          }
        ]
      };
    }

    return supportingInfo;
  }

  /**
   * Build FHIR Binary resource for attachments
   */
  buildBinaryResource(attachment) {
    const binaryId = attachment.binary_id || `binary-${this.generateId()}`;
    
    return {
      fullUrl: `http://provider.com/Binary/${binaryId}`,
      resource: {
        resourceType: 'Binary',
        id: binaryId,
        contentType: attachment.content_type,
        data: attachment.base64_content
      }
    };
  }

  /**
   * Build FHIR Encounter resource for Prior Authorization
   */
  buildEncounterResource(priorAuth, patient, provider) {
    const encounterId = `encounter-${priorAuth.id || this.generateId()}`;
    const patientId = `patient-${patient.patient_id || patient.patientId}`;
    const providerId = provider.provider_id || provider.providerId;
    const encounterClass = priorAuth.encounter_class || 'ambulatory';

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: {
        resourceType: 'Encounter',
        id: encounterId,
        meta: {
          profile: [this.getEncounterProfileUrl(encounterClass)]
        },
        status: 'planned',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: this.getEncounterClassCode(encounterClass)
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        serviceProvider: {
          reference: `Organization/${providerId}`
        },
        ...(priorAuth.encounter_start && {
          period: {
            start: this.formatDateTime(priorAuth.encounter_start),
            ...(priorAuth.encounter_end && {
              end: this.formatDateTime(priorAuth.encounter_end)
            })
          }
        })
      }
    };
  }

  /**
   * Build FHIR MessageHeader for Prior Authorization Request
   */
  buildMessageHeader(provider, insurer, focusFullUrl) {
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
          code: 'priorauth-request'
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
   * Build complete Prior Authorization Request Bundle
   * Following NPHIES specification: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner } = data;

    // Build individual resources
    const patientResource = nphiesMapper.buildPatientResource(patient);
    const providerResource = nphiesMapper.buildProviderOrganization(provider);
    const insurerResource = nphiesMapper.buildPayerOrganization(insurer);
    const coverageResource = coverage ? nphiesMapper.buildCoverageResource(coverage, patient, insurer, policyHolder) : null;
    const policyHolderResource = policyHolder ? nphiesMapper.buildPolicyHolderOrganization(policyHolder) : null;
    
    // Build Encounter
    const encounterResource = this.buildEncounterResource(priorAuth, patient, provider);
    
    // Build Claim (main PA request resource)
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage);
    
    // Build MessageHeader (must be first)
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build attachments as Binary resources
    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Assemble bundle with MessageHeader first per NPHIES specification
    const entries = [
      messageHeader,
      claimResource,
      encounterResource
    ];

    // Add coverage if provided
    if (coverageResource) {
      entries.push(coverageResource);
    }

    // Add policy holder if provided
    if (policyHolderResource) {
      entries.push(policyHolderResource);
    }

    // Add remaining resources
    entries.push(
      providerResource,
      patientResource,
      insurerResource
    );

    // Add binary resources for attachments
    binaryResources.forEach(binary => entries.push(binary));

    const bundle = {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };

    return bundle;
  }

  /**
   * Build Task resource for Cancel Request
   * Reference: NPHIES cancel-request using Task.focus
   */
  buildCancelTask(priorAuth, provider, insurer, reason) {
    const taskId = `task-${this.generateId()}`;
    const senderNphiesId = provider.nphies_id || 'PR-FHIR';
    const destinationNphiesId = insurer.nphies_id || 'INS-FHIR';

    const task = {
      resourceType: 'Task',
      id: taskId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/task|1.0.0']
      },
      status: 'requested',
      intent: 'proposal',
      code: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/task-code',
            code: 'cancel'
          }
        ]
      },
      focus: {
        identifier: {
          system: 'http://nphies.sa/identifiers/priorauth',
          value: priorAuth.pre_auth_ref
        }
      },
      authoredOn: this.formatDateTime(new Date()),
      requester: {
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: senderNphiesId
        }
      },
      owner: {
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/payer-license',
          value: destinationNphiesId
        }
      }
    };

    // Add reason if provided
    if (reason) {
      task.statusReason = {
        text: reason
      };
    }

    return task;
  }

  /**
   * Build Cancel Request Bundle
   */
  buildCancelRequestBundle(priorAuth, provider, insurer, reason) {
    const task = this.buildCancelTask(priorAuth, provider, insurer, reason);
    const taskEntry = {
      fullUrl: `http://provider.com/Task/${task.id}`,
      resource: task
    };

    const messageHeader = {
      fullUrl: `urn:uuid:${this.generateId()}`,
      resource: {
        resourceType: 'MessageHeader',
        id: this.generateId(),
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
        },
        eventCoding: {
          system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
          code: 'cancel-request'
        },
        destination: [
          {
            endpoint: `http://nphies.sa/license/payer-license/${insurer.nphies_id || 'INS-FHIR'}`,
            receiver: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: insurer.nphies_id || 'INS-FHIR'
              }
            }
          }
        ],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: provider.nphies_id || 'PR-FHIR'
          }
        },
        source: {
          endpoint: 'http://provider.com'
        },
        focus: [
          {
            reference: taskEntry.fullUrl
          }
        ]
      }
    };

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [messageHeader, taskEntry]
    };
  }

  /**
   * Parse Prior Authorization Response Bundle
   * Extract key information from ClaimResponse
   */
  parsePriorAuthResponse(responseBundle) {
    try {
      if (!responseBundle || !responseBundle.entry) {
        throw new Error('Invalid response bundle');
      }

      // Find key resources
      const messageHeader = responseBundle.entry.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
      const claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;

      // Check if response is nphies-generated (pended)
      const isNphiesGenerated = responseBundle.meta?.tag?.some(
        tag => tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tag' && 
               tag.code === 'nphies-generated'
      );

      // Handle OperationOutcome errors
      if (operationOutcome) {
        const errors = operationOutcome.issue?.map(issue => ({
          severity: issue.severity,
          code: issue.code,
          details: issue.details?.text || issue.diagnostics,
          location: issue.location?.join(', ')
        })) || [];

        if (errors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          return {
            success: false,
            outcome: 'error',
            isNphiesGenerated,
            errors
          };
        }
      }

      if (!claimResponse) {
        return {
          success: false,
          outcome: 'error',
          isNphiesGenerated,
          errors: [{ code: 'PARSE_ERROR', details: 'No ClaimResponse found in bundle' }]
        };
      }

      // Extract preAuthRef
      const preAuthRef = claimResponse.preAuthRef;

      // Extract preAuthPeriod
      const preAuthPeriod = claimResponse.preAuthPeriod;

      // Extract adjudication results for items
      const itemResults = claimResponse.item?.map(item => ({
        itemSequence: item.itemSequence,
        adjudication: item.adjudication?.map(adj => ({
          category: adj.category?.coding?.[0]?.code,
          amount: adj.amount?.value,
          currency: adj.amount?.currency,
          reason: adj.reason?.coding?.[0]?.code
        }))
      }));

      // Extract transfer extensions if present
      const transferAuthNumber = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationNumber')
      )?.valueString;

      const transferAuthProvider = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationProvider')
      )?.valueReference?.identifier?.value;

      const transferAuthPeriod = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationPeriod')
      )?.valuePeriod;

      // Determine success based on outcome
      const outcome = claimResponse.outcome || 'complete';
      const success = outcome === 'complete' || outcome === 'partial';

      return {
        success,
        outcome,
        disposition: claimResponse.disposition,
        preAuthRef,
        preAuthPeriod: preAuthPeriod ? {
          start: preAuthPeriod.start,
          end: preAuthPeriod.end
        } : null,
        nphiesResponseId: claimResponse.identifier?.[0]?.value || claimResponse.id,
        responseCode: messageHeader?.response?.code,
        isNphiesGenerated,
        itemResults,
        // Transfer details
        transfer: transferAuthNumber ? {
          authNumber: transferAuthNumber,
          provider: transferAuthProvider,
          period: transferAuthPeriod ? {
            start: transferAuthPeriod.start,
            end: transferAuthPeriod.end
          } : null
        } : null,
        // Raw response for storage
        rawBundle: responseBundle
      };

    } catch (error) {
      console.error('Error parsing prior auth response:', error);
      return {
        success: false,
        outcome: 'error',
        errors: [{
          code: 'PARSE_ERROR',
          details: error.message
        }]
      };
    }
  }

  /**
   * Validate Prior Authorization response bundle structure
   */
  validatePriorAuthResponse(response) {
    const errors = [];

    if (!response) {
      errors.push('Response is empty');
      return { valid: false, errors };
    }

    if (response.resourceType !== 'Bundle') {
      errors.push('Response is not a FHIR Bundle');
      return { valid: false, errors };
    }

    if (response.type !== 'message') {
      errors.push('Bundle type is not "message"');
    }

    if (!response.entry || !Array.isArray(response.entry)) {
      errors.push('Bundle has no entries');
      return { valid: false, errors };
    }

    // Check for MessageHeader (must be first)
    const firstEntry = response.entry[0];
    if (!firstEntry || firstEntry.resource?.resourceType !== 'MessageHeader') {
      errors.push('First entry must be MessageHeader');
    }

    // Check for eventCoding
    const eventCode = firstEntry?.resource?.eventCoding?.code;
    if (eventCode !== 'priorauth-response') {
      errors.push(`Expected priorauth-response event, got: ${eventCode}`);
    }

    // Check for either ClaimResponse or OperationOutcome
    const hasClaimResponse = response.entry.some(
      e => e.resource?.resourceType === 'ClaimResponse'
    );
    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    if (!hasClaimResponse && !hasOperationOutcome) {
      errors.push('Bundle must contain ClaimResponse or OperationOutcome');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new PriorAuthMapper();

