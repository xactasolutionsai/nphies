/**
 * NPHIES Communication Mapper
 * 
 * Builds FHIR Communication resources for NPHIES transactions.
 * Supports both:
 * - Test Case #1: Unsolicited Communication (HCP proactively sends info)
 * - Test Case #2: Solicited Communication (HCP responds to CommunicationRequest)
 * 
 * Key NPHIES Constraints:
 * - BV-00233: 'about' must reference Claim or ClaimResponse
 * - BV-00335: CommunicationRequest status must be 'active'
 * - CMRQ001: Payload content must be ONE of: string, attachment, or reference
 * 
 * NPHIES Bundle Requirements (per https://portal.nphies.sa/ig/Bundle-16b80922-b538-4ab3-0176-a80b33242163.html):
 * - Bundle must include full Patient, Provider Organization, and Insurer Organization resources
 * - MessageHeader event code should be 'communication' when sending Communication (not 'communication-request')
 * - 'about' reference should use proper identifier system URL format
 */

import { randomUUID } from 'crypto';

class CommunicationMapper {
  constructor() {
    this.generateId = () => randomUUID();
  }

  // ============================================================================
  // HELPER METHODS FOR RESOURCE BUILDING
  // ============================================================================

  /**
   * Split full name into family and given names
   */
  splitName(fullName) {
    if (!fullName) return { family: '', given: [] };
    const parts = fullName.trim().split(' ');
    return {
      family: parts[parts.length - 1] || '',
      given: parts.slice(0, -1).length > 0 ? parts.slice(0, -1) : [parts[0]]
    };
  }

  /**
   * Get FHIR marital status code from input
   */
  getMaritalStatusCode(status) {
    if (!status) return 'U'; // Unknown as default
    const statusMap = {
      'married': 'M', 'single': 'S', 'divorced': 'D', 'widowed': 'W', 'unknown': 'U',
      'M': 'M', 'S': 'S', 'D': 'D', 'W': 'W', 'U': 'U'
    };
    return statusMap[status.toLowerCase?.()] || 'U';
  }

  /**
   * Get identifier configuration based on type
   */
  getIdentifierConfig(type) {
    switch (type) {
      case 'passport':
        return { code: 'PPN', display: 'Passport Number', system: 'http://nphies.sa/identifier/passportnumber' };
      case 'iqama':
        return { code: 'PRC', display: 'Permanent Resident Card', system: 'http://nphies.sa/identifier/iqama' };
      case 'mrn':
        return { code: 'MR', display: 'Medical Record Number', system: 'http://provider.com/identifier/mrn' };
      case 'national_id':
      default:
        return { code: 'NI', display: 'National Identifier', system: 'http://nphies.sa/identifier/nationalid' };
    }
  }

  /**
   * Build Patient resource for Communication bundle
   * Per NPHIES standard: https://portal.nphies.sa/ig/StructureDefinition-patient.html
   */
  buildPatientResource(patient) {
    const patientId = patient.patient_id?.toString() || this.generateId();
    const nameInfo = this.splitName(patient.name);
    const identifierType = patient.identifier_type || 'national_id';
    const identifierConfig = this.getIdentifierConfig(identifierType);
    const gender = patient.gender ? patient.gender.toLowerCase() : 'unknown';
    const occupation = patient.occupation || 'business';

    const patientResource = {
      resourceType: 'Patient',
      id: patientId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0']
      },
      extension: [
        {
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/occupation',
              code: occupation
            }]
          }
        }
      ],
      identifier: [
        {
          extension: [
            {
              url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-identifier-country',
              valueCodeableConcept: {
                coding: [{
                  system: 'urn:iso:std:iso:3166',
                  code: 'SAU',
                  display: 'Saudi Arabia'
                }]
              }
            }
          ],
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: identifierConfig.code,
              display: identifierConfig.display
            }]
          },
          system: identifierConfig.system,
          value: (patient.identifier || patient.patient_id)?.toString() || 'UNKNOWN'
        }
      ],
      active: true,
      name: [{
        use: 'official',
        text: patient.name,
        family: nameInfo.family,
        given: nameInfo.given
      }],
      gender: gender,
      _gender: {
        extension: [{
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-administrative-gender',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-administrative-gender',
              code: gender
            }]
          }
        }]
      },
      deceasedBoolean: false,
      // NPHIES FIX (IC-00236): birthDate is REQUIRED, not optional
      // If not provided, use a placeholder date that indicates unknown
      birthDate: patient.birth_date ? this.formatDate(patient.birth_date) : '1900-01-01',
      maritalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: this.getMaritalStatusCode(patient.marital_status)
        }]
      }
    };

    // Add optional fields
    if (patient.phone) {
      patientResource.telecom = [{ system: 'phone', value: patient.phone }];
    }
    if (patient.address) {
      patientResource.address = [{
        use: 'home',
        text: patient.address,
        line: [patient.address],
        city: patient.city || 'Riyadh',
        country: 'Saudi Arabia'
      }];
    }

    return {
      fullUrl: `http://provider.com/Patient/${patientId}`,
      resource: patientResource
    };
  }

  /**
   * Build Provider Organization resource for Communication bundle
   * Per NPHIES standard: https://portal.nphies.sa/ig/StructureDefinition-provider-organization.html
   */
  buildProviderOrganizationResource(provider) {
    const providerId = provider.provider_id?.toString() || this.generateId();
    const nphiesId = provider.nphies_id || 'PR-FHIR';
    const providerName = provider.provider_name || provider.name || 'Provider Organization';
    const providerType = provider.provider_type || '1';

    const getProviderTypeDisplay = (code) => {
      const displays = { '1': 'Hospital', '2': 'Polyclinic', '3': 'Pharmacy', '4': 'Optical Shop', '5': 'Clinic' };
      return displays[code] || 'Healthcare Provider';
    };

    return {
      fullUrl: `http://provider.com/Organization/${providerId}`,
      resource: {
        resourceType: 'Organization',
        id: providerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0']
        },
        extension: [{
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/provider-type',
              code: providerType,
              display: getProviderTypeDisplay(providerType)
            }]
          }
        }],
        identifier: [{
          system: 'http://nphies.sa/license/provider-license',
          value: nphiesId
        }],
        active: true,
        type: [{
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider'
          }]
        }],
        name: providerName,
        ...(provider.address && {
          address: [{
            use: 'work',
            text: provider.address,
            line: [provider.address],
            city: provider.city || 'Riyadh',
            country: 'Saudi Arabia'
          }]
        })
      }
    };
  }

  /**
   * Build Insurer Organization resource for Communication bundle
   * Per NPHIES standard: https://portal.nphies.sa/ig/StructureDefinition-insurer-organization.html
   */
  buildInsurerOrganizationResource(insurer) {
    const insurerId = insurer.insurer_id?.toString() || this.generateId();
    const nphiesId = insurer.nphies_id || 'INS-FHIR';
    const insurerName = insurer.insurer_name || insurer.name || 'Insurance Organization';

    return {
      fullUrl: `http://provider.com/Organization/${insurerId}`,
      resource: {
        resourceType: 'Organization',
        id: insurerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-organization|1.0.0']
        },
        identifier: [{
          use: 'official',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'NII'
            }]
          },
          system: 'http://nphies.sa/license/payer-license',
          value: nphiesId
        }],
        active: true,
        type: [{
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
            code: 'ins',
            display: 'Insurance Company'
          }]
        }],
        name: insurerName,
        ...(insurer.address && {
          address: [{
            use: 'work',
            text: insurer.address,
            line: [insurer.address],
            city: 'Riyadh',
            country: 'Saudi Arabia'
          }]
        })
      }
    };
  }

  /**
   * Format date to FHIR date format (YYYY-MM-DD)
   */
  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // ============================================================================
  // MAIN BUNDLE BUILDERS
  // ============================================================================

  /**
   * Build UNSOLICITED Communication bundle (Test Case #1)
   * HCP proactively sends additional information to HIC
   * 
   * Per NPHIES standard (https://portal.nphies.sa/ig/Bundle-16b80922-b538-4ab3-0176-a80b33242163.html):
   * Bundle must include: MessageHeader, Communication, Provider Organization, Insurer Organization, Patient
   * 
   * @param {Object} options
   * @param {Object} options.priorAuth - Prior authorization data
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization data
   * @param {Object} options.insurer - Insurer organization data
   * @param {Array} options.payloads - Array of payload objects
   * @returns {Object} FHIR Bundle
   */
  buildUnsolicitedCommunicationBundle({ priorAuth, patient, provider, insurer, payloads }) {
    const bundleId = this.generateId();
    const communicationId = this.generateId();
    
    // Build the 'about' reference using proper identifier system URL format
    // Per NPHIES: use provider's domain for identifier system
    // NPHIES FIX (BV-00148): The 'about' identifier must be the pre_auth_ref (NPHIES-assigned reference)
    // NOT the internal request_number or nphies_request_id
    const providerDomain = (provider.provider_name || provider.name || 'provider').toLowerCase().replace(/\s+/g, '');
    const aboutIdentifier = priorAuth.pre_auth_ref || priorAuth.nphies_request_id || priorAuth.request_number;
    const aboutReference = {
      identifier: {
        system: `http://${providerDomain}.com.sa/identifiers/authorization`,
        value: aboutIdentifier
      }
    };
    
    // Build the Communication resource
    const communicationResource = this.buildCommunicationResource({
      id: communicationId,
      type: 'unsolicited',
      patient,
      provider,
      insurer,
      aboutReference: aboutReference,
      aboutType: 'Claim',
      payloads,
      basedOn: null // Unsolicited has no basedOn
    });

    const communicationEntry = {
      fullUrl: `http://provider.com/Communication/${communicationId}`,
      resource: communicationResource
    };

    // Build MessageHeader with correct event code ('communication' for sending Communication)
    const messageHeader = this.buildCommunicationMessageHeader({
      provider,
      insurer,
      focusFullUrl: communicationEntry.fullUrl
    });

    // Build full resources per NPHIES standard
    const providerResource = this.buildProviderOrganizationResource(provider);
    const insurerResource = this.buildInsurerOrganizationResource(insurer);
    const patientResource = this.buildPatientResource(patient);

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      // Entry order per NPHIES example: MessageHeader, Communication, Provider, Insurer, Patient
      entry: [
        messageHeader,
        communicationEntry,
        providerResource,
        insurerResource,
        patientResource
      ]
    };
  }

  /**
   * Build SOLICITED Communication bundle (Test Case #2)
   * HCP responds to CommunicationRequest from HIC
   * 
   * Per NPHIES standard (https://portal.nphies.sa/ig/Bundle-16b80922-b538-4ab3-0176-a80b33242163.html):
   * Bundle must include: MessageHeader, Communication, Provider Organization, Insurer Organization, Patient
   * 
   * @param {Object} options
   * @param {Object} options.communicationRequest - The CommunicationRequest being responded to
   * @param {Object} options.priorAuth - Prior authorization data
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization data
   * @param {Object} options.insurer - Insurer organization data
   * @param {Array} options.payloads - Array of payload objects (typically attachments)
   * @returns {Object} FHIR Bundle
   */
  buildSolicitedCommunicationBundle({ communicationRequest, priorAuth, patient, provider, insurer, payloads }) {
    const bundleId = this.generateId();
    const communicationId = this.generateId();
    
    // Build the 'about' reference using proper identifier system URL format
    // NPHIES FIX (BV-00148): The 'about' identifier must be the pre_auth_ref (NPHIES-assigned reference)
    const providerDomain = (provider.provider_name || provider.name || 'provider').toLowerCase().replace(/\s+/g, '');
    const aboutIdentifier = priorAuth.pre_auth_ref || priorAuth.nphies_request_id || priorAuth.request_number;
    
    // Use existing about_reference from CommunicationRequest if available, otherwise build new one
    const aboutReference = communicationRequest.about_reference ? 
      { identifier: { system: `http://${providerDomain}.com.sa/identifiers/authorization`, value: communicationRequest.about_reference } } :
      { identifier: { system: `http://${providerDomain}.com.sa/identifiers/authorization`, value: aboutIdentifier } };
    
    // Build the Communication resource with basedOn reference
    const communicationResource = this.buildCommunicationResource({
      id: communicationId,
      type: 'solicited',
      patient,
      provider,
      insurer,
      aboutReference: aboutReference,
      aboutType: communicationRequest.about_type || 'Claim',
      payloads,
      basedOn: `CommunicationRequest/${communicationRequest.request_id}`
    });

    const communicationEntry = {
      fullUrl: `http://provider.com/Communication/${communicationId}`,
      resource: communicationResource
    };

    // Build MessageHeader with correct event code ('communication' for sending Communication)
    const messageHeader = this.buildCommunicationMessageHeader({
      provider,
      insurer,
      focusFullUrl: communicationEntry.fullUrl
    });

    // Build full resources per NPHIES standard
    const providerResource = this.buildProviderOrganizationResource(provider);
    const insurerResource = this.buildInsurerOrganizationResource(insurer);
    const patientResource = this.buildPatientResource(patient);

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      // Entry order per NPHIES example: MessageHeader, Communication, Provider, Insurer, Patient
      entry: [
        messageHeader,
        communicationEntry,
        providerResource,
        insurerResource,
        patientResource
      ]
    };
  }

  // ============================================================================
  // RESOURCE BUILDERS
  // ============================================================================

  /**
   * Build Communication resource
   * 
   * Per NPHIES standard (https://portal.nphies.sa/ig/Bundle-16b80922-b538-4ab3-0176-a80b33242163.html):
   * - 'about' should use identifier with system URL format
   * - Subject references Patient in bundle
   * - Sender/Recipient reference Organizations in bundle
   * 
   * @param {Object} options
   * @param {string} options.id - Communication ID
   * @param {string} options.type - 'unsolicited' or 'solicited'
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization
   * @param {Object} options.insurer - Insurer organization
   * @param {Object|string} options.aboutReference - Reference to Claim/ClaimResponse (object with identifier or string)
   * @param {string} options.aboutType - 'Claim' or 'ClaimResponse'
   * @param {Array} options.payloads - Payload content
   * @param {string|null} options.basedOn - CommunicationRequest reference (for solicited)
   * @returns {Object} FHIR Communication resource
   */
  buildCommunicationResource({ id, type, patient, provider, insurer, aboutReference, aboutType, payloads, basedOn }) {
    const patientId = patient.patient_id?.toString() || patient.id;
    const providerId = provider.provider_id?.toString() || provider.id;
    const insurerId = insurer.insurer_id?.toString() || insurer.id;
    
    // Build 'about' reference - supports both object (with identifier) and string formats
    // Per NPHIES example: uses identifier with system URL format
    let aboutEntry;
    if (typeof aboutReference === 'object' && aboutReference.identifier) {
      // New format with identifier system URL (NPHIES compliant)
      aboutEntry = {
        type: aboutType,
        identifier: aboutReference.identifier
      };
    } else {
      // Legacy format with direct reference
      aboutEntry = {
        reference: aboutReference,
        type: aboutType
      };
    }
    
    // Build Communication identifier per NPHIES requirement (IC-00111)
    // The identifier system should use provider's domain
    const providerDomain = (provider.provider_name || provider.name || 'provider').toLowerCase().replace(/\s+/g, '');
    
    const communication = {
      resourceType: 'Communication',
      id,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/communication|1.0.0']
      },
      // NPHIES FIX (IC-00111): Communication identifier is required
      identifier: [{
        system: `http://${providerDomain}.com.sa/communication`,
        value: id
      }],
      // Status: 'completed' when sending (we're done composing)
      status: 'completed',
      // Category - Using HL7 standard codes: alert, notification, reminder, instruction
      // See: https://terminology.hl7.org/CodeSystem-communication-category.html
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: payloads?.[0]?.category || 'instruction'
        }]
      }],
      // Priority
      priority: payloads?.[0]?.priority || 'routine',
      // Subject (Patient) - references Patient resource in bundle
      subject: {
        reference: `Patient/${patientId}`,
        type: 'Patient'
      },
      // About (BV-00233: must reference Claim or ClaimResponse)
      // Per NPHIES example: uses identifier with system URL format
      about: [aboutEntry],
      // Sent timestamp
      sent: this.formatDateTime(new Date()),
      // Sender (HCP/Provider) - references Organization in bundle
      sender: {
        reference: `Organization/${providerId}`,
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: provider.nphies_id || 'PR-FHIR'
        }
      },
      // Recipient (HIC/Insurer) - references Organization in bundle
      // Per NPHIES example: recipient is the Organization (provider when HIC sends, insurer when HCP sends)
      recipient: [{
        reference: `Organization/${insurerId}`,
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/payer-license',
          value: insurer.nphies_id || 'INS-FHIR'
        }
      }],
      // Payload (content)
      payload: this.buildPayloads(payloads)
    };

    // Add basedOn for solicited communications (Test Case #2)
    if (basedOn) {
      communication.basedOn = [{
        reference: basedOn
      }];
    }

    return communication;
  }

  /**
   * Build payload array for Communication
   * Each payload can have:
   * - contentString (free text) - Test Case #1
   * - contentAttachment (file) - Test Case #2
   * - contentReference
   * Plus ClaimItemSequence extension
   * 
   * @param {Array} payloads - Array of payload objects
   * @returns {Array} FHIR payload array
   */
  buildPayloads(payloads) {
    if (!payloads || !Array.isArray(payloads)) {
      return [];
    }

    return payloads.map((payload, index) => {
      const fhirPayload = {};

      // Add ClaimItemSequence extension if item sequences are specified
      if (payload.claimItemSequences && payload.claimItemSequences.length > 0) {
        fhirPayload.extension = payload.claimItemSequences.map(seq => ({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-claimItemSequence',
          valuePositiveInt: seq
        }));
      }

      // Content type (CMRQ001: only ONE per payload)
      if (payload.contentType === 'string' && payload.contentString) {
        fhirPayload.contentString = payload.contentString;
      } else if (payload.contentType === 'attachment' && payload.attachment) {
        fhirPayload.contentAttachment = {
          contentType: payload.attachment.contentType || 'application/octet-stream',
          title: payload.attachment.title || `Attachment ${index + 1}`
        };
        
        // Either data (base64) or url
        if (payload.attachment.data) {
          fhirPayload.contentAttachment.data = payload.attachment.data;
        }
        if (payload.attachment.url) {
          fhirPayload.contentAttachment.url = payload.attachment.url;
        }
        if (payload.attachment.size) {
          fhirPayload.contentAttachment.size = payload.attachment.size;
        }
        if (payload.attachment.hash) {
          fhirPayload.contentAttachment.hash = payload.attachment.hash;
        }
      } else if (payload.contentType === 'reference' && payload.reference) {
        fhirPayload.contentReference = {
          reference: payload.reference.value,
          type: payload.reference.type
        };
      }

      return fhirPayload;
    }).filter(p => Object.keys(p).length > 0);
  }

  /**
   * Build MessageHeader for Communication transaction
   * 
   * Per NPHIES standard:
   * - Event code 'communication' is used when HCP SENDS a Communication (response/info)
   * - Event code 'communication-request' is used when HIC REQUESTS information from HCP
   * 
   * @param {Object} options
   * @param {Object} options.provider - Provider organization
   * @param {Object} options.insurer - Insurer organization
   * @param {string} options.focusFullUrl - Full URL of the Communication resource
   * @returns {Object} MessageHeader entry
   */
  buildCommunicationMessageHeader({ provider, insurer, focusFullUrl }) {
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
          // NPHIES FIX: Use 'communication' when HCP sends Communication (not 'communication-request')
          // 'communication-request' is for when HIC requests information FROM HCP
          code: 'communication'
        },
        destination: [{
          endpoint: `http://nphies.sa/license/payer-license/${destinationNphiesId}`,
          receiver: {
            type: 'Organization',
            identifier: {
              system: 'http://nphies.sa/license/payer-license',
              value: destinationNphiesId
            }
          }
        }],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: senderNphiesId
          }
        },
        source: {
          endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
        },
        focus: [{
          reference: focusFullUrl
        }]
      }
    };
  }

  // ============================================================================
  // POLL REQUEST BUILDERS
  // ============================================================================

  /**
   * Build Poll Request bundle for multiple message types
   * 
   * @param {string} providerId - Provider NPHIES ID
   * @param {Array} messageTypes - Array of message types to poll for
   *   - 'priorauth-response': Final ClaimResponse
   *   - 'communication-request': HIC asking for info
   *   - 'communication': Acknowledgment of sent Communication
   * @param {number} count - Max messages to retrieve (default 50)
   * @returns {Object} FHIR Bundle for poll request
   */
  buildPollRequestBundle(providerId, messageTypes = ['priorauth-response', 'communication-request', 'communication'], count = 50) {
    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const parametersId = this.generateId();

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'poll'
            },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com'
            },
            destination: [{
              endpoint: 'http://nphies.sa',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies-license',
                  value: 'nphies'
                }
              }
            }],
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            }
          }
        },
        {
          fullUrl: `urn:uuid:${parametersId}`,
          resource: {
            resourceType: 'Parameters',
            id: parametersId,
            parameter: [
              // Multiple message types
              ...messageTypes.map(type => ({
                name: 'message-type',
                valueCode: type
              })),
              {
                name: 'count',
                valueInteger: count
              }
            ]
          }
        }
      ]
    };
  }

  /**
   * Build Poll Request for specific prior authorization
   * Filters by the original request identifier
   * 
   * @param {string} providerId - Provider NPHIES ID
   * @param {string} requestIdentifier - Original request identifier
   * @param {Array} messageTypes - Message types to poll for
   * @returns {Object} FHIR Bundle
   */
  buildPriorAuthPollBundle(providerId, requestIdentifier, messageTypes = ['priorauth-response', 'communication-request', 'communication']) {
    const bundle = this.buildPollRequestBundle(providerId, messageTypes, 50);
    
    // Add request identifier filter
    const parameters = bundle.entry.find(e => e.resource?.resourceType === 'Parameters');
    if (parameters) {
      parameters.resource.parameter.push({
        name: 'request-identifier',
        valueIdentifier: {
          system: 'http://provider.com/prior-auth',
          value: requestIdentifier
        }
      });
    }

    return bundle;
  }

  // ============================================================================
  // RESPONSE PARSERS
  // ============================================================================

  /**
   * Parse poll response and extract different message types
   * 
   * @param {Object} responseBundle - FHIR Bundle from poll response
   * @returns {Object} Parsed messages by type
   */
  parsePollResponse(responseBundle) {
    const result = {
      claimResponses: [],
      communicationRequests: [],
      communications: [],
      errors: []
    };

    if (!responseBundle || responseBundle.resourceType !== 'Bundle') {
      result.errors.push('Invalid response bundle');
      return result;
    }

    // Handle different bundle types
    const entries = responseBundle.entry || [];
    
    for (const entry of entries) {
      const resource = entry.resource;
      if (!resource) continue;

      // Check for nested bundles (poll response may contain multiple message bundles)
      if (resource.resourceType === 'Bundle' && resource.type === 'message') {
        const nestedResult = this.parseMessageBundle(resource);
        result.claimResponses.push(...nestedResult.claimResponses);
        result.communicationRequests.push(...nestedResult.communicationRequests);
        result.communications.push(...nestedResult.communications);
      } else {
        // Direct resource
        this.categorizeResource(resource, result);
      }
    }

    return result;
  }

  /**
   * Parse a single message bundle
   * 
   * @param {Object} bundle - FHIR message Bundle
   * @returns {Object} Parsed resources
   */
  parseMessageBundle(bundle) {
    const result = {
      claimResponses: [],
      communicationRequests: [],
      communications: []
    };

    const entries = bundle.entry || [];
    for (const entry of entries) {
      this.categorizeResource(entry.resource, result);
    }

    return result;
  }

  /**
   * Categorize a resource by type
   * 
   * @param {Object} resource - FHIR resource
   * @param {Object} result - Result object to populate
   */
  categorizeResource(resource, result) {
    if (!resource) return;

    switch (resource.resourceType) {
      case 'ClaimResponse':
        result.claimResponses.push(resource);
        break;
      case 'CommunicationRequest':
        result.communicationRequests.push(this.parseCommunicationRequest(resource));
        break;
      case 'Communication':
        result.communications.push(this.parseCommunication(resource));
        break;
    }
  }

  /**
   * Parse CommunicationRequest resource
   * 
   * @param {Object} resource - FHIR CommunicationRequest
   * @returns {Object} Parsed data
   */
  parseCommunicationRequest(resource) {
    const parsed = {
      requestId: resource.id,
      status: resource.status,
      category: resource.category?.[0]?.coding?.[0]?.code,
      priority: resource.priority,
      authoredOn: resource.authoredOn,
      occurrenceDateTime: resource.occurrenceDateTime
    };

    // Parse about reference (BV-00233)
    if (resource.about && resource.about.length > 0) {
      const about = resource.about[0];
      parsed.aboutReference = about.reference;
      parsed.aboutType = about.type || this.extractTypeFromReference(about.reference);
    }

    // Parse sender
    if (resource.sender) {
      parsed.senderType = resource.sender.type;
      parsed.senderIdentifier = resource.sender.identifier?.value;
    }

    // Parse recipient
    if (resource.recipient && resource.recipient.length > 0) {
      parsed.recipientType = resource.recipient[0].type;
      parsed.recipientIdentifier = resource.recipient[0].identifier?.value;
    }

    // Parse payload
    if (resource.payload && resource.payload.length > 0) {
      const payload = resource.payload[0];
      if (payload.contentString) {
        parsed.payloadContentType = 'string';
        parsed.payloadContentString = payload.contentString;
      } else if (payload.contentAttachment) {
        parsed.payloadContentType = 'attachment';
        parsed.payloadAttachment = payload.contentAttachment;
      } else if (payload.contentReference) {
        parsed.payloadContentType = 'reference';
        parsed.payloadReference = payload.contentReference;
      }
    }

    return parsed;
  }

  /**
   * Parse Communication resource (acknowledgment)
   * 
   * @param {Object} resource - FHIR Communication
   * @returns {Object} Parsed data
   */
  parseCommunication(resource) {
    const parsed = {
      communicationId: resource.id,
      status: resource.status,
      category: resource.category?.[0]?.coding?.[0]?.code,
      sent: resource.sent,
      received: resource.received
    };

    // Check if this is an acknowledgment (inResponse to our communication)
    if (resource.inResponseTo && resource.inResponseTo.length > 0) {
      parsed.inResponseTo = resource.inResponseTo[0].reference;
      parsed.isAcknowledgment = true;
    }

    // Parse about reference
    if (resource.about && resource.about.length > 0) {
      parsed.aboutReference = resource.about[0].reference;
    }

    // Parse basedOn (for solicited)
    if (resource.basedOn && resource.basedOn.length > 0) {
      parsed.basedOn = resource.basedOn[0].reference;
    }

    return parsed;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format date to FHIR dateTime format
   * 
   * @param {Date} date - Date object
   * @returns {string} FHIR formatted dateTime
   */
  formatDateTime(date) {
    return date.toISOString();
  }

  /**
   * Extract resource type from reference string
   * 
   * @param {string} reference - FHIR reference (e.g., "Claim/123")
   * @returns {string} Resource type
   */
  extractTypeFromReference(reference) {
    if (!reference) return null;
    const parts = reference.split('/');
    return parts.length > 1 ? parts[parts.length - 2] : null;
  }

  /**
   * Extract resource ID from reference string
   * 
   * @param {string} reference - FHIR reference
   * @returns {string} Resource ID
   */
  extractIdFromReference(reference) {
    if (!reference) return null;
    const parts = reference.split('/');
    return parts[parts.length - 1];
  }
}

export default CommunicationMapper;

