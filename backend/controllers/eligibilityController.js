import { BaseController } from './baseController.js';
import { query } from '../db.js';
import { validationSchemas } from '../models/schema.js';
import { loadQueries } from '../db/queryLoader.js';
import nphiesMapper from '../services/nphiesMapper.js';
import nphiesService from '../services/nphiesService.js';
import nphiesDataService from '../services/nphiesDataService.js';

// Helper function to convert empty strings to null (for database compatibility)
const emptyToNull = (value) => (value === '' || value === undefined) ? null : value;

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

      // Build dynamic WHERE clause - use separate param indices for count vs data queries
      let whereConditions = [];
      let countParams = [];
      let countParamIndex = 1;

      if (search) {
        whereConditions.push(`(p.name ILIKE $${countParamIndex} OR pr.provider_name ILIKE $${countParamIndex} OR i.insurer_name ILIKE $${countParamIndex} OR e.purpose ILIKE $${countParamIndex})`);
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (status) {
        whereConditions.push(`e.status = $${countParamIndex}`);
        countParams.push(status);
        countParamIndex++;
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

      // Build WHERE clause for data query with offset param indices (limit=$1, offset=$2)
      let dataWhereConditions = [];
      let dataParams = [limit, offset];
      let dataParamIndex = 3;

      if (search) {
        dataWhereConditions.push(`(p.name ILIKE $${dataParamIndex} OR pr.provider_name ILIKE $${dataParamIndex} OR i.insurer_name ILIKE $${dataParamIndex} OR e.purpose ILIKE $${dataParamIndex})`);
        dataParams.push(`%${search}%`);
        dataParamIndex++;
      }

      if (status) {
        dataWhereConditions.push(`e.status = $${dataParamIndex}`);
        dataParams.push(status);
        dataParamIndex++;
      }

      const dataWhereClause = dataWhereConditions.length > 0 ? 'WHERE ' + dataWhereConditions.join(' AND ') : '';

      // Get paginated data with joins
      const dataQuery = `
        SELECT
          e.*,
          e.eligibility_id as id,
          p.name as patient_name,
          p.identifier as patient_identifier,
          pr.provider_name as provider_name,
          i.insurer_name as insurer_name
        FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
        ${dataWhereClause}
        ORDER BY e.created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await query(dataQuery, dataParams);

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
          e.mother_patient_id, -- Explicitly include mother_patient_id
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

  // Get patient eligibility responses (for prior auth dropdown)
  async getPatientEligibilities(req, res) {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }

      const result = await query(`
        SELECT
          e.eligibility_id, e.nphies_response_id, e.status, e.outcome, e.inforce,
          e.response_date, e.created_at, e.serviced_date, e.coverage_id,
          e.raw_response,
          i.insurer_name, i.nphies_id as insurer_nphies_id
        FROM eligibility e
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
        WHERE e.patient_id = $1
          AND e.nphies_response_id IS NOT NULL
          AND e.status = 'eligible'
        ORDER BY e.response_date DESC
      `, [patientId]);

      // Extract eligibility reference details from raw_response FHIR bundle
      const eligibilities = result.rows.map(row => {
        // resource.id = human-readable payer ID (e.g., "51434")
        let resourceId = '';
        // identifier.value = UUID used in FHIR identifier (e.g., "b4d2618f-...")
        let identifierValue = row.nphies_response_id || '';
        let identifierSystem = '';
        let fullUrl = '';

        // Parse raw_response to extract CoverageEligibilityResponse details
        if (row.raw_response) {
          try {
            const rawResponse = typeof row.raw_response === 'string' 
              ? JSON.parse(row.raw_response) 
              : row.raw_response;
            
            // Find CoverageEligibilityResponse entry in bundle
            const eligEntry = rawResponse.entry?.find(
              e => e.resource?.resourceType === 'CoverageEligibilityResponse'
            );

            if (eligEntry) {
              // Get the resource ID (e.g., "51434") - human-readable payer-assigned ID
              resourceId = eligEntry.resource.id || '';
              // Get the full URL (e.g., "http://pseudo-payer.com.sa/CoverageEligibilityResponse/51434")
              fullUrl = eligEntry.fullUrl || '';
              // Get identifier (UUID + system)
              const identifier = eligEntry.resource.identifier?.[0];
              if (identifier) {
                identifierSystem = identifier.system || '';
                if (identifier.value) {
                  identifierValue = identifier.value;
                }
              }
            }
          } catch (parseErr) {
            console.error('Error parsing eligibility raw_response:', parseErr);
          }
        }

        return {
          eligibility_id: row.eligibility_id,
          // The identifier value (UUID) - used for FHIR eligibility_response_id field
          eligibility_response_id: identifierValue,
          eligibility_response_system: identifierSystem,
          eligibility_response_url: fullUrl,
          // The human-readable payer-assigned resource ID (e.g., "51434")
          resource_id: resourceId,
          response_date: row.response_date,
          created_at: row.created_at,
          serviced_date: row.serviced_date,
          insurer_name: row.insurer_name,
          insurer_nphies_id: row.insurer_nphies_id,
          inforce: row.inforce,
          coverage_id: row.coverage_id
        };
      });

      res.json({ data: eligibilities });
    } catch (error) {
      console.error('Error getting patient eligibilities:', error);
      res.status(500).json({ error: 'Failed to fetch patient eligibilities' });
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
        // Mother Patient - either ID or manual data (for newborn requests)
        motherPatientId,
        motherPatientData,
        // Provider - either ID or manual data
        providerId,
        providerData,
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
      // Track if patient needs to be upserted (only after successful API call)
      let patient;
      let shouldUpsertPatient = false;
      let patientDataToUpsert = null;
      
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
        // Create temporary patient object from form data (don't upsert yet)
        if (!patientData.identifier) {
          return res.status(400).json({ success: false, error: 'Patient identifier is required' });
        }
        // Store patient data for later upsert (only if API call succeeds)
        patientDataToUpsert = {
          name: patientData.name,
          identifier: patientData.identifier,
          identifierType: patientData.identifierType || 'national_id',
          gender: emptyToNull(patientData.gender),
          birthDate: emptyToNull(patientData.birthDate),
          phone: emptyToNull(patientData.phone),
          email: emptyToNull(patientData.email),
          isNewborn: isNewborn
        };
        // Create temporary patient object for bundle building (without patient_id)
        patient = {
          name: patientData.name,
          identifier: patientData.identifier,
          identifier_type: patientData.identifierType || 'national_id',
          gender: emptyToNull(patientData.gender),
          birth_date: emptyToNull(patientData.birthDate),
          phone: emptyToNull(patientData.phone),
          email: emptyToNull(patientData.email)
        };
        shouldUpsertPatient = true;
        console.log(`[NPHIES Dynamic] Created temporary patient object (will upsert after successful API call): ${patient.name}`);
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

      // --- 3. Resolve Provider ---
      let provider;
      if (providerId) {
        // Fetch existing provider
        const providerResult = await query(
          'SELECT * FROM providers WHERE provider_id = $1',
          [providerId]
        );
        if (providerResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Provider not found' });
        }
        provider = providerResult.rows[0];
        console.log(`[NPHIES Dynamic] Using existing provider: ${provider.provider_name}`);
      } else if (providerData) {
        // UPSERT provider from form data
        if (!providerData.nphiesId) {
          return res.status(400).json({ success: false, error: 'Provider NPHIES ID is required' });
        }
        provider = await nphiesDataService.upsertProvider({
          name: providerData.name,
          nphiesId: providerData.nphiesId,
          locationLicense: providerData.locationLicense || 'GACH'
        });
        console.log(`[NPHIES Dynamic] Upserted provider: ${provider.provider_name}`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either providerId or providerData must be provided'
        });
      }

      // --- 4. Resolve Coverage ---
      let coverage = null;
      const isDiscoveryMode = purpose.includes('discovery') && !coverageId && !coverageData;

      if (coverageId) {
        // Fetch existing coverage (no patient restriction - coverage can be selected independently)
        const coverageResult = await query(
          'SELECT * FROM patient_coverage WHERE coverage_id = $1',
          [coverageId]
        );
        if (coverageResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Coverage not found' });
        }
        coverage = coverageResult.rows[0];
        console.log(`[NPHIES Dynamic] Using existing coverage: ${coverage.policy_number || coverage.member_id}`);
      } else if (coverageData && (coverageData.memberId || coverageData.policyNumber)) {
        // UPSERT coverage from form data - memberId is the primary identifier
        coverage = await nphiesDataService.upsertCoverage({
          policyNumber: coverageData.policyNumber || coverageData.memberId, // Use memberId as policyNumber if not provided
          memberId: coverageData.memberId,
          coverageType: coverageData.coverageType || 'EHCPOL',
          planName: coverageData.planName,
          networkType: coverageData.networkType,
          relationship: coverageData.relationship || 'self',
          startDate: coverageData.startDate,
          endDate: coverageData.endDate
        }, patient.patient_id, insurer.insurer_id);
        console.log(`[NPHIES Dynamic] Upserted coverage: ${coverage.policy_number || coverage.member_id}`);
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

      // --- 5. Resolve Mother Patient (for newborn requests) ---
      let motherPatient = null;
      let shouldUpsertMotherPatient = false;
      let motherPatientDataToUpsert = null;
      let finalMotherPatientId = null; // Track the final mother patient ID to store
      
      if (isNewborn) {
        if (motherPatientId) {
          // Fetch existing mother patient
          const motherResult = await query(
            'SELECT * FROM patients WHERE patient_id = $1',
            [motherPatientId]
          );
          if (motherResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Mother patient not found' });
          }
          motherPatient = motherResult.rows[0];
          finalMotherPatientId = motherPatient.patient_id; // Store the ID we'll use
        } else if (motherPatientData) {
          // Create temporary mother patient object from form data (don't upsert yet)
          if (!motherPatientData.identifier) {
            return res.status(400).json({ success: false, error: 'Mother patient identifier is required for newborn requests' });
          }
          // Store mother patient data for later upsert (only if API call succeeds)
          motherPatientDataToUpsert = {
            name: motherPatientData.name,
            identifier: motherPatientData.identifier,
            identifierType: motherPatientData.identifierType || 'iqama',
            gender: emptyToNull(motherPatientData.gender),
            birthDate: emptyToNull(motherPatientData.birthDate),
            phone: emptyToNull(motherPatientData.phone),
            email: emptyToNull(motherPatientData.email),
            isNewborn: false // Mother is not a newborn
          };
          // Create temporary mother patient object for bundle building (without patient_id)
          motherPatient = {
            name: motherPatientData.name,
            identifier: motherPatientData.identifier,
            identifier_type: motherPatientData.identifierType || 'iqama',
            gender: emptyToNull(motherPatientData.gender),
            birth_date: emptyToNull(motherPatientData.birthDate),
            phone: emptyToNull(motherPatientData.phone),
            email: emptyToNull(motherPatientData.email)
          };
          shouldUpsertMotherPatient = true;
        } else {
          return res.status(400).json({
            success: false,
            error: 'Mother patient information is required when isNewborn is true. Provide either motherPatientId or motherPatientData.'
          });
        }
      }


      // Build FHIR bundle with extensions (handles null coverage for discovery)
      const requestBundle = nphiesMapper.buildEligibilityRequestBundle({
        patient,
        provider,
        insurer,
        coverage,
        purpose: purpose || ['benefits', 'validation'],
        servicedDate: servicedDate || new Date(),
        isNewborn: Boolean(isNewborn),
        isTransfer: Boolean(isTransfer),
        motherPatient: motherPatient
      });


      // Send to NPHIES
      const nphiesResponse = await nphiesService.checkEligibility(requestBundle);

      if (!nphiesResponse.success) {
        // Don't save patients if API call failed (validation error)
        // Return error without saving eligibility record
        return res.status(500).json({
          success: false,
          error: 'NPHIES request failed',
          details: nphiesResponse.error
        });
      }

      // API call succeeded - now upsert patients if needed
      if (shouldUpsertPatient && patientDataToUpsert) {
        patient = await nphiesDataService.upsertPatient(patientDataToUpsert);
      }
      
      if (shouldUpsertMotherPatient && motherPatientDataToUpsert) {
        motherPatient = await nphiesDataService.upsertPatient(motherPatientDataToUpsert);
        finalMotherPatientId = motherPatient.patient_id; // Update the ID after upsert
      }


      // Parse response
      const parsedResponse = nphiesMapper.parseEligibilityResponse(nphiesResponse.data);

      // Process NPHIES response - UPSERT patient, insurer, coverage from response
      const updatedEntities = await nphiesDataService.processNphiesResponse(
        nphiesResponse.data,
        { patient, provider, insurer, coverage },
        requestBundle
      );

      // Store eligibility result with all parsed data
      // Use finalMotherPatientId which was set earlier (either from direct ID or after upsert)
      if (isNewborn && !finalMotherPatientId && motherPatient?.patient_id) {
        // Fallback: extract from motherPatient object if finalMotherPatientId wasn't set
        finalMotherPatientId = motherPatient.patient_id;
      }
      
      const storedResult = await nphiesDataService.storeEligibilityResult({
        patient: updatedEntities.patient || patient,
        provider,
        insurer: updatedEntities.insurer || insurer,
        coverage: updatedEntities.coverage || coverage,
        motherPatient: isNewborn ? motherPatient : null,
        motherPatientId: finalMotherPatientId, // Pass explicitly
        requestBundle,
        responseBundle: nphiesResponse.data,
        parsedResponse,
        purpose,
        servicedDate,
        isNewborn,
        isTransfer
      });


      // Return response - success indicates if eligibility was granted, not if API call succeeded
      // The API call succeeded if we got here, so always include eligibilityId for navigation
      res.json({
        success: parsedResponse.success,
        apiSuccess: true, // API call itself succeeded
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
   * 
   * When partialMode is true:
   * - No validation errors for missing fields
   * - Only includes fields that are actually provided
   * - Skips resources that have no data
   */
  async previewEligibilityRequest(req, res) {
    try {
      const {
        patientId,
        patientData,
        motherPatientId,
        motherPatientData,
        providerId,
        providerData,
        insurerId,
        insurerData,
        coverageId,
        coverageData,
        purpose,
        servicedDate,
        isNewborn = false,
        isTransfer = false,
        partialMode = false // When true, skip validation and only include filled fields
      } = req.body;

      console.log('[NPHIES Preview] Building preview request bundle...', partialMode ? '(partial mode)' : '');

      // --- 1. Resolve Patient (without UPSERT for preview) ---
      let patient = null;
      if (patientId) {
        const patientResult = await query(
          'SELECT * FROM patients WHERE patient_id = $1',
          [patientId]
        );
        if (patientResult.rows.length === 0) {
          if (!partialMode) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
          }
          // In partial mode, skip if not found
        } else {
          patient = patientResult.rows[0];
        }
      } else if (patientData && Object.keys(patientData).length > 0) {
        // For preview, just use the data as-is without saving
        // Only include fields that are actually provided
        patient = {
          patient_id: 'preview-patient-id',
          ...(patientData.name && { name: patientData.name }),
          ...(patientData.identifier && { identifier: patientData.identifier }),
          ...(patientData.identifierType && { identifier_type: patientData.identifierType }),
          ...(patientData.gender && { gender: patientData.gender }),
          ...(patientData.birthDate && { birth_date: patientData.birthDate }),
          ...(patientData.phone && { phone: patientData.phone }),
          ...(patientData.email && { email: patientData.email })
        };
      }
      
      // In non-partial mode, patient is required
      if (!partialMode && !patient) {
        return res.status(400).json({
          success: false,
          error: 'Either patientId or patientData must be provided'
        });
      }

      // --- 2. Resolve Insurer (without UPSERT for preview) ---
      let insurer = null;
      if (insurerId) {
        const insurerResult = await query(
          'SELECT * FROM insurers WHERE insurer_id = $1',
          [insurerId]
        );
        if (insurerResult.rows.length === 0) {
          if (!partialMode) {
            return res.status(404).json({ success: false, error: 'Insurer not found' });
          }
        } else {
          insurer = insurerResult.rows[0];
        }
      } else if (insurerData && Object.keys(insurerData).length > 0) {
        // For preview, just use the data as-is without saving
        insurer = {
          insurer_id: 'preview-insurer-id',
          ...(insurerData.name && { insurer_name: insurerData.name }),
          ...(insurerData.nphiesId && { nphies_id: insurerData.nphiesId })
        };
      }
      
      if (!partialMode && !insurer) {
        return res.status(400).json({
          success: false,
          error: 'Either insurerId or insurerData must be provided'
        });
      }

      // --- 3. Resolve Provider ---
      let provider = null;
      if (providerId) {
        const providerResult = await query(
          'SELECT * FROM providers WHERE provider_id = $1',
          [providerId]
        );
        if (providerResult.rows.length === 0) {
          if (!partialMode) {
            return res.status(404).json({ success: false, error: 'Provider not found' });
          }
        } else {
          provider = providerResult.rows[0];
        }
      } else if (providerData && Object.keys(providerData).length > 0) {
        // For preview, just use the data as-is without saving
        provider = {
          provider_id: 'preview-provider-id',
          ...(providerData.name && { provider_name: providerData.name }),
          ...(providerData.nphiesId && { nphies_id: providerData.nphiesId }),
          ...(providerData.locationLicense && { location_license: providerData.locationLicense })
        };
      }
      
      if (!partialMode && !provider) {
        return res.status(400).json({
          success: false,
          error: 'Either providerId or providerData must be provided'
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
          if (!partialMode) {
            return res.status(404).json({ success: false, error: 'Coverage not found' });
          }
        } else {
          coverage = coverageResult.rows[0];
        }
      } else if (coverageData && Object.keys(coverageData).length > 0) {
        // For preview, just use the data as-is without saving
        coverage = {
          coverage_id: 'preview-coverage-id',
          ...(coverageData.policyNumber && { policy_number: coverageData.policyNumber }),
          ...(coverageData.memberId && { member_id: coverageData.memberId }),
          ...(coverageData.coverageType && { coverage_type: coverageData.coverageType }),
          ...(coverageData.planName && { plan_name: coverageData.planName }),
          ...(coverageData.relationship && { relationship: coverageData.relationship }),
          ...(coverageData.network && { network: coverageData.network }),
          ...(patient && { patient_id: patient.patient_id }),
          ...(insurer && { insurer_id: insurer.insurer_id })
        };
      }

      // --- 5. Resolve Mother Patient (for newborn requests, without UPSERT for preview) ---
      let motherPatient = null;
      if (isNewborn) {
        if (motherPatientId) {
          // Fetch existing mother patient
          const motherResult = await query(
            'SELECT * FROM patients WHERE patient_id = $1',
            [motherPatientId]
          );
          if (motherResult.rows.length === 0) {
            if (!partialMode) {
              return res.status(404).json({ success: false, error: 'Mother patient not found' });
            }
          } else {
            motherPatient = motherResult.rows[0];
          }
        } else if (motherPatientData && Object.keys(motherPatientData).length > 0) {
          // For preview, just use the data as-is without saving
          motherPatient = {
            patient_id: 'preview-mother-patient-id',
            ...(motherPatientData.name && { name: motherPatientData.name }),
            ...(motherPatientData.identifier && { identifier: motherPatientData.identifier }),
            ...(motherPatientData.identifierType && { identifier_type: motherPatientData.identifierType }),
            ...(motherPatientData.gender && { gender: motherPatientData.gender }),
            ...(motherPatientData.birthDate && { birth_date: motherPatientData.birthDate }),
            ...(motherPatientData.phone && { phone: motherPatientData.phone })
          };
        }
      }

      // --- 6. Build FHIR Bundle (without sending) ---
      // Pass partialMode to the mapper so it can skip empty fields
      const requestBundle = nphiesMapper.buildEligibilityRequestBundle({
        patient,
        provider,
        insurer,
        coverage,
        purpose: purpose || (partialMode ? undefined : ['benefits', 'validation']),
        servicedDate: servicedDate || (partialMode ? undefined : new Date()),
        isNewborn: Boolean(isNewborn),
        isTransfer: Boolean(isTransfer),
        motherPatient: motherPatient,
        partialMode: partialMode
      });

      console.log('[NPHIES Preview] Bundle built successfully');

      // Build entities summary - only include what's actually provided
      const entities = {};
      if (patient) {
        entities.patient = {};
        if (patient.name) entities.patient.name = patient.name;
        if (patient.identifier) entities.patient.identifier = patient.identifier;
        if (patient.identifier_type) entities.patient.identifierType = patient.identifier_type;
        if (patient.gender) entities.patient.gender = patient.gender;
        if (patient.birth_date || patient.birthDate) entities.patient.birthDate = patient.birth_date || patient.birthDate;
      }
      if (provider) {
        entities.provider = {};
        if (provider.provider_name || provider.name) entities.provider.name = provider.provider_name || provider.name;
        if (provider.nphies_id) entities.provider.nphiesId = provider.nphies_id;
      }
      if (insurer) {
        entities.insurer = {};
        if (insurer.insurer_name || insurer.name) entities.insurer.name = insurer.insurer_name || insurer.name;
        if (insurer.nphies_id) entities.insurer.nphiesId = insurer.nphies_id;
      }
      if (coverage) {
        entities.coverage = {};
        if (coverage.policy_number) entities.coverage.policyNumber = coverage.policy_number;
        if (coverage.member_id) entities.coverage.memberId = coverage.member_id;
        if (coverage.coverage_type) entities.coverage.type = coverage.coverage_type;
      }

      // Build options summary - only include what's actually provided
      const options = {};
      if (purpose && purpose.length > 0) options.purpose = purpose;
      if (servicedDate) options.servicedDate = servicedDate;
      if (isNewborn) options.isNewborn = isNewborn;
      if (isTransfer) options.isTransfer = isTransfer;

      // Return the preview bundle
      res.json({
        success: true,
        preview: true,
        message: 'This is a preview of the FHIR bundle. No request was sent to NPHIES.',
        isDiscoveryMode,
        ...(Object.keys(entities).length > 0 && { entities }),
        ...(Object.keys(options).length > 0 && { options }),
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

  // Get mother patient ID for a newborn patient
  // Checks both eligibility and prior_authorizations tables
  // Get mother patient ID for a newborn patient
  // Checks both eligibility and prior_authorizations tables for the most recent mother_patient_id
  // Note: A patient should have only one mother, so we return the most recent record
  async getMotherPatientForNewborn(req, res) {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }

      // First, check eligibility table for most recent record
      // Note: eligibility table doesn't have is_newborn column, so we check if mother_patient_id exists
      const eligibilityQuery = `
        SELECT mother_patient_id, created_at, patient_id, eligibility_id
        FROM eligibility 
        WHERE patient_id = $1::uuid
          AND mother_patient_id IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const eligibilityResult = await query(eligibilityQuery, [patientId]);

      if (eligibilityResult.rows.length > 0 && eligibilityResult.rows[0].mother_patient_id) {
        return res.json({ 
          mother_patient_id: eligibilityResult.rows[0].mother_patient_id 
        });
      }

      // If not found in eligibility, check prior_authorizations table
      const priorAuthQuery = `
        SELECT mother_patient_id, created_at, patient_id, id
        FROM prior_authorizations 
        WHERE patient_id = $1::uuid
          AND is_newborn = true 
          AND mother_patient_id IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const priorAuthResult = await query(priorAuthQuery, [patientId]);

      if (priorAuthResult.rows.length > 0 && priorAuthResult.rows[0].mother_patient_id) {
        return res.json({ 
          mother_patient_id: priorAuthResult.rows[0].mother_patient_id 
        });
      }

      // No mother patient relationship found - return null (this is a valid response, not an error)
      return res.json({ mother_patient_id: null });
    } catch (error) {
      console.error('Error getting mother patient for newborn:', error);
      res.status(500).json({ error: 'Failed to fetch mother patient information', details: error.message });
    }
  }
}

export default new EligibilityController();
