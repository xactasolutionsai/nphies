/**
 * NPHIES Communication Service
 * 
 * Business logic for handling NPHIES Communications.
 * Supports both:
 * - Test Case #1: Unsolicited Communication (HCP proactively sends info)
 * - Test Case #2: Solicited Communication (HCP responds to CommunicationRequest)
 */

import { randomUUID } from 'crypto';
import pool from '../db.js';
import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';

class CommunicationService {
  constructor() {
    this.mapper = new CommunicationMapper();
  }

  // ============================================================================
  // SEND COMMUNICATIONS
  // ============================================================================

  /**
   * Preview Communication bundle without sending
   * Returns the exact FHIR bundle that would be sent to NPHIES
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} type - 'unsolicited' or 'solicited'
   * @param {number} communicationRequestId - For solicited, the request being responded to
   * @param {string} schemaName - Database schema name
   * @returns {Object} Preview data with bundle
   */
  async previewCommunicationBundle(priorAuthId, payloads, type = 'unsolicited', communicationRequestId = null, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Get Prior Authorization with related data
      // NPHIES Communication requires full patient/provider/insurer/coverage data
      const paResult = await client.query(`
        SELECT 
          pa.*,
          p.patient_id, 
          p.name as patient_name, 
          p.identifier as patient_identifier,
          p.identifier_type as patient_identifier_type,
          p.gender as patient_gender,
          p.birth_date as patient_birth_date,
          p.phone as patient_phone,
          p.address as patient_address,
          pr.provider_id, 
          pr.provider_name as provider_name, 
          pr.nphies_id as provider_nphies_id,
          pr.provider_type as provider_type,
          pr.address as provider_address,
          i.insurer_id, 
          i.insurer_name as insurer_name, 
          i.nphies_id as insurer_nphies_id,
          i.address as insurer_address
        FROM prior_authorizations pa
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        WHERE pa.id = $1
      `, [priorAuthId]);

      if (paResult.rows.length === 0) {
        throw new Error('Prior Authorization not found');
      }

      const priorAuth = paResult.rows[0];

      // Coverage data is not joined due to type mismatch (integer vs uuid)
      // Coverage is optional for Communication bundles
      const coverageData = null;

      // Build the bundle based on type
      let communicationBundle;
      
      if (type === 'unsolicited') {
        communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
          priorAuth: {
            nphies_request_id: priorAuth.nphies_request_id,
            request_number: priorAuth.request_number,
            pre_auth_ref: priorAuth.pre_auth_ref
          },
          patient: {
            patient_id: priorAuth.patient_id,
            identifier: priorAuth.patient_identifier,
            identifier_type: priorAuth.patient_identifier_type || 'national_id',
            name: priorAuth.patient_name,
            gender: priorAuth.patient_gender,
            birth_date: priorAuth.patient_birth_date,
            phone: priorAuth.patient_phone,
            address: priorAuth.patient_address
          },
          provider: {
            provider_id: priorAuth.provider_id,
            provider_name: priorAuth.provider_name,
            nphies_id: priorAuth.provider_nphies_id,
            provider_type: priorAuth.provider_type,
            address: priorAuth.provider_address
          },
          insurer: {
            insurer_id: priorAuth.insurer_id,
            insurer_name: priorAuth.insurer_name,
            nphies_id: priorAuth.insurer_nphies_id,
            address: priorAuth.insurer_address
          },
          coverage: coverageData,
          payloads
        });
      } else if (type === 'solicited' && communicationRequestId) {
        // Get the CommunicationRequest
        const crResult = await client.query(
          'SELECT * FROM nphies_communication_requests WHERE id = $1',
          [communicationRequestId]
        );
        
        if (crResult.rows.length === 0) {
          throw new Error('CommunicationRequest not found');
        }
        
        const commRequest = crResult.rows[0];
        
        communicationBundle = this.mapper.buildSolicitedCommunicationBundle({
          communicationRequest: {
            request_id: commRequest.request_id,
            about_reference: commRequest.about_reference,
            about_type: commRequest.about_type
          },
          priorAuth: {
            nphies_request_id: priorAuth.nphies_request_id,
            request_number: priorAuth.request_number,
            pre_auth_ref: priorAuth.pre_auth_ref
          },
          patient: {
            patient_id: priorAuth.patient_id,
            identifier: priorAuth.patient_identifier,
            identifier_type: priorAuth.patient_identifier_type || 'national_id',
            name: priorAuth.patient_name,
            gender: priorAuth.patient_gender,
            birth_date: priorAuth.patient_birth_date,
            phone: priorAuth.patient_phone,
            address: priorAuth.patient_address
          },
          provider: {
            provider_id: priorAuth.provider_id,
            provider_name: priorAuth.provider_name,
            nphies_id: priorAuth.provider_nphies_id,
            provider_type: priorAuth.provider_type,
            address: priorAuth.provider_address
          },
          insurer: {
            insurer_id: priorAuth.insurer_id,
            insurer_name: priorAuth.insurer_name,
            nphies_id: priorAuth.insurer_nphies_id,
            address: priorAuth.insurer_address
          },
          coverage: coverageData,
          payloads
        });
      } else {
        throw new Error('Invalid communication type or missing communicationRequestId for solicited');
      }

      return {
        bundle: communicationBundle,
        provider: {
          id: priorAuth.provider_id,
          name: priorAuth.provider_name,
          nphies_id: priorAuth.provider_nphies_id
        },
        insurer: {
          id: priorAuth.insurer_id,
          name: priorAuth.insurer_name,
          nphies_id: priorAuth.insurer_nphies_id
        },
        patient: {
          id: priorAuth.patient_id,
          name: priorAuth.patient_name,
          identifier: priorAuth.patient_identifier
        },
        coverage: coverageData
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send UNSOLICITED Communication (Test Case #1)
   * HCP proactively sends additional information to HIC
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {Array} payloads - Array of payload objects
   * @param {string} schemaName - Database schema name
   * @returns {Object} Result with communication data
   */
  async sendUnsolicitedCommunication(priorAuthId, payloads, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get Prior Authorization with related data
      // NPHIES Communication requires full patient/provider/insurer/coverage data
      const paResult = await client.query(`
        SELECT 
          pa.*,
          p.patient_id, 
          p.name as patient_name, 
          p.identifier as patient_identifier,
          p.identifier_type as patient_identifier_type,
          p.gender as patient_gender,
          p.birth_date as patient_birth_date,
          p.phone as patient_phone,
          p.address as patient_address,
          pr.provider_id, 
          pr.provider_name as provider_name, 
          pr.nphies_id as provider_nphies_id,
          pr.provider_type as provider_type,
          pr.address as provider_address,
          i.insurer_id, 
          i.insurer_name as insurer_name, 
          i.nphies_id as insurer_nphies_id,
          i.address as insurer_address
        FROM prior_authorizations pa
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        WHERE pa.id = $1
      `, [priorAuthId]);

      if (paResult.rows.length === 0) {
        throw new Error('Prior Authorization not found');
      }

      const priorAuth = paResult.rows[0];

      // 2. Validate PA is in queued/pended status
      const canCommunicate = priorAuth.status === 'queued' || 
                             priorAuth.outcome === 'queued' || 
                             priorAuth.adjudication_outcome === 'pended';
      
      if (!canCommunicate) {
        throw new Error(`Cannot send communication for PA with status '${priorAuth.status}'. Expected 'queued' or 'pended'.`);
      }

      // 3. Build Communication bundle with coverage data
      const communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
        priorAuth: {
          nphies_request_id: priorAuth.nphies_request_id,
          request_number: priorAuth.request_number,
          pre_auth_ref: priorAuth.pre_auth_ref
        },
        patient: {
          patient_id: priorAuth.patient_id,
          identifier: priorAuth.patient_identifier,
          identifier_type: priorAuth.patient_identifier_type || 'national_id',
          name: priorAuth.patient_name,
          gender: priorAuth.patient_gender,
          birth_date: priorAuth.patient_birth_date,
          phone: priorAuth.patient_phone,
          address: priorAuth.patient_address
        },
        provider: {
          provider_id: priorAuth.provider_id,
          provider_name: priorAuth.provider_name,
          nphies_id: priorAuth.provider_nphies_id,
          provider_type: priorAuth.provider_type,
          address: priorAuth.provider_address
        },
        insurer: {
          insurer_id: priorAuth.insurer_id,
          insurer_name: priorAuth.insurer_name,
          nphies_id: priorAuth.insurer_nphies_id,
          address: priorAuth.insurer_address
        },
        coverage: null, // Coverage JOIN removed due to type mismatch
        payloads
      });

      // 4. Send to NPHIES
      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      // 5. Extract Communication ID from our request bundle
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // 6. Extract NPHIES Communication ID and Acknowledgment from response
      // The response may contain:
      // - MessageHeader.response.identifier: references our original request
      // - MessageHeader.response.code: 'ok', 'transient-error', 'fatal-error'
      // - MessageHeader.meta.tag with 'queued-messages': indicates deferred delivery
      // - Communication resource with NPHIES-assigned ID (if acknowledgment includes it)
      // - MessageHeader.id from the response bundle
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;
      let isQueuedMessage = false;
      
      if (nphiesResponse.data && nphiesResponse.data.entry) {
        // Find MessageHeader in response
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (responseMessageHeader) {
          // Check for 'queued-messages' tag - indicates NPHIES couldn't deliver within 1 minute
          // Message is stored at NPHIES for later delivery to insurer
          const metaTags = responseMessageHeader.meta?.tag || [];
          isQueuedMessage = metaTags.some(
            tag => tag.code === 'queued-messages' || 
                   tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tags'
          );
          
          // Extract acknowledgment status from response.code
          if (responseMessageHeader.response?.code) {
            if (isQueuedMessage) {
              // Message queued at NPHIES - not yet delivered to insurer
              // Need to poll later for actual acknowledgment
              acknowledgmentReceived = false;
              acknowledgmentStatus = 'queued';
            } else {
              // Direct acknowledgment from insurer
              acknowledgmentReceived = true;
              acknowledgmentStatus = responseMessageHeader.response.code; // 'ok', 'transient-error', 'fatal-error'
            }
          }
          
          // Use MessageHeader ID as NPHIES Communication ID (for polling reference)
          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }
        
        // Also check for Communication resource in response (may have different ID)
        const responseCommunication = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'Communication'
        )?.resource;
        if (responseCommunication?.id) {
          nphiesCommunicationId = responseCommunication.id;
        }
      }
      
      console.log(`[CommunicationService] Our Communication ID: ${communicationId}`);
      console.log(`[CommunicationService] NPHIES Communication ID: ${nphiesCommunicationId || 'Not provided in response'}`);
      console.log(`[CommunicationService] Queued at NPHIES: ${isQueuedMessage}`);
      console.log(`[CommunicationService] Acknowledgment: ${acknowledgmentReceived ? acknowledgmentStatus : (isQueuedMessage ? 'queued' : 'Not received')}`);

      // 7. Store Communication in database (including nphies_communication_id and acknowledgment for polling)
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id,
          nphies_communication_id,
          prior_auth_id,
          patient_id,
          communication_type,
          status,
          category,
          priority,
          about_reference,
          about_type,
          sender_identifier,
          recipient_identifier,
          sent_at,
          acknowledgment_received,
          acknowledgment_at,
          acknowledgment_status,
          request_bundle,
          response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        priorAuthId,
        priorAuth.patient_id,
        'unsolicited',
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        `http://provider.com/Claim/${priorAuth.nphies_request_id || priorAuth.request_number}`,
        'Claim',
        priorAuth.provider_nphies_id,
        priorAuth.insurer_nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data ? JSON.stringify(nphiesResponse.data) : null
      ]);

      const communication = insertResult.rows[0];

      // 7. Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id,
            sequence,
            content_type,
            content_string,
            attachment_content_type,
            attachment_data,
            attachment_url,
            attachment_title,
            claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id,
          i + 1,
          payload.contentType,
          payload.contentString || null,
          payload.attachment?.contentType || null,
          payload.attachment?.data || null,
          payload.attachment?.url || null,
          payload.attachment?.title || null,
          payload.claimItemSequences || null
        ]);
      }

      await client.query('COMMIT');

      return {
        success: nphiesResponse.success,
        communication: {
          id: communication.id,
          communicationId: communication.communication_id,
          type: 'unsolicited',
          status: communication.status,
          sentAt: communication.sent_at,
          payloadCount: payloads.length
        },
        nphiesResponse: {
          status: nphiesResponse.status,
          success: nphiesResponse.success,
          error: nphiesResponse.error
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[CommunicationService] Error sending unsolicited communication:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Send SOLICITED Communication (Test Case #2)
   * HCP responds to CommunicationRequest from HIC
   * 
   * @param {number} communicationRequestId - CommunicationRequest ID
   * @param {Array} payloads - Array of payload objects (typically attachments)
   * @param {string} schemaName - Database schema name
   * @returns {Object} Result with communication data
   */
  async sendSolicitedCommunication(communicationRequestId, payloads, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get CommunicationRequest with full patient/provider/insurer/coverage data
      const crResult = await client.query(`
        SELECT cr.*, pa.id as pa_id, pa.nphies_request_id, pa.request_number, pa.pre_auth_ref,
               pa.patient_id, pa.provider_id, pa.insurer_id, pa.coverage_id,
               p.identifier as patient_identifier,
               p.identifier_type as patient_identifier_type,
               p.name as patient_name,
               p.gender as patient_gender,
               p.birth_date as patient_birth_date,
               p.phone as patient_phone,
               p.address as patient_address,
               pr.nphies_id as provider_nphies_id,
               pr.provider_name as provider_name,
               pr.provider_type as provider_type,
               pr.address as provider_address,
               i.nphies_id as insurer_nphies_id,
               i.insurer_name as insurer_name,
               i.address as insurer_address
        FROM nphies_communication_requests cr
        LEFT JOIN prior_authorizations pa ON cr.prior_auth_id = pa.id
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        WHERE cr.id = $1
      `, [communicationRequestId]);

      if (crResult.rows.length === 0) {
        throw new Error('CommunicationRequest not found');
      }

      const commRequest = crResult.rows[0];

      // 2. Validate CommunicationRequest hasn't been responded to
      if (commRequest.responded_at) {
        throw new Error('CommunicationRequest has already been responded to');
      }

      // 3. Build Communication bundle with basedOn reference and coverage data
      const communicationBundle = this.mapper.buildSolicitedCommunicationBundle({
        communicationRequest: {
          request_id: commRequest.request_id,
          about_reference: commRequest.about_reference,
          about_type: commRequest.about_type
        },
        priorAuth: {
          nphies_request_id: commRequest.nphies_request_id,
          request_number: commRequest.request_number,
          pre_auth_ref: commRequest.pre_auth_ref
        },
        patient: {
          patient_id: commRequest.patient_id,
          identifier: commRequest.patient_identifier,
          identifier_type: commRequest.patient_identifier_type || 'national_id',
          name: commRequest.patient_name,
          gender: commRequest.patient_gender,
          birth_date: commRequest.patient_birth_date,
          phone: commRequest.patient_phone,
          address: commRequest.patient_address
        },
        provider: {
          provider_id: commRequest.provider_id,
          provider_name: commRequest.provider_name,
          nphies_id: commRequest.provider_nphies_id,
          provider_type: commRequest.provider_type,
          address: commRequest.provider_address
        },
        insurer: {
          insurer_id: commRequest.insurer_id,
          insurer_name: commRequest.insurer_name,
          nphies_id: commRequest.insurer_nphies_id,
          address: commRequest.insurer_address
        },
        coverage: null, // Coverage JOIN removed due to type mismatch
        payloads
      });

      // 4. Send to NPHIES
      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      // 5. Extract Communication ID from our request bundle
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // 6. Extract NPHIES Communication ID and Acknowledgment from response
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;
      let isQueuedMessage = false;
      
      if (nphiesResponse.data && nphiesResponse.data.entry) {
        // Find MessageHeader in response
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;
        
        if (responseMessageHeader) {
          // Check for 'queued-messages' tag - indicates NPHIES couldn't deliver within 1 minute
          const metaTags = responseMessageHeader.meta?.tag || [];
          isQueuedMessage = metaTags.some(
            tag => tag.code === 'queued-messages' || 
                   tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tags'
          );
          
          // Extract acknowledgment status from response.code
          if (responseMessageHeader.response?.code) {
            if (isQueuedMessage) {
              // Message queued at NPHIES - not yet delivered to insurer
              acknowledgmentReceived = false;
              acknowledgmentStatus = 'queued';
            } else {
              // Direct acknowledgment from insurer
              acknowledgmentReceived = true;
              acknowledgmentStatus = responseMessageHeader.response.code;
            }
          }
          
          // Use MessageHeader ID as NPHIES Communication ID (for polling reference)
          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }
        
        // Also check for Communication resource in response (may have different ID)
        const responseCommunication = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'Communication'
        )?.resource;
        if (responseCommunication?.id) {
          nphiesCommunicationId = responseCommunication.id;
        }
      }
      
      console.log(`[CommunicationService] Solicited Communication ID: ${communicationId}`);
      console.log(`[CommunicationService] NPHIES Communication ID: ${nphiesCommunicationId || 'Not provided in response'}`);
      console.log(`[CommunicationService] Queued at NPHIES: ${isQueuedMessage}`);
      console.log(`[CommunicationService] Acknowledgment: ${acknowledgmentReceived ? acknowledgmentStatus : (isQueuedMessage ? 'queued' : 'Not received')}`);

      // 7. Store Communication (including nphies_communication_id and acknowledgment for polling)
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id,
          nphies_communication_id,
          prior_auth_id,
          patient_id,
          communication_type,
          based_on_request_id,
          status,
          category,
          priority,
          about_reference,
          about_type,
          sender_identifier,
          recipient_identifier,
          sent_at,
          acknowledgment_received,
          acknowledgment_at,
          acknowledgment_status,
          request_bundle,
          response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        commRequest.pa_id,
        commRequest.patient_id,
        'solicited',
        communicationRequestId,
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        commRequest.about_reference,
        commRequest.about_type,
        commRequest.provider_nphies_id,
        commRequest.insurer_nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data ? JSON.stringify(nphiesResponse.data) : null
      ]);

      const communication = insertResult.rows[0];

      // 7. Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id,
            sequence,
            content_type,
            content_string,
            attachment_content_type,
            attachment_data,
            attachment_url,
            attachment_title,
            claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id,
          i + 1,
          payload.contentType,
          payload.contentString || null,
          payload.attachment?.contentType || null,
          payload.attachment?.data || null,
          payload.attachment?.url || null,
          payload.attachment?.title || null,
          payload.claimItemSequences || null
        ]);
      }

      // 8. Update CommunicationRequest as responded
      await client.query(`
        UPDATE nphies_communication_requests
        SET responded_at = NOW(),
            response_communication_id = $1
        WHERE id = $2
      `, [communication.id, communicationRequestId]);

      await client.query('COMMIT');

      return {
        success: nphiesResponse.success,
        communication: {
          id: communication.id,
          communicationId: communication.communication_id,
          type: 'solicited',
          basedOnRequestId: communicationRequestId,
          status: communication.status,
          sentAt: communication.sent_at,
          payloadCount: payloads.length
        },
        nphiesResponse: {
          status: nphiesResponse.status,
          success: nphiesResponse.success,
          error: nphiesResponse.error
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[CommunicationService] Error sending solicited communication:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // POLL FOR MESSAGES
  // ============================================================================

  /**
   * Poll NPHIES for messages related to a Prior Authorization
   * Polls for: priorauth-response, communication-request, communication
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Poll results with categorized messages
   */
  async pollForMessages(priorAuthId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get Prior Authorization
      const paResult = await client.query(`
        SELECT pa.*, pr.nphies_id as provider_nphies_id, pr.provider_name
        FROM prior_authorizations pa
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        WHERE pa.id = $1
      `, [priorAuthId]);

      if (paResult.rows.length === 0) {
        throw new Error('Prior Authorization not found');
      }

      const priorAuth = paResult.rows[0];

      // 2. Build poll request using Task-based structure (per NPHIES specification)
      // Optionally include focus to poll for specific authorization (Task-560083 pattern)
      const providerDomain = this.mapper.extractProviderDomain(priorAuth.provider_name || 'Healthcare Provider');
      const authReference = this.mapper.getNphiesAuthReference(priorAuth);
      
      const pollOptions = {
        focus: {
          type: 'Claim',
          identifier: {
            system: `http://${providerDomain}/identifiers/authorization`,
            value: authReference
          }
        }
      };

      const pollBundle = this.mapper.buildPollRequestBundle(
        priorAuth.provider_nphies_id,
        priorAuth.provider_name || 'Healthcare Provider',
        undefined, // providerType (not needed for poll)
        pollOptions
      );

      // 3. Send poll request
      const pollResponse = await nphiesService.sendPriorAuthPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error,
          pollBundle
        };
      }

      // 4. Extract and categorize responses
      const claimResponses = nphiesService.extractClaimResponsesFromPoll(pollResponse.data);
      const communicationRequests = nphiesService.extractCommunicationRequestsFromPoll(pollResponse.data);
      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);

      const results = {
        success: true,
        claimResponses: [],
        communicationRequests: [],
        acknowledgments: [],
        pollBundle,
        responseBundle: pollResponse.data
      };

      // 5. Process ClaimResponses (final authorization responses)
      for (const cr of claimResponses) {
        const processed = await this.processClaimResponse(client, priorAuthId, cr);
        results.claimResponses.push(processed);
      }

      // 6. Process CommunicationRequests (HIC asking for info)
      for (const commReq of communicationRequests) {
        const processed = await this.storeCommunicationRequest(client, priorAuthId, commReq);
        results.communicationRequests.push(processed);
      }

      // 7. Process Communications (acknowledgments)
      for (const comm of communications) {
        const processed = await this.processAcknowledgment(client, comm);
        if (processed) {
          results.acknowledgments.push(processed);
        }
      }

      return results;

    } catch (error) {
      console.error('[CommunicationService] Error polling for messages:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process ClaimResponse from poll
   * Updates Prior Authorization status
   */
  async processClaimResponse(client, priorAuthId, claimResponse) {
    const outcome = claimResponse.outcome;
    let status = 'pending';
    
    switch (outcome) {
      case 'complete':
        // Check disposition for approval/denial
        const disposition = claimResponse.disposition?.toLowerCase() || '';
        if (disposition.includes('approved') || disposition.includes('accept')) {
          status = 'approved';
        } else if (disposition.includes('denied') || disposition.includes('reject')) {
          status = 'denied';
        } else {
          status = 'approved'; // Default complete to approved
        }
        break;
      case 'partial':
        status = 'partial';
        break;
      case 'queued':
        status = 'queued';
        break;
      case 'error':
        status = 'error';
        break;
    }

    // Update Prior Authorization
    await client.query(`
      UPDATE prior_authorizations
      SET status = $1,
          outcome = $2,
          disposition = $3,
          pre_auth_ref = COALESCE($4, pre_auth_ref),
          response_bundle = $5,
          response_date = NOW()
      WHERE id = $6
    `, [
      status,
      outcome,
      claimResponse.disposition,
      claimResponse.preAuthRef,
      JSON.stringify(claimResponse),
      priorAuthId
    ]);

    return {
      id: claimResponse.id,
      outcome,
      status,
      disposition: claimResponse.disposition,
      preAuthRef: claimResponse.preAuthRef
    };
  }

  /**
   * Store CommunicationRequest from poll
   * HIC is asking for additional information
   */
  async storeCommunicationRequest(client, priorAuthId, commRequest) {
    // Check if already stored
    const existing = await client.query(`
      SELECT id FROM nphies_communication_requests WHERE request_id = $1
    `, [commRequest.id]);

    if (existing.rows.length > 0) {
      return { id: existing.rows[0].id, alreadyStored: true };
    }

    // Parse the CommunicationRequest
    const parsed = this.mapper.parseCommunicationRequest(commRequest);

    // Store in database
    const result = await client.query(`
      INSERT INTO nphies_communication_requests (
        request_id,
        prior_auth_id,
        status,
        category,
        priority,
        about_reference,
        about_type,
        payload_content_type,
        payload_content_string,
        sender_identifier,
        recipient_identifier,
        authored_on,
        request_bundle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      commRequest.id,
      priorAuthId,
      parsed.status || 'active',
      parsed.category,
      parsed.priority,
      parsed.aboutReference,
      parsed.aboutType,
      parsed.payloadContentType,
      parsed.payloadContentString,
      parsed.senderIdentifier,
      parsed.recipientIdentifier,
      parsed.authoredOn,
      JSON.stringify(commRequest)
    ]);

    return {
      id: result.rows[0].id,
      requestId: commRequest.id,
      category: parsed.category,
      priority: parsed.priority,
      payloadContentString: parsed.payloadContentString,
      alreadyStored: false
    };
  }

  /**
   * Process Communication acknowledgment from poll
   * Updates our sent Communication with acknowledgment status
   */
  async processAcknowledgment(client, communication) {
    // Check if this is an acknowledgment (has inResponseTo)
    const parsed = this.mapper.parseCommunication(communication);
    
    if (!parsed.inResponseTo) {
      // Not an acknowledgment, might be something else
      return null;
    }

    // Extract our Communication ID from inResponseTo reference
    const ourCommId = this.mapper.extractIdFromReference(parsed.inResponseTo);
    
    if (!ourCommId) {
      return null;
    }

    // Update our Communication with acknowledgment
    const result = await client.query(`
      UPDATE nphies_communications
      SET acknowledgment_received = TRUE,
          acknowledgment_at = NOW(),
          acknowledgment_status = $1,
          acknowledgment_bundle = $2
      WHERE communication_id = $3
      RETURNING *
    `, [
      parsed.status,
      JSON.stringify(communication),
      ourCommId
    ]);

    if (result.rows.length === 0) {
      console.warn(`[CommunicationService] Acknowledgment for unknown Communication: ${ourCommId}`);
      return null;
    }

    return {
      communicationId: ourCommId,
      acknowledgmentStatus: parsed.status,
      acknowledgedAt: result.rows[0].acknowledgment_at
    };
  }

  // ============================================================================
  // POLL FOR ACKNOWLEDGMENTS
  // ============================================================================

  /**
   * Poll NPHIES for acknowledgment of a specific Communication
   * Use this when a communication has acknowledgment_status = 'queued'
   * 
   * @param {number} communicationDbId - Database ID of the communication
   * @param {string} schemaName - Database schema name
   * @returns {Object} Poll result with acknowledgment status
   */
  async pollForAcknowledgment(communicationDbId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get the Communication record
      const commResult = await client.query(`
        SELECT nc.*, 
               pr.nphies_id as provider_nphies_id,
               pa.nphies_request_id,
               pa.request_number
        FROM nphies_communications nc
        LEFT JOIN prior_authorizations pa ON nc.prior_auth_id = pa.id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        WHERE nc.id = $1
      `, [communicationDbId]);

      if (commResult.rows.length === 0) {
        throw new Error('Communication not found');
      }

      const communication = commResult.rows[0];

      // 2. Check if already acknowledged
      if (communication.acknowledgment_received && communication.acknowledgment_status !== 'queued') {
        return {
          success: true,
          alreadyAcknowledged: true,
          acknowledgmentStatus: communication.acknowledgment_status,
          acknowledgmentAt: communication.acknowledgment_at,
          message: 'Communication already acknowledged'
        };
      }

      // 3. Build poll request Bundle with Task resource (per NPHIES IG)
      // https://portal.nphies.sa/ig/Bundle-a84aabfa-1163-407d-aa38-f8119a0b7aa1.json.html
      const pollBundle = this.mapper.buildPollRequestBundle(
        communication.provider_nphies_id,
        'Healthcare Provider'  // Provider name
      );

      console.log(`[CommunicationService] Polling for acknowledgment of Communication: ${communication.communication_id}`);
      console.log(`[CommunicationService] Using poll-request Task message to $process-message`);

      // 4. Send poll request to NPHIES
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error,
          pollBundle: pollBundle,  // Return the Bundle for debugging
          message: 'Poll request failed'
        };
      }

      // 5. Extract Communications from poll response
      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);
      
      console.log(`[CommunicationService] Poll returned ${communications.length} communication(s)`);

      // 6. Find acknowledgment for our communication
      let acknowledgmentFound = false;
      let acknowledgmentData = null;

      for (const comm of communications) {
        const parsed = this.mapper.parseCommunication(comm);
        
        // Check if this is a response to our communication
        // Can match by inResponseTo or by about reference
        if (parsed.inResponseTo) {
          const referencedId = this.mapper.extractIdFromReference(parsed.inResponseTo);
          if (referencedId === communication.communication_id) {
            acknowledgmentFound = true;
            acknowledgmentData = {
              status: parsed.status,
              bundle: comm
            };
            break;
          }
        }
      }

      // 7. Update database if acknowledgment found
      if (acknowledgmentFound) {
        await client.query(`
          UPDATE nphies_communications
          SET acknowledgment_received = TRUE,
              acknowledgment_at = NOW(),
              acknowledgment_status = $1,
              acknowledgment_bundle = $2
          WHERE id = $3
        `, [
          acknowledgmentData.status || 'ok',
          JSON.stringify(acknowledgmentData.bundle),
          communicationDbId
        ]);

        return {
          success: true,
          acknowledgmentFound: true,
          acknowledgmentStatus: acknowledgmentData.status || 'ok',
          acknowledgmentAt: new Date(),
          pollBundle: pollBundle,  // The full Bundle sent to NPHIES
          responseBundle: pollResponse.data,
          message: 'Acknowledgment received and saved'
        };
      }

      // 8. No acknowledgment found yet
      return {
        success: true,
        acknowledgmentFound: false,
        currentStatus: communication.acknowledgment_status,
        pollBundle: pollBundle,  // The full Bundle sent to NPHIES
        responseBundle: pollResponse.data,
        communicationsInPoll: communications.length,
        message: 'No acknowledgment found yet. The insurer may not have responded.'
      };

    } catch (error) {
      console.error('[CommunicationService] Error polling for acknowledgment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Poll for acknowledgments for all queued communications of a Prior Authorization
   * 
   * @param {number} priorAuthId - Prior Authorization ID
   * @param {string} schemaName - Database schema name
   * @returns {Object} Poll results for all queued communications
   */
  async pollForAllQueuedAcknowledgments(priorAuthId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // 1. Get all queued communications for this prior auth
      const queuedResult = await client.query(`
        SELECT id, communication_id, acknowledgment_status
        FROM nphies_communications
        WHERE prior_auth_id = $1
          AND (acknowledgment_status = 'queued' OR acknowledgment_received = FALSE)
        ORDER BY sent_at DESC
      `, [priorAuthId]);

      if (queuedResult.rows.length === 0) {
        return {
          success: true,
          queuedCount: 0,
          results: [],
          message: 'No queued communications to poll'
        };
      }

      console.log(`[CommunicationService] Found ${queuedResult.rows.length} queued communication(s) to poll`);

      // 2. Poll for each queued communication
      const results = [];
      for (const comm of queuedResult.rows) {
        try {
          const pollResult = await this.pollForAcknowledgment(comm.id, schemaName);
          results.push({
            communicationId: comm.communication_id,
            dbId: comm.id,
            ...pollResult
          });
        } catch (error) {
          results.push({
            communicationId: comm.communication_id,
            dbId: comm.id,
            success: false,
            error: error.message
          });
        }
      }

      const acknowledged = results.filter(r => r.acknowledgmentFound).length;
      const stillQueued = results.filter(r => r.success && !r.acknowledgmentFound && !r.alreadyAcknowledged).length;

      return {
        success: true,
        queuedCount: queuedResult.rows.length,
        acknowledgedCount: acknowledged,
        stillQueuedCount: stillQueued,
        results,
        message: `Polled ${queuedResult.rows.length} communication(s): ${acknowledged} acknowledged, ${stillQueued} still queued`
      };

    } catch (error) {
      console.error('[CommunicationService] Error polling for all queued acknowledgments:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // GET METHODS
  // ============================================================================

  /**
   * Get pending CommunicationRequests for a Prior Authorization
   * These are requests from HIC that need responses
   */
  async getPendingCommunicationRequests(priorAuthId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const result = await client.query(`
        SELECT *
        FROM nphies_communication_requests
        WHERE prior_auth_id = $1
          AND responded_at IS NULL
        ORDER BY received_at DESC
      `, [priorAuthId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get all CommunicationRequests for a Prior Authorization
   */
  async getCommunicationRequests(priorAuthId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_id,
               c.sent_at as response_sent_at
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        WHERE cr.prior_auth_id = $1
        ORDER BY cr.received_at DESC
      `, [priorAuthId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get all Communications sent for a Prior Authorization
   */
  async getCommunications(priorAuthId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const result = await client.query(`
        SELECT c.*,
               cr.request_id as based_on_request_nphies_id,
               cr.payload_content_string as request_payload
        FROM nphies_communications c
        LEFT JOIN nphies_communication_requests cr ON c.based_on_request_id = cr.id
        WHERE c.prior_auth_id = $1
        ORDER BY c.created_at DESC
      `, [priorAuthId]);

      // Get payloads for each communication
      for (const comm of result.rows) {
        const payloadsResult = await client.query(`
          SELECT * FROM nphies_communication_payloads
          WHERE communication_id = $1
          ORDER BY sequence
        `, [comm.id]);
        comm.payloads = payloadsResult.rows;
      }

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get a single Communication by ID (supports both integer DB id and UUID communication_id)
   */
  async getCommunication(communicationId, schemaName) {
    const client = await pool.connect();
    
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Check if it's a UUID (contains dashes) or integer ID
      const isUUID = typeof communicationId === 'string' && communicationId.includes('-');
      
      const result = await client.query(`
        SELECT c.*,
               cr.request_id as based_on_request_nphies_id,
               cr.payload_content_string as request_payload
        FROM nphies_communications c
        LEFT JOIN nphies_communication_requests cr ON c.based_on_request_id = cr.id
        WHERE ${isUUID ? 'c.communication_id' : 'c.id'} = $1
      `, [communicationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const comm = result.rows[0];

      // Get payloads
      const payloadsResult = await client.query(`
        SELECT * FROM nphies_communication_payloads
        WHERE communication_id = $1
        ORDER BY sequence
      `, [comm.id]);
      comm.payloads = payloadsResult.rows;

      return comm;

    } finally {
      client.release();
    }
  }
}

export default new CommunicationService();

