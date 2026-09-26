import pool, { query } from '../db.js';
import { connectWithSchema, releaseSchemaClient as releaseDbSchemaClient } from '../services/dbSchema.js';

/**
 * Map a parsed NPHIES ClaimResponse (priorAuthMapper/claimMapper parse output)
 * to the local record status. The adjudication-outcome extension is the
 * authoritative verdict; OperationOutcome / ClaimResponse.error / parse
 * failures are validation errors ('error'), never a denial.
 */
export function statusFromParsedResponse(parsed) {
  if (!parsed || parsed.outcome === 'error') return 'error';
  if (parsed.outcome === 'queued') return 'queued';
  switch (parsed.adjudicationOutcome) {
    case 'approved': return 'approved';
    case 'rejected': return 'denied';
    case 'partial': return 'partial';
    case 'pended': return 'queued';
    default: break;
  }
  if (parsed.errors?.length) return 'error';
  if (parsed.outcome === 'partial') return 'partial';
  return parsed.success ? 'approved' : 'error';
}

/**
 * Build a Content-Disposition header value that is safe for non-Latin-1
 * (e.g. Arabic) filenames: an ASCII fallback plus RFC 5987 filename*.
 */
export function contentDisposition(filename, type = 'attachment') {
  const name = String(filename || 'attachment').replace(/[\r\n]/g, ' ');
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'attachment';
  const encoded = encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;

/** Validate a tenant schema name taken from a request (400 for anything but a plain identifier). */
export function safeSchemaName(schemaName) {
  const name = schemaName || 'public';
  if (!SCHEMA_NAME.test(name)) {
    const error = new Error('Invalid schema name');
    error.status = 400;
    throw error;
  }
  return name;
}

/**
 * After a record was reserved as 'pending' for a send, any failure must put
 * it back into a resendable state and record why.
 */
export async function markSendFailed(table, id, error) {
  if (!['prior_authorizations', 'claim_submissions'].includes(table)) throw new Error('Invalid table');
  const reason = `Send failed: ${error?.message || 'unexpected error'}`.slice(0, 1000);
  try {
    await query(
      `UPDATE ${table} SET status = 'error', outcome = 'error', disposition = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending'`,
      [reason, id]
    );
  } catch (resetError) {
    console.error(`[${table}] Failed to reset pending status for ${id}:`, resetError.message);
  }
}

/** Parse JSON input, returning a fallback instead of throwing. */
export function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

const COMMUNICATION_REQUEST_OWNERS = ['prior_auth_id', 'claim_id', 'advanced_authorization_id'];

/**
 * Stream one attachment from a stored CommunicationRequest payload. The
 * request must belong to the parent record named in the route (:id).
 */
export async function sendCommunicationRequestAttachment(req, res, ownerColumn) {
  if (!COMMUNICATION_REQUEST_OWNERS.includes(ownerColumn)) throw new Error('Invalid owner column');
  try {
    const requestId = Number.parseInt(req.params.requestId, 10);
    const idx = Number.parseInt(req.params.payloadIndex, 10);
    if (!Number.isInteger(requestId) || !Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: 'Invalid communication request or payload index' });
    }
    const result = await query(
      `SELECT request_bundle FROM nphies_communication_requests WHERE id = $1 AND ${ownerColumn}::text = $2`,
      [requestId, String(req.params.id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Communication request not found' });
    }

    const bundle = safeJsonParse(result.rows[0].request_bundle);
    const payload = bundle?.payload?.[idx];
    if (!payload?.contentAttachment?.data) {
      return res.status(404).json({ error: 'Attachment not found at the specified payload index' });
    }

    const att = payload.contentAttachment;
    const buffer = Buffer.from(att.data, 'base64');
    const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(att.contentType || '') ? att.contentType : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(att.title || `attachment_${idx}`));
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('Error downloading communication request attachment:', error);
    return res.status(500).json({ error: 'Failed to download attachment' });
  }
}

/** Pharmacy device items carry no medication fields (shared by PA and claims). */
export function sanitizePharmacyDeviceFields(items, type) {
  if (type !== 'pharmacy' || !Array.isArray(items)) return;
  for (const item of items) {
    if ((item.item_type || 'medication') === 'device') {
      item.prescribed_medication_code = null;
      item.pharmacist_selection_reason = null;
      item.pharmacist_substitute = null;
      item.days_supply = null;
      item.medication_code = null;
      item.medication_name = null;
      item.medication_system = null;
    }
  }
}

/**
 * Check out a pooled client for a tenant schema. search_path is switched only
 * when a (validated) schema was actually requested, through services/dbSchema.js
 * (bound set_config value, never interpolated), and is reset before the client
 * goes back to the pool (releaseSchemaClient) so it never leaks to the next user
 * of that connection.
 */
export async function connectForSchema(schemaName) {
  if (!schemaName) return pool.connect();
  const client = await connectWithSchema(safeSchemaName(schemaName));
  client.schemaSwitched = true;
  return client;
}

export async function releaseSchemaClient(client) {
  if (!client.schemaSwitched) return client.release();
  client.schemaSwitched = false;
  return releaseDbSchemaClient(client);
}

/**
 * Treating practitioner for the mappers, from the practitioner_* columns (migration 067)
 * of a prior authorization / claim row or from preview form data. Returns null when no
 * practitioner was entered, so the mappers report the missing practitioner themselves.
 */
export function practitionerFromRecord(record) {
  if (!record) return null;
  const clean = value => (typeof value === 'string' ? value.trim() : value) || null;
  const practitioner = {
    license_number: clean(record.practitioner_license),
    name: clean(record.practitioner_name),
    specialty_code: clean(record.practitioner_specialty_code),
    identifier_type: clean(record.practitioner_identifier_type)
  };
  return Object.values(practitioner).some(Boolean) ? practitioner : null;
}

/**
 * Derive Claim sub_type from encounter_class following NPHIES rules
 * (shared so prior authorizations and claims stay consistent).
 */
export function subTypeFromEncounterClass(encounterClass, authType) {
  const subTypes = {
    inpatient: 'ip', outpatient: 'op', daycase: 'ip', emergency: 'emr',
    ambulatory: 'op', home: 'op', telemedicine: 'op'
  };
  // Default based on auth type if encounter class not found
  const defaultByAuthType = {
    institutional: 'ip', professional: 'op', pharmacy: 'op', dental: 'op', vision: 'op'
  };
  return subTypes[encounterClass] || defaultByAuthType[authType] || 'op';
}
