import express from 'express';
import medicinesController from '../controllers/medicinesController.js';

const router = express.Router();

/**
 * Medicine Routes
 * All routes are prefixed with /api/medicines
 */

// Health check
router.get('/health', medicinesController.healthCheck.bind(medicinesController));

// Get statistics
router.get('/stats', medicinesController.getStatistics.bind(medicinesController));

// Search medicines (natural language RAG search)
router.get('/search', medicinesController.searchMedicines.bind(medicinesController));

// Search by active ingredient
router.get('/ingredient/:name', medicinesController.searchByActiveIngredient.bind(medicinesController));

// Search by brand name
router.get('/brand/:name', medicinesController.searchByBrandName.bind(medicinesController));

// Get medicine by specific code
router.get('/code/:type/:value', medicinesController.getMedicineByCode.bind(medicinesController));

// Get AI information for a medicine (both GET and POST supported)
router.get('/:mridOrId/ai-info', medicinesController.getMedicineWithAIInfo.bind(medicinesController));
router.post('/:mrid/ai-info', medicinesController.getMedicineAIInfo.bind(medicinesController));

// Get medicine by MRID (should be last to avoid conflicts)
router.get('/:mrid', medicinesController.getMedicineByMRID.bind(medicinesController));

export default router;

