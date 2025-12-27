import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import priorAuthMapper, { getMapper } from '../services/priorAuthMapper/index.js';
import nphiesService from '../services/nphiesService.js';
import communicationService from '../services/communicationService.js';
import nphiesDataService from '../services/nphiesDataService.js';
import CommunicationMapper from '../services/communicationMapper.js';

class PriorAuthorizationsController extends BaseController {
  constructor() {
    super('prior_authorizations', validationSchemas.priorAuthorization);
  }

  /**
   * Derive sub_type from encounter_class following NPHIES rules
   * This ensures consistency between Prior Auth and Claims
   */
  getSubTypeFromEncounterClass(encounterClass, authType) {
    // Map encounter class to claim subtype
    const subTypes = {
      'inpatient': 'ip',
      'outpatient': 'op',
      'daycase': 'ip',
      'emergency': 'emr',
      'ambulatory': 'op',
      'home': 'op',
      'telemedicine': 'op'
    };
    
    // Default based on auth type if encounter class not found
    const defaultByAuthType = {
      'institutional': 'ip',
      'professional': 'op',
      'pharmacy': 'op',
      'dental': 'op',
      'vision': 'op'
    };
    
    return subTypes[encounterClass] || defaultByAuthType[authType] || 'op';
  }

  /**
   * Get coverage data for a patient/insurer combination
   * @param {string} patientId - Patient UUID
   * @param {string} insurerId - Insurer UUID
   * @param {string} coverageId - Optional specific coverage ID
   * @returns {Object|null} Coverage data with insurer info
   */
  async getCoverageData(patientId, insurerId, coverageId = null) {
    try {
      let coverageResult;
      
      if (coverageId) {
        // Get specific coverage by ID
        coverageResult = await query(`
          SELECT pc.*, i.insurer_name, i.nphies_id as insurer_nphies_id
          FROM patient_coverage pc
          LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
          WHERE pc.coverage_id = $1
        `, [coverageId]);
      } else if (patientId && insurerId) {
        // Get coverage by patient + insurer
        coverageResult = await query(`
          SELECT pc.*, i.insurer_name, i.nphies_id as insurer_nphies_id
          FROM patient_coverage pc
          LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
          WHERE pc.patient_id = $1 AND pc.insurer_id = $2 AND pc.is_active = true
          ORDER BY pc.created_at DESC
          LIMIT 1
        `, [patientId, insurerId]);
      }

      if (coverageResult && coverageResult.rows.length > 0) {
        return coverageResult.rows[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching coverage data:', error);
      return null;
    }
  }

  /**
   * Get all prior authorizations with joins and filtering
   */
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';
      const authType = req.query.auth_type || '';

      // Build dynamic WHERE clause
      let whereConditions = [];
      let queryParams = [limit, offset];
      let countParams = [];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`(
          pa.request_number ILIKE $${paramIndex} OR 
          pa.pre_auth_ref ILIKE $${paramIndex} OR 
          p.name ILIKE $${paramIndex} OR 
          pr.provider_name ILIKE $${paramIndex} OR 
          i.insurer_name ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`pa.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      if (authType) {
        whereConditions.push(`pa.auth_type = $${paramIndex}`);
        queryParams.push(authType);
        countParams.push(authType);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM prior_authorizations pa
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins - including new adjudication columns
      const dataQuery = `
        SELECT
          pa.id, pa.request_number, pa.auth_type, pa.patient_id, pa.provider_id, pa.insurer_id,
          pa.status, pa.outcome, pa.adjudication_outcome, pa.disposition, pa.pre_auth_ref,
          pa.pre_auth_period_start, pa.pre_auth_period_end, pa.total_amount, pa.approved_amount,
          pa.eligible_amount, pa.benefit_amount, pa.copay_amount, pa.currency,
          pa.request_date, pa.response_date, pa.created_at, pa.updated_at,
          p.name as patient_name,
          p.identifier as patient_identifier,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          (SELECT COUNT(*) FROM prior_authorization_items WHERE prior_auth_id = pa.id) as item_count
        FROM prior_authorizations pa
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY pa.created_at DESC 
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
      console.error('Error getting prior authorizations:', error);
      res.status(500).json({ error: 'Failed to fetch prior authorizations' });
    }
  }

  /**
   * Internal method to get full prior authorization by ID
   */
  async getByIdInternal(id) {
    // Get main form data including all new columns
    const formQuery = `
      SELECT
        pa.id, pa.request_number, pa.auth_type, pa.patient_id, pa.provider_id, pa.insurer_id,
        pa.coverage_id, pa.practitioner_id, pa.status, pa.outcome, pa.adjudication_outcome,
        pa.disposition, pa.pre_auth_ref, pa.nphies_request_id, pa.nphies_response_id,
        pa.is_nphies_generated, pa.encounter_class, pa.encounter_start, pa.encounter_end,
        pa.is_update, pa.related_auth_id, pa.is_resubmission, pa.related_claim_identifier,
        pa.is_transfer, pa.transfer_provider_id,
        pa.transfer_auth_number, pa.transfer_period_start, pa.transfer_period_end,
        pa.is_newborn, pa.birth_weight, pa.mother_patient_id,
        pa.is_cancelled, pa.cancellation_reason, pa.eligibility_ref, pa.eligibility_offline_ref,
        pa.eligibility_offline_date, pa.diagnosis_codes, pa.primary_diagnosis, pa.priority,
        pa.total_amount, pa.approved_amount, pa.eligible_amount, pa.benefit_amount, pa.copay_amount,
        pa.currency, pa.request_bundle, pa.response_bundle, pa.request_date, pa.response_date,
        pa.pre_auth_period_start, pa.pre_auth_period_end, pa.created_at, pa.updated_at,
        pa.encounter_identifier, pa.service_type, pa.sub_type, pa.vision_prescription,
        pa.nphies_message_id, pa.nphies_response_code, pa.original_request_identifier,
        pa.insurance_sequence, pa.insurance_focal,
        pa.claim_response_status, pa.claim_response_use, pa.claim_response_created,
        pa.practice_code, pa.service_event_type,
        pa.triage_category, pa.triage_date, pa.encounter_priority,
        pa.eligibility_response_id, pa.eligibility_response_system,
        pa.medication_safety_analysis,
        pa.drug_interaction_justification,
        pa.drug_interaction_justification_date,
        pa.lab_observations,
        p.name as patient_name,
        p.identifier as patient_identifier,
        p.gender as patient_gender,
        p.birth_date as patient_birth_date,
        pr.provider_name,
        pr.nphies_id as provider_nphies_id,
        pr.provider_type,
        i.insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM prior_authorizations pa
      LEFT JOIN patients p ON pa.patient_id = p.patient_id
      LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
      LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
      WHERE pa.id = $1
    `;
    const formResult = await query(formQuery, [id]);

    if (formResult.rows.length === 0) {
      return null;
    }

    const priorAuth = formResult.rows[0];

    // Get items
    const itemsQuery = `
      SELECT * FROM prior_authorization_items
      WHERE prior_auth_id = $1
      ORDER BY sequence ASC
    `;
    const itemsResult = await query(itemsQuery, [id]);

    // Get supporting info
    const supportingInfoQuery = `
      SELECT * FROM prior_authorization_supporting_info
      WHERE prior_auth_id = $1
      ORDER BY sequence ASC
    `;
    const supportingInfoResult = await query(supportingInfoQuery, [id]);

    // Get attachments
    const attachmentsQuery = `
      SELECT id, prior_auth_id, supporting_info_id, file_name, content_type, 
             file_size, title, description, category, binary_id, created_at
      FROM prior_authorization_attachments
      WHERE prior_auth_id = $1
      ORDER BY created_at ASC
    `;
    const attachmentsResult = await query(attachmentsQuery, [id]);

    // Get diagnoses
    const diagnosesQuery = `
      SELECT * FROM prior_authorization_diagnoses
      WHERE prior_auth_id = $1
      ORDER BY sequence ASC
    `;
    const diagnosesResult = await query(diagnosesQuery, [id]);

    // Get responses
    const responsesQuery = `
      SELECT id, prior_auth_id, response_type, outcome, disposition, 
             pre_auth_ref, has_errors, errors, is_nphies_generated, 
             nphies_response_id, received_at
      FROM prior_authorization_responses
      WHERE prior_auth_id = $1
      ORDER BY received_at DESC
    `;
    const responsesResult = await query(responsesQuery, [id]);

    return {
      ...priorAuth,
      items: itemsResult.rows,
      supporting_info: supportingInfoResult.rows,
      attachments: attachmentsResult.rows,
      diagnoses: diagnosesResult.rows,
      responses: responsesResult.rows
    };
  }

  /**
   * Get prior authorization by ID with full details
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const priorAuth = await this.getByIdInternal(id);

      if (!priorAuth) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      res.json({ data: priorAuth });
    } catch (error) {
      console.error('Error getting prior authorization by ID:', error);
      res.status(500).json({ error: 'Failed to fetch prior authorization' });
    }
  }

  /**
   * Create new prior authorization with nested data
   */
  async create(req, res) {
    try {
      const { items, supporting_info, diagnoses, attachments, ...formData } = req.body;

      // Clean up data
      const cleanedData = this.cleanFormData(formData);

      // Validate input
      const { error, value } = this.validationSchema.validate(cleanedData, { abortEarly: false });
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        return res.status(400).json({
          error: 'Validation failed',
          errors,
          message: errors[0].message
        });
      }

      // Generate request number if not provided
      if (!value.request_number) {
        value.request_number = `PA-${Date.now()}`;
      }

      // Set default status
      if (!value.status) {
        value.status = 'draft';
      }

      // Handle mother patient data for newborn requests
      // If mother_patient_data is provided, upsert the mother patient first
      if (value.is_newborn && value.mother_patient_data && !value.mother_patient_id) {
        try {
          const motherPatientData = value.mother_patient_data;
          const motherPatient = await nphiesDataService.upsertPatient({
            name: motherPatientData.name,
            identifier: motherPatientData.identifier,
            identifierType: motherPatientData.identifierType || 'iqama',
            gender: motherPatientData.gender,
            birthDate: motherPatientData.birthDate,
            phone: motherPatientData.phone,
            email: motherPatientData.email,
            isNewborn: false // Mother is not a newborn
          });
          value.mother_patient_id = motherPatient.patient_id;
        } catch (error) {
          console.error('[createPriorAuth] Error upserting mother patient:', error);
          return res.status(400).json({ error: `Failed to process mother patient: ${error.message}` });
        }
      }
      // Remove mother_patient_data from value (we only store mother_patient_id)
      delete value.mother_patient_data;

      // Prepare JSONB fields for PostgreSQL (stringify objects/arrays)
      this.prepareJsonbFields(value);

      // Extract columns and values for main table
      // Note: coverage_id is excluded because DB column is INTEGER but we use UUID from patient_coverage
      const columns = Object.keys(value).filter(key => 
        !['items', 'supporting_info', 'diagnoses', 'attachments', 'coverage_id'].includes(key)
      );
      const values = columns.map(col => value[col]);

      // Insert main record
      const insertQuery = `
        INSERT INTO prior_authorizations (${columns.join(', ')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING *
      `;
      const result = await query(insertQuery, values);
      const priorAuthId = result.rows[0].id;

      // Insert items
      if (items && Array.isArray(items) && items.length > 0) {
        await this.insertItems(priorAuthId, items);
      }

      // Insert supporting info and get sequence -> ID mapping
      let supportingInfoSequenceMap = {};
      if (supporting_info && Array.isArray(supporting_info) && supporting_info.length > 0) {
        supportingInfoSequenceMap = await this.insertSupportingInfo(priorAuthId, supporting_info);
      }

      // Insert diagnoses
      if (diagnoses && Array.isArray(diagnoses) && diagnoses.length > 0) {
        await this.insertDiagnoses(priorAuthId, diagnoses);
      }

      // Insert attachments with supporting_info_id linking
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        await this.insertAttachments(priorAuthId, attachments, supportingInfoSequenceMap);
      }

      // Get complete record
      const completeData = await this.getByIdInternal(priorAuthId);

      res.status(201).json({ data: completeData });
    } catch (error) {
      console.error('Error creating prior authorization:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Request number already exists' });
      } else if (error.code === '23503') {
        res.status(400).json({ error: 'Invalid reference (patient, provider, or insurer not found)' });
      } else {
        res.status(500).json({ error: error.message || 'Failed to create prior authorization' });
      }
    }
  }

  /**
   * Update prior authorization
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { items, supporting_info, diagnoses, attachments, ...formData } = req.body;

      // Check if exists
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Only allow updates on draft or error status
      if (!['draft', 'error'].includes(existing.status)) {
        return res.status(400).json({ 
          error: 'Cannot update prior authorization with status: ' + existing.status 
        });
      }

      // Clean up data
      const cleanedData = this.cleanFormData(formData);

      // Validate input
      const { error, value } = this.validationSchema.validate(cleanedData, { abortEarly: false });
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        return res.status(400).json({
          error: 'Validation failed',
          errors,
          message: errors[0].message
        });
      }

      // Handle mother patient data for newborn requests (same logic as create)
      if (value.is_newborn && value.mother_patient_data && !value.mother_patient_id) {
        try {
          const motherPatientData = value.mother_patient_data;
          const motherPatient = await nphiesDataService.upsertPatient({
            name: motherPatientData.name,
            identifier: motherPatientData.identifier,
            identifierType: motherPatientData.identifierType || 'iqama',
            gender: motherPatientData.gender,
            birthDate: motherPatientData.birthDate,
            phone: motherPatientData.phone,
            email: motherPatientData.email,
            isNewborn: false // Mother is not a newborn
          });
          value.mother_patient_id = motherPatient.patient_id;
        } catch (error) {
          console.error('[updatePriorAuth] Error upserting mother patient:', error);
          return res.status(400).json({ error: `Failed to process mother patient: ${error.message}` });
        }
      }
      // Remove mother_patient_data from value (we only store mother_patient_id)
      delete value.mother_patient_data;

      // Prepare JSONB fields for PostgreSQL (stringify objects/arrays)
      this.prepareJsonbFields(value);

      // Extract columns and values
      // Note: coverage_id is excluded because DB column is INTEGER but we use UUID from patient_coverage
      const columns = Object.keys(value).filter(key => 
        !['items', 'supporting_info', 'diagnoses', 'attachments', 'coverage_id'].includes(key)
      );
      const values = [...columns.map(col => value[col]), id];

      // Update main record
      const updateQuery = `
        UPDATE prior_authorizations
        SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${columns.length + 1}
        RETURNING *
      `;
      await query(updateQuery, values);

      // Delete and re-insert nested data
      await query('DELETE FROM prior_authorization_items WHERE prior_auth_id = $1', [id]);
      await query('DELETE FROM prior_authorization_supporting_info WHERE prior_auth_id = $1', [id]);
      await query('DELETE FROM prior_authorization_diagnoses WHERE prior_auth_id = $1', [id]);
      await query('DELETE FROM prior_authorization_attachments WHERE prior_auth_id = $1', [id]);

      // Re-insert items
      if (items && Array.isArray(items) && items.length > 0) {
        await this.insertItems(id, items);
      }

      // Re-insert supporting info and get sequence -> ID mapping
      let supportingInfoSequenceMap = {};
      if (supporting_info && Array.isArray(supporting_info) && supporting_info.length > 0) {
        supportingInfoSequenceMap = await this.insertSupportingInfo(id, supporting_info);
      }

      // Re-insert diagnoses
      if (diagnoses && Array.isArray(diagnoses) && diagnoses.length > 0) {
        await this.insertDiagnoses(id, diagnoses);
      }

      // Re-insert attachments with supporting_info_id linking
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        await this.insertAttachments(id, attachments, supportingInfoSequenceMap);
      }

      // Get complete record
      const completeData = await this.getByIdInternal(id);

      res.json({ data: completeData });
    } catch (error) {
      console.error('Error updating prior authorization:', error);
      res.status(500).json({ error: error.message || 'Failed to update prior authorization' });
    }
  }

  /**
   * Delete prior authorization
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existing = await query('SELECT id, status FROM prior_authorizations WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Only allow deletion of draft records
      if (existing.rows[0].status !== 'draft') {
        return res.status(400).json({ 
          error: 'Can only delete draft prior authorizations' 
        });
      }

      // Delete (cascade will handle related records)
      await query('DELETE FROM prior_authorizations WHERE id = $1', [id]);

      res.json({ message: 'Prior authorization deleted successfully' });
    } catch (error) {
      console.error('Error deleting prior authorization:', error);
      res.status(500).json({ error: 'Failed to delete prior authorization' });
    }
  }

  /**
   * Send prior authorization to NPHIES
   */
  async sendToNphies(req, res) {
    try {
      const { id } = req.params;

      // Get full prior authorization data
      const priorAuth = await this.getByIdInternal(id);
      if (!priorAuth) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Only send draft or error status
      if (!['draft', 'error'].includes(priorAuth.status)) {
        return res.status(400).json({ 
          error: 'Can only send prior authorizations with draft or error status' 
        });
      }

      // Get patient, provider, insurer data
      const patientResult = await query('SELECT * FROM patients WHERE patient_id = $1', [priorAuth.patient_id]);
      const providerResult = await query('SELECT * FROM providers WHERE provider_id = $1', [priorAuth.provider_id]);
      const insurerResult = await query('SELECT * FROM insurers WHERE insurer_id = $1', [priorAuth.insurer_id]);

      if (patientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Patient not found' });
      }
      if (providerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider not found' });
      }
      if (insurerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Insurer not found' });
      }

      const patient = patientResult.rows[0];
      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];

      // Fetch coverage data for the patient/insurer
      const coverage = await this.getCoverageData(
        priorAuth.patient_id, 
        priorAuth.insurer_id,
        priorAuth.coverage_id
      );

      // Fetch mother patient if this is a newborn request
      let motherPatient = null;
      if (priorAuth.is_newborn && priorAuth.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [priorAuth.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }

      // For resubmission, ensure related_claim_identifier is set to the original request_number
      // This is used to reference the original Claim using its original identifier (provider system + request_number)
      if (priorAuth.is_resubmission && priorAuth.related_auth_id && !priorAuth.related_claim_identifier) {
        try {
          const originalAuth = await this.getByIdInternal(priorAuth.related_auth_id);
          if (originalAuth && originalAuth.request_number) {
            priorAuth.related_claim_identifier = originalAuth.request_number;
          }
        } catch (error) {
          console.warn('[sendToNphies] Could not look up original authorization for resubmission:', error.message);
        }
      }

      // For follow-up/update, ensure related_claim_identifier is set to the original request_number
      // This is used to reference the original Claim using its original identifier (provider system + request_number)
      if (priorAuth.is_update && priorAuth.related_auth_id && !priorAuth.related_claim_identifier) {
        try {
          const originalAuth = await this.getByIdInternal(priorAuth.related_auth_id);
          if (originalAuth && originalAuth.request_number) {
            priorAuth.related_claim_identifier = originalAuth.request_number;
          }
        } catch (error) {
          console.warn('[sendToNphies] Could not look up original authorization for follow-up:', error.message);
        }
      }

      // Build FHIR bundle
      const bundle = priorAuthMapper.buildPriorAuthRequestBundle({
        priorAuth,
        patient,
        provider,
        insurer,
        coverage,
        policyHolder: null, // policyHolder can reference the patient if self, or a RelatedPerson/Organization
        motherPatient: motherPatient
      });

      // Generate request ID
      const nphiesRequestId = `pa-req-${Date.now()}`;

      // Update status to pending and store request bundle
      await query(`
        UPDATE prior_authorizations 
        SET status = 'pending', 
            nphies_request_id = $1, 
            request_bundle = $2,
            request_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [nphiesRequestId, JSON.stringify(bundle), id]);

      // Send to NPHIES (use submitPriorAuth for prior authorization requests)
      const nphiesResponse = await nphiesService.submitPriorAuth(bundle);

      if (nphiesResponse.success) {
        // Validate response structure
        const validation = priorAuthMapper.validatePriorAuthResponse(nphiesResponse.data);
        if (!validation.valid) {
          console.error('[PriorAuth] Invalid response structure:', validation.errors);
        }

        // Parse response
        const parsedResponse = priorAuthMapper.parsePriorAuthResponse(nphiesResponse.data);

        // Debug logging for response parsing
        console.log('[PriorAuth] ===== NPHIES Response Parsing =====');
        console.log('[PriorAuth] Prior Auth ID:', id);
        console.log('[PriorAuth] Parsed outcome:', parsedResponse.outcome);
        console.log('[PriorAuth] Parsed adjudicationOutcome:', parsedResponse.adjudicationOutcome);
        console.log('[PriorAuth] Parsed success:', parsedResponse.success);
        console.log('[PriorAuth] Parsed preAuthRef:', parsedResponse.preAuthRef);
        console.log('[PriorAuth] Parsed errors:', parsedResponse.errors);

        // Update prior authorization with response
        // Use adjudicationOutcome (approved/rejected) for status determination
        const newStatus = parsedResponse.outcome === 'queued' ? 'queued' : 
                         parsedResponse.adjudicationOutcome === 'approved' ? 'approved' :
                         parsedResponse.adjudicationOutcome === 'rejected' ? 'denied' :
                         parsedResponse.outcome === 'partial' ? 'partial' : 
                         parsedResponse.success ? 'approved' : 'denied';

        // Debug logging for status determination
        console.log('[PriorAuth] Calculated newStatus:', newStatus);
        console.log('[PriorAuth] =====================================');

        // Extract all totals from response
        const eligibleTotal = parsedResponse.totals?.find(t => t.category === 'eligible')?.amount;
        const benefitTotal = parsedResponse.totals?.find(t => t.category === 'benefit')?.amount;
        const copayTotal = parsedResponse.totals?.find(t => t.category === 'copay')?.amount;
        
        // Fallback to item-level if totals not present
        const totalBenefit = benefitTotal ||
                            parsedResponse.itemResults?.[0]?.adjudication?.find(a => a.category === 'benefit')?.amount;

        await query(`
          UPDATE prior_authorizations 
          SET status = $1,
              outcome = $2,
              disposition = $3,
              pre_auth_ref = $4,
              nphies_response_id = $5,
              is_nphies_generated = $6,
              response_bundle = $7,
              response_date = CURRENT_TIMESTAMP,
              pre_auth_period_start = $8,
              pre_auth_period_end = $9,
              approved_amount = $10,
              adjudication_outcome = $11,
              eligible_amount = $12,
              benefit_amount = $13,
              copay_amount = $14,
              nphies_message_id = $15,
              nphies_response_code = $16,
              original_request_identifier = $17,
              insurance_sequence = $18,
              insurance_focal = $19,
              claim_response_status = $20,
              claim_response_use = $21,
              claim_response_created = $22,
              transfer_auth_number = $23,
              transfer_period_start = $24,
              transfer_period_end = $25,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $26
        `, [
          newStatus,
          parsedResponse.outcome,
          parsedResponse.disposition,
          parsedResponse.preAuthRef,
          parsedResponse.nphiesResponseId,
          parsedResponse.isNphiesGenerated,
          JSON.stringify(nphiesResponse.data),
          parsedResponse.preAuthPeriod?.start,
          parsedResponse.preAuthPeriod?.end,
          totalBenefit,
          parsedResponse.adjudicationOutcome,
          eligibleTotal,
          benefitTotal,
          copayTotal,
          // New fields
          parsedResponse.messageHeaderId,
          parsedResponse.responseCode,
          parsedResponse.originalRequestIdentifier,
          parsedResponse.insuranceSequence,
          parsedResponse.insuranceFocal,
          parsedResponse.claimResponseStatus,
          parsedResponse.claimResponseUse,
          parsedResponse.claimResponseCreated,
          // Transfer authorization response fields (NPHIES Test Case 9)
          parsedResponse.transfer?.authNumber || null,
          parsedResponse.transfer?.period?.start || null,
          parsedResponse.transfer?.period?.end || null,
          id
        ]);

        console.log(`[PriorAuth] Database updated - ID: ${id}, Status: ${newStatus}, AdjudicationOutcome: ${parsedResponse.adjudicationOutcome}`);

        // Store response in history with additional data
        // Note: outcome column uses FHIR ClaimResponse.outcome values (complete/partial/error/queued)
        // NOT adjudicationOutcome values (approved/rejected) - those go in the main table's adjudication_outcome column
        await query(`
          INSERT INTO prior_authorization_responses 
          (prior_auth_id, response_type, outcome, disposition, pre_auth_ref, 
           bundle_json, has_errors, errors, is_nphies_generated, nphies_response_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          id,
          'initial',
          parsedResponse.outcome || 'complete',  // FHIR outcome: complete/partial/error/queued
          parsedResponse.disposition,
          parsedResponse.preAuthRef,
          JSON.stringify(nphiesResponse.data),
          !parsedResponse.success,
          parsedResponse.errors ? JSON.stringify(parsedResponse.errors) : null,
          parsedResponse.isNphiesGenerated,
          parsedResponse.nphiesResponseId
        ]);

        // Update item adjudication if present
        if (parsedResponse.itemResults) {
          // Map NPHIES adjudication outcome to database-compatible status
          const mapAdjudicationStatus = (nphiesOutcome) => {
            const statusMap = {
              'approved': 'approved',
              'rejected': 'denied',    // NPHIES uses 'rejected', DB uses 'denied'
              'denied': 'denied',
              'partial': 'partial',
              'pended': 'pending',     // NPHIES uses 'pended', DB uses 'pending'
              'pending': 'pending',
              'queued': 'pending'
            };
            return statusMap[nphiesOutcome?.toLowerCase()] || null;
          };

          for (const itemResult of parsedResponse.itemResults) {
            // Use item-level outcome extension if available, otherwise derive from adjudication
            const adjStatus = mapAdjudicationStatus(itemResult.outcome) || 
                             (itemResult.adjudication?.find(a => a.category === 'eligible') ? 'approved' :
                              itemResult.adjudication?.find(a => a.category === 'denied') ? 'denied' : 'pending');
            const adjAmount = itemResult.benefitAmount || 
                             itemResult.adjudication?.find(a => a.category === 'benefit')?.amount;
            const adjReason = itemResult.adjudication?.find(a => a.reason)?.reasonDisplay || 
                             itemResult.adjudication?.find(a => a.reason)?.reason;
            
            // Extract additional item-level adjudication amounts
            const adjEligibleAmount = itemResult.eligibleAmount;
            const adjCopayAmount = itemResult.copayAmount;
            const adjApprovedQuantity = itemResult.approvedQuantity;
            
            await query(`
              UPDATE prior_authorization_items 
              SET adjudication_status = $1, 
                  adjudication_amount = $2, 
                  adjudication_reason = $3,
                  adjudication_eligible_amount = $4,
                  adjudication_copay_amount = $5,
                  adjudication_approved_quantity = $6
              WHERE prior_auth_id = $7 AND sequence = $8
            `, [
              adjStatus, 
              adjAmount, 
              adjReason, 
              adjEligibleAmount,
              adjCopayAmount,
              adjApprovedQuantity,
              id, 
              itemResult.itemSequence
            ]);
          }
        }

        // Get updated record
        const updatedData = await this.getByIdInternal(id);

        res.json({
          success: true,
          data: updatedData,
          nphiesResponse: {
            ...parsedResponse,
            // Exclude rawBundle from API response (it's stored in response_bundle)
            rawBundle: undefined
          }
        });
      } else {
        // Handle NPHIES error
        await query(`
          UPDATE prior_authorizations 
          SET status = 'error',
              outcome = 'error',
              disposition = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [nphiesResponse.error?.message || 'NPHIES request failed', id]);

        // Store error response (bundle_json cannot be null)
        await query(`
          INSERT INTO prior_authorization_responses 
          (prior_auth_id, response_type, outcome, bundle_json, has_errors, errors)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          id,
          'initial',
          'error',
          JSON.stringify(nphiesResponse.raw || {}),
          true,
          JSON.stringify([nphiesResponse.error])
        ]);

        res.status(502).json({
          success: false,
          error: nphiesResponse.error,
          data: await this.getByIdInternal(id)
        });
      }
    } catch (error) {
      console.error('Error sending prior authorization to NPHIES:', error);
      res.status(500).json({ error: error.message || 'Failed to send prior authorization' });
    }
  }

  /**
   * Submit update to existing authorization
   */
  async submitUpdate(req, res) {
    try {
      const { id } = req.params;
      const { items, supporting_info, diagnoses, attachments } = req.body;

      // Get existing prior authorization
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // For follow-up/update, we need the original request_number to reference the original Claim
      // Use the original authorization's request_number for Claim.related reference
      if (!existing.request_number) {
        return res.status(400).json({ 
          error: 'Cannot update: original authorization request_number is required' 
        });
      }

      // Create new prior authorization record for the update
      const updateData = {
        ...existing,
        id: undefined,
        request_number: `PA-UPD-${Date.now()}`,
        status: 'draft',
        is_update: true,
        related_auth_id: id,
        related_claim_identifier: existing.request_number, // Original request_number for Claim.related
        pre_auth_ref: existing.pre_auth_ref, // Keep for reference but not used in Claim.related
        items: items || existing.items,
        supporting_info: supporting_info || existing.supporting_info,
        diagnoses: diagnoses || existing.diagnoses,
        attachments: attachments || existing.attachments
      };

      // Create the update record
      const columns = Object.keys(updateData).filter(key => 
        !['items', 'supporting_info', 'diagnoses', 'attachments', 'responses', 
          'patient_name', 'patient_identifier', 'patient_gender', 'patient_birth_date',
          'provider_name', 'provider_nphies_id', 'provider_type',
          'insurer_name', 'insurer_nphies_id', 'request_bundle', 'response_bundle'].includes(key) &&
        updateData[key] !== undefined
      );
      const values = columns.map(col => updateData[col]);

      const insertQuery = `
        INSERT INTO prior_authorizations (${columns.join(', ')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING id
      `;
      const result = await query(insertQuery, values);
      const newId = result.rows[0].id;

      // Insert nested data
      if (updateData.items && updateData.items.length > 0) {
        await this.insertItems(newId, updateData.items);
      }
      if (updateData.supporting_info && updateData.supporting_info.length > 0) {
        const supportingInfoSequenceMap = await this.insertSupportingInfo(newId, updateData.supporting_info);
      }
      if (updateData.diagnoses && updateData.diagnoses.length > 0) {
        await this.insertDiagnoses(newId, updateData.diagnoses);
      }
      if (updateData.attachments && updateData.attachments.length > 0) {
        await this.insertAttachments(newId, updateData.attachments);
      }

      const completeData = await this.getByIdInternal(newId);

      res.status(201).json({ 
        data: completeData,
        message: 'Update request created. Use /send to submit to NPHIES.'
      });
    } catch (error) {
      console.error('Error creating update request:', error);
      res.status(500).json({ error: error.message || 'Failed to create update request' });
    }
  }

  /**
   * Cancel prior authorization
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Get existing prior authorization
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Must have pre_auth_ref to cancel
      if (!existing.pre_auth_ref) {
        return res.status(400).json({ 
          error: 'Cannot cancel: no prior authorization reference exists' 
        });
      }

      // Check if pre_auth_period has expired
      if (existing.pre_auth_period_end) {
        const periodEnd = new Date(existing.pre_auth_period_end);
        if (periodEnd < new Date()) {
          return res.status(400).json({ 
            error: 'Cannot cancel: authorization period has expired' 
          });
        }
      }

      // Get provider and insurer data
      const providerResult = await query('SELECT * FROM providers WHERE provider_id = $1', [existing.provider_id]);
      const insurerResult = await query('SELECT * FROM insurers WHERE insurer_id = $1', [existing.insurer_id]);

      if (providerResult.rows.length === 0 || insurerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider or insurer not found' });
      }

      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];

      // Build cancel request bundle
      const cancelBundle = priorAuthMapper.buildCancelRequestBundle(existing, provider, insurer, reason);

      // Send to NPHIES using dedicated cancel method
      // Cancel requests return Task response (not ClaimResponse)
      // Reference: https://portal.nphies.sa/ig/usecase-cancel.html
      const nphiesResponse = await nphiesService.submitCancelRequest(cancelBundle);

      if (nphiesResponse.success) {
        // Update status
        await query(`
          UPDATE prior_authorizations 
          SET status = 'cancelled',
              is_cancelled = true,
              cancellation_reason = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [reason, id]);

        // Store response
        // Map NPHIES Task status to DB outcome: 'completed' -> 'complete', 'failed' -> 'error'
        const dbOutcome = nphiesResponse.taskStatus === 'completed' ? 'complete' : 
                          nphiesResponse.taskStatus === 'failed' ? 'error' : 'complete';
        await query(`
          INSERT INTO prior_authorization_responses 
          (prior_auth_id, response_type, outcome, bundle_json)
          VALUES ($1, $2, $3, $4)
        `, [id, 'cancel', dbOutcome, JSON.stringify(nphiesResponse.data)]);

        const updatedData = await this.getByIdInternal(id);

        res.json({
          success: true,
          data: updatedData,
          message: 'Prior authorization cancelled successfully',
          taskStatus: nphiesResponse.taskStatus,
          // Include full NPHIES response for reference
          nphiesResponse: nphiesResponse.data,
          requestBundle: cancelBundle
        });
      } else {
        // Store failed response for debugging
        await query(`
          INSERT INTO prior_authorization_responses 
          (prior_auth_id, response_type, outcome, bundle_json)
          VALUES ($1, $2, $3, $4)
        `, [id, 'cancel', 'error', JSON.stringify(nphiesResponse.data || nphiesResponse.error)]);

        res.status(502).json({
          success: false,
          error: nphiesResponse.error || nphiesResponse.errors,
          taskStatus: nphiesResponse.taskStatus,
          message: 'Failed to cancel prior authorization',
          // Include full NPHIES response for debugging
          nphiesResponse: nphiesResponse.data,
          requestBundle: cancelBundle
        });
      }
    } catch (error) {
      console.error('Error cancelling prior authorization:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel prior authorization' });
    }
  }

  /**
   * Transfer prior authorization to another provider
   */
  async transfer(req, res) {
    try {
      const { id } = req.params;
      const { transfer_provider_id, reason } = req.body;

      // Get existing prior authorization
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Must have pre_auth_ref to transfer
      if (!existing.pre_auth_ref) {
        return res.status(400).json({ 
          error: 'Cannot transfer: no prior authorization reference exists' 
        });
      }

      // Create transfer request (similar to update but with transfer flag)
      const transferData = {
        ...existing,
        id: undefined,
        request_number: `PA-TRF-${Date.now()}`,
        status: 'draft',
        is_transfer: true,
        is_update: true,
        related_auth_id: id,
        transfer_provider_id,
        pre_auth_ref: existing.pre_auth_ref
      };

      // Create the transfer record
      const columns = Object.keys(transferData).filter(key => 
        !['items', 'supporting_info', 'diagnoses', 'attachments', 'responses',
          'patient_name', 'patient_identifier', 'patient_gender', 'patient_birth_date',
          'provider_name', 'provider_nphies_id', 'provider_type',
          'insurer_name', 'insurer_nphies_id', 'request_bundle', 'response_bundle'].includes(key) &&
        transferData[key] !== undefined
      );
      const values = columns.map(col => transferData[col]);

      const insertQuery = `
        INSERT INTO prior_authorizations (${columns.join(', ')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING id
      `;
      const result = await query(insertQuery, values);
      const newId = result.rows[0].id;

      // Copy nested data
      if (existing.items && existing.items.length > 0) {
        await this.insertItems(newId, existing.items);
      }
      if (existing.supporting_info && existing.supporting_info.length > 0) {
        await this.insertSupportingInfo(newId, existing.supporting_info);
      }
      if (existing.diagnoses && existing.diagnoses.length > 0) {
        await this.insertDiagnoses(newId, existing.diagnoses);
      }

      const completeData = await this.getByIdInternal(newId);

      res.status(201).json({ 
        data: completeData,
        message: 'Transfer request created. Use /send to submit to NPHIES.'
      });
    } catch (error) {
      console.error('Error creating transfer request:', error);
      res.status(500).json({ error: error.message || 'Failed to create transfer request' });
    }
  }

  /**
   * Poll for response (for queued requests)
   * Polls NPHIES for: priorauth-response, communication-request, communication
   */
  async poll(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      // Get existing prior authorization
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Only poll for queued/pended status
      const canPoll = existing.status === 'queued' || 
                      existing.outcome === 'queued' || 
                      existing.adjudication_outcome === 'pended';
      
      if (!canPoll) {
        return res.status(400).json({ 
          error: 'Can only poll for queued/pended prior authorizations',
          currentStatus: existing.status,
          outcome: existing.outcome,
          adjudicationOutcome: existing.adjudication_outcome
        });
      }

      // Poll NPHIES for messages
      const pollResult = await communicationService.pollForMessages(id, schemaName);

      if (!pollResult.success) {
        return res.status(500).json({
          error: 'Failed to poll NPHIES',
          details: pollResult.error,
          pollBundle: pollResult.pollBundle // Include the bundle that was sent for debugging
        });
      }

      // Get updated prior authorization data
      const updatedPA = await this.getByIdInternal(id);

      // Build detailed response message
      let message = 'No new messages';
      if (pollResult.claimResponses.length > 0) {
        const firstResponse = pollResult.claimResponses[0];
        const adjOutcome = firstResponse.adjudicationOutcome || firstResponse.status;
        message = `Received authorization response: ${adjOutcome}`;
        if (firstResponse.preAuthRef) {
          message += ` (Ref: ${firstResponse.preAuthRef})`;
        }
      } else if (pollResult.communicationRequests.length > 0) {
        message = `Received ${pollResult.communicationRequests.length} communication request(s) from insurer`;
      } else if (pollResult.shouldAutoPollForFinalResponse) {
        message = 'Acknowledgment received. Auto-polling for final response...';
      } else if (pollResult.matchingDetails && pollResult.matchingDetails.totalFound > 0 && pollResult.matchingDetails.matched === 0) {
        message = `Found ${pollResult.matchingDetails.totalFound} response(s) but none matched this authorization`;
      }

      res.json({
        success: true,
        data: updatedPA,
        pollResults: {
          claimResponses: pollResult.claimResponses,
          communicationRequests: pollResult.communicationRequests,
          acknowledgments: pollResult.acknowledgments,
          // Step 7: Auto-poll flags
          shouldAutoPollForFinalResponse: pollResult.shouldAutoPollForFinalResponse || false,
          autoPollDelayMs: pollResult.autoPollDelayMs,
          autoPollPriorAuthId: pollResult.autoPollPriorAuthId,
          // Add matching details for debugging
          matchingDetails: pollResult.matchingDetails
        },
        // Include poll request and response bundles for debugging
        pollBundle: pollResult.pollBundle,
        responseBundle: pollResult.responseBundle,
        // Include errors if any
        errors: pollResult.errors || [],
        responseCode: pollResult.responseCode,
        has_errors: (pollResult.errors && pollResult.errors.length > 0) || false,
        message
      });
    } catch (error) {
      console.error('Error polling for response:', error);
      res.status(500).json({ error: error.message || 'Failed to poll for response' });
    }
  }

  /**
   * Preview Poll bundle without sending
   * Returns the exact FHIR bundle that would be sent to NPHIES for polling
   */
  async previewPollBundle(req, res) {
    try {
      const { id } = req.params;

      // Get existing prior authorization
      const existing = await this.getByIdInternal(id);
      if (!existing) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Get provider NPHIES ID
      const providerResult = await query(`
        SELECT pr.nphies_id as provider_nphies_id, pr.provider_name
        FROM providers pr
        WHERE pr.provider_id = $1
      `, [existing.provider_id]);

      const providerNphiesId = providerResult.rows[0]?.provider_nphies_id;
      const providerName = providerResult.rows[0]?.provider_name;

      // Build poll bundle using Task-based structure (per NPHIES specification)
      // Include focus to poll for specific authorization (Task-560083 pattern)
      const communicationMapper = new CommunicationMapper();
      const providerDomain = communicationMapper.extractProviderDomain(providerName || 'Healthcare Provider');
      const authReference = communicationMapper.getNphiesAuthReference(existing);
      
      const pollOptions = {
        focus: {
          type: 'Claim',
          identifier: {
            system: `http://${providerDomain}/identifiers/authorization`,
            value: authReference
          }
        }
      };

      const pollBundle = communicationMapper.buildPollRequestBundle(
        providerNphiesId,
        providerName || 'Healthcare Provider',
        undefined, // providerType (not needed for poll)
        pollOptions
      );

      res.json({
        success: true,
        bundle: pollBundle,
        metadata: {
          priorAuthId: id,
          requestNumber: existing.request_number,
          nphiesRequestId: existing.nphies_request_id,
          status: existing.status,
          provider: {
            name: providerName,
            nphiesId: providerNphiesId
          },
          messageTypes: ['priorauth-response', 'communication-request', 'communication']
        }
      });
    } catch (error) {
      console.error('Error generating poll bundle preview:', error);
      res.status(500).json({ error: error.message || 'Failed to generate poll bundle preview' });
    }
  }

  // ============================================================================
  // COMMUNICATION METHODS
  // ============================================================================

  /**
   * Preview Communication bundle without sending
   * Returns the exact FHIR bundle that would be sent to NPHIES
   */
  async previewCommunicationBundle(req, res) {
    try {
      const { id } = req.params;
      const { payloads, type = 'unsolicited', communicationRequestId } = req.body;
      const schemaName = req.schemaName || 'public';

      // Get the bundle from communication service (preview mode)
      const result = await communicationService.previewCommunicationBundle(
        parseInt(id), 
        payloads || [], 
        type,
        communicationRequestId,
        schemaName
      );

      res.json({
        success: true,
        bundle: result.bundle,
        metadata: {
          priorAuthId: id,
          type,
          provider: result.provider,
          insurer: result.insurer,
          patient: result.patient
        }
      });
    } catch (error) {
      console.error('Error previewing communication bundle:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to preview communication bundle'
      });
    }
  }

  /**
   * Send UNSOLICITED Communication (Test Case #1)
   * HCP proactively sends additional information to HIC
   */
  async sendUnsolicitedCommunication(req, res) {
    try {
      const { id } = req.params;
      const { payloads } = req.body;
      const schemaName = req.schemaName || 'public';

      // Validate payloads
      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return res.status(400).json({ 
          error: 'At least one payload is required',
          hint: 'Provide payloads array with contentType and content'
        });
      }

      // Validate each payload has required fields
      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        if (!payload.contentType) {
          return res.status(400).json({
            error: `Payload ${i + 1} missing contentType`,
            hint: 'contentType must be "string", "attachment", or "reference"'
          });
        }
        if (payload.contentType === 'string' && !payload.contentString) {
          return res.status(400).json({
            error: `Payload ${i + 1} has contentType "string" but no contentString`
          });
        }
        if (payload.contentType === 'attachment' && !payload.attachment) {
          return res.status(400).json({
            error: `Payload ${i + 1} has contentType "attachment" but no attachment object`
          });
        }
      }

      // Send the communication
      const result = await communicationService.sendUnsolicitedCommunication(
        id, 
        payloads, 
        schemaName
      );

      res.json({
        success: result.success,
        data: result.communication,
        nphiesResponse: result.nphiesResponse,
        message: result.success 
          ? 'Unsolicited communication sent successfully' 
          : 'Failed to send communication'
      });

    } catch (error) {
      console.error('Error sending unsolicited communication:', error);
      res.status(500).json({ error: error.message || 'Failed to send communication' });
    }
  }

  /**
   * Send SOLICITED Communication (Test Case #2)
   * HCP responds to CommunicationRequest from HIC
   */
  async sendSolicitedCommunication(req, res) {
    try {
      const { id } = req.params;
      const { communicationRequestId, payloads } = req.body;
      const schemaName = req.schemaName || 'public';

      // Validate communicationRequestId
      if (!communicationRequestId) {
        return res.status(400).json({
          error: 'communicationRequestId is required',
          hint: 'Provide the ID of the CommunicationRequest you are responding to'
        });
      }

      // Validate payloads
      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return res.status(400).json({ 
          error: 'At least one payload is required',
          hint: 'For solicited communications, typically include attachments'
        });
      }

      // Send the communication
      const result = await communicationService.sendSolicitedCommunication(
        communicationRequestId,
        payloads,
        schemaName
      );

      res.json({
        success: result.success,
        data: result.communication,
        nphiesResponse: result.nphiesResponse,
        message: result.success 
          ? 'Solicited communication sent successfully' 
          : 'Failed to send communication'
      });

    } catch (error) {
      console.error('Error sending solicited communication:', error);
      res.status(500).json({ error: error.message || 'Failed to send communication' });
    }
  }

  /**
   * Get CommunicationRequests for a Prior Authorization
   * These are requests from HIC asking for additional information
   */
  async getCommunicationRequests(req, res) {
    try {
      const { id } = req.params;
      const { pending } = req.query;
      const schemaName = req.schemaName || 'public';

      let requests;
      if (pending === 'true') {
        requests = await communicationService.getPendingCommunicationRequests(id, schemaName);
      } else {
        requests = await communicationService.getCommunicationRequests(id, schemaName);
      }

      res.json({
        success: true,
        data: requests,
        count: requests.length,
        pendingCount: requests.filter(r => !r.responded_at).length
      });

    } catch (error) {
      console.error('Error getting communication requests:', error);
      res.status(500).json({ error: error.message || 'Failed to get communication requests' });
    }
  }

  /**
   * Get Communications sent for a Prior Authorization
   */
  async getCommunications(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      const communications = await communicationService.getCommunications(id, schemaName);

      res.json({
        success: true,
        data: communications,
        count: communications.length,
        acknowledgedCount: communications.filter(c => c.acknowledgment_received).length
      });

    } catch (error) {
      console.error('Error getting communications:', error);
      res.status(500).json({ error: error.message || 'Failed to get communications' });
    }
  }

  /**
   * Get a single Communication by ID
   */
  async getCommunication(req, res) {
    try {
      const { id, communicationId } = req.params;
      const schemaName = req.schemaName || 'public';

      const communication = await communicationService.getCommunication(communicationId, schemaName);

      if (!communication) {
        return res.status(404).json({ error: 'Communication not found' });
      }

      // Verify it belongs to the prior auth
      if (communication.prior_auth_id !== parseInt(id)) {
        return res.status(403).json({ error: 'Communication does not belong to this prior authorization' });
      }

      res.json({
        success: true,
        data: communication
      });

    } catch (error) {
      console.error('Error getting communication:', error);
      res.status(500).json({ error: error.message || 'Failed to get communication' });
    }
  }

  /**
   * Poll for acknowledgment of a specific Communication
   * Use when communication has acknowledgment_status = 'queued'
   */
  async pollCommunicationAcknowledgment(req, res) {
    try {
      const { id, communicationId } = req.params;
      const schemaName = req.schemaName || 'public';

      // First verify the communication exists and belongs to this PA
      const communication = await communicationService.getCommunication(communicationId, schemaName);

      if (!communication) {
        return res.status(404).json({ error: 'Communication not found' });
      }

      if (communication.prior_auth_id !== parseInt(id)) {
        return res.status(403).json({ error: 'Communication does not belong to this prior authorization' });
      }

      // Poll for acknowledgment
      const result = await communicationService.pollForAcknowledgment(communication.id, schemaName);

      res.json(result);

    } catch (error) {
      console.error('Error polling for communication acknowledgment:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to poll for acknowledgment' 
      });
    }
  }

  /**
   * Poll for all queued acknowledgments for a Prior Authorization
   */
  async pollAllQueuedAcknowledgments(req, res) {
    try {
      const { id } = req.params;
      const schemaName = req.schemaName || 'public';

      // Poll for all queued acknowledgments
      const result = await communicationService.pollForAllQueuedAcknowledgments(id, schemaName);

      res.json(result);

    } catch (error) {
      console.error('Error polling for all queued acknowledgments:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to poll for acknowledgments' 
      });
    }
  }

  /**
   * Get FHIR bundle preview for saved PA
   */
  async getBundle(req, res) {
    try {
      const { id } = req.params;

      // Get full prior authorization data
      const priorAuth = await this.getByIdInternal(id);
      if (!priorAuth) {
        return res.status(404).json({ error: 'Prior authorization not found' });
      }

      // Get patient, provider, insurer data
      const patientResult = await query('SELECT * FROM patients WHERE patient_id = $1', [priorAuth.patient_id]);
      const providerResult = await query('SELECT * FROM providers WHERE provider_id = $1', [priorAuth.provider_id]);
      const insurerResult = await query('SELECT * FROM insurers WHERE insurer_id = $1', [priorAuth.insurer_id]);

      if (patientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Patient not found' });
      }
      if (providerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider not found' });
      }
      if (insurerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Insurer not found' });
      }

      const patient = patientResult.rows[0];
      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];

      // Fetch coverage data for the patient/insurer
      const coverage = await this.getCoverageData(
        priorAuth.patient_id, 
        priorAuth.insurer_id,
        priorAuth.coverage_id
      );

      // Fetch mother patient if this is a newborn request
      let motherPatient = null;
      if (priorAuth.is_newborn && priorAuth.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [priorAuth.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }

      // Build FHIR bundle
      const bundle = priorAuthMapper.buildPriorAuthRequestBundle({
        priorAuth,
        patient,
        provider,
        insurer,
        coverage,
        policyHolder: null,
        motherPatient: motherPatient
      });

      res.json({ data: bundle });
    } catch (error) {
      console.error('Error generating bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to generate FHIR bundle' });
    }
  }

  /**
   * Preview FHIR bundle from form data (optionally saves request_bundle if record ID provided)
   */
  async previewBundle(req, res) {
    try {
      const formData = req.body;
      // Get optional ID - if provided, we'll save the request bundle to this record
      const existingId = formData.id || formData.prior_auth_id;

      // Validate required fields
      if (!formData.patient_id) {
        return res.status(400).json({ error: 'Patient is required' });
      }
      if (!formData.provider_id) {
        return res.status(400).json({ error: 'Provider is required' });
      }
      if (!formData.insurer_id) {
        return res.status(400).json({ error: 'Insurer is required' });
      }

      // Get patient, provider, insurer data
      const patientResult = await query('SELECT * FROM patients WHERE patient_id = $1', [formData.patient_id]);
      const providerResult = await query('SELECT * FROM providers WHERE provider_id = $1', [formData.provider_id]);
      const insurerResult = await query('SELECT * FROM insurers WHERE insurer_id = $1', [formData.insurer_id]);

      if (patientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Patient not found' });
      }
      if (providerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider not found' });
      }
      if (insurerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Insurer not found' });
      }

      const patient = patientResult.rows[0];
      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];

      // Fetch coverage data for the patient/insurer
      const coverage = await this.getCoverageData(
        formData.patient_id, 
        formData.insurer_id,
        formData.coverage_id
      );

      // Create a mock priorAuth object from form data
      // IMPORTANT: Include ALL fields that mappers use, so preview matches sendToNphies behavior
      const priorAuth = {
        id: existingId || 'preview',
        request_number: formData.request_number || `PREVIEW-${Date.now()}`,
        auth_type: formData.auth_type || 'professional',
        status: 'draft',
        priority: formData.priority || 'normal',
        encounter_class: formData.encounter_class,
        encounter_start: formData.encounter_start,
        encounter_end: formData.encounter_end,
        total_amount: formData.total_amount,
        currency: formData.currency || 'SAR',
        items: formData.items || [],
        diagnoses: formData.diagnoses || [],
        supporting_info: formData.supporting_info || [],
        // Vision prescription data for vision auth types
        vision_prescription: formData.vision_prescription || null,
        // Eligibility fields - must match what sendToNphies uses from database
        eligibility_ref: formData.eligibility_ref || null,
        eligibility_offline_ref: formData.eligibility_offline_ref || null,
        eligibility_offline_date: formData.eligibility_offline_date || null,
        // Transfer fields (NPHIES Test Case 9)
        is_transfer: formData.is_transfer || false,
        transfer_provider_id: formData.transfer_provider_id || null,
        transfer_auth_number: formData.transfer_auth_number || null,
        transfer_period_start: formData.transfer_period_start || null,
        transfer_period_end: formData.transfer_period_end || null,
        // Newborn fields (NPHIES Test Case 8)
        // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
        is_newborn: formData.is_newborn || false,
        birth_weight: formData.birth_weight ? parseFloat(formData.birth_weight) : null,
        mother_patient_id: formData.mother_patient_id || null,
        // Service type for institutional claims
        service_type: formData.service_type || null,
        // Use explicit sub_type, or derive from encounter_class (ensures consistency with Claims)
        sub_type: formData.sub_type || this.getSubTypeFromEncounterClass(formData.encounter_class, formData.auth_type),
        // Lab observations for professional claims (LOINC codes)
        lab_observations: formData.lab_observations || [],
        // Medication safety analysis for pharmacy claims
        medication_safety_analysis: formData.medication_safety_analysis || null,
        // Resubmission fields - for rejected/partial authorization resubmission
        is_resubmission: formData.is_resubmission || false,
        related_claim_identifier: formData.related_claim_identifier || null,
        related_auth_id: formData.related_auth_id || formData.source_id || null,
        // Update/Follow-up fields - for adding services to approved authorization (Use Case 7)
        is_update: formData.is_update || false
      };

      // For resubmission, ensure related_claim_identifier is set to the original request_number
      // This is used to reference the original Claim using its original identifier (provider system + request_number)
      if (priorAuth.is_resubmission && priorAuth.related_auth_id && !priorAuth.related_claim_identifier) {
        try {
          const originalAuth = await this.getByIdInternal(priorAuth.related_auth_id);
          if (originalAuth && originalAuth.request_number) {
            priorAuth.related_claim_identifier = originalAuth.request_number;
          }
        } catch (error) {
          console.warn('[Preview] Could not look up original authorization for resubmission:', error.message);
        }
      }

      // For follow-up/update, ensure related_claim_identifier is set to the original request_number
      // This is used to reference the original Claim using its original identifier (provider system + request_number)
      if (priorAuth.is_update && priorAuth.related_auth_id && !priorAuth.related_claim_identifier) {
        try {
          const originalAuth = await this.getByIdInternal(priorAuth.related_auth_id);
          if (originalAuth && originalAuth.request_number) {
            priorAuth.related_claim_identifier = originalAuth.request_number;
          }
        } catch (error) {
          console.warn('[Preview] Could not look up original authorization for follow-up:', error.message);
        }
      }

      // Fetch mother patient if this is a newborn request
      let motherPatient = null;
      if (priorAuth.is_newborn && priorAuth.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [priorAuth.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }

      // Build FHIR bundle
      const bundle = priorAuthMapper.buildPriorAuthRequestBundle({
        priorAuth,
        patient,
        provider,
        insurer,
        coverage,
        policyHolder: null,
        motherPatient: motherPatient
      });

      // If we have an existing record ID, save the request bundle to the database
      if (existingId && existingId !== 'preview') {
        try {
          await query(`
            UPDATE prior_authorizations 
            SET request_bundle = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [JSON.stringify(bundle), existingId]);
          console.log(`[Preview] Saved request bundle to prior authorization ID ${existingId}`);
        } catch (saveError) {
          console.error('[Preview] Error saving request bundle:', saveError);
          // Don't fail the request, just log the error
        }
      }

      // Return preview data with entities summary
      res.json({
        success: true,
        entities: {
          patient: {
            name: patient.name,
            identifier: patient.identifier
          },
          provider: {
            name: provider.provider_name,
            nphiesId: provider.nphies_id
          },
          insurer: {
            name: insurer.insurer_name,
            nphiesId: insurer.nphies_id
          }
        },
        options: {
          authType: formData.auth_type,
          priority: formData.priority,
          encounterClass: formData.encounter_class,
          itemsCount: formData.items?.length || 0,
          diagnosesCount: formData.diagnoses?.length || 0
        },
        fhirBundle: bundle,
        savedToRecord: existingId && existingId !== 'preview' ? existingId : null
      });
    } catch (error) {
      console.error('Error generating preview bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to generate preview' });
    }
  }

  // ============= Helper Methods =============

  /**
   * Clean form data (convert empty strings to null and remove read-only fields)
   */
  cleanFormData(formData) {
    const cleanedData = { ...formData };
    
    // Remove read-only/computed fields that should not be included in create/update
    const readOnlyFields = [
      // System-generated fields
      'id',
      'created_at',
      'updated_at',
      'request_date',
      'response_date',
      'request_bundle',
      'response_bundle',
      
      // Joined fields from patients table
      'patient_name',
      'patient_identifier',
      'patient_gender',
      'patient_birth_date',
      
      // Joined fields from providers table
      'provider_name',
      'provider_nphies_id',
      'provider_type',
      
      // Joined fields from insurers table
      'insurer_name',
      'insurer_nphies_id',
      
      // Related data (handled separately)
      'responses',
      'items',
      'supporting_info',
      'diagnoses',
      'attachments'
    ];
    
    readOnlyFields.forEach(field => {
      delete cleanedData[field];
    });
    
    const dateFields = ['encounter_start', 'encounter_end', 'eligibility_offline_date',
                        'pre_auth_period_start', 'pre_auth_period_end', 
                        'transfer_period_start', 'transfer_period_end'];
    const numberFields = ['coverage_id', 'related_auth_id', 'total_amount', 'approved_amount'];
    
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
    ['patient_id', 'provider_id', 'insurer_id', 'practitioner_id', 'transfer_provider_id'].forEach(field => {
      if (cleanedData[field] === '') cleanedData[field] = null;
    });

    // Convert empty strings to null for all other string fields
    Object.keys(cleanedData).forEach(key => {
      if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '') {
        cleanedData[key] = null;
      }
    });

    return cleanedData;
  }

  /**
   * Prepare JSONB fields for PostgreSQL insertion
   * Must be called AFTER validation but BEFORE database insertion
   */
  prepareJsonbFields(data) {
    const jsonbFields = ['vision_prescription', 'lab_observations', 'medication_safety_analysis'];
    jsonbFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        // If it's already a string (JSON), leave it; otherwise stringify
        if (typeof data[field] !== 'string') {
          data[field] = JSON.stringify(data[field]);
        }
      }
    });
    return data;
  }

  /**
   * Insert items
   */
  async insertItems(priorAuthId, items) {
    for (const item of items) {
      const itemQuery = `
        INSERT INTO prior_authorization_items 
        (prior_auth_id, sequence, product_or_service_code, product_or_service_system,
         product_or_service_display, tooth_number, tooth_surface, eye,
         medication_code, medication_system, medication_name, days_supply, quantity, unit_price,
         net_amount, currency, serviced_date, serviced_period_start, serviced_period_end,
         body_site_code, body_site_system, sub_site_code, description, notes,
         manual_code_entry, manual_prescribed_code_entry, prescribed_medication_code,
         pharmacist_selection_reason, pharmacist_substitute, patient_share, is_package, is_maternity,
         item_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      `;
      await query(itemQuery, [
        priorAuthId,
        item.sequence,
        item.product_or_service_code || item.medication_code || null, // For pharmacy, use medication_code if no product code
        item.product_or_service_system || null,
        item.product_or_service_display || null,
        item.tooth_number || null,
        item.tooth_surface || null,
        item.eye || null,
        item.medication_code || null,
        item.medication_system || null,
        item.medication_name || null,
        item.days_supply || null,
        item.quantity || null,
        item.unit_price || null,
        item.net_amount || null,
        item.currency || 'SAR',
        item.serviced_date || null,
        item.serviced_period_start || null,
        item.serviced_period_end || null,
        item.body_site_code || null,
        item.body_site_system || null,
        item.sub_site_code || null,
        item.description || null,
        item.notes || null,
        item.manual_code_entry || false,
        item.manual_prescribed_code_entry || false,
        item.prescribed_medication_code || null,
        item.pharmacist_selection_reason || null,
        item.pharmacist_substitute || null,
        item.patient_share || null,
        item.is_package || false,
        item.is_maternity || false,
        item.item_type || 'medication' // Save item_type (medication or device)
      ]);
    }
  }

  /**
   * Insert supporting info
   * Returns a map of sequence -> supporting_info_id for linking attachments
   */
  async insertSupportingInfo(priorAuthId, supportingInfo) {
    const sequenceMap = {};
    for (const info of supportingInfo) {
      const infoQuery = `
        INSERT INTO prior_authorization_supporting_info 
        (prior_auth_id, sequence, category, category_system, code, code_system,
         code_display, value_string, value_quantity, value_quantity_unit,
         value_boolean, value_date, value_period_start, value_period_end,
         value_reference, timing_date, timing_period_start, timing_period_end,
         reason_code, reason_system)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id, sequence
      `;
      
      // For chief-complaint with code_text (free text format), store in value_string
      // This allows round-trip of free text chief complaints
      const valueString = info.code_text || info.value_string || null;
      
      const result = await query(infoQuery, [
        priorAuthId,
        info.sequence,
        info.category,
        info.category_system || null,
        info.code || null,
        info.code_system || null,
        info.code_display || null,
        valueString,
        info.value_quantity || null,
        info.value_quantity_unit || null,
        info.value_boolean !== undefined ? info.value_boolean : null,
        info.value_date || null,
        info.value_period_start || null,
        info.value_period_end || null,
        info.value_reference || null,
        info.timing_date || null,
        info.timing_period_start || null,
        info.timing_period_end || null,
        info.reason_code || null,
        info.reason_system || null
      ]);
      
      // Map sequence to supporting_info_id for attachment linking
      if (result.rows[0]) {
        sequenceMap[info.sequence] = result.rows[0].id;
      }
    }
    return sequenceMap;
  }

  /**
   * Insert diagnoses
   */
  async insertDiagnoses(priorAuthId, diagnoses) {
    for (const diag of diagnoses) {
      const diagQuery = `
        INSERT INTO prior_authorization_diagnoses 
        (prior_auth_id, sequence, diagnosis_code, diagnosis_system, diagnosis_display,
         diagnosis_type, on_admission)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await query(diagQuery, [
        priorAuthId,
        diag.sequence,
        diag.diagnosis_code,
        diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am',
        diag.diagnosis_display || null,
        diag.diagnosis_type || 'principal',
        diag.on_admission !== undefined ? diag.on_admission : null
      ]);
    }
  }

  /**
   * Insert attachments
   * @param {number} priorAuthId - Prior authorization ID
   * @param {Array} attachments - Array of attachment objects
   * @param {Object} supportingInfoSequenceMap - Map of sequence -> supporting_info_id for linking
   */
  async insertAttachments(priorAuthId, attachments, supportingInfoSequenceMap = {}) {
    for (const att of attachments) {
      // Find supporting_info_id from sequence if provided
      let supportingInfoId = null;
      if (att.supporting_info_sequence && supportingInfoSequenceMap[att.supporting_info_sequence]) {
        supportingInfoId = supportingInfoSequenceMap[att.supporting_info_sequence];
      } else if (att.supporting_info_id) {
        // Direct ID provided (for updates)
        supportingInfoId = att.supporting_info_id;
      }
      
      const attQuery = `
        INSERT INTO prior_authorization_attachments 
        (prior_auth_id, supporting_info_id, file_name, content_type, file_size, base64_content,
         title, description, category, binary_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await query(attQuery, [
        priorAuthId,
        supportingInfoId,
        att.file_name,
        att.content_type,
        att.file_size || null,
        att.base64_content,
        att.title || null,
        att.description || null,
        att.category || null,
        att.binary_id || `binary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      ]);
    }
  }
}

export default new PriorAuthorizationsController();

