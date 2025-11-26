import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';
import nphiesMapper from '../services/nphiesMapper.js';
import nphiesService from '../services/nphiesService.js';
import nphiesDataService from '../services/nphiesDataService.js';

class EligibilityController extends BaseController {
  constructor() {
    super('eligibility', validationSchemas.eligibility);
  }

  // Get all eligibility records with joins
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
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR pr.provider_name ILIKE $${paramIndex} OR i.insurer_name ILIKE $${paramIndex} OR e.purpose ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        countParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`e.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          e.*,
          e.eligibility_id as id,
          p.name as patient_name,
          pr.provider_name as provider_name,
          i.insurer_name as insurer_name
        FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
        ${whereClause}
        ORDER BY e.eligibility_id DESC 
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
      console.error('Error getting eligibility records:', error);
      res.status(500).json({ error: 'Failed to fetch eligibility records' });
    }
  }

  // Get eligibility record by ID with full details
  async getById(req, res) {
    try {
      const queries = await loadQueries();
      const { id } = req.params;
      
      const result = await query(queries.ELIGIBILITY.GET_BY_ID_WITH_JOINS, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Eligibility record not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error getting eligibility record by ID:', error);
      res.status(500).json({ error: 'Failed to fetch eligibility record' });
    }
  }

  // Update eligibility status
  async updateStatus(req, res) {
    try {
      const queries = await loadQueries();
      const { id } = req.params;
      const { status } = req.body;

      if (!['eligible', 'not_eligible', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await query(queries.ELIGIBILITY.UPDATE_STATUS, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Eligibility record not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      console.error('Error updating eligibility status:', error);
      res.status(500).json({ error: 'Failed to update eligibility status' });
    }
  }

  // Check eligibility with NPHIES
  // Supports NPHIES extensions: Newborn (for newborn eligibility with mother's coverage)
  // and Transfer (for transfer of care requests)
  async checkNphiesEligibility(req, res) {
    try {
      const { 
        patientId, 
        providerId, 
        insurerId, 
        coverageId, 
        purpose, 
        servicedDate,
        isNewborn,  // Extension: Flag for newborn eligibility check
        isTransfer  // Extension: Flag for transfer of care
      } = req.body;

      // Validate required fields
      if (!patientId || !providerId || !insurerId || !coverageId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: patientId, providerId, insurerId, coverageId'
        });
      }

      // Note: IDs are UUIDs, not integers - no need to parse

      // Fetch patient data
      const patientResult = await query(
        'SELECT * FROM patients WHERE patient_id = $1',
        [patientId]
      );
      if (patientResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Patient not found' });
      }
      const patient = patientResult.rows[0];

      // Fetch provider data
      const providerResult = await query(
        'SELECT * FROM providers WHERE provider_id = $1',
        [providerId]
      );
      if (providerResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Provider not found' });
      }
      const provider = providerResult.rows[0];

      // Fetch insurer data
      const insurerResult = await query(
        'SELECT * FROM insurers WHERE insurer_id = $1',
        [insurerId]
      );
      if (insurerResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Insurer not found' });
      }
      const insurer = insurerResult.rows[0];

      // Fetch coverage data
      const coverageResult = await query(
        'SELECT * FROM patient_coverage WHERE coverage_id = $1 AND patient_id = $2',
        [coverageId, patientId]
      );
      if (coverageResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Coverage not found' });
      }
      const coverage = coverageResult.rows[0];

      // Validate NPHIES IDs
      if (!provider.nphies_id) {
        return res.status(400).json({
          success: false,
          error: 'Provider does not have NPHIES ID configured'
        });
      }
      if (!insurer.nphies_id) {
        return res.status(400).json({
          success: false,
          error: 'Insurer does not have NPHIES ID configured'
        });
      }

      console.log('[NPHIES] Building eligibility request bundle...');
      if (isNewborn) console.log('[NPHIES] Newborn extension enabled');
      if (isTransfer) console.log('[NPHIES] Transfer extension enabled');

      // Build FHIR bundle with extensions
      const requestBundle = nphiesMapper.buildEligibilityRequestBundle({
        patient,
        provider,
        insurer,
        coverage,
        purpose: purpose || ['benefits', 'validation'],
        servicedDate: servicedDate || new Date(),
        isNewborn: Boolean(isNewborn),
        isTransfer: Boolean(isTransfer)
      });

      console.log('[NPHIES] Sending request to NPHIES API...');

      // Send to NPHIES
      const nphiesResponse = await nphiesService.checkEligibility(requestBundle);

      if (!nphiesResponse.success) {
        // Save failed request to database
        const insertQuery = `
          INSERT INTO eligibility (
            patient_id, provider_id, insurer_id, coverage_id,
            purpose, serviced_date, status, outcome,
            is_transfer, raw_request, raw_response, error_codes,
            request_date, response_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          RETURNING eligibility_id
        `;

        const insertResult = await query(insertQuery, [
          patientId,
          providerId,
          insurerId,
          coverageId,
          (purpose || ['benefits', 'validation']).join(','),
          servicedDate || new Date(),
          'pending',
          'error',
          Boolean(isTransfer),
          JSON.stringify(requestBundle),
          JSON.stringify(nphiesResponse.error),
          JSON.stringify([nphiesResponse.error])
        ]);

        return res.status(500).json({
          success: false,
          eligibilityId: insertResult.rows[0].eligibility_id,
          error: 'NPHIES request failed',
          details: nphiesResponse.error
        });
      }

      console.log('[NPHIES] Parsing response...');

      // Parse response (includes Site Eligibility extraction)
      const parsedResponse = nphiesMapper.parseEligibilityResponse(nphiesResponse.data);

      // Save to database including site_eligibility and is_transfer
      const insertQuery = `
        INSERT INTO eligibility (
          patient_id, provider_id, insurer_id, coverage_id,
          purpose, serviced_date, status, outcome, inforce,
          nphies_request_id, nphies_response_id,
          is_transfer, site_eligibility,
          raw_request, raw_response, benefits, error_codes,
          request_date, response_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING eligibility_id
      `;

      const insertResult = await query(insertQuery, [
        patientId,
        providerId,
        insurerId,
        coverageId,
        (purpose || ['benefits', 'validation']).join(','),
        servicedDate || new Date(),
        parsedResponse.inforce ? 'eligible' : 'not_eligible',
        parsedResponse.outcome,
        parsedResponse.inforce,
        requestBundle.id,
        parsedResponse.nphiesResponseId,
        Boolean(isTransfer),
        parsedResponse.siteEligibility?.code || null,
        JSON.stringify(requestBundle),
        JSON.stringify(nphiesResponse.data),
        JSON.stringify(parsedResponse.benefits || []),
        JSON.stringify(parsedResponse.errors || [])
      ]);

      const eligibilityId = insertResult.rows[0].eligibility_id;

      console.log(`[NPHIES] Eligibility check completed. ID: ${eligibilityId}`);

      // Return success response with Site Eligibility
      res.json({
        success: parsedResponse.success,
        eligibilityId,
        outcome: parsedResponse.outcome,
        inforce: parsedResponse.inforce,
        responseCode: parsedResponse.responseCode,
        isNphiesGenerated: parsedResponse.isNphiesGenerated,
        siteEligibility: parsedResponse.siteEligibility,
        patient: {
          name: patient.name,
          identifier: patient.identifier,
          ...parsedResponse.patient
        },
        provider: {
          name: provider.provider_name || provider.name,
          nphiesId: provider.nphies_id
        },
        insurer: {
          name: insurer.insurer_name || insurer.name,
          nphiesId: insurer.nphies_id
        },
        coverage: {
          policyNumber: coverage.policy_number,
          type: coverage.coverage_type,
          ...parsedResponse.coverage
        },
        benefits: parsedResponse.benefits || [],
        nphiesResponseId: parsedResponse.nphiesResponseId,
        errors: parsedResponse.errors || [],
        raw: {
          request: requestBundle,
          response: nphiesResponse.data
        }
      });

    } catch (error) {
      console.error('[NPHIES] Error checking eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check eligibility',
        details: error.message
      });
    }
  }

  // Get NPHIES eligibility details with full FHIR data
  async getNphiesDetails(req, res) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          e.*,
          p.name as patient_name,
          p.identifier as patient_identifier,
          p.is_newborn as patient_is_newborn,
          pr.provider_name,
          pr.nphies_id as provider_nphies_id,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id,
          pc.policy_number,
          pc.coverage_type
        FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
        LEFT JOIN patient_coverage pc ON e.coverage_id = pc.coverage_id
        WHERE e.eligibility_id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Eligibility record not found' });
      }

      const record = result.rows[0];

      res.json({
        data: {
          eligibilityId: record.eligibility_id,
          outcome: record.outcome,
          inforce: record.inforce,
          status: record.status,
          siteEligibility: record.site_eligibility ? {
            code: record.site_eligibility,
            display: nphiesMapper.getSiteEligibilityDisplay(record.site_eligibility)
          } : null,
          isTransfer: record.is_transfer,
          patient: {
            name: record.patient_name,
            identifier: record.patient_identifier,
            isNewborn: record.patient_is_newborn
          },
          provider: {
            name: record.provider_name,
            nphiesId: record.provider_nphies_id
          },
          insurer: {
            name: record.insurer_name,
            nphiesId: record.insurer_nphies_id
          },
          coverage: {
            policyNumber: record.policy_number,
            type: record.coverage_type
          },
          benefits: record.benefits || [],
          errors: record.error_codes || [],
          requestDate: record.request_date,
          responseDate: record.response_date,
          raw: {
            request: record.raw_request,
            response: record.raw_response
          }
        }
      });
    } catch (error) {
      console.error('Error getting NPHIES eligibility details:', error);
      res.status(500).json({ error: 'Failed to fetch eligibility details' });
    }
  }

  // Get patient coverages
  async getPatientCoverages(req, res) {
    try {
      const { patientId } = req.params;

      const result = await query(`
        SELECT 
          pc.*,
          i.insurer_name,
          i.nphies_id as insurer_nphies_id
        FROM patient_coverage pc
        LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
        WHERE pc.patient_id = $1 AND pc.is_active = true
        ORDER BY pc.created_at DESC
      `, [patientId]);

      res.json({ data: result.rows });
    } catch (error) {
      console.error('Error getting patient coverages:', error);
      res.status(500).json({ error: 'Failed to fetch patient coverages' });
    }
  }

  // Send example bundle directly to NPHIES (for testing)
  async checkNphiesExampleDirect(req, res) {
    try {
      const { bundle } = req.body;

      if (!bundle || !bundle.resourceType || bundle.resourceType !== 'Bundle') {
        return res.status(400).json({
          success: false,
          error: 'Invalid bundle provided'
        });
      }

      console.log('[NPHIES] Sending example bundle directly to NPHIES API...');
      console.log('[NPHIES] Target: http://176.105.150.83/$process-message');

      // Send to NPHIES
      const nphiesResponse = await nphiesService.checkEligibility(bundle);

      if (!nphiesResponse.success) {
        return res.status(500).json({
          success: false,
          error: 'NPHIES request failed',
          details: nphiesResponse.error,
          raw: {
            request: bundle,
            error: nphiesResponse.error
          }
        });
      }

      console.log('[NPHIES] Response received from OBA API');

      // Parse response
      const parsedResponse = nphiesMapper.parseEligibilityResponse(nphiesResponse.data);

      // Return success response
      res.json({
        success: parsedResponse.success,
        outcome: parsedResponse.outcome,
        inforce: parsedResponse.inforce,
        patient: parsedResponse.patient,
        coverage: parsedResponse.coverage,
        benefits: parsedResponse.benefits || [],
        nphiesResponseId: parsedResponse.nphiesResponseId,
        errors: parsedResponse.errors || [],
        raw: {
          request: bundle,
          response: nphiesResponse.data
        }
      });

    } catch (error) {
      console.error('[NPHIES] Error sending example to NPHIES:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send example to NPHIES',
        details: error.message
      });
    }
  }

  /**
   * Check eligibility with NPHIES using dynamic data
   * Supports both existing records (by ID) and manual entry (raw data)
   * Auto-selects provider and performs UPSERT on all entities
   * 
   * Request body:
   * - patientId OR patientData: { name, identifier, identifierType, gender, birthDate, phone }
   * - insurerId OR insurerData: { name, nphiesId }
   * - coverageId OR coverageData: { policyNumber, memberId, coverageType, planName } OR null for discovery
   * - purpose: ['discovery'] | ['benefits', 'validation']
   * - servicedDate: date string
   * - isNewborn: boolean
   * - isTransfer: boolean
   */
  async checkDynamicEligibility(req, res) {
    try {
      const {
        // Patient - either ID or manual data
        patientId,
        patientData,
        // Insurer - either ID or manual data
        insurerId,
        insurerData,
        // Coverage - either ID, manual data, or null for discovery
        coverageId,
        coverageData,
        // Options
        purpose = ['benefits', 'validation'],
        servicedDate,
        isNewborn = false,
        isTransfer = false
      } = req.body;

      console.log('[NPHIES Dynamic] Processing eligibility request...');

      // --- 1. Resolve Patient ---
      let patient;
      if (patientId) {
        // Fetch existing patient
        const patientResult = await query(
          'SELECT * FROM patients WHERE patient_id = $1',
          [patientId]
        );
        if (patientResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Patient not found' });
        }
        patient = patientResult.rows[0];
        console.log(`[NPHIES Dynamic] Using existing patient: ${patient.name}`);
      } else if (patientData) {
        // UPSERT patient from form data
        if (!patientData.identifier) {
          return res.status(400).json({ success: false, error: 'Patient identifier is required' });
        }
        patient = await nphiesDataService.upsertPatient({
          name: patientData.name,
          identifier: patientData.identifier,
          identifierType: patientData.identifierType || 'national_id',
          gender: patientData.gender,
          birthDate: patientData.birthDate,
          phone: patientData.phone,
          email: patientData.email
        });
        console.log(`[NPHIES Dynamic] Upserted patient: ${patient.name}`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either patientId or patientData must be provided'
        });
      }

      // --- 2. Resolve Insurer ---
      let insurer;
      if (insurerId) {
        // Fetch existing insurer
        const insurerResult = await query(
          'SELECT * FROM insurers WHERE insurer_id = $1',
          [insurerId]
        );
        if (insurerResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Insurer not found' });
        }
        insurer = insurerResult.rows[0];
        console.log(`[NPHIES Dynamic] Using existing insurer: ${insurer.insurer_name}`);
      } else if (insurerData) {
        // UPSERT insurer from form data
        if (!insurerData.nphiesId) {
          return res.status(400).json({ success: false, error: 'Insurer NPHIES ID is required' });
        }
        insurer = await nphiesDataService.upsertInsurer({
          name: insurerData.name,
          nphiesId: insurerData.nphiesId
        });
        console.log(`[NPHIES Dynamic] Upserted insurer: ${insurer.insurer_name}`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either insurerId or insurerData must be provided'
        });
      }

      // --- 3. Resolve Provider (Auto-select) ---
      let provider;
      try {
        provider = await nphiesDataService.getDefaultProvider();
        console.log(`[NPHIES Dynamic] Auto-selected provider: ${provider.provider_name}`);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'No provider configured. Please add a provider to the database.'
        });
      }

      // --- 4. Resolve Coverage ---
      let coverage = null;
      const isDiscoveryMode = purpose.includes('discovery') && !coverageId && !coverageData;

      if (coverageId) {
        // Fetch existing coverage
        const coverageResult = await query(
          'SELECT * FROM patient_coverage WHERE coverage_id = $1 AND patient_id = $2',
          [coverageId, patient.patient_id]
        );
        if (coverageResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Coverage not found for this patient' });
        }
        coverage = coverageResult.rows[0];
        console.log(`[NPHIES Dynamic] Using existing coverage: ${coverage.policy_number}`);
      } else if (coverageData && coverageData.policyNumber) {
        // UPSERT coverage from form data
        coverage = await nphiesDataService.upsertCoverage({
          policyNumber: coverageData.policyNumber,
          memberId: coverageData.memberId,
          coverageType: coverageData.coverageType || 'EHCPOL',
          planName: coverageData.planName,
          networkType: coverageData.networkType,
          relationship: coverageData.relationship || 'self',
          startDate: coverageData.startDate,
          endDate: coverageData.endDate
        }, patient.patient_id, insurer.insurer_id);
        console.log(`[NPHIES Dynamic] Upserted coverage: ${coverage.policy_number}`);
      } else if (!isDiscoveryMode) {
        return res.status(400).json({
          success: false,
          error: 'Coverage is required unless using discovery mode'
        });
      } else {
        console.log('[NPHIES Dynamic] Discovery mode - no coverage provided');
      }

      // Validate NPHIES IDs
      if (!provider.nphies_id) {
        return res.status(400).json({
          success: false,
          error: 'Provider does not have NPHIES ID configured'
        });
      }
      if (!insurer.nphies_id) {
        return res.status(400).json({
          success: false,
          error: 'Insurer does not have NPHIES ID configured'
        });
      }

      console.log('[NPHIES Dynamic] Building eligibility request bundle...');
      if (isNewborn) console.log('[NPHIES Dynamic] Newborn extension enabled');
      if (isTransfer) console.log('[NPHIES Dynamic] Transfer extension enabled');
      if (isDiscoveryMode) console.log('[NPHIES Dynamic] Discovery mode enabled');

      // Build FHIR bundle with extensions (handles null coverage for discovery)
      const requestBundle = nphiesMapper.buildEligibilityRequestBundle({
        patient,
        provider,
        insurer,
        coverage,
        purpose: purpose || ['benefits', 'validation'],
        servicedDate: servicedDate || new Date(),
        isNewborn: Boolean(isNewborn),
        isTransfer: Boolean(isTransfer)
      });

      console.log('[NPHIES Dynamic] Sending request to NPHIES API...');

      // Send to NPHIES
      const nphiesResponse = await nphiesService.checkEligibility(requestBundle);

      if (!nphiesResponse.success) {
        // Store failed request
        const failedResult = await nphiesDataService.storeEligibilityResult({
          patient,
          provider,
          insurer,
          coverage,
          requestBundle,
          responseBundle: null,
          parsedResponse: {
            success: false,
            outcome: 'error',
            inforce: false,
            errors: [nphiesResponse.error]
          },
          purpose,
          servicedDate,
          isNewborn,
          isTransfer
        });

        return res.status(500).json({
          success: false,
          eligibilityId: failedResult.eligibilityId,
          error: 'NPHIES request failed',
          details: nphiesResponse.error
        });
      }

      console.log('[NPHIES Dynamic] Parsing response and storing data...');

      // Parse response
      const parsedResponse = nphiesMapper.parseEligibilityResponse(nphiesResponse.data);

      // Process NPHIES response - UPSERT patient, insurer, coverage from response
      const updatedEntities = await nphiesDataService.processNphiesResponse(
        nphiesResponse.data,
        { patient, provider, insurer, coverage },
        requestBundle
      );

      // Store eligibility result with all parsed data
      const storedResult = await nphiesDataService.storeEligibilityResult({
        patient: updatedEntities.patient || patient,
        provider,
        insurer: updatedEntities.insurer || insurer,
        coverage: updatedEntities.coverage || coverage,
        requestBundle,
        responseBundle: nphiesResponse.data,
        parsedResponse,
        purpose,
        servicedDate,
        isNewborn,
        isTransfer
      });

      console.log(`[NPHIES Dynamic] Eligibility check completed. ID: ${storedResult.eligibilityId}`);

      // Return success response
      res.json({
        success: parsedResponse.success,
        eligibilityId: storedResult.eligibilityId,
        outcome: parsedResponse.outcome,
        inforce: parsedResponse.inforce,
        responseCode: parsedResponse.responseCode,
        isNphiesGenerated: parsedResponse.isNphiesGenerated,
        siteEligibility: parsedResponse.siteEligibility,
        patient: {
          patientId: updatedEntities.patient?.patient_id,
          name: updatedEntities.patient?.name || patient.name,
          identifier: updatedEntities.patient?.identifier || patient.identifier,
          ...parsedResponse.patient
        },
        provider: {
          providerId: provider.provider_id,
          name: provider.provider_name || provider.name,
          nphiesId: provider.nphies_id
        },
        insurer: {
          insurerId: updatedEntities.insurer?.insurer_id,
          name: updatedEntities.insurer?.insurer_name || insurer.insurer_name,
          nphiesId: updatedEntities.insurer?.nphies_id || insurer.nphies_id
        },
        coverage: coverage ? {
          coverageId: updatedEntities.coverage?.coverage_id,
          policyNumber: updatedEntities.coverage?.policy_number || coverage.policy_number,
          type: updatedEntities.coverage?.coverage_type || coverage.coverage_type,
          ...parsedResponse.coverage
        } : parsedResponse.coverage,
        benefits: parsedResponse.benefits || [],
        nphiesResponseId: parsedResponse.nphiesResponseId,
        errors: parsedResponse.errors || [],
        raw: {
          request: requestBundle,
          response: nphiesResponse.data
        }
      });

    } catch (error) {
      console.error('[NPHIES Dynamic] Error checking eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check eligibility',
        details: error.message
      });
    }
  }

  /**
   * Preview the FHIR bundle that would be sent to NPHIES
   * This does NOT send the request, only builds and returns the bundle
   */
  async previewEligibilityRequest(req, res) {
    try {
      const {
        patientId,
        patientData,
        insurerId,
        insurerData,
        coverageId,
        coverageData,
        purpose = ['benefits', 'validation'],
        servicedDate,
        isNewborn = false,
        isTransfer = false
      } = req.body;

      console.log('[NPHIES Preview] Building preview request bundle...');

      // --- 1. Resolve Patient (without UPSERT for preview) ---
      let patient;
      if (patientId) {
        const patientResult = await query(
          'SELECT * FROM patients WHERE patient_id = $1',
          [patientId]
        );
        if (patientResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Patient not found' });
        }
        patient = patientResult.rows[0];
      } else if (patientData) {
        // For preview, just use the data as-is without saving
        patient = {
          patient_id: 'preview-patient-id',
          name: patientData.name || 'Preview Patient',
          identifier: patientData.identifier,
          identifier_type: patientData.identifierType || 'national_id',
          gender: patientData.gender,
          birthdate: patientData.birthDate,
          phone: patientData.phone
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either patientId or patientData must be provided'
        });
      }

      // --- 2. Resolve Insurer (without UPSERT for preview) ---
      let insurer;
      if (insurerId) {
        const insurerResult = await query(
          'SELECT * FROM insurers WHERE insurer_id = $1',
          [insurerId]
        );
        if (insurerResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Insurer not found' });
        }
        insurer = insurerResult.rows[0];
      } else if (insurerData) {
        // For preview, just use the data as-is without saving
        insurer = {
          insurer_id: 'preview-insurer-id',
          insurer_name: insurerData.name || 'Preview Insurer',
          nphies_id: insurerData.nphiesId
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either insurerId or insurerData must be provided'
        });
      }

      // --- 3. Resolve Provider (Auto-select) ---
      let provider;
      try {
        provider = await nphiesDataService.getDefaultProvider();
        if (!provider) {
          return res.status(404).json({
            success: false,
            error: 'No provider configured in the system'
          });
        }
      } catch (err) {
        return res.status(404).json({
          success: false,
          error: 'Failed to get default provider'
        });
      }

      // --- 4. Resolve Coverage (without UPSERT for preview) ---
      let coverage = null;
      const isDiscoveryMode = !coverageId && !coverageData;

      if (coverageId) {
        const coverageResult = await query(
          'SELECT * FROM patient_coverage WHERE coverage_id = $1',
          [coverageId]
        );
        if (coverageResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Coverage not found' });
        }
        coverage = coverageResult.rows[0];
      } else if (coverageData) {
        // For preview, just use the data as-is without saving
        coverage = {
          coverage_id: 'preview-coverage-id',
          policy_number: coverageData.policyNumber,
          member_id: coverageData.memberId,
          coverage_type: coverageData.coverageType || 'EHCPOL',
          plan_name: coverageData.planName,
          relationship: coverageData.relationship || 'self',
          patient_id: patient.patient_id,
          insurer_id: insurer.insurer_id
        };
      }

      // --- 5. Build FHIR Bundle (without sending) ---
      const requestBundle = nphiesMapper.buildEligibilityRequestBundle({
        patient,
        provider,
        insurer,
        coverage,
        purpose: purpose || ['benefits', 'validation'],
        servicedDate: servicedDate || new Date(),
        isNewborn: Boolean(isNewborn),
        isTransfer: Boolean(isTransfer)
      });

      console.log('[NPHIES Preview] Bundle built successfully');

      // Return the preview bundle
      res.json({
        success: true,
        preview: true,
        message: 'This is a preview of the FHIR bundle. No request was sent to NPHIES.',
        isDiscoveryMode,
        entities: {
          patient: {
            name: patient.name,
            identifier: patient.identifier,
            identifierType: patient.identifier_type,
            gender: patient.gender,
            birthDate: patient.birthdate
          },
          provider: {
            name: provider.provider_name || provider.name,
            nphiesId: provider.nphies_id
          },
          insurer: {
            name: insurer.insurer_name || insurer.name,
            nphiesId: insurer.nphies_id
          },
          coverage: coverage ? {
            policyNumber: coverage.policy_number,
            memberId: coverage.member_id,
            type: coverage.coverage_type
          } : null
        },
        options: {
          purpose,
          servicedDate: servicedDate || new Date().toISOString().split('T')[0],
          isNewborn,
          isTransfer
        },
        fhirBundle: requestBundle
      });

    } catch (error) {
      console.error('[NPHIES Preview] Error building preview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to build preview',
        details: error.message
      });
    }
  }
}

export default new EligibilityController();
