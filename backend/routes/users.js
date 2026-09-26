import express from 'express';
import usersController from '../controllers/usersController.js';

const router = express.Router();

// Authentication is applied globally in server.js (app.use('/api', authenticateToken));
// running it again here only repeated the user lookup.

// GET /api/users - Get all users (admin only)
router.get('/', usersController.getAll.bind(usersController));

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', usersController.getById.bind(usersController));

export default router;

