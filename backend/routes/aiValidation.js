import express from 'express';
import aiValidationController from '../controllers/aiValidationController.js';

const router = express.Router();

// POST /api/ai-validation/validate-eye-form - Validate eye approval form
router.post('/validate-eye-form', aiValidationController.validateEyeForm.bind(aiValidationController));

// GET /api/ai-validation/history/:formId - Get validation history for a form
router.get('/history/:formId', aiValidationController.getValidationHistory.bind(aiValidationController));

// POST /api/ai-validation/override/:validationId - Mark validation as overridden
router.post('/override/:validationId', aiValidationController.markAsOverridden.bind(aiValidationController));

// GET /api/ai-validation/statistics - Get validation statistics
router.get('/statistics', aiValidationController.getStatistics.bind(aiValidationController));

// GET /api/ai-validation/health - Check AI validation service health
router.get('/health', aiValidationController.checkHealth.bind(aiValidationController));

// POST /api/ai-validation/knowledge/search - Search medical knowledge base
router.post('/knowledge/search', aiValidationController.searchKnowledge.bind(aiValidationController));

// GET /api/ai-validation/knowledge/stats - Get knowledge base statistics
router.get('/knowledge/stats', aiValidationController.getKnowledgeStats.bind(aiValidationController));

export default router;

