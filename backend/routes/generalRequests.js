import express from 'express';
import generalRequestsController from '../controllers/generalRequestsController.js';

const router = express.Router();

// GET /api/general-requests - Get all requests with pagination and search
router.get('/', generalRequestsController.getAll.bind(generalRequestsController));

// GET /api/general-requests/:id - Get request by ID with full details
router.get('/:id', generalRequestsController.getById.bind(generalRequestsController));

// POST /api/general-requests - Create new request
router.post('/', generalRequestsController.create.bind(generalRequestsController));

// PUT /api/general-requests/:id - Update request
router.put('/:id', generalRequestsController.update.bind(generalRequestsController));

// DELETE /api/general-requests/:id - Delete request
router.delete('/:id', generalRequestsController.delete.bind(generalRequestsController));

export default router;

