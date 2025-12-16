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
 */

import { randomUUID } from 'crypto';

class CommunicationMapper {
  constructor() {
    this.generateId = () => randomUUID();
  }

  // ============================================================================
  // MAIN BUNDLE BUILDERS
  // ============================================================================

  /**
   * Build UNSOLICITED Communication bundle (Test Case #1)
   * HCP proactively sends additional information to HIC
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
    
    // Build the Communication resource
    const communicationResource = this.buildCommunicationResource({
      id: communicationId,
      type: 'unsolicited',
      patient,
      provider,
      insurer,
      aboutReference: `http://provider.com/Claim/${priorAuth.nphies_request_id || priorAuth.request_number}`,
      aboutType: 'Claim',
      payloads,
      basedOn: null // Unsolicited has no basedOn
    });

    const communicationEntry = {
      fullUrl: `http://provider.com/Communication/${communicationId}`,
      resource: communicationResource
    };

    // Build MessageHeader
    const messageHeader = this.buildCommunicationMessageHeader({
      provider,
      insurer,
      focusFullUrl: communicationEntry.fullUrl
    });

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [messageHeader, communicationEntry]
    };
  }

  /**
   * Build SOLICITED Communication bundle (Test Case #2)
   * HCP responds to CommunicationRequest from HIC
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
    
    // Build the Communication resource with basedOn reference
    const communicationResource = this.buildCommunicationResource({
      id: communicationId,
      type: 'solicited',
      patient,
      provider,
      insurer,
      aboutReference: communicationRequest.about_reference || 
        `http://provider.com/Claim/${priorAuth.nphies_request_id || priorAuth.request_number}`,
      aboutType: communicationRequest.about_type || 'Claim',
      payloads,
      basedOn: `CommunicationRequest/${communicationRequest.request_id}`
    });

    const communicationEntry = {
      fullUrl: `http://provider.com/Communication/${communicationId}`,
      resource: communicationResource
    };

    // Build MessageHeader
    const messageHeader = this.buildCommunicationMessageHeader({
      provider,
      insurer,
      focusFullUrl: communicationEntry.fullUrl
    });

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [messageHeader, communicationEntry]
    };
  }

  // ============================================================================
  // RESOURCE BUILDERS
  // ============================================================================

  /**
   * Build Communication resource
   * 
   * @param {Object} options
   * @param {string} options.id - Communication ID
   * @param {string} options.type - 'unsolicited' or 'solicited'
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization
   * @param {Object} options.insurer - Insurer organization
   * @param {string} options.aboutReference - Reference to Claim/ClaimResponse
   * @param {string} options.aboutType - 'Claim' or 'ClaimResponse'
   * @param {Array} options.payloads - Payload content
   * @param {string|null} options.basedOn - CommunicationRequest reference (for solicited)
   * @returns {Object} FHIR Communication resource
   */
  buildCommunicationResource({ id, type, patient, provider, insurer, aboutReference, aboutType, payloads, basedOn }) {
    const communication = {
      resourceType: 'Communication',
      id,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/communication|1.0.0']
      },
      // Status: 'completed' when sending (we're done composing)
      status: 'completed',
      // Category
      category: [{
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/communication-category',
          code: 'alert'
        }]
      }],
      // Priority
      priority: 'routine',
      // Subject (Patient)
      subject: {
        reference: `Patient/${patient.patient_id}`,
        type: 'Patient'
      },
      // About (BV-00233: must reference Claim or ClaimResponse)
      about: [{
        reference: aboutReference,
        type: aboutType
      }],
      // Sent timestamp
      sent: this.formatDateTime(new Date()),
      // Sender (HCP/Provider)
      sender: {
        reference: `Organization/${provider.provider_id || provider.nphies_id}`,
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: provider.nphies_id || 'PR-FHIR'
        }
      },
      // Recipient (HIC/Insurer)
      recipient: [{
        reference: `Organization/${insurer.insurer_id || insurer.nphies_id}`,
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
          code: 'communication-request' // Event code for sending Communication
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

