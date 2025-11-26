// Base controller with common CRUD operations
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';

export class BaseController {
  constructor(tableName, validationSchema) {
    this.tableName = tableName;
    this.validationSchema = validationSchema;
  }

  // Get all records with pagination
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Load queries dynamically
      const queries = await loadQueries();
      
      // Get total count
      const countResult = await query(queries.COMMON.COUNT(this.tableName));
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const result = await query(queries.COMMON.GET_ALL(this.tableName, limit, offset), [limit, offset]);

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error(`Error getting ${this.tableName}:`, error);
      res.status(500).json({ error: `Failed to fetch ${this.tableName}` });
    }
  }

  // Get record by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.COMMON.GET_BY_ID(this.tableName), [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${this.tableName} not found` });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error(`Error getting ${this.tableName} by ID:`, error);
      res.status(500).json({ error: `Failed to fetch ${this.tableName}` });
    }
  }

  // Create new record
  async create(req, res) {
    try {
      // Validate input
      const { error, value } = this.validationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const columns = Object.keys(value);
      const values = Object.values(value);

      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(
        queries.COMMON.INSERT(this.tableName, columns),
        values
      );

      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({ error: 'Record already exists' });
      } else if (error.code === '23503') { // Foreign key constraint violation
        res.status(400).json({ error: 'Invalid reference to related record' });
      } else {
        res.status(500).json({ error: `Failed to create ${this.tableName}` });
      }
    }
  }

  // Update record
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // Validate input
      const { error, value } = this.validationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const columns = Object.keys(value);
      const values = [...Object.values(value), id];

      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(
        queries.COMMON.UPDATE(this.tableName, columns),
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${this.tableName} not found` });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({ error: 'Record already exists' });
      } else if (error.code === '23503') { // Foreign key constraint violation
        res.status(400).json({ error: 'Invalid reference to related record' });
      } else {
        res.status(500).json({ error: `Failed to update ${this.tableName}` });
      }
    }
  }

  // Delete record
  async delete(req, res) {
    try {
      const { id } = req.params;
      // Load queries dynamically
      const queries = await loadQueries();
      
      const result = await query(queries.COMMON.DELETE(this.tableName), [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${this.tableName} not found` });
      }

      res.json({ message: `${this.tableName} deleted successfully` });
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      if (error.code === '23503') { // Foreign key constraint violation
        res.status(400).json({ error: 'Cannot delete record with related data' });
      } else {
        res.status(500).json({ error: `Failed to delete ${this.tableName}` });
      }
    }
  }
}
