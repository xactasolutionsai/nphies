import express from 'express';
import authController from '../controllers/authController.js';
import { createLoginLimiter } from '../middleware/loginLimiter.js';

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// POST /api/auth/register - Register new user
router.post('/register', authController.register.bind(authController));

// POST /api/auth/login - Login user
router.post('/login', createLoginLimiter(), authController.login.bind(authController));

// GET /api/auth/verify - Verify token (optional)
router.get('/verify', authController.verifyToken.bind(authController));

export default router;

