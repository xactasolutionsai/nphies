import { BaseController } from './baseController.js';
import { query } from '../db.js';

class DentalApprovalsController extends BaseController {
  constructor() {
    super('dental_approvals', null); // No validation schema for now
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
        whereConditions.push(`(da.provider_name ILIKE $${paramIndex} OR da.insurance_company_name ILIKE $${paramIndex} OR da.form_number ILIKE $${paramIndex} OR da.insured_name ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`da.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM dental_approvals da
        LEFT JOIN patients p ON da.patient_id = p.patient_id
        LEFT JOIN providers pr ON da.provider_id = pr.provider_id
        LEFT JOIN insurers i ON da.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          da.*,
          p.name as patient_name,
          pr.provider_name as provider_name_joined,
          i.insurer_name as insurer_name
        FROM dental_approvals da
        LEFT JOIN patients p ON da.patient_id = p.patient_id
        LEFT JOIN providers pr ON da.provider_id = pr.provider_id
        LEFT JOIN insurers i ON da.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY da.created_at DESC 
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
      console.error('Error getting dental approvals:', error);
      res.status(500).json({ error: 'Failed to fetch dental approvals' });
    }
  }

  // Internal method to get form by ID
  async getByIdInternal(id) {
    // Get main form data
    const formQuery = `
      SELECT
        da.*,
        p.name as patient_name,
        pr.provider_name as provider_name_joined,
        i.insurer_name as insurer_name
      FROM dental_approvals da
      LEFT JOIN patients p ON da.patient_id = p.patient_id
      LEFT JOIN providers pr ON da.provider_id = pr.provider_id
      LEFT JOIN insurers i ON da.insurer_id = i.insurer_id
      WHERE da.id = $1
    `;
    const formResult = await query(formQuery, [id]);

    if (formResult.rows.length === 0) {
      return null;
    }

    const form = formResult.rows[0];

    // Get procedures
    const proceduresQuery = `
      SELECT * FROM dental_procedures
      WHERE form_id = $1
      ORDER BY id ASC
    `;
    const proceduresResult = await query(proceduresQuery, [id]);

    // Get medications
    const medicationsQuery = `
      SELECT * FROM dental_medications
      WHERE form_id = $1
      ORDER BY id ASC
    `;
    const medicationsResult = await query(medicationsQuery, [id]);

    return {
      ...form,
      procedures: proceduresResult.rows,
      medications: medicationsResult.rows
    };
  }

  // Get form by ID with full details including nested data
  async getById(req, res) {
    try {
      const { id } = req.params;
      const formData = await this.getByIdInternal(id);

      if (!formData) {
        return res.status(404).json({ error: 'Dental approval form not found' });
      }

      res.json({ data: formData });
    } catch (error) {
      console.error('Error getting dental approval by ID:', error);
      res.status(500).json({ error: 'Failed to fetch dental approval' });
    }
  }

  // Create new form with nested data
  async create(req, res) {
    try {
      const { procedures, medications, ...formData } = req.body;

      // Clean up empty strings: convert empty strings to null for dates and numbers
      const cleanedData = { ...formData };
      const dateFields = ['date_of_visit', 'expiry_date', 'provider_date'];
      const numberFields = ['age', 'duration_of_illness_days'];
      
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

      // Convert empty strings to null for UUID fields
      if (cleanedData.patient_id === '') cleanedData.patient_id = null;
      if (cleanedData.provider_id === '') cleanedData.provider_id = null;
      if (cleanedData.insurer_id === '') cleanedData.insurer_id = null;

      // Convert empty strings to null for all other string fields
      Object.keys(cleanedData).forEach(key => {
        if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '' && cleanedData[key] !== null) {
          cleanedData[key] = null;
        }
      });

      // Generate form number if not provided
      if (!cleanedData.form_number) {
        const timestamp = Date.now();
        cleanedData.form_number = `DA-${timestamp}`;
      }

      // Extract columns and values for main table
      const columns = Object.keys(cleanedData).filter(key => key !== 'procedures' && key !== 'medications');
      const values = columns.map(col => cleanedData[col]);

      // Start transaction
      try {
        // Insert main form
        const insertFormQuery = `
          INSERT INTO dental_approvals (${columns.join(', ')})
          VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
          RETURNING *
        `;
        const formResult = await query(insertFormQuery, values);
        const formId = formResult.rows[0].id;

        // Insert procedures if provided
        if (procedures && Array.isArray(procedures) && procedures.length > 0) {
          for (const proc of procedures) {
            const procQuery = `
              INSERT INTO dental_procedures (form_id, code, service_description, tooth_number, cost)
              VALUES ($1, $2, $3, $4, $5)
            `;
            await query(procQuery, [
              formId,
              proc.code || null,
              proc.service_description || null,
              proc.tooth_number || null,
              proc.cost || null
            ]);
          }
        }

        // Insert medications if provided
        if (medications && Array.isArray(medications) && medications.length > 0) {
          for (const med of medications) {
            const medQuery = `
              INSERT INTO dental_medications (form_id, medication_name, type, quantity)
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
      console.error('Error creating dental approval:', error);
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
        const errorMessage = error.message || 'Failed to create dental approval';
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
      const { procedures, medications, ...formData } = req.body;

      // Clean up empty strings: convert empty strings to null for dates and numbers
      const cleanedData = { ...formData };
      const dateFields = ['date_of_visit', 'expiry_date', 'provider_date'];
      const numberFields = ['age', 'duration_of_illness_days'];
      
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

      // Convert empty strings to null for UUID fields
      if (cleanedData.patient_id === '') cleanedData.patient_id = null;
      if (cleanedData.provider_id === '') cleanedData.provider_id = null;
      if (cleanedData.insurer_id === '') cleanedData.insurer_id = null;

      // Convert empty strings to null for all other string fields
      Object.keys(cleanedData).forEach(key => {
        if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '' && cleanedData[key] !== null) {
          cleanedData[key] = null;
        }
      });

      const columns = Object.keys(cleanedData).filter(key => key !== 'procedures' && key !== 'medications');
      const values = [...columns.map(col => cleanedData[col]), id];

      // Update main form
      const updateFormQuery = `
        UPDATE dental_approvals
        SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${columns.length + 1}
        RETURNING *
      `;
      const formResult = await query(updateFormQuery, values);

      if (formResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dental approval form not found' });
      }

      // Delete existing procedures and medications
      await query('DELETE FROM dental_procedures WHERE form_id = $1', [id]);
      await query('DELETE FROM dental_medications WHERE form_id = $1', [id]);

      // Insert updated procedures if provided
      if (procedures && Array.isArray(procedures) && procedures.length > 0) {
        for (const proc of procedures) {
          const procQuery = `
            INSERT INTO dental_procedures (form_id, code, service_description, tooth_number, cost)
            VALUES ($1, $2, $3, $4, $5)
          `;
          await query(procQuery, [
            id,
            proc.code || null,
            proc.service_description || null,
            proc.tooth_number || null,
            proc.cost || null
          ]);
        }
      }

      // Insert updated medications if provided
      if (medications && Array.isArray(medications) && medications.length > 0) {
        for (const med of medications) {
          const medQuery = `
            INSERT INTO dental_medications (form_id, medication_name, type, quantity)
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
      console.error('Error updating dental approval:', error);
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
        const errorMessage = error.message || 'Failed to update dental approval';
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
      const formCheck = await query('SELECT id FROM dental_approvals WHERE id = $1', [id]);
      if (formCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dental approval form not found' });
      }

      // Delete related procedures first (due to foreign key constraint)
      await query('DELETE FROM dental_procedures WHERE form_id = $1', [id]);

      // Delete related medications first (due to foreign key constraint)
      await query('DELETE FROM dental_medications WHERE form_id = $1', [id]);

      // Delete the main form
      const result = await query('DELETE FROM dental_approvals WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Dental approval form not found' });
      }

      res.json({ message: 'Dental approval form deleted successfully' });
    } catch (error) {
      console.error('Error deleting dental approval:', error);
      if (error.code === '23503') {
        res.status(400).json({ error: 'Cannot delete record with related data' });
      } else {
        res.status(500).json({ error: 'Failed to delete dental approval' });
      }
    }
  }
}

export default new DentalApprovalsController();

