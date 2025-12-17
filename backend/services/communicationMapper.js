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
   * Build Coverage resource for Communication bundle
   * Per NPHIES standard: https://portal.nphies.sa/ig/StructureDefinition-coverage.html
   */
  buildCoverageResource(coverage, patient, insurer) {
    const coverageId = coverage?.coverage_id?.toString() || coverage?.id?.toString() || this.generateId();
    const patientId = patient.patient_id?.toString() || patient.id;
    const insurerId = insurer.insurer_id?.toString() || insurer.id;

    const coverageResource = {
      resourceType: 'Coverage',
      id: coverageId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0']
      },
      identifier: [
        {
          system: 'http://payer.com/memberid',
          value: coverage?.member_id || patient.identifier || `MEM-${Date.now()}`
        }
      ],
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
            code: coverage?.coverage_type || coverage?.type || 'EHCPOL',
            display: this.getCoverageTypeDisplay(coverage?.coverage_type || coverage?.type || 'EHCPOL')
          }
        ]
      },
      policyHolder: {
        reference: `Patient/${patientId}`
      },
      subscriber: {
        reference: `Patient/${patientId}`
      },
      beneficiary: {
        reference: `Patient/${patientId}`
      },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: coverage?.relationship || 'self',
            display: this.getRelationshipDisplay(coverage?.relationship || 'self')
          }
        ]
      },
      payor: [
        {
          reference: `Organization/${insurerId}`
        }
      ],
      class: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                code: 'plan'
              }
            ]
          },
          value: coverage?.plan_id || coverage?.class_value || 'default-plan',
          name: coverage?.plan_name || coverage?.class_name || 'Insurance Plan'
        }
      ]
    };

    // Add period if available
    if (coverage?.period_start || coverage?.start_date) {
      coverageResource.period = {
        start: this.formatDate(coverage.period_start || coverage.start_date)
      };
      if (coverage?.period_end || coverage?.end_date) {
        coverageResource.period.end = this.formatDate(coverage.period_end || coverage.end_date);
      }
    }

    // Add network class if available
    if (coverage?.network) {
      coverageResource.class.push({
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              code: 'network'
            }
          ]
        },
        value: coverage.network,
        name: coverage.network_name || 'Network'
      });
    }

    return {
      fullUrl: `http://provider.com/Coverage/${coverageId}`,
      resource: coverageResource
    };
  }

  /**
   * Get coverage type display name
   */
  getCoverageTypeDisplay(code) {
    const displays = {
      'EHCPOL': 'Extended Healthcare',
      'PUBLICPOL': 'Public Healthcare',
      'DENTAL': 'Dental',
      'VISION': 'Vision',
      'MENTPRG': 'Mental Health Program'
    };
    return displays[code] || 'Healthcare Coverage';
  }

  /**
   * Get relationship display name
   */
  getRelationshipDisplay(code) {
    const displays = {
      'self': 'Self',
      'spouse': 'Spouse',
      'child': 'Child',
      'parent': 'Parent',
      'other': 'Other'
    };
    return displays[code] || 'Self';
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
   * Get the authorization reference for the 'about' element
   * 
   * IMPORTANT: The 'about' identifier value MUST match the original Claim.identifier.value
   * that was sent in the Prior Authorization request. This is the provider-assigned
   * request_number, NOT the NPHIES-assigned pre_auth_ref from the response.
   * 
   * Priority order:
   * 1. request_number (provider-assigned ID used in original Claim) - REQUIRED
   * 2. nphies_request_id (fallback)
   * 3. pre_auth_ref (last resort, though may not match original Claim)
   * 
   * @param {Object} priorAuth - Prior authorization data
   * @returns {string} Authorization reference matching original Claim identifier
   */
  getNphiesAuthReference(priorAuth) {
    // request_number is the provider-assigned identifier used in the original Claim
    // This MUST match the Claim.identifier.value sent in the prior auth request
    if (priorAuth.request_number) {
      return priorAuth.request_number;
    }
    
    // Fallback to nphies_request_id if no request_number
    if (priorAuth.nphies_request_id) {
      return priorAuth.nphies_request_id;
    }
    
    // Last resort: use pre_auth_ref (though this may not match original Claim)
    return priorAuth.pre_auth_ref || `req_${Date.now()}`;
  }

  /**
   * Build Location resource for Communication bundle (optional)
   * Per NPHIES standard: https://portal.nphies.sa/ig/StructureDefinition-location.html
   * 
   * @param {Object} location - Location data
   * @param {Object} provider - Provider organization data
   * @returns {Object} FHIR Location entry or null if no location data
   */
  buildLocationResource(location, provider) {
    if (!location) return null;

    const locationId = location.location_id?.toString() || location.id?.toString() || this.generateId();
    const providerId = provider.provider_id?.toString() || provider.id;

    const locationResource = {
      resourceType: 'Location',
      id: locationId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/location|1.0.0']
      },
      identifier: [
        {
          system: 'http://nphies.sa/identifier/location',
          value: location.identifier || locationId
        }
      ],
      status: location.status || 'active',
      name: location.name || provider.provider_name || 'Healthcare Facility',
      mode: 'instance',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: location.type_code || 'HOSP',
              display: location.type_display || 'Hospital'
            }
          ]
        }
      ],
      managingOrganization: {
        reference: `Organization/${providerId}`
      }
    };

    // Add address if available
    if (location.address || provider.address) {
      const addr = location.address || provider.address;
      locationResource.address = {
        use: 'work',
        type: 'physical',
        line: Array.isArray(addr.line) ? addr.line : (addr.line ? [addr.line] : [addr.text || addr]),
        city: addr.city || '',
        state: addr.state || '',
        postalCode: addr.postalCode || addr.postal_code || '',
        country: addr.country || 'Saudi Arabia'
      };
    }

    // Add telecom if available
    if (location.phone || location.telecom) {
      locationResource.telecom = [];
      if (location.phone) {
        locationResource.telecom.push({
          system: 'phone',
          value: location.phone,
          use: 'work'
        });
      }
      if (location.email) {
        locationResource.telecom.push({
          system: 'email',
          value: location.email,
          use: 'work'
        });
      }
    }

    // Add position (coordinates) if available
    if (location.latitude && location.longitude) {
      locationResource.position = {
        longitude: parseFloat(location.longitude),
        latitude: parseFloat(location.latitude)
      };
    }

    return {
      fullUrl: `http://provider.com/Location/${locationId}`,
      resource: locationResource
    };
  }

  // ============================================================================
  // MAIN BUNDLE BUILDERS
  // ============================================================================

  /**
   * Build UNSOLICITED Communication bundle (Test Case #1)
   * HCP proactively sends additional information to HIC
   * 
   * Per NPHIES standard (https://portal.nphies.sa/ig/usecase-information-submission.html):
   * Bundle must include: MessageHeader, Communication, Patient, Provider Organization, Insurer Organization
   * Optional: Coverage, Location, any additional resources
   * 
   * @param {Object} options
   * @param {Object} options.priorAuth - Prior authorization data
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization data
   * @param {Object} options.insurer - Insurer organization data
   * @param {Object} options.coverage - Coverage data (optional but recommended)
   * @param {Object} options.location - Location data (optional)
   * @param {Array} options.payloads - Array of payload objects
   * @returns {Object} FHIR Bundle
   */
  buildUnsolicitedCommunicationBundle({ priorAuth, patient, provider, insurer, coverage, location, payloads }) {
    const bundleId = this.generateId();
    const communicationId = this.generateId();
    
    // Build the 'about' reference using proper identifier system URL format
    // NPHIES FIX (BV-00148): The 'about' identifier MUST be the pre_auth_ref (NPHIES-assigned UUID)
    // Example: 98118790-5053-4cef-b479-ae744986fbd5
    const providerDomain = (provider.provider_name || provider.name || 'provider').toLowerCase().replace(/\s+/g, '');
    const aboutIdentifier = this.getNphiesAuthReference(priorAuth);
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
    const patientResource = this.buildPatientResource(patient);
    const providerResource = this.buildProviderOrganizationResource(provider);
    const insurerResource = this.buildInsurerOrganizationResource(insurer);
    
    // Build Coverage resource if coverage data is provided
    const coverageResource = coverage ? this.buildCoverageResource(coverage, patient, insurer) : null;
    
    // Build Location resource if location data is provided (optional per NPHIES spec)
    const locationResource = location ? this.buildLocationResource(location, provider) : null;

    // Entry order per NPHIES example: MessageHeader, Communication, Provider, Insurer, Patient
    // Optional resources (Coverage, Location) come after main resources
    const entries = [
      messageHeader,
      communicationEntry,
      providerResource,
      insurerResource,
      patientResource
    ];
    
    // Add Coverage if available (per NPHIES bundle example)
    if (coverageResource) {
      entries.push(coverageResource);
    }
    
    // Add Location if available (optional per NPHIES spec)
    if (locationResource) {
      entries.push(locationResource);
    }

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };
  }

  /**
   * Build SOLICITED Communication bundle (Test Case #2)
   * HCP responds to CommunicationRequest from HIC
   * 
   * Per NPHIES standard (https://portal.nphies.sa/ig/usecase-information-submission.html):
   * Bundle must include: MessageHeader, Communication, Patient, Provider Organization, Insurer Organization
   * Optional: Coverage, Location, any additional resources
   * 
   * @param {Object} options
   * @param {Object} options.communicationRequest - The CommunicationRequest being responded to
   * @param {Object} options.priorAuth - Prior authorization data
   * @param {Object} options.patient - Patient data
   * @param {Object} options.provider - Provider organization data
   * @param {Object} options.insurer - Insurer organization data
   * @param {Object} options.coverage - Coverage data (optional but recommended)
   * @param {Object} options.location - Location data (optional)
   * @param {Array} options.payloads - Array of payload objects (typically attachments)
   * @returns {Object} FHIR Bundle
   */
  buildSolicitedCommunicationBundle({ communicationRequest, priorAuth, patient, provider, insurer, coverage, location, payloads }) {
    const bundleId = this.generateId();
    const communicationId = this.generateId();
    
    // Build the 'about' reference using proper identifier system URL format
    // NPHIES FIX (BV-00148): The 'about' identifier MUST be the pre_auth_ref (NPHIES-assigned UUID)
    // Example: 98118790-5053-4cef-b479-ae744986fbd5
    const providerDomain = (provider.provider_name || provider.name || 'provider').toLowerCase().replace(/\s+/g, '');
    const aboutIdentifier = this.getNphiesAuthReference(priorAuth);
    
    // Use existing about_reference from CommunicationRequest if available, otherwise build new one
    const aboutReference = communicationRequest.about_reference ? 
      { identifier: { system: `http://${providerDomain}.com.sa/identifiers/authorization`, value: communicationRequest.about_reference } } :
      { identifier: { system: `http://${providerDomain}.com.sa/identifiers/authorization`, value: aboutIdentifier } };
    
    // Build basedOn identifier per NPHIES example format
    // Per NPHIES: { identifier: { system: "http://sni.com.sa/identifiers/communicationrequest", value: "CommReq_12361231" } }
    const insurerDomain = (insurer.insurer_name || insurer.name || 'insurer').toLowerCase().replace(/\s+/g, '');
    const basedOnIdentifier = {
      system: `http://${insurerDomain}.com.sa/identifiers/communicationrequest`,
      value: communicationRequest.request_id || `CommReq_${communicationId}`
    };

    // Build the Communication resource with basedOn identifier
    const communicationResource = this.buildCommunicationResource({
      id: communicationId,
      type: 'solicited',
      patient,
      provider,
      insurer,
      aboutReference: aboutReference,
      aboutType: communicationRequest.about_type || 'Claim',
      payloads,
      basedOn: { identifier: basedOnIdentifier }
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
    const patientResource = this.buildPatientResource(patient);
    const providerResource = this.buildProviderOrganizationResource(provider);
    const insurerResource = this.buildInsurerOrganizationResource(insurer);
    
    // Build Coverage resource if coverage data is provided
    const coverageResource = coverage ? this.buildCoverageResource(coverage, patient, insurer) : null;
    
    // Build Location resource if location data is provided (optional per NPHIES spec)
    const locationResource = location ? this.buildLocationResource(location, provider) : null;

    // Entry order per NPHIES example: MessageHeader, Communication, Provider, Insurer, Patient
    // Optional resources (Coverage, Location) come after main resources
    const entries = [
      messageHeader,
      communicationEntry,
      providerResource,
      insurerResource,
      patientResource
    ];
    
    // Add Coverage if available (per NPHIES bundle example)
    if (coverageResource) {
      entries.push(coverageResource);
    }
    
    // Add Location if available (optional per NPHIES spec)
    if (locationResource) {
      entries.push(locationResource);
    }

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
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
      // NPHIES FIX (IC-00111): Communication identifier is required per NPHIES spec
      // Per NPHIES example: http://saudigeneralhospital.com.sa/identifiers/communication
      identifier: [{
        system: `http://${providerDomain}.com.sa/identifiers/communication`,
        value: `Communication_${id.replace(/-/g, '')}`
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
    // Per NPHIES example: uses identifier format instead of reference
    // Example: { identifier: { system: "http://sni.com.sa/identifiers/communicationrequest", value: "CommReq_12361231" } }
    if (basedOn) {
      // basedOn can be either a string (legacy) or an object with identifier info
      if (typeof basedOn === 'object' && basedOn.identifier) {
        communication.basedOn = [{
          identifier: basedOn.identifier
        }];
      } else if (typeof basedOn === 'object' && basedOn.system && basedOn.value) {
        communication.basedOn = [{
          identifier: {
            system: basedOn.system,
            value: basedOn.value
          }
        }];
      } else {
        // Legacy string format - convert to identifier format
        const insurerDomain = (insurer.insurer_name || insurer.name || 'insurer').toLowerCase().replace(/\s+/g, '');
        communication.basedOn = [{
          identifier: {
            system: `http://${insurerDomain}.com.sa/identifiers/communicationrequest`,
            value: typeof basedOn === 'string' ? basedOn.replace('CommunicationRequest/', '') : String(basedOn)
          }
        }];
      }
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
  /**
   * Build Poll Request Bundle for NPHIES
   * 
   * Based on official NPHIES IG example:
   * https://portal.nphies.sa/ig/Bundle-a84aabfa-1163-407d-aa38-f8119a0b7aa1.json.html
   * 
   * NPHIES Poll uses a FHIR Message Bundle with:
   * - MessageHeader with eventCoding: 'poll-request'
   * - Task resource with profile 'poll-request' and code 'poll'
   * - Organization resources for requester (Provider) and owner (NPHIES)
   * 
   * The MessageHeader.focus points to the Task resource.
   * 
   * @param {string} providerId - Provider license ID
   * @param {string} providerName - Provider organization name (optional)
   * @returns {Object} FHIR Bundle for poll request
   */
  buildPollRequestBundle(providerId, providerName = 'Healthcare Provider') {
    const bundleId = this.generateId();
    const messageHeaderId = this.generateId();
    const taskId = this.generateId();
    const providerOrgId = this.generateId();
    const timestamp = this.formatDateTime(new Date());
    const providerEndpoint = process.env.NPHIES_PROVIDER_ENDPOINT || 'http://provider.com/fhir';

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: timestamp,
      entry: [
        // 1. MessageHeader
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
              code: 'poll-request'
            },
            destination: [{
              endpoint: 'https://nphies.sa/fhir/$process-message',
              receiver: {
                type: 'Organization',
                identifier: {
                  system: 'http://nphies.sa/license/nphies',
                  value: 'NPHIES'
                }
              }
            }],
            sender: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/provider-license',
                value: providerId
              }
            },
            source: {
              endpoint: providerEndpoint
            },
            focus: [{
              reference: `${providerEndpoint}/Task/${taskId}`
            }]
          }
        },
        // 2. Task (poll-request)
        {
          fullUrl: `${providerEndpoint}/Task/${taskId}`,
          resource: {
            resourceType: 'Task',
            id: taskId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/poll-request|1.0.0']
            },
            identifier: [{
              system: `${providerEndpoint}/identifiers/poll-request`,
              value: `poll_${Date.now()}`
            }],
            status: 'requested',
            intent: 'order',
            priority: 'routine',
            code: {
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/task-code',
                code: 'poll'
              }]
            },
            authoredOn: timestamp,
            lastModified: timestamp,
            requester: {
              reference: `Organization/${providerOrgId}`
            },
            owner: {
              reference: 'Organization/NPHIES'
            }
          }
        },
        // 3. Provider Organization
        {
          fullUrl: `${providerEndpoint}/Organization/${providerOrgId}`,
          resource: {
            resourceType: 'Organization',
            id: providerOrgId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0']
            },
            identifier: [{
              system: 'http://nphies.sa/license/provider-license',
              value: providerId
            }],
            active: true,
            type: [{
              coding: [{
                system: 'http://nphies.sa/terminology/CodeSystem/organization-type',
                code: 'prov'
              }]
            }],
            name: providerName
          }
        },
        // 4. NPHIES Organization
        {
          fullUrl: `${providerEndpoint}/Organization/NPHIES`,
          resource: {
            resourceType: 'Organization',
            id: 'NPHIES',
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/organization|1.0.0']
            },
            identifier: [{
              use: 'official',
              system: 'http://nphies.sa/license/nphies',
              value: 'NPHIES'
            }],
            active: true,
            name: 'National Program for Health Information Exchange Services'
          }
        }
      ]
    };
  }

  /**
   * Build Poll Parameters (simple format for reference)
   * Note: NPHIES requires full Bundle with MessageHeader, use buildPollRequestBundle instead
   */
  buildPollParameters(messageTypes = ['communication'], count = 10, identifier = null) {
    const parameters = {
      resourceType: 'Parameters',
      parameter: []
    };

    for (const messageType of messageTypes) {
      parameters.parameter.push({
        name: 'message-type',
        valueCode: messageType
      });
    }

    parameters.parameter.push({
      name: 'count',
      valueInteger: count
    });

    if (identifier) {
      parameters.parameter.push({
        name: 'identifier',
        valueString: identifier
      });
    }

    return parameters;
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
   * Per NPHIES example (https://portal.nphies.sa/ig/Bundle-16b80922-b538-4ab3-0176-a80b33242163.json.html):
   * Extracts identifier, subject, and all standard CommunicationRequest fields
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

    // Parse identifier (per NPHIES spec - contains request identifier system/value)
    if (resource.identifier && resource.identifier.length > 0) {
      const identifier = resource.identifier[0];
      parsed.identifier = identifier.value;
      parsed.identifierSystem = identifier.system;
      parsed.identifierUse = identifier.use;
    }

    // Parse subject reference (Patient reference)
    if (resource.subject) {
      parsed.subjectReference = resource.subject.reference;
      parsed.subjectType = resource.subject.type || 'Patient';
    }

    // Parse about reference (BV-00233)
    // Supports both direct reference and identifier-based reference formats
    if (resource.about && resource.about.length > 0) {
      const about = resource.about[0];
      parsed.aboutReference = about.reference;
      parsed.aboutType = about.type || this.extractTypeFromReference(about.reference);
      
      // Also extract identifier if present (NPHIES uses identifier format)
      if (about.identifier) {
        parsed.aboutIdentifier = about.identifier.value;
        parsed.aboutIdentifierSystem = about.identifier.system;
      }
    }

    // Parse sender
    if (resource.sender) {
      parsed.senderType = resource.sender.type;
      parsed.senderIdentifier = resource.sender.identifier?.value;
      parsed.senderIdentifierSystem = resource.sender.identifier?.system;
    }

    // Parse recipient
    if (resource.recipient && resource.recipient.length > 0) {
      parsed.recipientType = resource.recipient[0].type;
      parsed.recipientIdentifier = resource.recipient[0].identifier?.value;
      parsed.recipientIdentifierSystem = resource.recipient[0].identifier?.system;
    }

    // Parse payload (may have multiple payloads)
    parsed.payloads = [];
    if (resource.payload && resource.payload.length > 0) {
      for (const payload of resource.payload) {
        const parsedPayload = {};
        
        // Extract ClaimItemSequence extension if present
        if (payload.extension) {
          const itemSequences = payload.extension
            .filter(ext => ext.url?.includes('claimItemSequence'))
            .map(ext => ext.valuePositiveInt);
          if (itemSequences.length > 0) {
            parsedPayload.claimItemSequences = itemSequences;
          }
        }
        
        if (payload.contentString) {
          parsedPayload.contentType = 'string';
          parsedPayload.contentString = payload.contentString;
        } else if (payload.contentAttachment) {
          parsedPayload.contentType = 'attachment';
          parsedPayload.attachment = payload.contentAttachment;
        } else if (payload.contentReference) {
          parsedPayload.contentType = 'reference';
          parsedPayload.reference = payload.contentReference;
        }
        
        parsed.payloads.push(parsedPayload);
      }
      
      // For backwards compatibility, also set the first payload fields
      const firstPayload = resource.payload[0];
      if (firstPayload.contentString) {
        parsed.payloadContentType = 'string';
        parsed.payloadContentString = firstPayload.contentString;
      } else if (firstPayload.contentAttachment) {
        parsed.payloadContentType = 'attachment';
        parsed.payloadAttachment = firstPayload.contentAttachment;
      } else if (firstPayload.contentReference) {
        parsed.payloadContentType = 'reference';
        parsed.payloadReference = firstPayload.contentReference;
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

