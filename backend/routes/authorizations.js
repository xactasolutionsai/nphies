import express from 'express';
import authorizationsController from '../controllers/authorizationsController.js';

const router = express.Router();

// GET /api/authorizations - Get all authorizations with pagination and search
router.get('/', authorizationsController.getAll.bind(authorizationsController));

// GET /api/authorizations/:id - Get authorization by ID with full details
router.get('/:id', authorizationsController.getById.bind(authorizationsController));

// POST /api/authorizations - Create new authorization
router.post('/', authorizationsController.create.bind(authorizationsController));

// PUT /api/authorizations/:id - Update authorization
router.put('/:id', authorizationsController.update.bind(authorizationsController));

// PATCH /api/authorizations/:id/status - Update authorization status
router.patch('/:id/status', authorizationsController.updateStatus.bind(authorizationsController));

// DELETE /api/authorizations/:id - Delete authorization
router.delete('/:id', authorizationsController.delete.bind(authorizationsController));

export default router;
