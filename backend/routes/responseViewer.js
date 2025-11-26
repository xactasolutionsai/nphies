import express from 'express';
import responseViewerController from '../controllers/responseViewerController.js';

const router = express.Router();

// ResponseViewer routes
router.get('/claims', responseViewerController.getClaims);
router.get('/authorizations', responseViewerController.getAuthorizations);
router.get('/eligibility', responseViewerController.getEligibility);
router.get('/payments', responseViewerController.getPayments);

export default router;
