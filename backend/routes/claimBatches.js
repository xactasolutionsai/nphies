import express from 'express';
import claimBatchesController from '../controllers/claimBatchesController.js';

const router = express.Router();

// ============================================
// GET ROUTES
// ============================================

// GET /api/claim-batches - Get all claim batches with pagination and search
router.get('/', claimBatchesController.getAll.bind(claimBatchesController));

// GET /api/claim-batches/stats - Get claim batch statistics
router.get('/stats', claimBatchesController.getStats.bind(claimBatchesController));

// GET /api/claim-batches/available-claims - Get claims available for batch creation
router.get('/available-claims', claimBatchesController.getAvailableClaims.bind(claimBatchesController));

// GET /api/claim-batches/:id - Get claim batch by ID with full details
router.get('/:id', claimBatchesController.getById.bind(claimBatchesController));

// GET /api/claim-batches/:id/bundle - Preview FHIR bundle for batch
router.get('/:id/bundle', claimBatchesController.previewBundle.bind(claimBatchesController));

// ============================================
// POST ROUTES
// ============================================

// Batches are created only via POST /create (validated items); the legacy generic
// POST / and PUT /:id BaseController routes were removed (wrong schema, no draft guard).

// POST /api/claim-batches/create - Create batch from selected claims
router.post('/create', claimBatchesController.createBatch.bind(claimBatchesController));

// POST /api/claim-batches/:id/send - Submit batch to NPHIES
router.post('/:id/send', claimBatchesController.sendToNphies.bind(claimBatchesController));

// POST /api/claim-batches/:id/poll - Poll for deferred responses
router.post('/:id/poll', claimBatchesController.pollResponses.bind(claimBatchesController));

// POST /api/claim-batches/:id/recalculate - Recalculate batch statistics from response_bundle
router.post('/:id/recalculate', claimBatchesController.recalculateStatistics.bind(claimBatchesController));

// POST /api/claim-batches/:id/add-claims - Add claims to existing batch
router.post('/:id/add-claims', claimBatchesController.addClaimsToBatch.bind(claimBatchesController));

// POST /api/claim-batches/:id/remove-claims - Remove claims from batch
router.post('/:id/remove-claims', claimBatchesController.removeClaimsFromBatch.bind(claimBatchesController));

// ============================================
// PATCH ROUTES
// ============================================

// PATCH /api/claim-batches/:id/status - Update claim batch status
router.patch('/:id/status', claimBatchesController.updateStatus.bind(claimBatchesController));

// ============================================
// DELETE ROUTES
// ============================================

// DELETE /api/claim-batches/:id - Delete claim batch
router.delete('/:id', claimBatchesController.delete.bind(claimBatchesController));

export default router;
