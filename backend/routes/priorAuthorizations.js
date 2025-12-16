import express from 'express';
import priorAuthorizationsController from '../controllers/priorAuthorizationsController.js';

const router = express.Router();

/**
 * Prior Authorization Routes
 * 
 * Following the plan specification:
 * GET    /api/prior-authorizations              - List with pagination/filters
 * GET    /api/prior-authorizations/:id          - Get by ID
 * POST   /api/prior-authorizations              - Create new PA
 * PUT    /api/prior-authorizations/:id          - Update PA (draft)
 * DELETE /api/prior-authorizations/:id          - Delete draft PA
 * POST   /api/prior-authorizations/:id/send     - Send to NPHIES
 * POST   /api/prior-authorizations/:id/update   - Submit update request
 * POST   /api/prior-authorizations/:id/cancel   - Cancel authorization
 * POST   /api/prior-authorizations/:id/transfer - Transfer to provider
 * POST   /api/prior-authorizations/:id/poll     - Poll for response (changed to POST)
 * GET    /api/prior-authorizations/:id/bundle   - Get FHIR bundle preview
 * 
 * Communication Routes (Test Case #1 & #2):
 * POST   /api/prior-authorizations/:id/communication/unsolicited  - Send unsolicited Communication
 * POST   /api/prior-authorizations/:id/communication/solicited    - Send solicited Communication (response to CommunicationRequest)
 * GET    /api/prior-authorizations/:id/communication-requests     - Get CommunicationRequests from HIC
 * GET    /api/prior-authorizations/:id/communications             - Get sent Communications
 * GET    /api/prior-authorizations/:id/communications/:commId     - Get single Communication
 */

// Preview (must be before :id routes)
router.post('/preview', (req, res) => priorAuthorizationsController.previewBundle(req, res));

// Basic CRUD operations
router.get('/', (req, res) => priorAuthorizationsController.getAll(req, res));
router.get('/:id', (req, res) => priorAuthorizationsController.getById(req, res));
router.post('/', (req, res) => priorAuthorizationsController.create(req, res));
router.put('/:id', (req, res) => priorAuthorizationsController.update(req, res));
router.delete('/:id', (req, res) => priorAuthorizationsController.delete(req, res));

// NPHIES workflow operations
router.post('/:id/send', (req, res) => priorAuthorizationsController.sendToNphies(req, res));
router.post('/:id/update', (req, res) => priorAuthorizationsController.submitUpdate(req, res));
router.post('/:id/cancel', (req, res) => priorAuthorizationsController.cancel(req, res));
router.post('/:id/transfer', (req, res) => priorAuthorizationsController.transfer(req, res));

// Poll for response (POST to trigger NPHIES poll)
router.post('/:id/poll', (req, res) => priorAuthorizationsController.poll(req, res));

// FHIR bundle preview
router.get('/:id/bundle', (req, res) => priorAuthorizationsController.getBundle(req, res));

// ============================================================================
// COMMUNICATION ROUTES
// ============================================================================

// Preview Communication bundle (without sending)
// Returns the FHIR bundle that would be sent to NPHIES
router.post('/:id/communication/preview', (req, res) => 
  priorAuthorizationsController.previewCommunicationBundle(req, res)
);

// Send UNSOLICITED Communication (Test Case #1)
// HCP proactively sends additional information to HIC
router.post('/:id/communication/unsolicited', (req, res) => 
  priorAuthorizationsController.sendUnsolicitedCommunication(req, res)
);

// Send SOLICITED Communication (Test Case #2)
// HCP responds to CommunicationRequest from HIC
router.post('/:id/communication/solicited', (req, res) => 
  priorAuthorizationsController.sendSolicitedCommunication(req, res)
);

// Get CommunicationRequests from HIC (requests for additional info)
// Query param: ?pending=true to get only unanswered requests
router.get('/:id/communication-requests', (req, res) => 
  priorAuthorizationsController.getCommunicationRequests(req, res)
);

// Get sent Communications
router.get('/:id/communications', (req, res) => 
  priorAuthorizationsController.getCommunications(req, res)
);

// Get single Communication by ID
router.get('/:id/communications/:communicationId', (req, res) => 
  priorAuthorizationsController.getCommunication(req, res)
);

export default router;

