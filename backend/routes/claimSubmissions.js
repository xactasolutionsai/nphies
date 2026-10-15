import express from 'express';
import claimSubmissionsController from '../controllers/claimSubmissionsController.js';
import { reviewClaim } from '../services/claimReviewService.js';
import { buildGrouperInput } from '../services/grouperInputService.js';

const router = express.Router();
const reviewing = new Set();
router.get('/:id/grouper-input', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({error:'Authentication required'});
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid claim id'});
  res.set('Cache-Control','no-store');
  try {
    const claim=await claimSubmissionsController.getByIdInternal(req.params.id);
    if (!claim) return res.status(404).json({error:'Claim not found'});
    res.json({data:buildGrouperInput(claim)});
  } catch(error) {
    if(error.status===422) return res.status(422).json({error:error.message,validation:error.validation});
    res.status(500).json({error:'تعذر تجهيز مدخلات Grouper.'});
  }
});
router.post('/:id/assistant-review', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
  if (!/^\d+$/.test(req.params.id) || Object.keys(req.body || {}).some(k => !['useModel', 'reviewMode'].includes(k)) || (req.body?.useModel !== undefined && typeof req.body.useModel !== 'boolean') || (req.body?.reviewMode !== undefined && !['assistant', 'clinical'].includes(req.body.reviewMode))) return res.status(400).json({ error: 'Invalid review input' });
  if (reviewing.has(req.user.id)) return res.status(429).json({ error: 'المراجعة قيد التنفيذ؛ انتظر النتيجة.' });
  reviewing.add(req.user.id);
  try {
    const claim = await claimSubmissionsController.getByIdInternal(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json({ data: await reviewClaim(claim, { useModel: req.body?.useModel === true, reviewMode: req.body?.reviewMode || 'assistant' }) });
  } catch { res.status(503).json({ error: 'تعذرت المراجعة الآن. لم تتغير المطالبة.' }); }
  finally { reviewing.delete(req.user.id); }
});

/**
 * Claim Submission Routes
 * 
 * Endpoints for NPHIES Claim submissions (use: "claim")
 * 
 * GET    /api/claim-submissions              - List with pagination/filters
 * GET    /api/claim-submissions/:id          - Get by ID with items, diagnoses, etc
 * POST   /api/claim-submissions              - Create new claim
 * POST   /api/claim-submissions/from-pa/:paId - Create claim from approved PA
 * PUT    /api/claim-submissions/:id          - Update claim (draft/error only)
 * DELETE /api/claim-submissions/:id          - Delete draft claim
 * POST   /api/claim-submissions/:id/send     - Send to NPHIES
 * GET    /api/claim-submissions/:id/bundle   - Get FHIR bundle
 * POST   /api/claim-submissions/preview      - Preview FHIR bundle from form data
 */

// Preview (must be before :id routes)
router.post('/preview', (req, res) => claimSubmissionsController.previewBundle(req, res));

// Create claim from approved Prior Authorization
router.post('/from-pa/:paId', (req, res) => claimSubmissionsController.createFromPriorAuth(req, res));

// Basic CRUD operations
router.get('/', (req, res) => claimSubmissionsController.getAll(req, res));
router.get('/:id', (req, res) => claimSubmissionsController.getById(req, res));
router.post('/', (req, res) => claimSubmissionsController.create(req, res));
router.put('/:id', (req, res) => claimSubmissionsController.update(req, res));
router.delete('/:id', (req, res) => claimSubmissionsController.delete(req, res));

// NPHIES workflow operations
router.post('/:id/send', (req, res) => claimSubmissionsController.sendToNphies(req, res));
router.post('/:id/cancel', (req, res) => claimSubmissionsController.cancel(req, res));

// FHIR bundle preview for existing claim
router.get('/:id/bundle', (req, res) => claimSubmissionsController.getBundle(req, res));
router.get('/:id/drg-audit', (req, res) => claimSubmissionsController.getDrgAudit(req, res));

// ============================================================================
// Communication Routes - Status Check, Poll, and Communications
// ============================================================================

/**
 * Preview Status Check Bundle (without sending)
 * GET /api/claim-submissions/:id/status-check/preview
 * 
 * Returns the status-check FHIR bundle for review/copy before sending.
 */
router.get('/:id/status-check/preview', (req, res) => claimSubmissionsController.previewStatusCheck(req, res));

/**
 * Status Check - Check processing status of a queued/pended claim
 * POST /api/claim-submissions/:id/status-check
 * 
 * Sends a status-check message to NPHIES to request current processing status.
 * Use this when a claim is in queued/pended status.
 */
router.post('/:id/status-check', (req, res) => claimSubmissionsController.sendStatusCheck(req, res));

/**
 * Poll - Retrieve pending messages for a claim
 * POST /api/claim-submissions/:id/poll
 * 
 * Polls NPHIES for:
 * - ClaimResponse (final adjudicated response)
 * - CommunicationRequest (HIC needs more info - CONDITIONAL)
 * - Communication acknowledgments
 * 
 * Note: CommunicationRequest is conditional - may or may not be received
 * depending on whether HIC needs additional information.
 */
router.post('/:id/poll', (req, res) => claimSubmissionsController.pollMessages(req, res));

/**
 * Send Unsolicited Communication
 * POST /api/claim-submissions/:id/communication/unsolicited
 * 
 * HCP proactively sends additional information to HIC.
 * Body: { payloads: [{ contentType: 'string'|'attachment', ... }] }
 */
router.post('/:id/communication/unsolicited', (req, res) => claimSubmissionsController.sendUnsolicitedCommunication(req, res));

/**
 * Send Solicited Communication
 * POST /api/claim-submissions/:id/communication/solicited
 * 
 * HCP responds to a CommunicationRequest from HIC.
 * Body: { communicationRequestId: number, payloads: [...] }
 */
router.post('/:id/communication/solicited', (req, res) => claimSubmissionsController.sendSolicitedCommunication(req, res));

/**
 * Get Communication Requests
 * GET /api/claim-submissions/:id/communication-requests
 * 
 * Get all CommunicationRequests received from HIC for this claim.
 * Query: ?pending=true to get only pending (unanswered) requests
 */
router.get('/:id/communication-requests', (req, res) => claimSubmissionsController.getCommunicationRequests(req, res));
router.get('/:id/communication-requests/:requestId/attachment/:payloadIndex', (req, res) => claimSubmissionsController.downloadCommunicationRequestAttachment(req, res));

/**
 * Get Communications
 * GET /api/claim-submissions/:id/communications
 * 
 * Get all Communications sent for this claim (both solicited and unsolicited).
 */
router.get('/:id/communications', (req, res) => claimSubmissionsController.getCommunications(req, res));

/**
 * Preview Communication Bundle (without sending)
 * POST /api/claim-submissions/:id/communication/preview
 * 
 * Returns the exact FHIR bundle that would be sent to NPHIES.
 * Body: { payloads: [...], type: 'unsolicited'|'solicited', communicationRequestId?: number }
 */
router.post('/:id/communication/preview', (req, res) => claimSubmissionsController.previewCommunicationBundle(req, res));

/**
 * Poll for acknowledgment of a specific Communication
 * POST /api/claim-submissions/:id/communications/:communicationId/poll-acknowledgment
 * 
 * Use when communication has acknowledgment_status = 'queued'
 */
router.post('/:id/communications/:communicationId/poll-acknowledgment', (req, res) => claimSubmissionsController.pollCommunicationAcknowledgment(req, res));

/**
 * Poll for all queued acknowledgments
 * POST /api/claim-submissions/:id/communications/poll-all-acknowledgments
 * 
 * Polls NPHIES for acknowledgments of all communications with status = 'queued'
 */
router.post('/:id/communications/poll-all-acknowledgments', (req, res) => claimSubmissionsController.pollAllQueuedAcknowledgments(req, res));

export default router;
