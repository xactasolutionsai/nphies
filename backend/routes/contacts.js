import express from 'express';
import contactsController from '../controllers/contactsController.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token (for admin-only routes)
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
