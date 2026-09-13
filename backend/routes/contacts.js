import express from 'express';
import contactsController from '../controllers/contactsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();


// PUBLIC ROUTE - No authentication required
// POST /api/contacts - Submit contact form from external website
router.post('/', contactsController.create.bind(contactsController));

// ADMIN-ONLY ROUTES - Require authentication
// GET /api/contacts - Get all contacts (super admin only)
router.get('/', authenticateToken, contactsController.getAll.bind(contactsController));

// GET /api/contacts/:id - Get contact by ID (super admin only)
router.get('/:id', authenticateToken, contactsController.getById.bind(contactsController));

// PATCH /api/contacts/:id/status - Update contact status (super admin only)
router.patch('/:id/status', authenticateToken, contactsController.updateStatus.bind(contactsController));

export default router;
