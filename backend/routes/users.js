import express from 'express';
import usersController from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();


// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/users - Get all users (admin only)
router.get('/', usersController.getAll.bind(usersController));

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', usersController.getById.bind(usersController));

export default router;

