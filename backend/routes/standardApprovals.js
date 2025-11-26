import express from 'express';
import standardApprovalsController from '../controllers/standardApprovalsController.js';

const router = express.Router();

// GET /api/standard-approvals - Get all forms with pagination and search
router.get('/', standardApprovalsController.getAll.bind(standardApprovalsController));

// GET /api/standard-approvals/:id - Get form by ID with full details
router.get('/:id', standardApprovalsController.getById.bind(standardApprovalsController));

// POST /api/standard-approvals - Create new form
router.post('/', standardApprovalsController.create.bind(standardApprovalsController));

// PUT /api/standard-approvals/:id - Update form
router.put('/:id', standardApprovalsController.update.bind(standardApprovalsController));

// DELETE /api/standard-approvals/:id - Delete form
router.delete('/:id', standardApprovalsController.delete.bind(standardApprovalsController));

export default router;

