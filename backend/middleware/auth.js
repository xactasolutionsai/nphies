import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { getJwtSecret } from '../config/auth.js';

export async function authenticateToken(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(match[1], getJwtSecret(), { algorithms: ['HS256'] });
    const result = await query('SELECT id, email, role FROM users WHERE id = $1', [decoded.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User no longer exists' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(error);
  }
}
