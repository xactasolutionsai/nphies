/**
 * Payment Reconciliation Routes
 * 
 * API endpoints for nphies Payment Reconciliation module
 */

import express from 'express';
import paymentReconciliationController from '../controllers/paymentReconciliationController.js';

const router = express.Router();

// POST /api/payment-reconciliation - Receive FHIR Bundle from insurer
router.post('/', paymentReconciliationController.receiveBundle.bind(paymentReconciliationController));

// POST /api/payment-reconciliation/simulate/:claimId - Simulate payment from approved claim (for testing)
router.post('/simulate/:claimId', paymentReconciliationController.simulatePayment.bind(paymentReconciliationController));

// POST /api/payment-reconciliation/poll - Poll NPHIES for pending payment messages
router.post('/poll', paymentReconciliationController.pollNphies.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/preview-simulate/:claimId - Preview simulate bundle (without saving)
router.get('/preview-simulate/:claimId', paymentReconciliationController.previewSimulate.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/preview-poll - Preview poll bundle (without sending)
router.get('/preview-poll', paymentReconciliationController.previewPoll.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/stats - Get dashboard statistics
router.get('/stats', paymentReconciliationController.getStats.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/claim/:claimId - Get reconciliations for a claim
router.get('/claim/:claimId', paymentReconciliationController.getByClaimId.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id/bundle - Get original FHIR bundle
router.get('/:id/bundle', paymentReconciliationController.getOriginalBundle.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id/acknowledgement - Get acknowledgement bundle
router.get('/:id/acknowledgement', paymentReconciliationController.getAcknowledgementBundle.bind(paymentReconciliationController));

// POST /api/payment-reconciliation/:id/acknowledge - Send Payment Notice to NPHIES
router.post('/:id/acknowledge', paymentReconciliationController.sendAcknowledgement.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id/preview-acknowledge - Preview Payment Notice bundle
router.get('/:id/preview-acknowledge', paymentReconciliationController.previewAcknowledgement.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id - Get single reconciliation with details
router.get('/:id', paymentReconciliationController.getById.bind(paymentReconciliationController));

// GET /api/payment-reconciliation - List all reconciliations
router.get('/', paymentReconciliationController.getAll.bind(paymentReconciliationController));

export default router;

