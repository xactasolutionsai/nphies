/**
 * NPHIES Advanced Authorization Communication Service
 * 
 * Business logic for handling NPHIES Communications for Advanced Authorizations.
 * Advanced Authorizations are payer-initiated (received via polling, not sent by provider).
 * 
 * Key difference from Prior Auth / Claim communication services:
 * - advanced_authorizations table has NO FK to patients/providers/insurers tables
 * - Patient/provider/insurer data is extracted from the stored response_bundle JSONB
 * - Provider info falls back to NPHIES_CONFIG defaults
 * 
 * Supports:
 * - Unsolicited Communication (HCP proactively sends info about an APA)
 * - Solicited Communication (HCP responds to CommunicationRequest from HIC)
 * - Acknowledgment polling
 */

import { randomUUID } from 'crypto';
import pool from '../db.js';
import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

class AdvancedAuthCommunicationService {
  constructor() {
    this.mapper = new CommunicationMapper();
  }

  // ============================================================================
  // HELPERS - Extract data from response_bundle
  // ============================================================================

  /**
   * Find the inner message Bundle containing ClaimResponse + Patient + Org + Coverage
   * from poll_response_bundle, handling both storage shapes.
   */
  _getMessageBundleEntries(advAuth) {
    const pollBundle = advAuth.poll_response_bundle;
    if (pollBundle && pollBundle.resourceType === 'Bundle' && pollBundle.entry) {
      // Case 1: outer poll response - find the nested inner message Bundle
      for (const entry of pollBundle.entry) {
        const r = entry?.resource;
        if (r?.resourceType === 'Bundle' && r.type === 'message' && r.entry?.length) {
          if (r.entry.some(e => e.resource?.resourceType === 'ClaimResponse')) {
            return r.entry.map(e => e.resource).filter(Boolean);
          }
        }
      }
      // Case 2: poll_response_bundle IS the inner message Bundle directly
      if (pollBundle.type === 'message') {
        if (pollBundle.entry.some(e => e.resource?.resourceType === 'ClaimResponse')) {
          return pollBundle.entry.map(e => e.resource).filter(Boolean);
        }
      }
    }
    return [];
  }

  /**
   * Extract patient/provider/insurer/coverage data from the advanced auth's stored bundles.
   * Primarily uses poll_response_bundle (which contains the full message Bundle with embedded
   * Patient, Organization, Coverage). Falls back to response_bundle if needed.
   */
  extractBundleData(advAuth) {
    let entries = this._getMessageBundleEntries(advAuth);

    // Fallback: try response_bundle (usually just the raw ClaimResponse with no embedded entities)
    if (entries.length === 0) {
      const bundle = advAuth.response_bundle;
      if (bundle) {
        if (bundle.resourceType === 'Bundle' && bundle.entry) {
          entries = bundle.entry.map(e => e.resource).filter(Boolean);
        } else if (bundle.resourceType === 'ClaimResponse') {
          entries = [bundle];
        }
      }
    }

    if (entries.length === 0) return { patient: null, provider: null, insurer: null, coverage: null };

    // Find Patient resource
    const patientResource = entries.find(r => r.resourceType === 'Patient');
    let patient = null;
    if (patientResource) {
      const nameObj = patientResource.name?.[0];
      const idObj = patientResource.identifier?.[0];
      patient = {
        patient_id: patientResource.id,
        identifier: idObj?.value || null,
        identifier_type: idObj?.type?.coding?.[0]?.code === 'PPN' ? 'passport' :
                         idObj?.type?.coding?.[0]?.code === 'NI' ? 'national_id' :
                         idObj?.type?.coding?.[0]?.code === 'VP' ? 'visa' : 'national_id',
        name: nameObj?.text || [nameObj?.given?.[0], nameObj?.family].filter(Boolean).join(' ') || null,
        gender: patientResource.gender || null,
        birth_date: patientResource.birthDate || null,
        phone: patientResource.telecom?.find(t => t.system === 'phone')?.value || null,
        address: null
      };
    }

    // Find Provider Organization (type = 'prov')
    const providerOrg = entries.find(r =>
      r.resourceType === 'Organization' &&
      r.type?.some(t => t.coding?.some(c => c.code === 'prov'))
    );
    let provider = null;
    if (providerOrg) {
      provider = {
        provider_id: providerOrg.id,
        provider_name: providerOrg.name || 'Healthcare Provider',
        nphies_id: providerOrg.identifier?.find(i => i.system?.includes('provider-license'))?.value || null,
        provider_type: providerOrg.extension?.find(e => e.url?.includes('extension-provider-type'))
          ?.valueCodeableConcept?.coding?.[0]?.code || null,
        address: null
      };
    }

    // Find Insurer Organization (type = 'ins')
    const insurerOrg = entries.find(r =>
      r.resourceType === 'Organization' &&
      r.type?.some(t => t.coding?.some(c => c.code === 'ins'))
    );
    let insurer = null;
    if (insurerOrg) {
      insurer = {
        insurer_id: insurerOrg.id,
        insurer_name: insurerOrg.name || 'Insurance Company',
        nphies_id: insurerOrg.identifier?.find(i => i.system?.includes('payer-license'))?.value || null,
        address: null
      };
    }

    // Find Coverage resource
    const coverageRes = entries.find(r => r.resourceType === 'Coverage');
    let coverage = null;
    if (coverageRes) {
      const covId = coverageRes.identifier?.[0];
      coverage = {
        coverage_id: coverageRes.id,
        identifier_value: covId?.value || null,
        identifier_system: covId?.system || null,
        status: coverageRes.status || 'active',
        relationship: coverageRes.relationship?.coding?.[0]?.code || 'self',
        class_value: coverageRes.class?.[0]?.value || null,
        type_code: coverageRes.type?.coding?.[0]?.code || null
      };
    }

    return { patient, provider, insurer, coverage };
  }

  /**
   * Get advanced auth with extracted entity data.
   * Falls back to NPHIES_CONFIG for provider if not found in bundle.
   */
  async getAdvancedAuthWithEntities(client, advAuthId) {
    const result = await client.query(
      'SELECT * FROM advanced_authorizations WHERE id = $1',
      [advAuthId]
    );

    if (result.rows.length === 0) {
      throw new Error('Advanced Authorization not found');
    }

    const advAuth = result.rows[0];
    const { patient, provider, insurer, coverage } = this.extractBundleData(advAuth);

    // Fallback provider from DB config
    let finalProvider = provider;
    if (!finalProvider || !finalProvider.nphies_id) {
      const provResult = await client.query(
        `SELECT nphies_id, provider_name, provider_type, address FROM providers WHERE nphies_id = $1 LIMIT 1`,
        [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
      );
      if (provResult.rows.length > 0) {
        finalProvider = {
          provider_id: provResult.rows[0].nphies_id,
          provider_name: provResult.rows[0].provider_name,
          nphies_id: provResult.rows[0].nphies_id,
          provider_type: provResult.rows[0].provider_type,
          address: provResult.rows[0].address
        };
      } else {
        finalProvider = {
          provider_id: NPHIES_CONFIG.DEFAULT_PROVIDER_ID,
          provider_name: 'Healthcare Provider',
          nphies_id: NPHIES_CONFIG.DEFAULT_PROVIDER_ID,
          provider_type: null,
          address: null
        };
      }
    }

    // Fallback insurer
    let finalInsurer = insurer;
    if (!finalInsurer || !finalInsurer.nphies_id) {
      finalInsurer = {
        insurer_id: null,
        insurer_name: 'Insurance Company',
        nphies_id: NPHIES_CONFIG.DEFAULT_INSURER_ID,
        address: null
      };
    }

    // Fallback patient - use reference string if no Patient resource found
    let finalPatient = patient;
    if (!finalPatient) {
      finalPatient = {
        patient_id: null,
        identifier: null,
        identifier_type: 'national_id',
        name: null,
        gender: null,
        birth_date: null,
        phone: null,
        address: null
      };
    }

    return { advAuth, patient: finalPatient, provider: finalProvider, insurer: finalInsurer, coverage };
  }

  // ============================================================================
  // PREVIEW
  // ============================================================================

  async previewCommunicationBundle(advAuthId, payloads, type = 'unsolicited', communicationRequestId = null, schemaName) {
    const client = await pool.connect();

    try {
      await client.query(`SET search_path TO ${schemaName}`);
      const { advAuth, patient, provider, insurer, coverage } = await this.getAdvancedAuthWithEntities(client, advAuthId);

      const authIdentifier = advAuth.identifier_value || advAuth.pre_auth_ref;
      const claimResponse = advAuth.response_bundle;
      const requestIdentifier = claimResponse?.request?.identifier?.value || authIdentifier;

      let communicationBundle;

      if (type === 'unsolicited') {
        communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
          priorAuth: {
            nphies_request_id: requestIdentifier,
            request_number: requestIdentifier,
            pre_auth_ref: advAuth.pre_auth_ref || authIdentifier
          },
          patient,
          provider,
          insurer,
          coverage,
          payloads
        });
      } else if (type === 'solicited' && communicationRequestId) {
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
            about_identifier: commRequest.about_identifier,
            about_identifier_system: commRequest.about_identifier_system,
            about_type: commRequest.about_type,
            cr_identifier: commRequest.cr_identifier,
            cr_identifier_system: commRequest.cr_identifier_system
          },
          priorAuth: {
            nphies_request_id: requestIdentifier,
            request_number: requestIdentifier,
            pre_auth_ref: advAuth.pre_auth_ref || authIdentifier
          },
          patient,
          provider,
          insurer,
          coverage,
          payloads
        });
      } else {
        throw new Error('Invalid communication type or missing communicationRequestId for solicited');
      }

      return {
        bundle: communicationBundle,
        provider: { id: provider.provider_id, name: provider.provider_name, nphies_id: provider.nphies_id },
        insurer: { id: insurer.insurer_id, name: insurer.insurer_name, nphies_id: insurer.nphies_id },
        patient: { id: patient.patient_id, name: patient.name, identifier: patient.identifier },
        coverage
      };
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // SEND COMMUNICATIONS
  // ============================================================================

  async sendUnsolicitedCommunication(advAuthId, payloads, schemaName) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      const { advAuth, patient, provider, insurer, coverage } = await this.getAdvancedAuthWithEntities(client, advAuthId);
      const authIdentifier = advAuth.identifier_value || advAuth.pre_auth_ref;
      const claimResponse = advAuth.response_bundle;
      const requestIdentifier = claimResponse?.request?.identifier?.value || authIdentifier;

      const communicationBundle = this.mapper.buildUnsolicitedCommunicationBundle({
        priorAuth: {
          nphies_request_id: requestIdentifier,
          request_number: requestIdentifier,
          pre_auth_ref: advAuth.pre_auth_ref || authIdentifier
        },
        patient,
        provider,
        insurer,
        coverage,
        payloads
      });

      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      console.log(`[AdvAuthCommService] Unsolicited NPHIES response:`, {
        success: nphiesResponse.success,
        status: nphiesResponse.status,
        hasData: !!nphiesResponse.data
      });

      // Extract Communication ID from our request bundle
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // Extract NPHIES acknowledgment from response
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;
      let isQueuedMessage = false;

      if (nphiesResponse.data && nphiesResponse.data.entry) {
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;

        if (responseMessageHeader) {
          const metaTags = responseMessageHeader.meta?.tag || [];
          isQueuedMessage = metaTags.some(
            tag => tag.code === 'queued-messages' ||
                   tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tags'
          );

          if (responseMessageHeader.response?.code) {
            if (isQueuedMessage) {
              acknowledgmentReceived = false;
              acknowledgmentStatus = 'queued';
            } else {
              acknowledgmentReceived = true;
              acknowledgmentStatus = responseMessageHeader.response.code;
            }
          }

          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }

        const responseCommunication = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'Communication'
        )?.resource;
        if (responseCommunication?.id) {
          nphiesCommunicationId = responseCommunication.id;
        }
      }

      // Store Communication in database
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id, nphies_communication_id,
          prior_auth_id, claim_id, advanced_authorization_id,
          patient_id, communication_type, status, category, priority,
          about_reference, about_type, sender_identifier, recipient_identifier,
          sent_at, acknowledgment_received, acknowledgment_at, acknowledgment_status,
          request_bundle, response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        null, // prior_auth_id
        null, // claim_id
        advAuthId,
        null, // patient_id - advanced auth patients don't have local DB records
        'unsolicited',
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        `http://provider.com/Claim/${requestIdentifier}`,
        'Claim',
        provider.nphies_id,
        insurer.nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data
          ? JSON.stringify(nphiesResponse.data)
          : nphiesResponse.error
            ? JSON.stringify({ _fallback: true, error: nphiesResponse.error, status: nphiesResponse.status })
            : null
      ]);

      const communication = insertResult.rows[0];

      // Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id, sequence, content_type, content_string,
            attachment_content_type, attachment_data, attachment_url,
            attachment_title, claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id, i + 1, payload.contentType,
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
      console.error('[AdvAuthCommService] Error sending unsolicited communication:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async sendSolicitedCommunication(communicationRequestId, payloads, schemaName) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${schemaName}`);

      // Get CommunicationRequest with advanced auth data
      const crResult = await client.query(`
        SELECT cr.*, aa.id as aa_id, aa.identifier_value, aa.pre_auth_ref,
               aa.response_bundle, aa.patient_reference, aa.insurer_reference,
               aa.service_provider_reference
        FROM nphies_communication_requests cr
        LEFT JOIN advanced_authorizations aa ON cr.advanced_authorization_id = aa.id
        WHERE cr.id = $1
      `, [communicationRequestId]);

      if (crResult.rows.length === 0) {
        throw new Error('CommunicationRequest not found');
      }

      const commRequest = crResult.rows[0];
      const advAuthId = commRequest.aa_id || commRequest.advanced_authorization_id;

      // Extract entity data from the advanced auth
      let patient, provider, insurer, coverage;
      if (advAuthId) {
        const entities = await this.getAdvancedAuthWithEntities(client, advAuthId);
        patient = entities.patient;
        provider = entities.provider;
        insurer = entities.insurer;
        coverage = entities.coverage;
      } else {
        // Fallback if no advanced auth linked
        provider = {
          provider_id: NPHIES_CONFIG.DEFAULT_PROVIDER_ID,
          provider_name: 'Healthcare Provider',
          nphies_id: NPHIES_CONFIG.DEFAULT_PROVIDER_ID,
          provider_type: null,
          address: null
        };
        insurer = {
          insurer_id: null,
          insurer_name: 'Insurance Company',
          nphies_id: NPHIES_CONFIG.DEFAULT_INSURER_ID,
          address: null
        };
        patient = {
          patient_id: null, identifier: null, identifier_type: 'national_id',
          name: null, gender: null, birth_date: null, phone: null, address: null
        };
      }

      const authIdentifier = commRequest.identifier_value || commRequest.pre_auth_ref;
      const claimResponseBundle = commRequest.response_bundle;
      const requestIdentifier = claimResponseBundle?.request?.identifier?.value || authIdentifier;

      const communicationBundle = this.mapper.buildSolicitedCommunicationBundle({
        communicationRequest: {
          request_id: commRequest.request_id,
          about_reference: commRequest.about_reference,
          about_identifier: commRequest.about_identifier,
          about_identifier_system: commRequest.about_identifier_system,
          about_type: commRequest.about_type,
          cr_identifier: commRequest.cr_identifier,
          cr_identifier_system: commRequest.cr_identifier_system
        },
        priorAuth: {
          nphies_request_id: requestIdentifier,
          request_number: requestIdentifier,
          pre_auth_ref: commRequest.pre_auth_ref || authIdentifier
        },
        patient,
        provider,
        insurer,
        coverage,
        payloads
      });

      const nphiesResponse = await nphiesService.sendCommunication(communicationBundle);

      // Extract Communication ID
      const communicationResource = communicationBundle.entry?.find(
        e => e.resource?.resourceType === 'Communication'
      )?.resource;
      const communicationId = communicationResource?.id || randomUUID();

      // Extract acknowledgment
      let nphiesCommunicationId = null;
      let acknowledgmentReceived = false;
      let acknowledgmentStatus = null;

      if (nphiesResponse.data && nphiesResponse.data.entry) {
        const responseMessageHeader = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'MessageHeader'
        )?.resource;

        if (responseMessageHeader) {
          const metaTags = responseMessageHeader.meta?.tag || [];
          const isQueued = metaTags.some(
            tag => tag.code === 'queued-messages' ||
                   tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tags'
          );

          if (responseMessageHeader.response?.code) {
            if (isQueued) {
              acknowledgmentReceived = false;
              acknowledgmentStatus = 'queued';
            } else {
              acknowledgmentReceived = true;
              acknowledgmentStatus = responseMessageHeader.response.code;
            }
          }

          if (responseMessageHeader.id) {
            nphiesCommunicationId = responseMessageHeader.id;
          }
        }

        const responseCommunication = nphiesResponse.data.entry.find(
          e => e.resource?.resourceType === 'Communication'
        )?.resource;
        if (responseCommunication?.id) {
          nphiesCommunicationId = responseCommunication.id;
        }
      }

      // Store Communication
      const insertResult = await client.query(`
        INSERT INTO nphies_communications (
          communication_id, nphies_communication_id,
          prior_auth_id, claim_id, advanced_authorization_id,
          patient_id, communication_type, based_on_request_id,
          status, category, priority,
          about_reference, about_type, sender_identifier, recipient_identifier,
          sent_at, acknowledgment_received, acknowledgment_at, acknowledgment_status,
          request_bundle, response_bundle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `, [
        communicationId,
        nphiesCommunicationId,
        null, // prior_auth_id
        null, // claim_id
        advAuthId,
        null, // patient_id - advanced auth patients don't have local DB records
        'solicited',
        communicationRequestId,
        nphiesResponse.success ? 'completed' : 'entered-in-error',
        'alert',
        'routine',
        commRequest.about_reference,
        commRequest.about_type,
        provider.nphies_id,
        insurer.nphies_id,
        new Date(),
        acknowledgmentReceived,
        acknowledgmentReceived ? new Date() : null,
        acknowledgmentStatus,
        JSON.stringify(communicationBundle),
        nphiesResponse.data
          ? JSON.stringify(nphiesResponse.data)
          : nphiesResponse.error
            ? JSON.stringify({ _fallback: true, error: nphiesResponse.error, status: nphiesResponse.status })
            : null
      ]);

      const communication = insertResult.rows[0];

      // Store payloads
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        await client.query(`
          INSERT INTO nphies_communication_payloads (
            communication_id, sequence, content_type, content_string,
            attachment_content_type, attachment_data, attachment_url,
            attachment_title, claim_item_sequences
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          communication.id, i + 1, payload.contentType,
          payload.contentString || null,
          payload.attachment?.contentType || null,
          payload.attachment?.data || null,
          payload.attachment?.url || null,
          payload.attachment?.title || null,
          payload.claimItemSequences || null
        ]);
      }

      // Update CommunicationRequest as responded
      await client.query(`
        UPDATE nphies_communication_requests
        SET responded_at = NOW(), response_communication_id = $1
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
      console.error('[AdvAuthCommService] Error sending solicited communication:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // GET METHODS
  // ============================================================================

  async getCommunicationRequests(advAuthId, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);
      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_uuid,
               c.sent_at as response_sent_at
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        WHERE cr.advanced_authorization_id = $1
        ORDER BY cr.received_at DESC
      `, [advAuthId]);

      for (const row of result.rows) {
        row.payloads = this._extractPayloadsFromBundle(row.request_bundle);
      }

      return result.rows;
    } finally {
      client.release();
    }
  }

  _extractPayloadsFromBundle(requestBundle) {
    if (!requestBundle) return [];
    const bundle = typeof requestBundle === 'string' ? JSON.parse(requestBundle) : requestBundle;
    const fhirPayloads = bundle.payload || [];
    return fhirPayloads.map((p, idx) => {
      if (p.contentString) {
        return { index: idx, content_type: 'string', content_string: p.contentString };
      }
      if (p.contentAttachment) {
        const att = p.contentAttachment;
        return {
          index: idx,
          content_type: 'attachment',
          attachment_title: att.title || 'Attachment',
          attachment_content_type: att.contentType || 'application/octet-stream',
          attachment_size: att.data ? Math.round((att.data.length * 3) / 4) : att.size || null,
          attachment_creation: att.creation || null,
          has_data: !!att.data
        };
      }
      if (p.contentReference) {
        return { index: idx, content_type: 'reference', reference: p.contentReference.reference || p.contentReference };
      }
      return { index: idx, content_type: 'unknown' };
    });
  }

  async getCommunications(advAuthId, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);
      const result = await client.query(`
        SELECT c.*,
               cr.request_id as based_on_request_nphies_id,
               cr.payload_content_string as request_payload
        FROM nphies_communications c
        LEFT JOIN nphies_communication_requests cr ON c.based_on_request_id = cr.id
        WHERE c.advanced_authorization_id = $1
        ORDER BY c.created_at DESC
      `, [advAuthId]);

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

  async getCommunication(communicationId, schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);
      const isUUID = typeof communicationId === 'string' && communicationId.includes('-');

      const result = await client.query(`
        SELECT c.*,
               cr.request_id as based_on_request_nphies_id,
               cr.payload_content_string as request_payload
        FROM nphies_communications c
        LEFT JOIN nphies_communication_requests cr ON c.based_on_request_id = cr.id
        WHERE ${isUUID ? 'c.communication_id' : 'c.id'} = $1
      `, [communicationId]);

      if (result.rows.length === 0) return null;

      const comm = result.rows[0];
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

  // ============================================================================
  // ACKNOWLEDGMENT POLLING
  // ============================================================================

  async pollCommunicationAcknowledgment(advAuthId, communicationId, schemaName) {
    const client = await pool.connect();

    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Get the communication with provider info
      const commResult = await client.query(`
        SELECT c.*, aa.identifier_value
        FROM nphies_communications c
        LEFT JOIN advanced_authorizations aa ON c.advanced_authorization_id = aa.id
        WHERE c.communication_id = $1 AND c.advanced_authorization_id = $2
      `, [communicationId, advAuthId]);

      if (commResult.rows.length === 0) {
        throw new Error('Communication not found');
      }

      const comm = commResult.rows[0];

      if (comm.acknowledgment_received && comm.acknowledgment_status === 'ok') {
        return {
          success: true,
          alreadyAcknowledged: true,
          acknowledgmentStatus: comm.acknowledgment_status,
          message: 'Communication was already acknowledged'
        };
      }

      // Get provider for poll
      const provResult = await client.query(
        `SELECT nphies_id, provider_name FROM providers WHERE nphies_id = $1 LIMIT 1`,
        [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
      );
      const providerNphiesId = provResult.rows[0]?.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
      const providerName = provResult.rows[0]?.provider_name || 'Healthcare Provider';

      const pollBundle = this.mapper.buildPollRequestBundle(providerNphiesId, providerName);

      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error || 'Poll request failed',
          pollBundle,
          responseBundle: pollResponse.data
        };
      }

      const communications = nphiesService.extractCommunicationsFromPoll(pollResponse.data);

      let acknowledgmentFound = false;
      let acknowledgmentStatus = null;

      for (const respComm of communications) {
        const parsed = this.mapper.parseCommunication(respComm);

        if (parsed.inResponseTo) {
          const responseToId = this.mapper.extractIdFromReference(parsed.inResponseTo);

          if (responseToId === communicationId) {
            acknowledgmentFound = true;
            acknowledgmentStatus = parsed.status;

            await client.query(`
              UPDATE nphies_communications
              SET acknowledgment_received = TRUE,
                  acknowledgment_at = NOW(),
                  acknowledgment_status = $1,
                  acknowledgment_bundle = $2
              WHERE communication_id = $3
            `, [acknowledgmentStatus, JSON.stringify(respComm), communicationId]);

            break;
          }
        }
      }

      return {
        success: true,
        acknowledgmentFound,
        acknowledgmentStatus,
        pollBundle,
        responseBundle: pollResponse.data,
        message: acknowledgmentFound
          ? `Acknowledgment received: ${acknowledgmentStatus}`
          : 'No acknowledgment found. The message may still be processing.'
      };

    } catch (error) {
      console.error('[AdvAuthCommService] Error polling for acknowledgment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async pollAllQueuedAcknowledgments(advAuthId, schemaName) {
    const client = await pool.connect();

    try {
      await client.query(`SET search_path TO ${schemaName}`);

      const commsResult = await client.query(`
        SELECT c.communication_id
        FROM nphies_communications c
        WHERE c.advanced_authorization_id = $1
          AND (c.acknowledgment_status = 'queued' OR (c.acknowledgment_received = FALSE AND c.status = 'completed'))
      `, [advAuthId]);

      if (commsResult.rows.length === 0) {
        return {
          success: true,
          totalPolled: 0,
          acknowledged: 0,
          stillQueued: 0,
          results: [],
          message: 'No communications awaiting acknowledgment'
        };
      }

      const results = [];
      let acknowledged = 0;
      let stillQueued = 0;

      for (const row of commsResult.rows) {
        try {
          const pollResult = await this.pollCommunicationAcknowledgment(
            advAuthId, row.communication_id, schemaName
          );

          if (pollResult.acknowledgmentFound) acknowledged++;
          else if (!pollResult.alreadyAcknowledged) stillQueued++;

          results.push({ communicationId: row.communication_id, ...pollResult });
        } catch (err) {
          results.push({ communicationId: row.communication_id, success: false, error: err.message });
        }
      }

      return {
        success: true,
        totalPolled: commsResult.rows.length,
        acknowledged,
        stillQueued,
        results,
        message: `Polled ${commsResult.rows.length} communication(s): ${acknowledged} acknowledged, ${stillQueued} still queued`
      };

    } catch (error) {
      console.error('[AdvAuthCommService] Error polling all acknowledgments:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new AdvancedAuthCommunicationService();
