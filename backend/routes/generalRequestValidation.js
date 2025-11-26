import express from 'express';
import generalRequestValidationController from '../controllers/generalRequestValidationController.js';

const router = express.Router();

// POST /api/general-request/validate - Validate general request (diagnosis to scan)
router.post('/validate', generalRequestValidationController.validateGeneralRequest.bind(generalRequestValidationController));

// GET /api/general-request/health - Check validation service health
router.get('/health', generalRequestValidationController.checkHealth.bind(generalRequestValidationController));

export default router;

