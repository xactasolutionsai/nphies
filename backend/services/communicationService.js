/**
 * NPHIES Communication Service
 * 
 * Business logic for handling NPHIES Communications.
 * Supports both:
 * - Test Case #1: Unsolicited Communication (HCP proactively sends info)
 * - Test Case #2: Solicited Communication (HCP responds to CommunicationRequest)
 */

import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';
import systemPollService from './systemPollService.js';
import { mapClaimResponseStatus } from './messageUpdater.js';
import { connectWithSchema, releaseSchemaClient, withSchemaClient } from './dbSchema.js';
import { sendAndRecordCommunication } from './communicationOutbox.js';

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
    const client = await connectWithSchema(schemaName);
    
    try {

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
            about_identifier: commRequest.about_identifier,
            about_identifier_system: commRequest.about_identifier_system,
            about_type: commRequest.about_type,
            cr_identifier: commRequest.cr_identifier,
            cr_identifier_system: commRequest.cr_identifier_system
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
      await releaseSchemaClient(client);
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
    try {
      // 1. Get Prior Authorization with related data and build the bundle.
      // NPHIES Communication requires full patient/provider/insurer data.
      const { priorAuth, communicationBundle } = await withSchemaClient(schemaName, async client => {
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
        return { priorAuth, communicationBundle };
      });

      // 2. Record, send (outside any transaction) and store the outcome
      return await sendAndRecordCommunication({
        schemaName,
        communicationBundle,
        payloads,
        record: {
          prior_auth_id: priorAuthId,
          patient_id: priorAuth.patient_id,
          communication_type: 'unsolicited',
          about_reference: `http://provider.com/Claim/${priorAuth.nphies_request_id || priorAuth.request_number}`,
          about_type: 'Claim',
          sender_identifier: priorAuth.provider_nphies_id,
          recipient_identifier: priorAuth.insurer_nphies_id
        },
        logPrefix: '[CommunicationService]'
      });

    } catch (error) {
      console.error('[CommunicationService] Error sending unsolicited communication:', error);
      throw error;
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
    try {
      // 1. Get CommunicationRequest with full patient/provider/insurer data and build the bundle
      const { commRequest, communicationBundle } = await withSchemaClient(schemaName, async client => {
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

        // Multiple solicited responses to the same CommunicationRequest are allowed
        // (responded_at is tracked for audit but does not block further responses)
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
        return { commRequest, communicationBundle };
      });

      // Identifiers only: the bundle carries patient data and base64 attachments.
      console.log('[CommunicationService] Sending solicited communication:', {
        communicationRequestId,
        requestId: commRequest.request_id,
        priorAuthId: commRequest.pa_id,
        payloadCount: payloads.length
      });

      // 2. Record, send (outside any transaction) and store the outcome
      return await sendAndRecordCommunication({
        schemaName,
        communicationBundle,
        payloads,
        communicationRequestId,
        record: {
          prior_auth_id: commRequest.pa_id,
          patient_id: commRequest.patient_id,
          communication_type: 'solicited',
          about_reference: commRequest.about_reference,
          about_type: commRequest.about_type,
          sender_identifier: commRequest.provider_nphies_id,
          recipient_identifier: commRequest.insurer_nphies_id
        },
        logPrefix: '[CommunicationService]'
      });

    } catch (error) {
      console.error('[CommunicationService] Error sending solicited communication:', error);
      throw error;
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
    const client = await connectWithSchema(schemaName);
    // Messages for other records; handed to the system poll path after release.
    const otherMessages = [];
    let results;
    let pollBundle;
    let pollResponse;
    
    try {
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
      const expectedSystem = `http://${providerDomain}/identifiers/authorization`;
      
      const pollOptions = {
        focus: {
          type: 'Claim',
          identifier: {
            system: expectedSystem,
            value: authReference
          }
        }
      };

      pollBundle = this.mapper.buildPollRequestBundle(
        priorAuth.provider_nphies_id,
        priorAuth.provider_name || 'Healthcare Provider',
        undefined, // providerType (not needed for poll)
        pollOptions
      );

      // 3. Send poll request
      pollResponse = await nphiesService.sendPriorAuthPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error,
          pollBundle
        };
      }

      // 4. Split the response into messages. Only ClaimResponses whose
      //    request.identifier is this authorization, and CommunicationRequests
      //    about it, are applied here; everything else goes to the system poll path.
      const authIdentifiers = new Set(
        [authReference, priorAuth.request_number, priorAuth.nphies_request_id, priorAuth.pre_auth_ref]
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(String)
      );
      const messages = systemPollService.extractPollMessages(pollResponse.data);
      const matchingClaimResponses = [];
      const unmatchedClaimResponses = [];
      const matchingCommunicationRequests = [];
      const communications = [];
      let totalClaimResponses = 0;

      for (const message of messages) {
        const resource = message.resource;
        if (resource?.resourceType === 'ClaimResponse') {
          totalClaimResponses++;
          const requestIdentifier = resource.request?.identifier?.value;
          const requestSystem = resource.request?.identifier?.system;
          if (requestIdentifier !== undefined && requestIdentifier !== null && authIdentifiers.has(String(requestIdentifier))) {
            matchingClaimResponses.push(resource);
          } else {
            otherMessages.push(message);
            unmatchedClaimResponses.push({
              id: resource.id,
              requestIdentifier,
              requestSystem,
              reason: !requestIdentifier ? 'No request identifier found' :
                     `Identifier value mismatch (expected "${authReference}", got "${requestIdentifier}")`
            });
          }
        } else if (resource?.resourceType === 'CommunicationRequest') {
          if (this.isAboutIdentifiers(resource, authIdentifiers)) {
            matchingCommunicationRequests.push(resource);
          } else {
            otherMessages.push(message);
          }
        } else if (resource?.resourceType === 'Communication') {
          communications.push(message);
        } else {
          otherMessages.push(message);
        }
      }

      results = {
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
          totalFound: totalClaimResponses,
          matched: matchingClaimResponses.length,
          unmatched: unmatchedClaimResponses.length,
          unmatchedDetails: unmatchedClaimResponses,
          pollIdentifier: {
            system: expectedSystem,
            value: authReference
          }
        }
      };

      // 5. Process only matching ClaimResponses (final authorization responses)
      for (const cr of matchingClaimResponses) {
        await client.query('BEGIN');
        try {
          const processed = await this.processClaimResponse(client, priorAuthId, cr);
          await client.query('COMMIT');
          results.claimResponses.push(processed);
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        }
      }

      // 6. Process CommunicationRequests about this authorization (HIC asking for info)
      for (const commReq of matchingCommunicationRequests) {
        const processed = await this.storeCommunicationRequest(client, priorAuthId, commReq);
        results.communicationRequests.push(processed);
      }

      // 7. Process Communications (acknowledgments); others go to the system path
      for (const message of communications) {
        const processed = await this.processAcknowledgment(client, message.resource);
        if (processed) {
          results.acknowledgments.push(processed);
        } else {
          otherMessages.push(message);
        }
      }

    } catch (error) {
      console.error('[CommunicationService] Error polling for messages:', error);
      throw error;
    } finally {
      await releaseSchemaClient(client);
    }

    results.otherMessages = await this.routeOtherMessages(
      otherMessages, pollBundle, pollResponse?.data, schemaName, `prior authorization #${priorAuthId} poll`
    );
    return results;
  }

  /** True when a CommunicationRequest/Communication.about[] references one of the identifiers. */
  isAboutIdentifiers(resource, identifiers) {
    return (resource?.about || []).some(about => {
      const identifierValue = about.identifier?.value;
      if (identifierValue !== undefined && identifierValue !== null && identifiers.has(String(identifierValue))) return true;
      const refId = this.mapper.extractIdFromReference(about.reference);
      return !!refId && identifiers.has(String(refId));
    });
  }

  /**
   * Hand messages that are not for this record to the system poll processing
   * path (correlator + updater) so they are not lost after leaving the queue.
   */
  async routeOtherMessages(messages, pollBundle, responseData, schemaName, source) {
    if (!messages.length) return { count: 0 };
    try {
      const routed = await systemPollService.processForeignMessages(messages, pollBundle, responseData, schemaName, source);
      return {
        count: messages.length,
        processed: routed.processed,
        matched: routed.matched,
        unmatched: routed.unmatched,
        pollLogId: routed.pollLogId,
        errors: routed.errors.length > 0 ? routed.errors : undefined
      };
    } catch (error) {
      console.error(`[CommunicationService] Could not route ${messages.length} message(s) from ${source}:`, error);
      return { count: messages.length, error: error.message };
    }
  }

  /**
   * Process ClaimResponse from poll
   * Updates Prior Authorization status and extracts full adjudication information
   */
  async processClaimResponse(client, priorAuthId, claimResponse) {
    // Same interpretation as the system poll: unclear responses stay 'pending' for
    // review, never defaulted to approved; "not approved" is a denial.
    const { status, outcome, adjudicationOutcome, needsReview } = mapClaimResponseStatus(claimResponse);

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
    const approvedAmount = totals.find(t => t.category === 'benefit')?.amount ??
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
      approvedAmount ?? null,
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
        const itemApprovedAmount = itemAdj.adjudication.find(a => a.category === 'benefit')?.amount ??
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
          itemApprovedAmount ?? null,
          adjudicationReason || null,
          priorAuthId,
          itemAdj.itemSequence
        ]);
      }
    }

    // Extract NPHIES validation errors from ClaimResponse.error[]
    // Mirrors the shape produced by the send path in BaseMapper.parsePriorAuthResponse
    // so the Details page can render { code, message, location } uniformly.
    const claimResponseErrors = (claimResponse.error || []).map(err => ({
      code: err.code?.coding?.[0]?.code,
      message: err.code?.coding?.[0]?.display,
      location: err.code?.coding?.[0]?.extension?.find(
        ext => ext.url?.includes('error-expression')
      )?.valueString
    }));
    const hasErrors = claimResponseErrors.length > 0;

    // Store poll response in prior_authorization_responses table
    await client.query(`
      INSERT INTO prior_authorization_responses 
      (prior_auth_id, response_type, outcome, disposition, pre_auth_ref, 
       bundle_json, has_errors, errors, is_nphies_generated, nphies_response_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      priorAuthId,
      'poll',
      outcome,
      claimResponse.disposition || null,
      claimResponse.preAuthRef || null,
      JSON.stringify(claimResponse),
      hasErrors,
      hasErrors ? JSON.stringify(claimResponseErrors) : null,
      true,
      claimResponse.id || null
    ]);

    return {
      id: claimResponse.id,
      outcome,
      status,
      adjudicationOutcome,
      needsReview,
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

    // Extract claim_id when the request is about a Claim. NPHIES may send the
    // about as an identifier only (no reference), so use either form.
    let claimId = null;
    const aboutIsClaim = parsed.aboutType === 'Claim' || (!parsed.aboutType && parsed.aboutIdentifier);
    if (aboutIsClaim && (parsed.aboutIdentifier || parsed.aboutReference)) {
      try {
        // Identifier value first; otherwise the id part of "Claim/{identifier}"
        let identifierValue = parsed.aboutIdentifier || parsed.aboutReference;
        
        // If it's a reference string like "Claim/{id}", extract the ID part
        if (!parsed.aboutIdentifier && typeof identifierValue === 'string' && identifierValue.includes('/')) {
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
        console.warn(`[CommunicationService] Could not extract claim_id from about: ${parsed.aboutIdentifier || parsed.aboutReference}`, error);
        // Continue without claim_id if lookup fails
      }
    }

    // Store in database (include claim_id and identifier fields when available)
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
        about_identifier,
        about_identifier_system,
        cr_identifier,
        cr_identifier_system,
        payload_content_type,
        payload_content_string,
        sender_identifier,
        recipient_identifier,
        authored_on,
        request_bundle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      parsed.aboutIdentifier || null,
      parsed.aboutIdentifierSystem || null,
      parsed.identifier || null,
      parsed.identifierSystem || null,
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
    try {
      // 1. Get the Communication record
      const communication = await withSchemaClient(schemaName, async client => {
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
        return commResult.rows[0] || null;
      });

      if (!communication) {
        throw new Error('Communication not found');
      }

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

      // 4. Send poll request to NPHIES (no database client held during the call)
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        return {
          success: false,
          error: pollResponse.error,
          pollBundle: pollBundle,  // Return the Bundle for debugging
          message: 'Poll request failed'
        };
      }

      // 5. Find the acknowledgment for our communication. Every other message in
      //    the response is handed to the system poll path instead of being dropped.
      const messages = systemPollService.extractPollMessages(pollResponse.data);
      const otherMessages = [];
      let acknowledgmentData = null;
      let communicationsInPoll = 0;

      for (const message of messages) {
        const comm = message.resource;
        let isOurAck = false;
        if (comm?.resourceType === 'Communication') {
          communicationsInPoll++;
          const parsed = this.mapper.parseCommunication(comm);
          const referencedId = parsed.inResponseTo ? this.mapper.extractIdFromReference(parsed.inResponseTo) : null;
          if (!acknowledgmentData && referencedId === communication.communication_id) {
            isOurAck = true;
            acknowledgmentData = { status: parsed.status, bundle: comm };
          }
        }
        if (!isOurAck) otherMessages.push(message);
      }

      console.log(`[CommunicationService] Poll returned ${messages.length} message(s), ${communicationsInPoll} communication(s)`);

      // 6. Update database if acknowledgment found
      if (acknowledgmentData) {
        await withSchemaClient(schemaName, client => client.query(`
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
        ]));
      }

      const routed = await this.routeOtherMessages(
        otherMessages, pollBundle, pollResponse.data, schemaName, `communication #${communicationDbId} acknowledgment poll`
      );

      if (acknowledgmentData) {
        return {
          success: true,
          acknowledgmentFound: true,
          acknowledgmentStatus: acknowledgmentData.status || 'ok',
          acknowledgmentAt: new Date(),
          otherMessages: routed,
          pollBundle: pollBundle,  // The full Bundle sent to NPHIES
          responseBundle: pollResponse.data,
          message: 'Acknowledgment received and saved'
        };
      }

      // 7. No acknowledgment found yet
      return {
        success: true,
        acknowledgmentFound: false,
        currentStatus: communication.acknowledgment_status,
        otherMessages: routed,
        pollBundle: pollBundle,  // The full Bundle sent to NPHIES
        responseBundle: pollResponse.data,
        communicationsInPoll,
        message: 'No acknowledgment found yet. The insurer may not have responded.'
      };

    } catch (error) {
      console.error('[CommunicationService] Error polling for acknowledgment:', error);
      throw error;
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
    try {
      // 1. Get all queued communications for this prior auth. The client is
      //    released before the per-communication polls (which take their own).
      const queued = await withSchemaClient(schemaName, async client => {
        const queuedResult = await client.query(`
          SELECT id, communication_id, acknowledgment_status
          FROM nphies_communications
          WHERE prior_auth_id = $1
            AND (acknowledgment_status = 'queued' OR acknowledgment_received = FALSE)
          ORDER BY sent_at DESC
        `, [priorAuthId]);
        return queuedResult.rows;
      });

      if (queued.length === 0) {
        return {
          success: true,
          queuedCount: 0,
          results: [],
          message: 'No queued communications to poll'
        };
      }

      console.log(`[CommunicationService] Found ${queued.length} queued communication(s) to poll`);

      // 2. Poll for each queued communication
      const results = [];
      for (const comm of queued) {
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
        queuedCount: queued.length,
        acknowledgedCount: acknowledged,
        stillQueuedCount: stillQueued,
        results,
        message: `Polled ${queued.length} communication(s): ${acknowledged} acknowledged, ${stillQueued} still queued`
      };

    } catch (error) {
      console.error('[CommunicationService] Error polling for all queued acknowledgments:', error);
      throw error;
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
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT *
        FROM nphies_communication_requests
        WHERE prior_auth_id = $1
          AND responded_at IS NULL
        ORDER BY received_at DESC
      `, [priorAuthId]);

      return result.rows;

    } finally {
      await releaseSchemaClient(client);
    }
  }

  /**
   * Get all CommunicationRequests for a Prior Authorization
   */
  async getCommunicationRequests(priorAuthId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

      const result = await client.query(`
        SELECT cr.*,
               c.communication_id as response_communication_uuid,
               c.sent_at as response_sent_at
        FROM nphies_communication_requests cr
        LEFT JOIN nphies_communications c ON cr.response_communication_id = c.id
        WHERE cr.prior_auth_id = $1
        ORDER BY cr.received_at DESC
      `, [priorAuthId]);

      for (const row of result.rows) {
        row.payloads = this._extractPayloadsFromBundle(row.request_bundle);
      }

      return result.rows;

    } finally {
      await releaseSchemaClient(client);
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

  /**
   * Get all Communications sent for a Prior Authorization
   */
  async getCommunications(priorAuthId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

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
      await releaseSchemaClient(client);
    }
  }

  /**
   * Get a single Communication by ID (supports both integer DB id and UUID communication_id)
   */
  async getCommunication(communicationId, schemaName) {
    const client = await connectWithSchema(schemaName);
    
    try {

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
      await releaseSchemaClient(client);
    }
  }
}

export default new CommunicationService();

