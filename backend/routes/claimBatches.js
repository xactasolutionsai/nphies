import express from 'express';
import claimBatchesController from '../controllers/claimBatchesController.js';

const router = express.Router();

// GET /api/claim-batches - Get all claim batches with pagination and search
router.get('/', claimBatchesController.getAll.bind(claimBatchesController));

// GET /api/claim-batches/stats - Get claim batch statistics
router.get('/stats', claimBatchesController.getStats.bind(claimBatchesController));

// GET /api/claim-batches/:id - Get claim batch by ID with full details
router.get('/:id', claimBatchesController.getById.bind(claimBatchesController));

// POST /api/claim-batches - Create new claim batch
router.post('/', claimBatchesController.create.bind(claimBatchesController));

// PUT /api/claim-batches/:id - Update claim batch
router.put('/:id', claimBatchesController.update.bind(claimBatchesController));

// PATCH /api/claim-batches/:id/status - Update claim batch status
router.patch('/:id/status', claimBatchesController.updateStatus.bind(claimBatchesController));

// DELETE /api/claim-batches/:id - Delete claim batch
router.delete('/:id', claimBatchesController.delete.bind(claimBatchesController));

export default router;
