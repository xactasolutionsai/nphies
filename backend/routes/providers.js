import express from 'express';
import providersController from '../controllers/providersController.js';

const router = express.Router();

// GET /api/providers - Get all providers with pagination and search
router.get('/', providersController.getAll.bind(providersController));

// GET /api/providers/:id - Get provider by ID with related data
router.get('/:id', providersController.getById.bind(providersController));

// POST /api/providers - Create new provider
router.post('/', providersController.create.bind(providersController));

// PUT /api/providers/:id - Update provider
router.put('/:id', providersController.update.bind(providersController));

// DELETE /api/providers/:id - Delete provider
router.delete('/:id', providersController.delete.bind(providersController));

export default router;
