import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import claimMapper, { getClaimMapper } from '../services/claimMapper/index.js';
import nphiesService from '../services/nphiesService.js';
import claimCommunicationService from '../services/claimCommunicationService.js';

class ClaimSubmissionsController extends BaseController {
  constructor() {
    super('claim_submissions', validationSchemas.claimSubmission);
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

  async getCoverageData(patientId, insurerId, coverageId = null) {
    try {
      let coverageResult;
      if (coverageId) {
        coverageResult = await query(`SELECT pc.*, i.insurer_name, i.nphies_id as insurer_nphies_id FROM patient_coverage pc LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id WHERE pc.coverage_id = $1`, [coverageId]);
      } else if (patientId && insurerId) {
        coverageResult = await query(`SELECT pc.*, i.insurer_name, i.nphies_id as insurer_nphies_id FROM patient_coverage pc LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id WHERE pc.patient_id = $1 AND pc.insurer_id = $2 AND pc.is_active = true ORDER BY pc.created_at DESC LIMIT 1`, [patientId, insurerId]);
      }
      return coverageResult?.rows[0] || null;
    } catch (error) {
      console.error('Error fetching coverage data:', error);
      return null;
    }
  }

  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';
      const claimType = req.query.claim_type || '';

      let whereConditions = [];
      let queryParams = [limit, offset];
      let countParams = [];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`(cs.claim_number ILIKE $${paramIndex} OR cs.pre_auth_ref ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex} OR pr.provider_name ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`cs.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      if (claimType) {
        whereConditions.push(`cs.claim_type = $${paramIndex}`);
        queryParams.push(claimType);
        countParams.push(claimType);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      const countResult = await query(`SELECT COUNT(*) as total FROM claim_submissions cs LEFT JOIN patients p ON cs.patient_id = p.patient_id LEFT JOIN providers pr ON cs.provider_id = pr.provider_id ${whereClause}`, countParams);
      const total = parseInt(countResult.rows[0].total);

      const dataQuery = `
        SELECT cs.id, cs.claim_number, cs.claim_type, cs.sub_type, cs.patient_id, cs.provider_id, cs.insurer_id,
          cs.prior_auth_id, cs.pre_auth_ref, cs.status, cs.outcome, cs.adjudication_outcome, cs.disposition,
          cs.total_amount, cs.approved_amount, cs.currency, cs.service_date, cs.request_date, cs.response_date,
          cs.created_at, cs.updated_at,
          p.name as patient_name, p.identifier as patient_identifier,
          pr.provider_name, pr.nphies_id as provider_nphies_id,
          i.insurer_name, i.nphies_id as insurer_nphies_id,
          (SELECT COUNT(*) FROM claim_submission_items WHERE claim_id = cs.id) as item_count
        FROM claim_submissions cs
        LEFT JOIN patients p ON cs.patient_id = p.patient_id
        LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
        LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY cs.created_at DESC LIMIT $1 OFFSET $2
      `;
      const result = await query(dataQuery, queryParams);

      res.json({ data: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Error getting claim submissions:', error);
      res.status(500).json({ error: 'Failed to fetch claim submissions' });
    }
  }

  async getByIdInternal(id) {
    const formResult = await query(`
      SELECT cs.*, p.name as patient_name, p.identifier as patient_identifier, p.gender as patient_gender, p.birth_date as patient_birth_date,
        pr.provider_name, pr.nphies_id as provider_nphies_id, pr.provider_type,
        i.insurer_name, i.nphies_id as insurer_nphies_id
      FROM claim_submissions cs
      LEFT JOIN patients p ON cs.patient_id = p.patient_id
      LEFT JOIN providers pr ON cs.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cs.insurer_id = i.insurer_id
      WHERE cs.id = $1
    `, [id]);

    if (formResult.rows.length === 0) return null;

    const claim = formResult.rows[0];
    const [itemsResult, supportingInfoResult, diagnosesResult, responsesResult, attachmentsResult] = await Promise.all([
      query('SELECT * FROM claim_submission_items WHERE claim_id = $1 ORDER BY sequence ASC', [id]),
      query('SELECT * FROM claim_submission_supporting_info WHERE claim_id = $1 ORDER BY sequence ASC', [id]),
      query('SELECT * FROM claim_submission_diagnoses WHERE claim_id = $1 ORDER BY sequence ASC', [id]),
      query('SELECT id, claim_id, response_type, outcome, disposition, nphies_claim_id, has_errors, errors, is_nphies_generated, nphies_response_id, received_at FROM claim_submission_responses WHERE claim_id = $1 ORDER BY received_at DESC', [id]),
      query('SELECT id, claim_id, supporting_info_id, file_name, content_type, file_size, title, description, category, binary_id, created_at FROM claim_submission_attachments WHERE claim_id = $1 ORDER BY created_at ASC', [id])
    ]);

    return {
      ...claim,
      items: itemsResult.rows,
      supporting_info: supportingInfoResult.rows,
      diagnoses: diagnosesResult.rows,
      responses: responsesResult.rows,
      attachments: attachmentsResult.rows
    };
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const claim = await this.getByIdInternal(id);
      if (!claim) return res.status(404).json({ error: 'Claim submission not found' });
      res.json({ data: claim });
    } catch (error) {
      console.error('Error getting claim by ID:', error);
      res.status(500).json({ error: 'Failed to fetch claim submission' });
    }
  }

  async create(req, res) {
    try {
      const { items, supporting_info, diagnoses, attachments, ...formData } = req.body;
      const cleanedData = this.cleanFormData(formData);

      if (!cleanedData.claim_number) cleanedData.claim_number = `CLM-${Date.now()}`;
      if (!cleanedData.status) cleanedData.status = 'draft';

      const columns = Object.keys(cleanedData).filter(key => !['items', 'supporting_info', 'diagnoses', 'attachments', 'coverage_id'].includes(key));
      const values = columns.map(col => cleanedData[col]);

      const insertQuery = `INSERT INTO claim_submissions (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      const result = await query(insertQuery, values);
      const claimId = result.rows[0].id;

      if (items?.length > 0) await this.insertItems(claimId, items);
      if (supporting_info?.length > 0) await this.insertSupportingInfo(claimId, supporting_info);
      if (diagnoses?.length > 0) await this.insertDiagnoses(claimId, diagnoses);
      if (attachments?.length > 0) await this.insertAttachments(claimId, attachments);

      const completeData = await this.getByIdInternal(claimId);
      res.status(201).json({ data: completeData });
    } catch (error) {
      console.error('Error creating claim submission:', error);
      if (error.code === '23505') res.status(409).json({ error: 'Claim number already exists' });
      else if (error.code === '23503') res.status(400).json({ error: 'Invalid reference' });
      else res.status(500).json({ error: error.message || 'Failed to create claim submission' });
    }
  }

  async createFromPriorAuth(req, res) {
    try {
      const { paId } = req.params;
      const { itemOverrides, priority } = req.body || {}; // Optional service code overrides and priority

      const paResult = await query(`
        SELECT pa.*, p.name as patient_name, pr.provider_name, i.insurer_name
        FROM prior_authorizations pa
        LEFT JOIN patients p ON pa.patient_id = p.patient_id
        LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
        LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
        WHERE pa.id = $1
      `, [paId]);

      if (paResult.rows.length === 0) return res.status(404).json({ error: 'Prior authorization not found' });

      const pa = paResult.rows[0];
      if (pa.status !== 'approved') return res.status(400).json({ error: 'Can only create claims from approved prior authorizations' });

      const [paItemsResult, paDiagnosesResult, paSupportingInfoResult, paAttachmentsResult] = await Promise.all([
        query('SELECT * FROM prior_authorization_items WHERE prior_auth_id = $1 ORDER BY sequence ASC', [paId]),
        query('SELECT * FROM prior_authorization_diagnoses WHERE prior_auth_id = $1 ORDER BY sequence ASC', [paId]),
        query('SELECT * FROM prior_authorization_supporting_info WHERE prior_auth_id = $1 ORDER BY sequence ASC', [paId]),
        query('SELECT id, prior_auth_id, supporting_info_id, file_name, content_type, file_size, base64_content, title, description, category, binary_id, created_at FROM prior_authorization_attachments WHERE prior_auth_id = $1 ORDER BY created_at ASC', [paId])
      ]);

      // For claims, service_date must be within encounter period (BV-00041)
      // Use encounter_start as the service date, or today if no encounter dates exist
      const serviceDate = pa.encounter_start ? new Date(pa.encounter_start) : new Date();
      
      const claimData = {
        claim_number: `CLM-${Date.now()}`,
        claim_type: pa.auth_type,
        // Use explicit sub_type from PA, or derive from encounter_class (not hardcoded default)
        sub_type: pa.sub_type || this.getSubTypeFromEncounterClass(pa.encounter_class, pa.auth_type),
        patient_id: pa.patient_id,
        provider_id: pa.provider_id,
        insurer_id: pa.insurer_id,
        prior_auth_id: paId,
        pre_auth_ref: pa.pre_auth_ref,
        status: 'draft',
        encounter_class: pa.encounter_class,
        encounter_start: pa.encounter_start,
        encounter_end: pa.encounter_end,
        encounter_identifier: pa.encounter_identifier,
        service_type: pa.service_type,
        eligibility_ref: pa.eligibility_ref,
        eligibility_offline_ref: pa.eligibility_offline_ref,
        eligibility_offline_date: pa.eligibility_offline_date,
        mother_patient_id: pa.mother_patient_id, // Copy mother_patient_id from prior auth for newborn claims
        practice_code: pa.practice_code,
        priority: priority || pa.priority || 'normal', // Use provided priority, fallback to PA priority, then 'normal'
        total_amount: pa.approved_amount || pa.total_amount,
        currency: pa.currency,
        service_date: serviceDate,
        // Copy newborn extension fields from prior authorization
        is_newborn: pa.is_newborn || false,
        birth_weight: pa.birth_weight || null,
        mother_patient_id: pa.mother_patient_id || null, // Copy mother_patient_id from prior auth for newborn claims
        // Copy ICU hours for institutional claims
        icu_hours: pa.icu_hours || null
      };

      const columns = Object.keys(claimData).filter(key => claimData[key] !== undefined && claimData[key] !== null);
      const values = columns.map(col => claimData[col]);
      const insertQuery = `INSERT INTO claim_submissions (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      const result = await query(insertQuery, values);
      const claimId = result.rows[0].id;

      if (paItemsResult.rows.length > 0) {
        // Apply service code overrides for professional claims if provided
        // Item servicedDate must be within encounter period (BV-00041)
        const items = paItemsResult.rows.map((item, idx) => {
          const override = itemOverrides?.find(o => o.sequence === idx + 1);
          return {
            ...item,
            // Use item's original serviced_date, or encounter start, or today
            serviced_date: item.serviced_date || serviceDate,
            // For professional claims, override the service code and system if provided
            product_or_service_code: override?.service_code || item.product_or_service_code,
            // For pharmacy claims, copy medication_name to product_or_service_display if display is empty
            product_or_service_display: override?.service_display || 
                                       item.product_or_service_display || 
                                       item.medication_name || 
                                       null,
            // Use services CodeSystem for professional claims when override is provided
            product_or_service_system: override?.service_code 
              ? 'http://nphies.sa/terminology/CodeSystem/services' 
              : item.product_or_service_system
          };
        });
        await this.insertItems(claimId, items);
      }

      if (paDiagnosesResult.rows.length > 0) await this.insertDiagnoses(claimId, paDiagnosesResult.rows);
      if (paSupportingInfoResult.rows.length > 0) await this.insertSupportingInfo(claimId, paSupportingInfoResult.rows);
      
      // Copy attachments from prior authorization
      if (paAttachmentsResult.rows.length > 0) {
        await this.insertAttachments(claimId, paAttachmentsResult.rows);
      }

      const completeData = await this.getByIdInternal(claimId);
      res.status(201).json({ data: completeData, message: 'Claim created from prior authorization. Review and submit.' });
    } catch (error) {
      console.error('Error creating claim from PA:', error);
      res.status(500).json({ error: error.message || 'Failed to create claim from prior authorization' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { items, supporting_info, diagnoses, attachments, ...formData } = req.body;

      const existing = await this.getByIdInternal(id);
      if (!existing) return res.status(404).json({ error: 'Claim submission not found' });
      if (!['draft', 'error'].includes(existing.status)) return res.status(400).json({ error: 'Cannot update claim with status: ' + existing.status });

      const cleanedData = this.cleanFormData(formData);
      const columns = Object.keys(cleanedData).filter(key => !['items', 'supporting_info', 'diagnoses', 'attachments', 'coverage_id'].includes(key));
      const values = [...columns.map(col => cleanedData[col]), id];

      const updateQuery = `UPDATE claim_submissions SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${columns.length + 1} RETURNING *`;
      await query(updateQuery, values);

      await query('DELETE FROM claim_submission_items WHERE claim_id = $1', [id]);
      await query('DELETE FROM claim_submission_supporting_info WHERE claim_id = $1', [id]);
      await query('DELETE FROM claim_submission_diagnoses WHERE claim_id = $1', [id]);
      await query('DELETE FROM claim_submission_attachments WHERE claim_id = $1', [id]);

      if (items?.length > 0) await this.insertItems(id, items);
      if (supporting_info?.length > 0) await this.insertSupportingInfo(id, supporting_info);
      if (diagnoses?.length > 0) await this.insertDiagnoses(id, diagnoses);
      if (attachments?.length > 0) await this.insertAttachments(id, attachments);

      const completeData = await this.getByIdInternal(id);
      res.json({ data: completeData });
    } catch (error) {
      console.error('Error updating claim submission:', error);
      res.status(500).json({ error: error.message || 'Failed to update claim submission' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const existing = await query('SELECT id, status FROM claim_submissions WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Claim submission not found' });
      if (existing.rows[0].status !== 'draft') return res.status(400).json({ error: 'Can only delete draft claims' });

      await query('DELETE FROM claim_submissions WHERE id = $1', [id]);
      res.json({ message: 'Claim submission deleted successfully' });
    } catch (error) {
      console.error('Error deleting claim submission:', error);
      res.status(500).json({ error: 'Failed to delete claim submission' });
    }
  }

  async sendToNphies(req, res) {
    try {
      const { id } = req.params;
      const claim = await this.getByIdInternal(id);
      if (!claim) return res.status(404).json({ error: 'Claim submission not found' });
      if (!['draft', 'error'].includes(claim.status)) return res.status(400).json({ error: 'Can only send claims with draft or error status' });

      const [patientResult, providerResult, insurerResult] = await Promise.all([
        query('SELECT * FROM patients WHERE patient_id = $1', [claim.patient_id]),
        query('SELECT * FROM providers WHERE provider_id = $1', [claim.provider_id]),
        query('SELECT * FROM insurers WHERE insurer_id = $1', [claim.insurer_id])
      ]);

      if (patientResult.rows.length === 0) return res.status(400).json({ error: 'Patient not found' });
      if (providerResult.rows.length === 0) return res.status(400).json({ error: 'Provider not found' });
      if (insurerResult.rows.length === 0) return res.status(400).json({ error: 'Insurer not found' });

      const patient = patientResult.rows[0];
      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];
      const coverage = await this.getCoverageData(claim.patient_id, claim.insurer_id, claim.coverage_id);

      // Fetch mother patient if this is a newborn claim
      let motherPatient = null;
      if (claim.is_newborn && claim.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [claim.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }

      const bundle = claimMapper.buildClaimRequestBundle({ claim, patient, provider, insurer, coverage, policyHolder: null, motherPatient });
      const nphiesRequestId = `clm-req-${Date.now()}`;

      await query(`UPDATE claim_submissions SET status = 'pending', nphies_request_id = $1, request_bundle = $2, request_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3`, [nphiesRequestId, JSON.stringify(bundle), id]);

      const nphiesResponse = await nphiesService.submitClaim(bundle);

      if (nphiesResponse.success) {
        const parsedResponse = claimMapper.parseClaimResponse(nphiesResponse.data);
        const newStatus = parsedResponse.outcome === 'queued' ? 'queued' : 
                         parsedResponse.adjudicationOutcome === 'approved' ? 'approved' :
                         parsedResponse.adjudicationOutcome === 'rejected' ? 'denied' :
                         parsedResponse.success ? 'approved' : 'denied';

        await query(`
          UPDATE claim_submissions SET status = $1, outcome = $2, disposition = $3, nphies_claim_id = $4, nphies_response_id = $5,
            is_nphies_generated = $6, response_bundle = $7, response_date = CURRENT_TIMESTAMP, adjudication_outcome = $8, updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
        `, [newStatus, parsedResponse.outcome, parsedResponse.disposition, parsedResponse.nphiesClaimId, parsedResponse.nphiesClaimId, parsedResponse.isNphiesGenerated || false, JSON.stringify(nphiesResponse.data), parsedResponse.adjudicationOutcome, id]);

        await query(`INSERT INTO claim_submission_responses (claim_id, response_type, outcome, disposition, nphies_claim_id, bundle_json, has_errors, errors, is_nphies_generated, nphies_response_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, 'initial', parsedResponse.outcome || 'complete', parsedResponse.disposition, parsedResponse.nphiesClaimId, JSON.stringify(nphiesResponse.data), !parsedResponse.success, parsedResponse.errors ? JSON.stringify(parsedResponse.errors) : null, parsedResponse.isNphiesGenerated || false, parsedResponse.nphiesClaimId]);

        const updatedData = await this.getByIdInternal(id);
        res.json({ success: true, data: updatedData, nphiesResponse: { ...parsedResponse, rawBundle: undefined } });
      } else {
        await query(`UPDATE claim_submissions SET status = 'error', outcome = 'error', disposition = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [nphiesResponse.error?.message || 'NPHIES request failed', id]);
        await query(`INSERT INTO claim_submission_responses (claim_id, response_type, outcome, bundle_json, has_errors, errors) VALUES ($1, $2, $3, $4, $5, $6)`, [id, 'initial', 'error', JSON.stringify(nphiesResponse.raw || {}), true, JSON.stringify([nphiesResponse.error])]);
        res.status(502).json({ success: false, error: nphiesResponse.error, data: await this.getByIdInternal(id) });
      }
    } catch (error) {
      console.error('Error sending claim to NPHIES:', error);
      res.status(500).json({ error: error.message || 'Failed to send claim' });
    }
  }

  async getBundle(req, res) {
    try {
      const { id } = req.params;
      const claim = await this.getByIdInternal(id);
      if (!claim) return res.status(404).json({ error: 'Claim submission not found' });

      const [patientResult, providerResult, insurerResult] = await Promise.all([
        query('SELECT * FROM patients WHERE patient_id = $1', [claim.patient_id]),
        query('SELECT * FROM providers WHERE provider_id = $1', [claim.provider_id]),
        query('SELECT * FROM insurers WHERE insurer_id = $1', [claim.insurer_id])
      ]);

      if (patientResult.rows.length === 0) return res.status(400).json({ error: 'Patient not found' });
      if (providerResult.rows.length === 0) return res.status(400).json({ error: 'Provider not found' });
      if (insurerResult.rows.length === 0) return res.status(400).json({ error: 'Insurer not found' });

      const coverage = await this.getCoverageData(claim.patient_id, claim.insurer_id, claim.coverage_id);
      
      // Fetch mother patient if this is a newborn claim
      let motherPatient = null;
      if (claim.is_newborn && claim.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [claim.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }
      
      const bundle = claimMapper.buildClaimRequestBundle({ 
        claim, 
        patient: patientResult.rows[0], 
        provider: providerResult.rows[0], 
        insurer: insurerResult.rows[0], 
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

  async previewBundle(req, res) {
    try {
      const formData = req.body;
      if (!formData.patient_id) return res.status(400).json({ error: 'Patient is required' });
      if (!formData.provider_id) return res.status(400).json({ error: 'Provider is required' });
      if (!formData.insurer_id) return res.status(400).json({ error: 'Insurer is required' });

      const [patientResult, providerResult, insurerResult] = await Promise.all([
        query('SELECT * FROM patients WHERE patient_id = $1', [formData.patient_id]),
        query('SELECT * FROM providers WHERE provider_id = $1', [formData.provider_id]),
        query('SELECT * FROM insurers WHERE insurer_id = $1', [formData.insurer_id])
      ]);

      if (patientResult.rows.length === 0) return res.status(400).json({ error: 'Patient not found' });
      if (providerResult.rows.length === 0) return res.status(400).json({ error: 'Provider not found' });
      if (insurerResult.rows.length === 0) return res.status(400).json({ error: 'Insurer not found' });

      const patient = patientResult.rows[0];
      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];
      const coverage = await this.getCoverageData(formData.patient_id, formData.insurer_id, formData.coverage_id);

      // Fetch mother patient if this is a newborn claim
      let motherPatient = null;
      if (formData.is_newborn && formData.mother_patient_id) {
        const motherResult = await query('SELECT * FROM patients WHERE patient_id = $1', [formData.mother_patient_id]);
        if (motherResult.rows.length > 0) {
          motherPatient = motherResult.rows[0];
        }
      }

      const claim = {
        claim_number: formData.claim_number || `PREVIEW-${Date.now()}`,
        claim_type: formData.claim_type || 'institutional',
        // Use explicit sub_type, or derive from encounter_class (not hardcoded default)
        sub_type: formData.sub_type || this.getSubTypeFromEncounterClass(formData.encounter_class, formData.claim_type),
        status: 'draft',
        priority: formData.priority || 'normal',
        encounter_class: formData.encounter_class,
        encounter_start: formData.encounter_start,
        encounter_end: formData.encounter_end,
        service_date: formData.service_date,
        total_amount: formData.total_amount,
        currency: formData.currency || 'SAR',
        items: formData.items || [],
        diagnoses: formData.diagnoses || [],
        supporting_info: formData.supporting_info || [],
        pre_auth_ref: formData.pre_auth_ref,
        eligibility_offline_ref: formData.eligibility_offline_ref,
        practice_code: formData.practice_code,
        service_type: formData.service_type,
        is_newborn: formData.is_newborn || false,
        birth_weight: formData.birth_weight || null,
        mother_patient_id: formData.mother_patient_id || null,
        // ICU hours for institutional claims
        icu_hours: formData.icu_hours ? parseFloat(formData.icu_hours) : null,
        // Attachments
        attachments: formData.attachments || []
      };

      const bundle = claimMapper.buildClaimRequestBundle({ 
        claim, 
        patient, 
        provider, 
        insurer, 
        coverage, 
        policyHolder: null, 
        motherPatient: motherPatient
      });
      res.json({
        success: true,
        entities: { patient: { name: patient.name, identifier: patient.identifier }, provider: { name: provider.provider_name, nphiesId: provider.nphies_id }, insurer: { name: insurer.insurer_name, nphiesId: insurer.nphies_id } },
        options: { claimType: formData.claim_type, itemsCount: formData.items?.length || 0 },
        fhirBundle: bundle
      });
    } catch (error) {
      console.error('Error generating preview bundle:', error);
      res.status(500).json({ error: error.message || 'Failed to generate preview' });
    }
  }

  cleanFormData(formData) {
    const cleanedData = { ...formData };
    const readOnlyFields = ['id', 'created_at', 'updated_at', 'request_date', 'response_date', 'request_bundle', 'response_bundle', 'patient_name', 'patient_identifier', 'patient_gender', 'patient_birth_date', 'provider_name', 'provider_nphies_id', 'provider_type', 'insurer_name', 'insurer_nphies_id', 'responses', 'items', 'supporting_info', 'diagnoses', 'attachments'];
    readOnlyFields.forEach(field => delete cleanedData[field]);
    
    ['patient_id', 'provider_id', 'insurer_id', 'practitioner_id'].forEach(field => { if (cleanedData[field] === '') cleanedData[field] = null; });
    Object.keys(cleanedData).forEach(key => { if (typeof cleanedData[key] === 'string' && cleanedData[key].trim() === '') cleanedData[key] = null; });
    return cleanedData;
  }

  async insertItems(claimId, items) {
    for (const item of items) {
      await query(`
        INSERT INTO claim_submission_items (claim_id, sequence, product_or_service_code, product_or_service_system, product_or_service_display, tooth_number, tooth_surface, eye, medication_code, medication_system, days_supply, quantity, unit_price, factor, tax, patient_share, payer_share, net_amount, currency, serviced_date, serviced_period_start, serviced_period_end, body_site_code, body_site_system, sub_site_code, is_package, is_maternity, patient_invoice, description, notes, item_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
      `, [claimId, item.sequence, item.product_or_service_code, item.product_or_service_system, item.product_or_service_display, item.tooth_number, item.tooth_surface, item.eye, item.medication_code, item.medication_system, item.days_supply, item.quantity, item.unit_price, item.factor || 1, item.tax || 0, item.patient_share || 0, item.payer_share, item.net_amount, item.currency || 'SAR', item.serviced_date, item.serviced_period_start, item.serviced_period_end, item.body_site_code, item.body_site_system, item.sub_site_code, item.is_package || false, item.is_maternity || false, item.patient_invoice, item.description, item.notes, item.item_type || 'medication']);
    }
  }

  async insertSupportingInfo(claimId, supportingInfo) {
    for (const info of supportingInfo) {
      await query(`
        INSERT INTO claim_submission_supporting_info (claim_id, sequence, category, category_system, code, code_system, code_display, code_text, value_string, value_quantity, value_quantity_unit, value_boolean, value_date, value_period_start, value_period_end, value_reference, timing_date, timing_period_start, timing_period_end, reason_code, reason_system)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `, [claimId, info.sequence, info.category, info.category_system, info.code, info.code_system, info.code_display, info.code_text, info.value_string, info.value_quantity, info.value_quantity_unit, info.value_boolean, info.value_date, info.value_period_start, info.value_period_end, info.value_reference, info.timing_date, info.timing_period_start, info.timing_period_end, info.reason_code, info.reason_system]);
    }
  }

  async insertDiagnoses(claimId, diagnoses) {
    for (const diag of diagnoses) {
      await query(`INSERT INTO claim_submission_diagnoses (claim_id, sequence, diagnosis_code, diagnosis_system, diagnosis_display, diagnosis_type, on_admission, condition_onset) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [claimId, diag.sequence, diag.diagnosis_code, diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am', diag.diagnosis_display, diag.diagnosis_type || 'principal', diag.on_admission, diag.condition_onset || 'NR']);
    }
  }

  async insertAttachments(claimId, attachments) {
    for (const att of attachments) {
      await query(`INSERT INTO claim_submission_attachments (claim_id, file_name, content_type, file_size, base64_content, title, description, category, binary_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [claimId, att.file_name, att.content_type, att.file_size, att.base64_content, att.title, att.description, att.category, att.binary_id || `binary-${Date.now()}`]);
    }
  }

  // ============================================================================
  // COMMUNICATION ENDPOINTS - Status Check, Poll, and Communications
  // ============================================================================

  /**
   * Preview Status Check bundle (without sending)
   * GET /claim-submissions/:id/status-check/preview
   */
  async previewStatusCheck(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Previewing status check for claim ${claimId}`);

      const result = await claimCommunicationService.previewStatusCheck(claimId, schemaName);

      res.json({
        success: result.success,
        message: result.message,
        claimNumber: result.claimNumber,
        statusCheckBundle: result.statusCheckBundle
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Status check preview error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate status check preview'
      });
    }
  }

  /**
   * Send Status Check for a claim
   * POST /claim-submissions/:id/status-check
   */
  async sendStatusCheck(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Sending status check for claim ${claimId}`);

      const result = await claimCommunicationService.sendStatusCheck(claimId, schemaName);

      // Return detailed error information for debugging
      res.json({
        success: result.success,
        message: result.message,
        statusCheckBundle: result.statusCheckBundle,
        response: result.response,
        responseCode: result.responseCode,
        errors: result.errors,  // Array of {code, message, expression}
        error: result.error     // Human-readable error string
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Status check error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send status check'
      });
    }
  }

  /**
   * Poll for messages related to a claim
   * POST /claim-submissions/:id/poll
   */
  async pollMessages(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Polling messages for claim ${claimId}`);

      const result = await claimCommunicationService.pollForMessages(claimId, schemaName);

      res.json({
        success: result.success,
        message: result.message,
        hasCommunicationRequests: result.hasCommunicationRequests,
        hasClaimResponse: result.hasClaimResponse,
        claimResponses: result.claimResponses,
        communicationRequests: result.communicationRequests,
        acknowledgments: result.acknowledgments,
        pollBundle: result.pollBundle,
        responseBundle: result.responseBundle,
        errors: result.errors || [],
        responseCode: result.responseCode,
        error: result.error
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Poll error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to poll for messages'
      });
    }
  }

  /**
   * Send unsolicited communication for a claim
   * POST /claim-submissions/:id/communication/unsolicited
   */
  async sendUnsolicitedCommunication(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';
      const { payloads } = req.body;

      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Payloads array is required'
        });
      }

      console.log(`[ClaimSubmissions] Sending unsolicited communication for claim ${claimId}`);

      const result = await claimCommunicationService.sendUnsolicitedCommunication(
        claimId,
        payloads,
        schemaName
      );

      res.json({
        success: result.success,
        communication: result.communication,
        nphiesResponse: result.nphiesResponse
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Unsolicited communication error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send unsolicited communication'
      });
    }
  }

  /**
   * Send solicited communication (response to CommunicationRequest)
   * POST /claim-submissions/:id/communication/solicited
   */
  async sendSolicitedCommunication(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';
      const { communicationRequestId, payloads } = req.body;

      if (!communicationRequestId) {
        return res.status(400).json({
          success: false,
          error: 'communicationRequestId is required'
        });
      }

      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Payloads array is required'
        });
      }

      console.log(`[ClaimSubmissions] Sending solicited communication for claim ${claimId}, responding to request ${communicationRequestId}`);

      const result = await claimCommunicationService.sendSolicitedCommunication(
        communicationRequestId,
        payloads,
        schemaName
      );

      res.json({
        success: result.success,
        communication: result.communication,
        nphiesResponse: result.nphiesResponse
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Solicited communication error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send solicited communication'
      });
    }
  }

  /**
   * Get communication requests for a claim
   * GET /claim-submissions/:id/communication-requests
   */
  async getCommunicationRequests(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';
      const pendingOnly = req.query.pending === 'true';

      console.log(`[ClaimSubmissions] Getting communication requests for claim ${claimId}`);

      let requests;
      if (pendingOnly) {
        requests = await claimCommunicationService.getPendingCommunicationRequests(claimId, schemaName);
      } else {
        requests = await claimCommunicationService.getCommunicationRequests(claimId, schemaName);
      }

      res.json({
        success: true,
        communicationRequests: requests,
        count: requests.length,
        pendingCount: requests.filter(r => !r.responded_at).length
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Get communication requests error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get communication requests'
      });
    }
  }

  /**
   * Get communications sent for a claim
   * GET /claim-submissions/:id/communications
   */
  async getCommunications(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Getting communications for claim ${claimId}`);

      const communications = await claimCommunicationService.getCommunications(claimId, schemaName);

      res.json({
        success: true,
        communications: communications,
        count: communications.length
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Get communications error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get communications'
      });
    }
  }

  /**
   * Preview Communication bundle (without sending)
   * POST /claim-submissions/:id/communication/preview
   */
  async previewCommunicationBundle(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';
      const { payloads, type, communicationRequestId } = req.body;

      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Payloads array is required'
        });
      }

      console.log(`[ClaimSubmissions] Previewing ${type} communication bundle for claim ${claimId}`);

      const result = await claimCommunicationService.previewCommunicationBundle(
        claimId,
        payloads,
        type || 'unsolicited',
        communicationRequestId,
        schemaName
      );

      res.json({
        success: result.success,
        bundle: result.bundle,
        metadata: result.metadata,
        error: result.error
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Preview communication bundle error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to preview communication bundle'
      });
    }
  }

  /**
   * Poll for acknowledgment of a specific communication
   * POST /claim-submissions/:id/communications/:communicationId/poll-acknowledgment
   */
  async pollCommunicationAcknowledgment(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const { communicationId } = req.params;
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Polling acknowledgment for communication ${communicationId} on claim ${claimId}`);

      const result = await claimCommunicationService.pollCommunicationAcknowledgment(
        claimId,
        communicationId,
        schemaName
      );

      res.json({
        success: result.success,
        acknowledgmentFound: result.acknowledgmentFound,
        acknowledgmentStatus: result.acknowledgmentStatus,
        alreadyAcknowledged: result.alreadyAcknowledged,
        pollBundle: result.pollBundle,
        responseBundle: result.responseBundle,
        message: result.message,
        error: result.error
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Poll acknowledgment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to poll for acknowledgment'
      });
    }
  }

  /**
   * Poll for all queued acknowledgments
   * POST /claim-submissions/:id/communications/poll-all-acknowledgments
   */
  async pollAllQueuedAcknowledgments(req, res) {
    try {
      const claimId = parseInt(req.params.id);
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Polling all queued acknowledgments for claim ${claimId}`);

      const result = await claimCommunicationService.pollAllQueuedAcknowledgments(
        claimId,
        schemaName
      );

      res.json({
        success: result.success,
        totalPolled: result.totalPolled,
        acknowledged: result.acknowledged,
        stillQueued: result.stillQueued,
        errors: result.errors,
        results: result.results,
        message: result.message
      });

    } catch (error) {
      console.error('[ClaimSubmissions] Poll all acknowledgments error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to poll for acknowledgments'
      });
    }
  }

  /**
   * Cancel claim submission
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const schemaName = req.schemaName || 'public';

      console.log(`[ClaimSubmissions] Cancelling claim ${id} with reason: ${reason}`);

      // Get existing claim
      const existing = await this.getByIdInternal(id, schemaName);
      if (!existing) {
        return res.status(404).json({ error: 'Claim submission not found' });
      }

      // Must have claim identifier to cancel (nphies_claim_id or claim_number)
      if (!existing.nphies_claim_id && !existing.claim_number) {
        return res.status(400).json({ 
          error: 'Cannot cancel: no claim identifier exists' 
        });
      }

      // Check if claim can be cancelled (not already cancelled, paid, etc.)
      if (existing.status === 'cancelled') {
        return res.status(400).json({ 
          error: 'Claim is already cancelled' 
        });
      }

      if (existing.status === 'paid') {
        return res.status(400).json({ 
          error: 'Cannot cancel: claim has already been paid' 
        });
      }

      // Get provider and insurer data
      const providerResult = await query(`SELECT * FROM providers WHERE provider_id = $1`, [existing.provider_id]);
      const insurerResult = await query(`SELECT * FROM insurers WHERE insurer_id = $1`, [existing.insurer_id]);

      if (providerResult.rows.length === 0 || insurerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Provider or insurer not found' });
      }

      const provider = providerResult.rows[0];
      const insurer = insurerResult.rows[0];

      // Build cancel request bundle using claim mapper (which extends BaseMapper)
      // Adapt claim data to prior auth format for cancel bundle
      // The identifier used should be nphies_claim_id if available, otherwise claim_number
      const claimForCancel = {
        request_number: existing.nphies_claim_id || existing.claim_number,
        nphies_request_id: existing.nphies_claim_id || existing.nphies_request_id,
        pre_auth_ref: existing.pre_auth_ref,
        provider_id: existing.provider_id,
        insurer_id: existing.insurer_id
      };

      // Get claim mapper and build cancel bundle
      const mapper = getClaimMapper(existing.claim_type);
      const cancelBundle = mapper.buildCancelRequestBundle(claimForCancel, provider, insurer, reason);

      // Send to NPHIES using dedicated cancel method
      const nphiesResponse = await nphiesService.submitCancelRequest(cancelBundle);

      if (nphiesResponse.success) {
        // Update status
        await query(`SET search_path TO ${schemaName}`);
        // Try to update cancellation_reason if column exists, otherwise just update status
        try {
          await query(`
            UPDATE claim_submissions 
            SET status = 'cancelled',
                cancellation_reason = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [reason, id]);
        } catch (error) {
          // If cancellation_reason column doesn't exist, just update status
          if (error.message.includes('column "cancellation_reason" does not exist')) {
            await query(`
              UPDATE claim_submissions 
              SET status = 'cancelled',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [id]);
          } else {
            throw error;
          }
        }

        // Store response
        const dbOutcome = nphiesResponse.taskStatus === 'completed' ? 'complete' : 
                          nphiesResponse.taskStatus === 'failed' ? 'error' : 'complete';
        await query(`
          INSERT INTO claim_submission_responses 
          (claim_id, response_type, outcome, bundle_json, received_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [id, 'cancel', dbOutcome, JSON.stringify(nphiesResponse.data)]);

        const updatedData = await this.getByIdInternal(id, schemaName);

        res.json({
          success: true,
          data: updatedData,
          message: 'Claim cancelled successfully',
          taskStatus: nphiesResponse.taskStatus,
          nphiesResponse: nphiesResponse.data,
          requestBundle: cancelBundle
        });
      } else {
        // Store failed response for debugging
        await query(`SET search_path TO ${schemaName}`);
        await query(`
          INSERT INTO claim_submission_responses 
          (claim_id, response_type, outcome, bundle_json, has_errors, errors, received_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          id, 
          'cancel', 
          'error', 
          JSON.stringify(nphiesResponse.data || nphiesResponse.error),
          true,
          JSON.stringify(nphiesResponse.error || nphiesResponse.errors)
        ]);

        res.status(502).json({
          success: false,
          error: nphiesResponse.error || nphiesResponse.errors,
          taskStatus: nphiesResponse.taskStatus,
          message: 'Failed to cancel claim',
          nphiesResponse: nphiesResponse.data,
          requestBundle: cancelBundle
        });
      }
    } catch (error) {
      console.error('[ClaimSubmissions] Error cancelling claim:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel claim' });
    }
  }
}

export default new ClaimSubmissionsController();
