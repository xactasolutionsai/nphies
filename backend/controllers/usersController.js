import { query } from '../db.js';
import { ASSIGNABLE_ROLES } from '../middleware/requireRole.js';

class UsersController {
  // Get all users (admin only)
  async getAll(req, res) {
    try {
      // Check if user is super admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only super admin can access this resource'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let whereClause = '';
      let queryParams = [];

      if (search) {
        whereClause = ' WHERE email ILIKE $1';
        queryParams = [`%${search}%`, limit, offset];
      } else {
        queryParams = [limit, offset];
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM users${whereClause}`;
      const countResult = await query(countQuery, search ? [queryParams[0]] : []);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated users (exclude password_hash)
      const dataQuery = `
        SELECT id, email, role, created_at, updated_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${search ? '$2' : '$1'} OFFSET ${search ? '$3' : '$2'}
      `;
      
      const result = await query(dataQuery, queryParams);

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch users'
      });
    }
  }

  // Get user by ID (admin only)
  async getById(req, res) {
    try {
      // Check if user is super admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only super admin can access this resource'
        });
      }

      const { id } = req.params;

      const result = await query(
        'SELECT id, email, role, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch user'
      });
    }
  }

  // Change a user's role (admin only). Body: { role: 'admin' | 'submitter' | 'reviewer' | 'viewer' }
  async updateRole(req, res) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden', requiredRole: 'admin' });
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
      }
      // An administrator cannot change their own role, so the last admin cannot lock everyone out.
      if (Number(req.user.id) === id) {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }

      const result = await query(
        'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, role, created_at, updated_at',
        [role, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to update user role'
      });
    }
  }
}

export default new UsersController();

