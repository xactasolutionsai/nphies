/**
 * Message Correlator Service
 * 
 * Handles correlation of incoming NPHIES poll response messages to original
 * outbound requests stored in the database.
 * 
 * Two categories of messages:
 * 1. Solicited (MessageHeader.response.identifier IS present) - responses to our outbound requests
 * 2. Unsolicited (MessageHeader.response.identifier IS NOT present) - payer-initiated messages
 * 
 * Correlation strategies for solicited messages:
 *   Strategy 1: Match MessageHeader.response.identifier → outbound_message_header_id
 *   Strategy 2: Match ClaimResponse.request.identifier → nphies_request_id / request_number
 * 
 * For unsolicited messages:
 *   - Advanced Authorizations → create new record
 *   - CommunicationRequests → match via about reference
 *   - Communications → match via about reference
 */

import pool from '../db.js';
import advancedAuthParser from './advancedAuthParser.js';

class MessageCorrelator {

  /**
   * Determine if a message is solicited or unsolicited
   * @param {Object} messageHeader - The MessageHeader resource from the message bundle
   * @returns {'solicited'|'unsolicited'}
   */
  classifyMessage(messageHeader) {
    if (messageHeader?.response?.identifier) {
      return 'solicited';
    }
    return 'unsolicited';
  }

  /**
   * Extract MessageHeader from a message bundle
   * @param {Object} messageBundle - FHIR message Bundle
   * @returns {Object|null} The MessageHeader resource
   */
  extractMessageHeader(messageBundle) {
    if (!messageBundle?.entry) return null;
    return messageBundle.entry.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource || null;
  }

  /**
   * Extract the primary payload resource from a message bundle
   * @param {Object} messageBundle - FHIR message Bundle
   * @returns {Object|null} The primary resource (ClaimResponse, CommunicationRequest, Communication, etc.)
   */
  extractPayloadResource(messageBundle) {
    if (!messageBundle?.entry) return null;
    
    const payloadTypes = ['ClaimResponse', 'CommunicationRequest', 'Communication', 'Task'];
    for (const entry of messageBundle.entry) {
      if (entry.resource && payloadTypes.includes(entry.resource.resourceType)) {
        return entry.resource;
      }
    }
    return null;
  }

  /**
   * Correlate a solicited message to its original outbound request
   * 
   * @param {string} responseIdentifier - MessageHeader.response.identifier value
   * @param {Object} resource - The payload resource (ClaimResponse, etc.)
   * @param {string} schemaName - Database schema name
   * @returns {Object|null} { table, recordId, strategy } or null
   */
  async correlateToOutboundRequest(responseIdentifier, resource, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Strategy 1: Match via outbound_message_header_id
      if (responseIdentifier) {
        const match = await this.matchByMessageHeaderId(client, responseIdentifier);
        if (match) return match;
      }

      // Strategy 2: Match via ClaimResponse.request.identifier
      if (resource?.resourceType === 'ClaimResponse') {
        const match = await this.matchByClaimResponseIdentifier(client, resource);
        if (match) return match;
      }

      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Handle an unsolicited (payer-initiated) message
   * 
   * @param {Object} messageBundle - The full message bundle
   * @param {Object} resource - The payload resource
   * @param {string} schemaName - Database schema name
   * @returns {Object} { table, recordId, strategy, type: 'unsolicited' }
   */
  async handleNewInboundEvent(messageBundle, resource, schemaName) {
    if (!resource) {
      return { type: 'unsolicited', unmatched: true, reason: 'No payload resource found' };
    }

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      switch (resource.resourceType) {
        case 'ClaimResponse': {
          // Check if it's an Advanced Authorization (payer-initiated)
          if (advancedAuthParser.isAdvancedAuthorization(resource)) {
            return {
              type: 'unsolicited',
              table: 'advanced_authorizations',
              strategy: 'new_advanced_auth',
              resourceType: 'ClaimResponse',
              isNew: true
            };
          }
          
          // Try to match ClaimResponse to an existing request via identifier
          const match = await this.matchByClaimResponseIdentifier(client, resource);
          if (match) {
            return { ...match, type: 'unsolicited' };
          }
          
          return {
            type: 'unsolicited',
            unmatched: true,
            resourceType: 'ClaimResponse',
            reason: 'ClaimResponse does not match any existing request and is not an Advanced Authorization'
          };
        }

        case 'CommunicationRequest': {
          const match = await this.matchCommunicationRequestByAbout(client, resource);
          if (match) {
            return { ...match, type: 'unsolicited', strategy: 'communication_request_about' };
          }
          return {
            type: 'unsolicited',
            unmatched: true,
            resourceType: 'CommunicationRequest',
            reason: 'Could not match CommunicationRequest.about to any existing request'
          };
        }

        case 'Communication': {
          const match = await this.matchCommunicationByAbout(client, resource);
          if (match) {
            return { ...match, type: 'unsolicited', strategy: 'communication_about' };
          }
          return {
            type: 'unsolicited',
            unmatched: true,
            resourceType: 'Communication',
            reason: 'Could not match Communication.about to any existing request'
          };
        }

        default:
          return {
            type: 'unsolicited',
            unmatched: true,
            resourceType: resource.resourceType,
            reason: `Unhandled resource type: ${resource.resourceType}`
          };
      }
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // Private matching strategies
  // =========================================================================

  /**
   * Strategy 1: Match by outbound_message_header_id
   */
  async matchByMessageHeaderId(client, responseIdentifier) {
    // Check prior_authorizations
    const paResult = await client.query(
      `SELECT id FROM prior_authorizations WHERE outbound_message_header_id = $1 LIMIT 1`,
      [responseIdentifier]
    );
    if (paResult.rows.length > 0) {
      return {
        table: 'prior_authorizations',
        recordId: paResult.rows[0].id,
        strategy: 'message_header_id',
        type: 'solicited'
      };
    }

    // Check claim_submissions
    const csResult = await client.query(
      `SELECT id FROM claim_submissions WHERE outbound_message_header_id = $1 LIMIT 1`,
      [responseIdentifier]
    );
    if (csResult.rows.length > 0) {
      return {
        table: 'claim_submissions',
        recordId: csResult.rows[0].id,
        strategy: 'message_header_id',
        type: 'solicited'
      };
    }

    return null;
  }

  /**
   * Strategy 2: Match by ClaimResponse.request.identifier
   */
  async matchByClaimResponseIdentifier(client, claimResponse) {
    const requestIdentifier = claimResponse.request?.identifier?.value;
    if (!requestIdentifier) return null;

    // Check prior_authorizations by request_number or nphies_request_id
    const paResult = await client.query(
      `SELECT id FROM prior_authorizations 
       WHERE request_number = $1 OR nphies_request_id = $1 
       LIMIT 1`,
      [requestIdentifier]
    );
    if (paResult.rows.length > 0) {
      return {
        table: 'prior_authorizations',
        recordId: paResult.rows[0].id,
        strategy: 'claim_response_identifier',
        type: 'solicited'
      };
    }

    // Check claim_submissions by claim_number, nphies_claim_id, or nphies_request_id
    const csResult = await client.query(
      `SELECT id FROM claim_submissions 
       WHERE claim_number = $1 OR nphies_claim_id = $1 OR nphies_request_id = $1
       LIMIT 1`,
      [requestIdentifier]
    );
    if (csResult.rows.length > 0) {
      return {
        table: 'claim_submissions',
        recordId: csResult.rows[0].id,
        strategy: 'claim_response_identifier',
        type: 'solicited'
      };
    }

    return null;
  }

  /**
   * Match CommunicationRequest by its about reference
   * CommunicationRequest.about[] references the related Claim or ClaimResponse
   */
  async matchCommunicationRequestByAbout(client, commRequest) {
    const aboutRefs = commRequest.about || [];
    
    for (const aboutRef of aboutRefs) {
      // Try to match by identifier value
      const identifierValue = aboutRef.identifier?.value;
      if (identifierValue) {
        // Check prior_authorizations
        const paResult = await client.query(
          `SELECT id FROM prior_authorizations 
           WHERE request_number = $1 OR nphies_request_id = $1 
           LIMIT 1`,
          [identifierValue]
        );
        if (paResult.rows.length > 0) {
          return {
            table: 'prior_authorizations',
            recordId: paResult.rows[0].id
          };
        }

        // Check claim_submissions
        const csResult = await client.query(
          `SELECT id FROM claim_submissions 
           WHERE claim_number = $1 OR nphies_claim_id = $1 OR nphies_request_id = $1
           LIMIT 1`,
          [identifierValue]
        );
        if (csResult.rows.length > 0) {
          return {
            table: 'claim_submissions',
            recordId: csResult.rows[0].id
          };
        }

        // Check advanced_authorizations (payer-initiated, stored by identifier_value)
        const aaResult = await client.query(
          `SELECT id FROM advanced_authorizations 
           WHERE identifier_value = $1
           LIMIT 1`,
          [identifierValue]
        );
        if (aaResult.rows.length > 0) {
          return {
            table: 'advanced_authorizations',
            recordId: aaResult.rows[0].id
          };
        }
      }

      // Try to match by reference string (e.g., "Claim/123")
      const reference = aboutRef.reference;
      if (reference) {
        const refId = reference.split('/').pop();
        if (refId) {
          const paResult = await client.query(
            `SELECT id FROM prior_authorizations 
             WHERE request_number = $1 OR nphies_request_id = $1
             LIMIT 1`,
            [refId]
          );
          if (paResult.rows.length > 0) {
            return { table: 'prior_authorizations', recordId: paResult.rows[0].id };
          }

          const csResult = await client.query(
            `SELECT id FROM claim_submissions 
             WHERE claim_number = $1 OR nphies_claim_id = $1 OR nphies_request_id = $1
             LIMIT 1`,
            [refId]
          );
          if (csResult.rows.length > 0) {
            return { table: 'claim_submissions', recordId: csResult.rows[0].id };
          }

          // Check advanced_authorizations
          const aaResult = await client.query(
            `SELECT id FROM advanced_authorizations 
             WHERE identifier_value = $1
             LIMIT 1`,
            [refId]
          );
          if (aaResult.rows.length > 0) {
            return { table: 'advanced_authorizations', recordId: aaResult.rows[0].id };
          }
        }
      }
    }

    return null;
  }

  /**
   * Match Communication by its about reference
   */
  async matchCommunicationByAbout(client, communication) {
    // Communications can reference CommunicationRequests or Claims
    const aboutRefs = communication.about || [];
    
    for (const aboutRef of aboutRefs) {
      const identifierValue = aboutRef.identifier?.value;
      if (identifierValue) {
        // Check if it references a stored CommunicationRequest
        const crResult = await client.query(
          `SELECT id, prior_auth_id, claim_id, advanced_authorization_id FROM nphies_communication_requests 
           WHERE request_id = $1 OR cr_identifier = $1
           LIMIT 1`,
          [identifierValue]
        );
        if (crResult.rows.length > 0) {
          const cr = crResult.rows[0];
          return {
            table: 'nphies_communications',
            relatedCommunicationRequestId: cr.id,
            relatedPriorAuthId: cr.prior_auth_id,
            relatedClaimId: cr.claim_id,
            relatedAdvancedAuthId: cr.advanced_authorization_id
          };
        }

        // Check prior_authorizations
        const paResult = await client.query(
          `SELECT id FROM prior_authorizations WHERE request_number = $1 OR nphies_request_id = $1 LIMIT 1`,
          [identifierValue]
        );
        if (paResult.rows.length > 0) {
          return { table: 'prior_authorizations', recordId: paResult.rows[0].id };
        }

        // Check claim_submissions
        const csResult = await client.query(
          `SELECT id FROM claim_submissions WHERE claim_number = $1 OR nphies_claim_id = $1 OR nphies_request_id = $1 LIMIT 1`,
          [identifierValue]
        );
        if (csResult.rows.length > 0) {
          return { table: 'claim_submissions', recordId: csResult.rows[0].id };
        }

        // Check advanced_authorizations
        const aaResult = await client.query(
          `SELECT id FROM advanced_authorizations WHERE identifier_value = $1 LIMIT 1`,
          [identifierValue]
        );
        if (aaResult.rows.length > 0) {
          return { table: 'advanced_authorizations', recordId: aaResult.rows[0].id };
        }
      }
    }

    return null;
  }
}

export default new MessageCorrelator();
