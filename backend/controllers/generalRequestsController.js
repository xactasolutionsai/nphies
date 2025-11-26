import { query } from '../db.js';
import generalRequestValidationService from '../services/generalRequestValidationService.js';

class GeneralRequestsController {
  /**
   * Get all general requests with pagination and search
   * GET /api/general-requests
   */
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
        whereConditions.push(`(
          gr.form_number ILIKE $${paramIndex} OR
          gr.patient_data->>'fullName' ILIKE $${paramIndex} OR
          gr.service_data->>'diagnosis' ILIKE $${paramIndex} OR
          gr.service_data->>'description' ILIKE $${paramIndex} OR
          p.name ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`gr.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM general_requests gr
        LEFT JOIN patients p ON gr.patient_id = p.patient_id
        LEFT JOIN providers pr ON gr.provider_id = pr.provider_id
        LEFT JOIN insurers i ON gr.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          gr.id,
          gr.form_number,
          gr.status,
          gr.patient_data->>'fullName' as patient_name,
          gr.service_data->>'diagnosis' as diagnosis,
          gr.service_data->>'description' as service_description,
          gr.service_data->>'urgency' as urgency,
          gr.service_data->>'emergencyCase' as emergency_case,
          gr.provider_data->>'facilityName' as provider_name,
          gr.coverage_data->>'insurer' as insurer_name,
          gr.created_at,
          gr.submitted_at,
          p.name as patient_name_joined,
          pr.provider_name as provider_name_joined,
          i.insurer_name as insurer_name_joined
        FROM general_requests gr
        LEFT JOIN patients p ON gr.patient_id = p.patient_id
        LEFT JOIN providers pr ON gr.provider_id = pr.provider_id
        LEFT JOIN insurers i ON gr.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY gr.created_at DESC 
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
      console.error('Error getting general requests:', error);
      res.status(500).json({ error: 'Failed to fetch general requests' });
    }
  }

  /**
   * Get general request by ID with full details
   * GET /api/general-requests/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      const getQuery = `
        SELECT
          gr.*,
          p.name as patient_name_joined,
          pr.provider_name as provider_name_joined,
          i.insurer_name as insurer_name_joined
        FROM general_requests gr
        LEFT JOIN patients p ON gr.patient_id = p.patient_id
        LEFT JOIN providers pr ON gr.provider_id = pr.provider_id
        LEFT JOIN insurers i ON gr.insurer_id = i.insurer_id
        WHERE gr.id = $1
      `;
      const result = await query(getQuery, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'General request not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting general request by ID:', error);
      res.status(500).json({ error: 'Failed to fetch general request' });
    }
  }

  /**
   * Create new general request
   * POST /api/general-requests
   */
  async create(req, res) {
    try {
      const formData = req.body;

      // Extract form sections
      const {
        patient,
        insured,
        provider,
        coverage,
        encounterClass,
        encounterStart,
        encounterEnd,
        service,
        managementItems,
        medications,
        medicationSafetyAnalysis,
        attachments,
        prerequisiteJustification
      } = formData;

      // Generate form number if not provided
      const formNumber = formData.form_number || `GR-${Date.now()}`;

      // Determine status (Draft by default)
      const status = formData.status || 'Draft';

      // Run validation service to get AI suggestions
      let validationResults = null;
      try {
        validationResults = await generalRequestValidationService.validateDiagnosisToScan(formData);
        console.log('✅ Validation completed and stored with request');
      } catch (validationError) {
        console.error('⚠️ Validation failed, continuing without AI results:', validationError.message);
        // Continue without validation results if service fails
      }

      // Insert general request
      const insertQuery = `
        INSERT INTO general_requests (
          form_number,
          patient_id,
          provider_id,
          insurer_id,
          status,
          patient_data,
          insured_data,
          provider_data,
          coverage_data,
          encounter_class,
          encounter_start,
          encounter_end,
          service_data,
          management_items,
          medications,
          medication_safety_analysis,
          validation_results,
          prerequisite_justification,
          attachments,
          submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;

      const values = [
        formNumber,
        formData.patient_id || null, // UUID from form data
        formData.provider_id || null, // UUID from form data
        formData.insurer_id || null, // UUID from form data
        status,
        JSON.stringify(patient || {}),
        JSON.stringify(insured || {}),
        JSON.stringify(provider || {}),
        JSON.stringify(coverage || {}),
        encounterClass || null,
        encounterStart || null,
        encounterEnd || null,
        JSON.stringify(service || {}),
        JSON.stringify(managementItems || []),
        JSON.stringify(medications || []),
        JSON.stringify(medicationSafetyAnalysis || null),
        JSON.stringify(validationResults || null),
        prerequisiteJustification || null,
        JSON.stringify(attachments || []),
        status === 'Submitted' ? new Date() : null
      ];

      const result = await query(insertQuery, values);

      res.status(201).json({ 
        data: result.rows[0],
        message: 'General request created successfully'
      });
    } catch (error) {
      console.error('Error creating general request:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Form number already exists' });
      } else if (error.code === '23503') {
        res.status(400).json({ error: 'Invalid reference to patient, provider, or insurer' });
      } else {
        res.status(500).json({ 
          error: 'Failed to create general request',
          details: error.message
        });
      }
    }
  }

  /**
   * Update existing general request
   * PUT /api/general-requests/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const formData = req.body;

      // Check if record exists
      const existsQuery = 'SELECT id, status FROM general_requests WHERE id = $1';
      const existsResult = await query(existsQuery, [id]);
      
      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'General request not found' });
      }

      // Extract form sections
      const {
        patient,
        insured,
        provider,
        coverage,
        encounterClass,
        encounterStart,
        encounterEnd,
        service,
        managementItems,
        medications,
        medicationSafetyAnalysis,
        attachments,
        prerequisiteJustification
      } = formData;

      // Determine status
      const status = formData.status || existsResult.rows[0].status;

      // Run validation service to get updated AI suggestions
      let validationResults = null;
      try {
        validationResults = await generalRequestValidationService.validateDiagnosisToScan(formData);
        console.log('✅ Validation updated for request');
      } catch (validationError) {
        console.error('⚠️ Validation failed during update:', validationError.message);
        // Continue without validation results if service fails
      }

      // Update general request
      const updateQuery = `
        UPDATE general_requests
        SET
          patient_id = $1,
          provider_id = $2,
          insurer_id = $3,
          status = $4,
          patient_data = $5,
          insured_data = $6,
          provider_data = $7,
          coverage_data = $8,
          encounter_class = $9,
          encounter_start = $10,
          encounter_end = $11,
          service_data = $12,
          management_items = $13,
          medications = $14,
          medication_safety_analysis = $15,
          validation_results = $16,
          prerequisite_justification = $17,
          attachments = $18,
          submitted_at = $19,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $20
        RETURNING *
      `;

      const values = [
        formData.patient_id || null,
        formData.provider_id || null,
        formData.insurer_id || null,
        status,
        JSON.stringify(patient || {}),
        JSON.stringify(insured || {}),
        JSON.stringify(provider || {}),
        JSON.stringify(coverage || {}),
        encounterClass || null,
        encounterStart || null,
        encounterEnd || null,
        JSON.stringify(service || {}),
        JSON.stringify(managementItems || []),
        JSON.stringify(medications || []),
        JSON.stringify(medicationSafetyAnalysis || null),
        JSON.stringify(validationResults || null),
        prerequisiteJustification || null,
        JSON.stringify(attachments || []),
        status === 'Submitted' && !existsResult.rows[0].submitted_at ? new Date() : existsResult.rows[0].submitted_at,
        id
      ];

      const result = await query(updateQuery, values);

      res.json({ 
        data: result.rows[0],
        message: 'General request updated successfully'
      });
    } catch (error) {
      console.error('Error updating general request:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Form number already exists' });
      } else if (error.code === '23503') {
        res.status(400).json({ error: 'Invalid reference to patient, provider, or insurer' });
      } else {
        res.status(500).json({ 
          error: 'Failed to update general request',
          details: error.message
        });
      }
    }
  }

  /**
   * Delete general request
   * DELETE /api/general-requests/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existsQuery = 'SELECT id FROM general_requests WHERE id = $1';
      const existsResult = await query(existsQuery, [id]);
      
      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'General request not found' });
      }

      // Delete
      await query('DELETE FROM general_requests WHERE id = $1', [id]);

      res.json({ message: 'General request deleted successfully' });
    } catch (error) {
      console.error('Error deleting general request:', error);
      res.status(500).json({ error: 'Failed to delete general request' });
    }
  }
}

export default new GeneralRequestsController();

