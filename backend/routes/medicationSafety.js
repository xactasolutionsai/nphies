import express from 'express';
import medicationSafetyController from '../controllers/medicationSafetyController.js';

const router = express.Router();

// POST /api/medication-safety/check-interactions - Check drug interactions
router.post('/check-interactions', medicationSafetyController.checkInteractions.bind(medicationSafetyController));

// POST /api/medication-safety/analyze - Comprehensive safety analysis
router.post('/analyze', medicationSafetyController.analyzeSafety.bind(medicationSafetyController));

// POST /api/medication-safety/suggest - Get AI medication suggestions
router.post('/suggest', medicationSafetyController.suggestMedications.bind(medicationSafetyController));

// GET /api/medication-safety/health - Health check
router.get('/health', medicationSafetyController.checkHealth.bind(medicationSafetyController));

export default router;

