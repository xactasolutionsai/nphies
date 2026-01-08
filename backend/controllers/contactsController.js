import { query } from '../db.js';

class ContactsController {
  // Create a new contact (public endpoint - no auth required)
  async create(req, res) {
    try {
      const { name, email, company, message } = req.body;

      // Validation
      if (!name || !name.trim()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name is required'
        });
      }

      if (!email || !email.trim()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Email is required'
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid email format'
        });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Message is required'
        });
      }

      // Get source URL from referer header or request body
      const sourceUrl = req.body.source_url || req.headers.referer || null;

      // Get IP address
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

      // Insert contact
      const result = await query(
        `INSERT INTO contacts (name, email, company, message, source_url, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, company, message, source_url, status, created_at`,
        [
          name.trim(),
          email.trim().toLowerCase(),
          company?.trim() || null,
          message.trim(),
          sourceUrl,
          ipAddress
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Contact form submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to submit contact form'
      });
    }
  }

  // Get all contacts (super admin only)
  async getAll(req, res) {
    try {
      // Check if user is super admin
      const userEmail = req.user?.email;
      if (userEmail !== 'eng.anasshamia@gmail.com') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only super admin can access this resource'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM contacts${whereClause}`;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated contacts
      const dataQuery = `
        SELECT id, name, email, company, message, source_url, ip_address, status, created_at, updated_at
        FROM contacts
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const result = await query(dataQuery, [...queryParams, limit, offset]);

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
      console.error('Get contacts error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch contacts'
      });
    }
  }

  // Get contact by ID (super admin only)
  async getById(req, res) {
    try {
      // Check if user is super admin
      const userEmail = req.user?.email;
      if (userEmail !== 'eng.anasshamia@gmail.com') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only super admin can access this resource'
        });
      }

      const { id } = req.params;

      const result = await query(
        'SELECT id, name, email, company, message, source_url, ip_address, status, created_at, updated_at FROM contacts WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Contact not found'
        });
      }

      res.json({
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get contact by ID error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch contact'
      });
    }
  }

  // Update contact status (super admin only)
  async updateStatus(req, res) {
    try {
      // Check if user is super admin
      const userEmail = req.user?.email;
      if (userEmail !== 'eng.anasshamia@gmail.com') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only super admin can access this resource'
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['new', 'read', 'replied', 'archived'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      const result = await query(
        `UPDATE contacts 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, email, company, message, source_url, ip_address, status, created_at, updated_at`,
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Contact not found'
        });
      }

      res.json({
        success: true,
        message: 'Contact status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update contact status error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to update contact status'
      });
    }
  }
}

export default new ContactsController();
