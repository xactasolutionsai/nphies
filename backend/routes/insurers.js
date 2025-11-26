import express from 'express';
import insurersController from '../controllers/insurersController.js';

const router = express.Router();

// GET /api/insurers - Get all insurers with pagination and search
router.get('/', insurersController.getAll.bind(insurersController));

// GET /api/insurers/:id - Get insurer by ID with related data
router.get('/:id', insurersController.getById.bind(insurersController));

// POST /api/insurers - Create new insurer
router.post('/', insurersController.create.bind(insurersController));

// PUT /api/insurers/:id - Update insurer
router.put('/:id', insurersController.update.bind(insurersController));

// DELETE /api/insurers/:id - Delete insurer
router.delete('/:id', insurersController.delete.bind(insurersController));

export default router;
