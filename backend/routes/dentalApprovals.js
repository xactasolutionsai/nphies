import express from 'express';
import dentalApprovalsController from '../controllers/dentalApprovalsController.js';

const router = express.Router();

// GET /api/dental-approvals - Get all forms with pagination and search
router.get('/', dentalApprovalsController.getAll.bind(dentalApprovalsController));

// GET /api/dental-approvals/:id - Get form by ID with full details
router.get('/:id', dentalApprovalsController.getById.bind(dentalApprovalsController));

// POST /api/dental-approvals - Create new form
router.post('/', dentalApprovalsController.create.bind(dentalApprovalsController));

// PUT /api/dental-approvals/:id - Update form
router.put('/:id', dentalApprovalsController.update.bind(dentalApprovalsController));

// DELETE /api/dental-approvals/:id - Delete form
router.delete('/:id', dentalApprovalsController.delete.bind(dentalApprovalsController));

export default router;

