import express from 'express';
import claimsController from '../controllers/claimsController.js';

const router = express.Router();

// GET /api/claims - Get all claims with pagination and search
router.get('/', claimsController.getAll.bind(claimsController));

// GET /api/claims/stats - Get claims statistics
router.get('/stats', claimsController.getStats.bind(claimsController));

// GET /api/claims/:id - Get claim by ID with full details
router.get('/:id', claimsController.getById.bind(claimsController));

// POST /api/claims - Create new claim
router.post('/', claimsController.create.bind(claimsController));

// PUT /api/claims/:id - Update claim
router.put('/:id', claimsController.update.bind(claimsController));

// PATCH /api/claims/:id/status - Update claim status
router.patch('/:id/status', claimsController.updateStatus.bind(claimsController));

// DELETE /api/claims/:id - Delete claim
router.delete('/:id', claimsController.delete.bind(claimsController));

export default router;
