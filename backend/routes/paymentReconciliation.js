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

// GET /api/payment-reconciliation/stats - Get dashboard statistics
router.get('/stats', paymentReconciliationController.getStats.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/claim/:claimId - Get reconciliations for a claim
router.get('/claim/:claimId', paymentReconciliationController.getByClaimId.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id/bundle - Get original FHIR bundle
router.get('/:id/bundle', paymentReconciliationController.getOriginalBundle.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id/acknowledgement - Get acknowledgement bundle
router.get('/:id/acknowledgement', paymentReconciliationController.getAcknowledgementBundle.bind(paymentReconciliationController));

// GET /api/payment-reconciliation/:id - Get single reconciliation with details
router.get('/:id', paymentReconciliationController.getById.bind(paymentReconciliationController));

// GET /api/payment-reconciliation - List all reconciliations
router.get('/', paymentReconciliationController.getAll.bind(paymentReconciliationController));

export default router;

