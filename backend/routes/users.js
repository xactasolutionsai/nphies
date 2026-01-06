import express from 'express';
import usersController from '../controllers/usersController.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token'
      });
    }
    req.user = decoded;
    next();
  });
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/users - Get all users (admin only)
router.get('/', usersController.getAll.bind(usersController));

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', usersController.getById.bind(usersController));

export default router;

