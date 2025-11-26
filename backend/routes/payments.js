import express from 'express';
import paymentsController from '../controllers/paymentsController.js';

const router = express.Router();

// GET /api/payments - Get all payments with pagination and search
router.get('/', paymentsController.getAll.bind(paymentsController));

// GET /api/payments/stats - Get payment statistics
router.get('/stats', paymentsController.getStats.bind(paymentsController));

// GET /api/payments/insurer/:insurerId - Get payments by insurer
router.get('/insurer/:insurerId', paymentsController.getByInsurer.bind(paymentsController));

// GET /api/payments/:id - Get payment by ID with full details
router.get('/:id', paymentsController.getById.bind(paymentsController));

// POST /api/payments - Create new payment
router.post('/', paymentsController.create.bind(paymentsController));

// PUT /api/payments/:id - Update payment
router.put('/:id', paymentsController.update.bind(paymentsController));

// PATCH /api/payments/:id - Update payment details
router.patch('/:id', paymentsController.updatePayment.bind(paymentsController));

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', paymentsController.delete.bind(paymentsController));

export default router;
