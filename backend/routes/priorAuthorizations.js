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
 * GET    /api/prior-authorizations/:id/poll     - Poll for response
 * GET    /api/prior-authorizations/:id/bundle   - Get FHIR bundle preview
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
router.get('/:id/poll', (req, res) => priorAuthorizationsController.poll(req, res));

// FHIR bundle preview
router.get('/:id/bundle', (req, res) => priorAuthorizationsController.getBundle(req, res));

export default router;

