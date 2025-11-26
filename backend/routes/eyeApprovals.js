import express from 'express';
import eyeApprovalsController from '../controllers/eyeApprovalsController.js';

const router = express.Router();

// GET /api/eye-approvals - Get all forms with pagination and search
router.get('/', eyeApprovalsController.getAll.bind(eyeApprovalsController));

// GET /api/eye-approvals/:id - Get form by ID with full details
router.get('/:id', eyeApprovalsController.getById.bind(eyeApprovalsController));

// POST /api/eye-approvals - Create new form
router.post('/', eyeApprovalsController.create.bind(eyeApprovalsController));

// PUT /api/eye-approvals/:id - Update form
router.put('/:id', eyeApprovalsController.update.bind(eyeApprovalsController));

// DELETE /api/eye-approvals/:id - Delete form
router.delete('/:id', eyeApprovalsController.delete.bind(eyeApprovalsController));

export default router;

