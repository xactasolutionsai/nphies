import { query } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthController {
  // Register a new user
  async register(req, res) {
    // Enforce this inside Express too: reverse-proxy exact paths can be bypassed
    // through trailing slashes or case-insensitive routing.
    if (process.env.NODE_ENV === 'production' || process.env.DISABLE_PUBLIC_REGISTRATION === 'true') {
      return res.status(403).json({ error: 'Public registration is disabled' });
    }
    try {
      const { email, password, confirmPassword } = req.body;

      // Validation
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          error: 'Passwords do not match'
        });
      }

      if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({
          error: 'Password must contain at least 12 characters and at most 72 UTF-8 bytes'
        });
      }

      // Check if email already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already registered'
        });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user
      const result = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at',
        [email.toLowerCase().trim(), passwordHash]
      );

      const user = result.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            created_at: user.created_at
          },
          token
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to register user'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (typeof email !== 'string' || email.length > 255 || !email.trim() ||
          typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find user by email
      const result = await query(
        'SELECT id, email, role, password_hash, created_at FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            created_at: user.created_at
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to login'
      });
    }
  }

  // Verify token (optional middleware helper)
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          error: 'No token provided'
        });
      }

      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      
      // Get user info
      const result = await query(
        'SELECT id, email, role, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Invalid or expired token'
        });
      }

      console.error('Verify token error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to verify token'
      });
    }
  }
}

export default new AuthController();
