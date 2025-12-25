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
import { NPHIES_CONFIG } from '../config/nphies.js';

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
      const allClaimResponses = nphiesService.extractClaimResponsesFromPoll(pollResponse.data);
      const communicationRequests = nphiesService.extractCommunicationRequestsFromPoll(pollResponse.data);
      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);

      // Filter ClaimResponses to match the pending authorization
      // Match by checking ClaimResponse.request.identifier against poll focus identifier
      const matchingClaimResponses = [];
      const unmatchedClaimResponses = [];
      
      const expectedSystem = `http://${providerDomain}/identifiers/authorization`;
      
      for (const cr of allClaimResponses) {
        const requestIdentifier = cr.request?.identifier?.value;
        const requestSystem = cr.request?.identifier?.system;
        
        // Try multiple matching strategies
        let matches = false;
        
        // Strategy 1: Exact match (value + system)
        const exactValueMatch = requestIdentifier === authReference;
        const exactSystemMatch = requestSystem === expectedSystem;
        if (exactValueMatch && exactSystemMatch) {
          matches = true;
        }
        
        // Strategy 2: Value match only (system might differ slightly)
        if (!matches && exactValueMatch) {
          matches = true;
        }
        
        // Strategy 3: Case-insensitive system match with value match
        if (!matches && requestIdentifier && requestSystem) {
          const systemNormalized = requestSystem.toLowerCase().replace(/\/$/, '');
          const expectedSystemNormalized = expectedSystem.toLowerCase().replace(/\/$/, '');
          if (requestIdentifier === authReference && systemNormalized === expectedSystemNormalized) {
            matches = true;
          }
        }
        
        // Strategy 4: If only one ClaimResponse and it has a request identifier, assume it's for this auth
        // (This handles cases where NPHIES might return responses without perfect identifier matching)
        if (!matches && allClaimResponses.length === 1 && requestIdentifier) {
          matches = true;
        }
        
        if (matches) {
          matchingClaimResponses.push(cr);
        } else {
          unmatchedClaimResponses.push({
            id: cr.id,
            requestIdentifier,
            requestSystem,
            reason: !requestIdentifier ? 'No request identifier found' : 
                   !exactValueMatch ? `Identifier value mismatch (expected "${authReference}", got "${requestIdentifier}")` : 
                   `Identifier system mismatch (expected "${expectedSystem}", got "${requestSystem}")`
          });
        }
      }

      const results = {
        success: true,
        claimResponses: [],
        communicationRequests: [],
        acknowledgments: [],
        pollBundle,
        responseBundle: pollResponse.data,
        // Include errors and response code from NPHIES
        errors: pollResponse.errors || [],
        responseCode: pollResponse.responseCode,
        // Add matching details for debugging
        matchingDetails: {
          totalFound: allClaimResponses.length,
          matched: matchingClaimResponses.length,
          unmatched: unmatchedClaimResponses.length,
          unmatchedDetails: unmatchedClaimResponses,
          pollIdentifier: {
            system: `http://${providerDomain}/identifiers/authorization`,
            value: authReference
          }
        }
      };

      // 5. Process only matching ClaimResponses (final authorization responses)
      for (const cr of matchingClaimResponses) {
        const processed = await this.processClaimResponse(client, priorAuthId, cr);
        results.claimResponses.push(processed);
      }
      

      // 6. Process CommunicationRequests (HIC asking for info)
      for (const commReq of communicationRequests) {
        const processed = await this.storeCommunicationRequest(client, priorAuthId, commReq);
        results.communicationRequests.push(processed);
      }

      // 7. Process Communications (acknowledgments)
      let hasUnsolicitedAcknowledgment = false;
      let unsolicitedPriorAuthId = null;
      
      for (const comm of communications) {
        const processed = await this.processAcknowledgment(client, comm);
        if (processed) {
          results.acknowledgments.push(processed);
          
          // Check if this was an acknowledgment for an unsolicited communication
          if (processed.isUnsolicited && processed.priorAuthId) {
            hasUnsolicitedAcknowledgment = true;
            unsolicitedPriorAuthId = processed.priorAuthId;
          }
        }
      }

      // 8. Auto-poll for final response after unsolicited communication acknowledgment (Step 7)
      if (hasUnsolicitedAcknowledgment && NPHIES_CONFIG.AUTO_POLL_AFTER_ACKNOWLEDGMENT) {
        console.log(`[CommunicationService] Unsolicited communication acknowledged. Auto-polling for final response in ${NPHIES_CONFIG.AUTO_POLL_DELAY_MS}ms...`);
        
        // Set flag to indicate auto-poll should be triggered
        results.shouldAutoPollForFinalResponse = true;
        results.autoPollDelayMs = NPHIES_CONFIG.AUTO_POLL_DELAY_MS;
        results.autoPollPriorAuthId = unsolicitedPriorAuthId;
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
   * Updates Prior Authorization status and extracts full adjudication information
   */
  async processClaimResponse(client, priorAuthId, claimResponse) {
    const outcome = claimResponse.outcome;
    let status = 'pending';
    let adjudicationOutcome = null;
    
    // Extract adjudication outcome from extension
    const adjudicationExt = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    );
    adjudicationOutcome = adjudicationExt?.valueCodeableConcept?.coding?.[0]?.code;
    
    switch (outcome) {
      case 'complete':
        // Check disposition for approval/denial
        const disposition = claimResponse.disposition?.toLowerCase() || '';
        if (disposition.includes('approved') || disposition.includes('accept')) {
          status = 'approved';
          if (!adjudicationOutcome) adjudicationOutcome = 'approved';
        } else if (disposition.includes('denied') || disposition.includes('reject')) {
          status = 'denied';
          if (!adjudicationOutcome) adjudicationOutcome = 'rejected';
        } else {
          status = 'approved'; // Default complete to approved
          if (!adjudicationOutcome) adjudicationOutcome = 'approved';
        }
        break;
      case 'partial':
        status = 'partial';
        if (!adjudicationOutcome) adjudicationOutcome = 'partial';
        break;
      case 'queued':
        status = 'queued';
        break;
      case 'error':
        status = 'error';
        break;
    }

    // Extract financial totals
    const totals = claimResponse.total?.map(total => ({
      category: total.category?.coding?.[0]?.code,
      categoryDisplay: total.category?.coding?.[0]?.display,
      amount: total.amount?.value,
      currency: total.amount?.currency || 'SAR'
    })) || [];

    // Extract item-level adjudication details
    const itemAdjudications = claimResponse.item?.map(item => {
      const itemOutcome = item.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      )?.valueCodeableConcept?.coding?.[0]?.code;

      const adjudicationList = item.adjudication?.map(adj => ({
        category: adj.category?.coding?.[0]?.code,
        categoryDisplay: adj.category?.coding?.[0]?.display,
        amount: adj.amount?.value,
        value: adj.value,
        currency: adj.amount?.currency,
        reason: adj.reason?.coding?.[0]?.code,
        reasonDisplay: adj.reason?.coding?.[0]?.display
      })) || [];

      return {
        itemSequence: item.itemSequence,
        outcome: itemOutcome,
        adjudication: adjudicationList
      };
    }) || [];

    // Extract pre-auth period
    const preAuthPeriod = claimResponse.preAuthPeriod;

    // Calculate approved amount from totals
    const approvedAmount = totals.find(t => t.category === 'benefit')?.amount || 
                          totals.find(t => t.category === 'eligible')?.amount;

    // Update Prior Authorization with full adjudication details
    await client.query(`
      UPDATE prior_authorizations
      SET status = $1,
          outcome = $2,
          disposition = $3,
          adjudication_outcome = $4,
          pre_auth_ref = COALESCE($5, pre_auth_ref),
          pre_auth_period_start = COALESCE($6, pre_auth_period_start),
          pre_auth_period_end = COALESCE($7, pre_auth_period_end),
          approved_amount = COALESCE($8, approved_amount),
          response_bundle = $9,
          response_date = NOW()
      WHERE id = $10
    `, [
      status,
      outcome,
      claimResponse.disposition,
      adjudicationOutcome,
      claimResponse.preAuthRef,
      preAuthPeriod?.start || null,
      preAuthPeriod?.end || null,
      approvedAmount || null,
      JSON.stringify(claimResponse),
      priorAuthId
    ]);

    // Update item-level adjudication if items exist
    if (itemAdjudications.length > 0) {
      for (const itemAdj of itemAdjudications) {
        const itemOutcome = itemAdj.outcome;
        const adjudicationStatus = itemOutcome === 'approved' ? 'approved' : 
                                  itemOutcome === 'rejected' ? 'denied' : 
                                  itemOutcome === 'partial' ? 'partial' : 'pending';
        
        // Get approved amount for this item
        const itemApprovedAmount = itemAdj.adjudication.find(a => a.category === 'benefit')?.amount ||
                                  itemAdj.adjudication.find(a => a.category === 'eligible')?.amount;
        
        // Get adjudication reason
        const adjudicationReason = itemAdj.adjudication.find(a => a.reason)?.reasonDisplay ||
                                  itemAdj.adjudication.find(a => a.reason)?.reason;

        await client.query(`
          UPDATE prior_authorization_items
          SET adjudication_status = $1,
              adjudication_amount = $2,
              adjudication_reason = $3
          WHERE prior_auth_id = $4 AND sequence = $5
        `, [
          adjudicationStatus,
          itemApprovedAmount || null,
          adjudicationReason || null,
          priorAuthId,
          itemAdj.itemSequence
        ]);
      }
    }

    return {
      id: claimResponse.id,
      outcome,
      status,
      adjudicationOutcome,
      disposition: claimResponse.disposition,
      preAuthRef: claimResponse.preAuthRef,
      preAuthPeriod,
      totals,
      itemAdjudications,
      approvedAmount
    };
  }

  /**
   * Store CommunicationRequest from poll
   * HIC is asking for additional information
   * Supports both prior auth and claim-level communications
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

    // Extract claim_id if about_type is 'Claim'
    let claimId = null;
    if (parsed.aboutType === 'Claim' && parsed.aboutReference) {
      try {
        // Extract identifier from about_reference
        // Format could be: "Claim/{identifier}" or just the identifier value
        let identifierValue = parsed.aboutReference;
        
        // If it's a reference string like "Claim/{id}", extract the ID part
        if (typeof identifierValue === 'string' && identifierValue.includes('/')) {
          identifierValue = identifierValue.split('/').pop();
        }
        
        // Try to find claim by claim_number or nphies_claim_id
        const claimQuery = await client.query(`
          SELECT id FROM claim_submissions 
          WHERE claim_number = $1 OR nphies_claim_id = $1
          LIMIT 1
        `, [identifierValue]);
        
        if (claimQuery.rows.length > 0) {
          claimId = claimQuery.rows[0].id;
        }
      } catch (error) {
        console.warn(`[CommunicationService] Could not extract claim_id from about_reference: ${parsed.aboutReference}`, error);
        // Continue without claim_id if lookup fails
      }
    }

    // Store in database (include claim_id when available)
    const result = await client.query(`
      INSERT INTO nphies_communication_requests (
        request_id,
        prior_auth_id,
        claim_id,
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      commRequest.id,
      priorAuthId,
      claimId, // Store claim_id when about_type is 'Claim'
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
      claimId: claimId,
      category: parsed.category,
      priority: parsed.priority,
      payloadContentString: parsed.payloadContentString,
      alreadyStored: false
    };
  }

  /**
   * Process Communication acknowledgment from poll
   * Updates our sent Communication with acknowledgment status
   * Returns information about whether this was an unsolicited communication (for auto-poll)
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

    // Get communication details before updating (to check if it's unsolicited)
    const commBeforeUpdate = await client.query(`
      SELECT communication_type, prior_auth_id, claim_id
      FROM nphies_communications
      WHERE communication_id = $1
    `, [ourCommId]);

    if (commBeforeUpdate.rows.length === 0) {
      console.warn(`[CommunicationService] Acknowledgment for unknown Communication: ${ourCommId}`);
      return null;
    }

    const commData = commBeforeUpdate.rows[0];
    const isUnsolicited = commData.communication_type === 'unsolicited';

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
      acknowledgedAt: result.rows[0].acknowledgment_at,
      isUnsolicited: isUnsolicited,
      priorAuthId: commData.prior_auth_id,
      claimId: commData.claim_id
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

