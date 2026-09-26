/**
 * Outbound NPHIES Communication recording, shared by the prior-auth, claim and
 * advanced-authorization communication services.
 *
 * The outbound record is committed BEFORE the HTTP call and updated after it, and
 * no database transaction is held open while NPHIES is contacted. A later DB
 * failure can therefore never erase the only record of a message that NPHIES has
 * already received (previously the send happened inside BEGIN ... COMMIT and a
 * ROLLBACK discarded it).
 */

import { randomUUID } from 'crypto';
import nphiesService from './nphiesService.js';
import { withSchemaTransaction } from './dbSchema.js';

/**
 * Read the synchronous acknowledgment NPHIES returns for a Communication.
 * A 'queued-messages' meta tag means NPHIES stored the message for later delivery,
 * so the acknowledgment still has to be polled.
 */
export function extractCommunicationAcknowledgment(nphiesResponse) {
  let nphiesCommunicationId = null;
  let acknowledgmentReceived = false;
  let acknowledgmentStatus = null;
  let isQueued = false;

  const entries = nphiesResponse?.data?.entry;
  if (Array.isArray(entries)) {
    const header = entries.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
    if (header) {
      const metaTags = header.meta?.tag || [];
      isQueued = metaTags.some(
        tag => tag.code === 'queued-messages' ||
               tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tags'
      );
      if (header.response?.code) {
        if (isQueued) {
          acknowledgmentStatus = 'queued';
        } else {
          acknowledgmentReceived = true;
          acknowledgmentStatus = header.response.code; // 'ok', 'transient-error', 'fatal-error'
        }
      }
      if (header.id) nphiesCommunicationId = header.id;
    }
    const responseCommunication = entries.find(e => e.resource?.resourceType === 'Communication')?.resource;
    if (responseCommunication?.id) nphiesCommunicationId = responseCommunication.id;
  }

  return { nphiesCommunicationId, acknowledgmentReceived, acknowledgmentStatus, isQueued };
}

/**
 * Persist, send and finalize one outbound Communication.
 *
 * @param {Object} options
 * @param {string} options.schemaName
 * @param {Object} options.communicationBundle - the FHIR message bundle to send
 * @param {Array} options.payloads - payload objects as received from the API
 * @param {Object} options.record - nphies_communications column values:
 *   prior_auth_id, claim_id, advanced_authorization_id, patient_id,
 *   communication_type ('unsolicited'|'solicited'), about_reference, about_type,
 *   sender_identifier, recipient_identifier
 * @param {number|null} [options.communicationRequestId] - for solicited replies
 * @param {string} [options.logPrefix]
 * @returns {Promise<Object>} same shape the services returned before
 */
export async function sendAndRecordCommunication({
  schemaName, communicationBundle, payloads, record, communicationRequestId = null, logPrefix = '[Communication]'
}) {
  const communicationResource = communicationBundle.entry?.find(
    e => e.resource?.resourceType === 'Communication'
  )?.resource;
  const communicationId = communicationResource?.id || randomUUID();

  // 1. Record the outbound message before it leaves the system.
  const communication = await withSchemaTransaction(schemaName, async client => {
    const insertResult = await client.query(`
      INSERT INTO nphies_communications (
        communication_id, prior_auth_id, claim_id, advanced_authorization_id, patient_id,
        communication_type, based_on_request_id, status, category, priority,
        about_reference, about_type, sender_identifier, recipient_identifier,
        acknowledgment_received, request_bundle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'in-progress', $13, 'routine', $8, $9, $10, $11, FALSE, $12)
      RETURNING *
    `, [
      communicationId,
      record.prior_auth_id ?? null,
      record.claim_id ?? null,
      record.advanced_authorization_id ?? null,
      record.patient_id ?? null,
      record.communication_type,
      communicationRequestId,
      record.about_reference ?? null,
      record.about_type ?? null,
      record.sender_identifier ?? null,
      record.recipient_identifier ?? null,
      JSON.stringify(communicationBundle),
      // Store the category actually sent in the bundle (was always 'alert')
      communicationResource?.category?.[0]?.coding?.[0]?.code || 'alert'
    ]);
    const row = insertResult.rows[0];

    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i];
      await client.query(`
        INSERT INTO nphies_communication_payloads (
          communication_id, sequence, content_type, content_string,
          attachment_content_type, attachment_data, attachment_url,
          attachment_title, claim_item_sequences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        row.id,
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
    return row;
  });

  // 2. Send, with no database transaction or pooled client held open.
  let nphiesResponse;
  let deliveryUnknown = false;
  try {
    nphiesResponse = await nphiesService.sendCommunication(communicationBundle);
  } catch (error) {
    deliveryUnknown = true;
    nphiesResponse = { success: false, status: null, data: null, error: error.message };
  }
  console.log(`${logPrefix} NPHIES response:`, {
    success: nphiesResponse.success,
    status: nphiesResponse.status,
    hasData: !!nphiesResponse.data
  });

  const ack = extractCommunicationAcknowledgment(nphiesResponse);
  const status = nphiesResponse.success ? 'completed' : deliveryUnknown ? 'unknown' : 'entered-in-error';
  const responseBundle = nphiesResponse.data
    ? nphiesResponse.data
    : nphiesResponse.error
      ? { _fallback: true, error: nphiesResponse.error, status: nphiesResponse.status, message: 'NPHIES returned no response bundle' }
      : null;

  // 3. Record the outcome. If this fails the outbound row (with its request
  //    bundle) is still there, so the delivery is never lost.
  let finalRow = communication;
  let recordUpdateError = null;
  try {
    finalRow = await withSchemaTransaction(schemaName, async client => {
      const updated = await client.query(`
        UPDATE nphies_communications
        SET nphies_communication_id = $1,
            status = $2,
            sent_at = NOW(),
            acknowledgment_received = $3,
            acknowledgment_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
            acknowledgment_status = $4,
            response_bundle = $5
        WHERE id = $6
        RETURNING *
      `, [
        ack.nphiesCommunicationId,
        status,
        ack.acknowledgmentReceived,
        ack.acknowledgmentStatus,
        responseBundle ? JSON.stringify(responseBundle) : null,
        communication.id
      ]);

      if (communicationRequestId && nphiesResponse.success) {
        await client.query(`
          UPDATE nphies_communication_requests
          SET responded_at = NOW(),
              response_communication_id = $1
          WHERE id = $2
        `, [communication.id, communicationRequestId]);
      }
      return updated.rows[0] || communication;
    });
  } catch (error) {
    recordUpdateError = error.message;
    console.error(`${logPrefix} Communication ${communicationId} was sent but its result could not be saved:`, error.message);
  }

  console.log(`${logPrefix} Communication ${communicationId}: status=${status}, ack=${ack.acknowledgmentStatus || 'none'}`);

  return {
    success: nphiesResponse.success,
    communication: {
      id: finalRow.id,
      communicationId: finalRow.communication_id,
      type: record.communication_type,
      ...(communicationRequestId ? { basedOnRequestId: communicationRequestId } : {}),
      status: recordUpdateError ? status : finalRow.status,
      sentAt: finalRow.sent_at,
      payloadCount: payloads.length
    },
    nphiesResponse: {
      status: nphiesResponse.status,
      success: nphiesResponse.success,
      error: nphiesResponse.error
    },
    ...(recordUpdateError ? { warning: `Sent, but the delivery result could not be saved: ${recordUpdateError}` } : {})
  };
}
