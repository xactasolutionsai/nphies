import express from 'express';
import advancedAuthorizationsController from '../controllers/advancedAuthorizationsController.js';

const router = express.Router();

/**
 * Advanced Authorization Routes
 * 
 * GET    /api/advanced-authorizations                                        - List all with pagination/filters
 * GET    /api/advanced-authorizations/poll/preview                           - Preview poll bundle (without sending)
 * POST   /api/advanced-authorizations/poll                                   - Poll NPHIES for new APAs
 * GET    /api/advanced-authorizations/:id                                    - Get by ID with full details
 * GET    /api/advanced-authorizations/:id/download                           - Download raw JSON
 * POST   /api/advanced-authorizations/:id/cancel                            - Cancel authorization via NPHIES
 * DELETE /api/advanced-authorizations/:id                                    - Delete record
 * 
 * Communication Routes:
 * POST   /api/advanced-authorizations/:id/communication/preview              - Preview communication bundle
 * POST   /api/advanced-authorizations/:id/communication/unsolicited          - Send unsolicited communication
 * POST   /api/advanced-authorizations/:id/communication/solicited            - Send solicited communication
 * GET    /api/advanced-authorizations/:id/communication-requests             - Get communication requests
 * GET    /api/advanced-authorizations/:id/communications                     - Get sent communications
 * GET    /api/advanced-authorizations/:id/communications/:commId             - Get single communication
 * POST   /api/advanced-authorizations/:id/communications/:commId/poll-acknowledgment  - Poll ack for one
 * POST   /api/advanced-authorizations/:id/communications/poll-all-acknowledgments     - Poll all acks
 */

// Poll preview and poll (must be before :id route to avoid conflict)
router.get('/poll/preview', (req, res) => advancedAuthorizationsController.previewPollBundle(req, res));
router.post('/poll', (req, res) => advancedAuthorizationsController.poll(req, res));

// CRUD operations
router.get('/', (req, res) => advancedAuthorizationsController.getAll(req, res));
router.get('/:id', (req, res) => advancedAuthorizationsController.getById(req, res));
router.get('/:id/download', (req, res) => advancedAuthorizationsController.downloadJson(req, res));
router.post('/:id/cancel', (req, res) => advancedAuthorizationsController.cancel(req, res));
router.delete('/:id', (req, res) => advancedAuthorizationsController.delete(req, res));

// Communication routes
router.post('/:id/communication/preview', (req, res) => advancedAuthorizationsController.previewCommunicationBundle(req, res));
router.post('/:id/communication/unsolicited', (req, res) => advancedAuthorizationsController.sendUnsolicitedCommunication(req, res));
router.post('/:id/communication/solicited', (req, res) => advancedAuthorizationsController.sendSolicitedCommunication(req, res));
router.get('/:id/communication-requests', (req, res) => advancedAuthorizationsController.getCommunicationRequests(req, res));
router.get('/:id/communication-requests/:requestId/attachment/:payloadIndex', (req, res) => advancedAuthorizationsController.downloadCommunicationRequestAttachment(req, res));
router.get('/:id/communications', (req, res) => advancedAuthorizationsController.getCommunications(req, res));
router.post('/:id/communications/poll-all-acknowledgments', (req, res) => advancedAuthorizationsController.pollAllQueuedAcknowledgments(req, res));
router.get('/:id/communications/:commId', (req, res) => advancedAuthorizationsController.getCommunicationById(req, res));
router.post('/:id/communications/:commId/poll-acknowledgment', (req, res) => advancedAuthorizationsController.pollCommunicationAcknowledgment(req, res));

export default router;
