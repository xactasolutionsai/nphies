import express from 'express';
import claimSubmissionsController from '../controllers/claimSubmissionsController.js';

const router = express.Router();

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

// FHIR bundle preview for existing claim
router.get('/:id/bundle', (req, res) => claimSubmissionsController.getBundle(req, res));

export default router;
