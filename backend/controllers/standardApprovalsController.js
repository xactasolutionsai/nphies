import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';

class StandardApprovalsController extends BaseController {
  constructor() {
    super('standard_approvals_claims', validationSchemas.standardApprovalClaim);
  }

  // Get all forms with joins
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';

      // Build dynamic WHERE clause
      let whereConditions = [];
      let queryParams = [limit, offset];
      let countParams = [];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`(sac.provider_name ILIKE $${paramIndex} OR sac.insurance_company_name ILIKE $${paramIndex} OR sac.form_number ILIKE $${paramIndex} OR sac.insured_name ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`sac.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM standard_approvals_claims sac
        LEFT JOIN patients p ON sac.patient_id = p.patient_id
        LEFT JOIN providers pr ON sac.provider_id = pr.provider_id
        LEFT JOIN insurers i ON sac.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          sac.*,
          p.name as patient_name,
          pr.provider_name as provider_name_joined,
          i.insurer_name as insurer_name
        FROM standard_approvals_claims sac
        LEFT JOIN patients p ON sac.patient_id = p.patient_id
        LEFT JOIN providers pr ON sac.provider_id = pr.provider_id
        LEFT JOIN insurers i ON sac.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY sac.created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await query(dataQuery, queryParams);

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
      console.error('Error getting standard approvals:', error);
      res.status(500).json({ error: 'Failed to fetch standard approvals' });
    }
  }

  // Internal method to get form by ID
  async getByIdInternal(id) {
      // Get main form data
      const formQuery = `
        SELECT
          sac.*,
          p.name as patient_name,
          pr.provider_name as provider_name_joined,
          i.insurer_name as insurer_name
        FROM standard_approvals_claims sac
        LEFT JOIN patients p ON sac.patient_id = p.patient_id
        LEFT JOIN providers pr ON sac.provider_id = pr.provider_id
        LEFT JOIN insurers i ON sac.insurer_id = i.insurer_id
        WHERE sac.id = $1
      `;
    const formResult = await query(formQuery, [id]);

    if (formResult.rows.length === 0) {
      return null;
    }

    const form = formResult.rows[0];

    // Get management items
    const managementItemsQuery = `
      SELECT * FROM standard_approvals_management_items
      WHERE form_id = $1
      ORDER BY id ASC
    `;
    const managementItemsResult = await query(managementItemsQuery, [id]);

    // Get medications
    const medicationsQuery = `
      SELECT * FROM standard_approvals_medications
      WHERE form_id = $1
      ORDER BY id ASC
    `;
    const medicationsResult = await query(medicationsQuery, [id]);

    return {
      ...form,
      management_items: managementItemsResult.rows,
      medications: medicationsResult.rows
    };
  }

  // Get form by ID with full details including nested data
  async getById(req, res) {
    try {
      const { id } = req.params;
      const formData = await this.getByIdInternal(id);

      if (!formData) {
        return res.status(404).json({ error: 'Standard approval form not found' });
      }

      res.json({ data: formData });
    } catch (error) {
      console.error('Error getting standard approval by ID:', error);
      res.status(500).json({ error: 'Failed to fetch standard approval' });
    }
  }

  // Create new form with nested data
  async create(req, res) {
    try {
      const { management_items, medications, ...formData } = req.body;

      // Clean up empty strings: convert empty strings to null for dates and numbers
      const cleanedData = { ...formData };
      const dateFields = ['date_of_visit', 'expiry_date', 'provider_date', 'expected_date_of_admission'];
      const numberFields = ['age', 'emergency_care_level', 'pulse', 'temp', 'weight', 'height', 
                           'respiratory_rate', 'duration_of_illness_days', 'estimated_length_of_stay_days'];
      
      dateFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === null) {
          cleanedData[field] = null;
        }
      });
      
      numberFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        }
      });

      // Convert empty strings to null for UUID fields (before general string cleanup)
      if (cleanedData.patient_id === '') cleanedData.patient_id = null;
      if (cleanedData.provider_id === '') cleanedData.provider_id = null;
      if (cleanedData.insurer_id === '') cleanedData.insurer_id = null;

      // Handle conditional field: emergency_care_level
      // If emergency_case is false or not set, set emergency_care_level to null
      if (!cleanedData.emergency_case && (cleanedData.emergency_care_level === '' || cleanedData.emergency_care_level === null || cleanedData.emergency_care_level === undefined)) {
        cleanedData.emergency_care_level = null;
      }

      // Convert empty strings to null for all other string fields
      Object.keys(cleanedData).forEach(key => {
        if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '' && cleanedData[key] !== null) {
          cleanedData[key] = null;
        }
      });

      // Validate input (excluding nested arrays)
      const { error, value } = this.validationSchema.validate(cleanedData, { abortEarly: false });
      if (error) {
        // Format validation errors with field names
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors,
          message: errors[0].message // For backward compatibility
        });
      }

      // Generate form number if not provided
      if (!value.form_number) {
        const timestamp = Date.now();
        value.form_number = `SAC-${timestamp}`;
      }

      // Extract columns and values for main table
      const columns = Object.keys(value).filter(key => key !== 'management_items' && key !== 'medications');
      const values = columns.map(col => value[col]);

      // Start transaction
      try {
        // Insert main form
        const insertFormQuery = `
          INSERT INTO standard_approvals_claims (${columns.join(', ')})
          VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
          RETURNING *
        `;
        const formResult = await query(insertFormQuery, values);
        const formId = formResult.rows[0].id;

        // Insert management items if provided
        if (management_items && Array.isArray(management_items) && management_items.length > 0) {
          for (const item of management_items) {
            const itemQuery = `
              INSERT INTO standard_approvals_management_items (form_id, code, description, type, quantity, cost)
              VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await query(itemQuery, [
              formId,
              item.code || null,
              item.description || null,
              item.type || null,
              item.quantity || null,
              item.cost || null
            ]);
          }
        }

        // Insert medications if provided
        if (medications && Array.isArray(medications) && medications.length > 0) {
          for (const med of medications) {
            const medQuery = `
              INSERT INTO standard_approvals_medications (form_id, medication_name, type, quantity)
              VALUES ($1, $2, $3, $4)
            `;
            await query(medQuery, [
              formId,
              med.medication_name || null,
              med.type || null,
              med.quantity || null
            ]);
          }
        }

        // Get complete form with nested data
        const completeFormData = await this.getByIdInternal(formId);

        res.status(201).json({ data: completeFormData });
      } catch (err) {
        throw err;
      }
    } catch (error) {
      console.error('Error creating standard approval:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Form number already exists' });
      } else if (error.code === '23503') {
        // Extract field name from constraint error
        const constraintMatch = error.message.match(/violates foreign key constraint.*?on table.*?Key \((.*?)\)=/);
        const fieldName = constraintMatch ? constraintMatch[1] : 'referenced field';
        res.status(400).json({ 
          error: `Invalid ${fieldName}`,
          errors: [{ field: fieldName, message: `Invalid ${fieldName} reference` }]
        });
      } else {
        // Return detailed error message
        const errorMessage = error.message || 'Failed to create standard approval';
        res.status(500).json({ 
          error: errorMessage,
          details: error.detail || error.hint || null
        });
      }
    }
  }

  // Update form with nested data
  async update(req, res) {
    try {
      const { id } = req.params;
      const { management_items, medications, ...formData } = req.body;

      // Clean up empty strings: convert empty strings to null for dates and numbers
      const cleanedData = { ...formData };
      const dateFields = ['date_of_visit', 'expiry_date', 'provider_date', 'expected_date_of_admission'];
      const numberFields = ['age', 'emergency_care_level', 'pulse', 'temp', 'weight', 'height', 
                           'respiratory_rate', 'duration_of_illness_days', 'estimated_length_of_stay_days'];
      
      dateFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === null) {
          cleanedData[field] = null;
        }
      });
      
      numberFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        }
      });

      // Convert empty strings to null for UUID fields (before general string cleanup)
      if (cleanedData.patient_id === '') cleanedData.patient_id = null;
      if (cleanedData.provider_id === '') cleanedData.provider_id = null;
      if (cleanedData.insurer_id === '') cleanedData.insurer_id = null;

      // Handle conditional field: emergency_care_level
      // If emergency_case is false or not set, set emergency_care_level to null
      if (!cleanedData.emergency_case && (cleanedData.emergency_care_level === '' || cleanedData.emergency_care_level === null || cleanedData.emergency_care_level === undefined)) {
        cleanedData.emergency_care_level = null;
      }

      // Convert empty strings to null for all other string fields
      Object.keys(cleanedData).forEach(key => {
        if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '' && cleanedData[key] !== null) {
          cleanedData[key] = null;
        }
      });

      // Validate input
      const { error, value } = this.validationSchema.validate(cleanedData, { abortEarly: false });
      if (error) {
        // Format validation errors with field names
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors,
          message: errors[0].message // For backward compatibility
        });
      }
      const columns = Object.keys(value).filter(key => key !== 'management_items' && key !== 'medications');
      const values = [...columns.map(col => value[col]), id];

      // Update main form
      const updateFormQuery = `
        UPDATE standard_approvals_claims
        SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${columns.length + 1}
        RETURNING *
      `;
      const formResult = await query(updateFormQuery, values);

      if (formResult.rows.length === 0) {
        return res.status(404).json({ error: 'Standard approval form not found' });
      }

      // Delete existing management items and medications
      await query('DELETE FROM standard_approvals_management_items WHERE form_id = $1', [id]);
      await query('DELETE FROM standard_approvals_medications WHERE form_id = $1', [id]);

      // Insert updated management items if provided
      if (management_items && Array.isArray(management_items) && management_items.length > 0) {
        for (const item of management_items) {
          const itemQuery = `
            INSERT INTO standard_approvals_management_items (form_id, code, description, type, quantity, cost)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await query(itemQuery, [
            id,
            item.code || null,
            item.description || null,
            item.type || null,
            item.quantity || null,
            item.cost || null
          ]);
        }
      }

      // Insert updated medications if provided
      if (medications && Array.isArray(medications) && medications.length > 0) {
        for (const med of medications) {
          const medQuery = `
            INSERT INTO standard_approvals_medications (form_id, medication_name, type, quantity)
            VALUES ($1, $2, $3, $4)
          `;
          await query(medQuery, [
            id,
            med.medication_name || null,
            med.type || null,
            med.quantity || null
          ]);
        }
      }

      // Get complete updated form
      const completeFormData = await this.getByIdInternal(id);

      res.json({ data: completeFormData });
    } catch (error) {
      console.error('Error updating standard approval:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Form number already exists' });
      } else if (error.code === '23503') {
        // Extract field name from constraint error
        const constraintMatch = error.message.match(/violates foreign key constraint.*?on table.*?Key \((.*?)\)=/);
        const fieldName = constraintMatch ? constraintMatch[1] : 'referenced field';
        res.status(400).json({ 
          error: `Invalid ${fieldName}`,
          errors: [{ field: fieldName, message: `Invalid ${fieldName} reference` }]
        });
      } else {
        // Return detailed error message
        const errorMessage = error.message || 'Failed to update standard approval';
        res.status(500).json({ 
          error: errorMessage,
          details: error.detail || error.hint || null
        });
      }
    }
  }

  // Delete form with nested data
  async delete(req, res) {
    try {
      const { id } = req.params;

      // First, check if the form exists
      const formCheck = await query('SELECT id FROM standard_approvals_claims WHERE id = $1', [id]);
      if (formCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Standard approval form not found' });
      }

      // Delete related management items first (due to foreign key constraint)
      await query('DELETE FROM standard_approvals_management_items WHERE form_id = $1', [id]);

      // Delete related medications first (due to foreign key constraint)
      await query('DELETE FROM standard_approvals_medications WHERE form_id = $1', [id]);

      // Delete the main form
      const result = await query('DELETE FROM standard_approvals_claims WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Standard approval form not found' });
      }

      res.json({ message: 'Standard approval form deleted successfully' });
    } catch (error) {
      console.error('Error deleting standard approval:', error);
      if (error.code === '23503') {
        res.status(400).json({ error: 'Cannot delete record with related data' });
      } else {
        res.status(500).json({ error: 'Failed to delete standard_approvals_claims' });
      }
    }
  }
}

export default new StandardApprovalsController();

