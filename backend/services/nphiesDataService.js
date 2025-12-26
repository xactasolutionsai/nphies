/**
 * NPHIES Data Service
 * Handles UPSERT operations for storing NPHIES response data
 * Reference: https://portal.nphies.sa/ig/usecase-eligibility.html
 */

import { query, transaction } from '../db.js';

class NphiesDataService {
  
  /**
   * UPSERT patient - Create if not exists, update if exists
   * Matches by identifier (National ID, Iqama, or Passport)
   * @param {Object} patientData - Patient data from form or NPHIES response
   * @returns {Object} The upserted patient record
   */
  async upsertPatient(patientData) {
    const {
      name,
      identifier,
      identifierType = 'national_id',
      identifierSystem,
      gender,
      birthDate,
      phone,
      email,
      address,
      city,
      country = 'SAU',
      maritalStatus,
      nphiesPatientId,
      isNewborn = false
    } = patientData;

    if (!identifier) {
      throw new Error('Patient identifier is required');
    }

    // Check if patient exists by identifier
    const existingPatient = await query(
      'SELECT * FROM patients WHERE identifier = $1',
      [identifier]
    );

    if (existingPatient.rows.length > 0) {
      // Update existing patient
      const updateQuery = `
        UPDATE patients SET
          name = COALESCE($1, name),
          identifier_type = COALESCE($2, identifier_type),
          gender = COALESCE($3, gender),
          birth_date = COALESCE($4, birth_date),
          phone = COALESCE($5, phone),
          email = COALESCE($6, email),
          address = COALESCE($7, address),
          city = COALESCE($8, city),
          country = COALESCE($9, country),
          marital_status = COALESCE($10, marital_status),
          is_newborn = COALESCE($11, is_newborn),
          updated_at = NOW()
        WHERE identifier = $12
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        name,
        identifierType,
        gender?.toLowerCase(),
        birthDate,
        phone,
        email,
        address,
        city,
        country,
        maritalStatus,
        isNewborn,
        identifier
      ]);
      
      console.log(`[NPHIES Data] Updated patient: ${identifier}`);
      return result.rows[0];
    } else {
      // Insert new patient
      const insertQuery = `
        INSERT INTO patients (
          name, identifier, identifier_type, gender, birth_date,
          phone, email, address, city, country, marital_status, is_newborn
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        name || 'Unknown',
        identifier,
        identifierType,
        gender?.toLowerCase(),
        birthDate,
        phone,
        email,
        address,
        city,
        country,
        maritalStatus,
        isNewborn
      ]);
      
      console.log(`[NPHIES Data] Created new patient: ${identifier} (newborn: ${isNewborn})`);
      return result.rows[0];
    }
  }

  /**
   * UPSERT insurer - Create if not exists, update if exists
   * Matches by NPHIES ID
   * @param {Object} insurerData - Insurer data from form or NPHIES response
   * @returns {Object} The upserted insurer record
   */
  async upsertInsurer(insurerData) {
    const {
      name,
      nphiesId,
      status = 'Active',
      phone,
      email,
      address
    } = insurerData;

    if (!nphiesId) {
      throw new Error('Insurer NPHIES ID is required');
    }

    // Check if insurer exists by nphies_id
    const existingInsurer = await query(
      'SELECT * FROM insurers WHERE nphies_id = $1',
      [nphiesId]
    );

    if (existingInsurer.rows.length > 0) {
      // Update existing insurer
      const updateQuery = `
        UPDATE insurers SET
          insurer_name = COALESCE($1, insurer_name),
          status = COALESCE($2, status),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          address = COALESCE($5, address),
          updated_at = NOW()
        WHERE nphies_id = $6
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        name,
        status,
        phone,
        email,
        address,
        nphiesId
      ]);
      
      console.log(`[NPHIES Data] Updated insurer: ${nphiesId}`);
      return result.rows[0];
    } else {
      // Insert new insurer
      const insertQuery = `
        INSERT INTO insurers (
          insurer_name, nphies_id, status, phone, email, address
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        name || 'Unknown Insurer',
        nphiesId,
        status,
        phone,
        email,
        address
      ]);
      
      console.log(`[NPHIES Data] Created new insurer: ${nphiesId}`);
      return result.rows[0];
    }
  }

  /**
   * UPSERT provider - Create if not exists, update if exists
   * Matches by nphies_id
   * @param {Object} providerData - Provider data from form
   * @returns {Object} The upserted provider record
   */
  async upsertProvider(providerData) {
    const {
      name,
      nphiesId,
      locationLicense = 'GACH',
      providerType = '1',
      phone,
      email,
      address
    } = providerData;

    if (!nphiesId) {
      throw new Error('Provider NPHIES ID is required');
    }

    // Check if provider exists by nphies_id
    const existingProvider = await query(
      'SELECT * FROM providers WHERE nphies_id = $1',
      [nphiesId]
    );

    if (existingProvider.rows.length > 0) {
      // Update existing provider
      const updateQuery = `
        UPDATE providers SET
          provider_name = COALESCE($1, provider_name),
          location_license = COALESCE($2, location_license),
          provider_type = COALESCE($3, provider_type),
          phone = COALESCE($4, phone),
          email = COALESCE($5, email),
          address = COALESCE($6, address),
          updated_at = NOW()
        WHERE nphies_id = $7
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        name,
        locationLicense,
        providerType,
        phone,
        email,
        address,
        nphiesId
      ]);
      
      console.log(`[NPHIES Data] Updated provider: ${nphiesId}`);
      return result.rows[0];
    } else {
      // Insert new provider
      const insertQuery = `
        INSERT INTO providers (
          provider_name, nphies_id, location_license, provider_type, phone, email, address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        name || 'Unknown Provider',
        nphiesId,
        locationLicense,
        providerType,
        phone,
        email,
        address
      ]);
      
      console.log(`[NPHIES Data] Created new provider: ${nphiesId}`);
      return result.rows[0];
    }
  }

  /**
   * UPSERT coverage - Create if not exists, update if exists
   * Matches by policy_number + patient_id
   * @param {Object} coverageData - Coverage data from form or NPHIES response
   * @param {string} patientId - Patient UUID
   * @param {string} insurerId - Insurer UUID
   * @returns {Object} The upserted coverage record
   */
  async upsertCoverage(coverageData, patientId, insurerId) {
    const {
      policyNumber,
      memberId,
      subscriberId,
      coverageType = 'EHCPOL',
      relationship = 'self',
      dependentNumber,
      planName,
      networkType,
      classCode,
      className,
      startDate,
      endDate,
      isActive = true,
      nphiesCoverageId
    } = coverageData;

    // Use policyNumber or memberId as the primary identifier
    const coverageIdentifier = policyNumber || memberId;
    
    if (!coverageIdentifier) {
      throw new Error('Coverage identifier (policyNumber or memberId) is required');
    }

    // Check if coverage exists by policy_number + patient_id OR member_id + patient_id
    const existingCoverage = await query(
      'SELECT * FROM patient_coverage WHERE (policy_number = $1 OR member_id = $1) AND patient_id = $2',
      [coverageIdentifier, patientId]
    );

    if (existingCoverage.rows.length > 0) {
      // Update existing coverage
      const updateQuery = `
        UPDATE patient_coverage SET
          insurer_id = COALESCE($1, insurer_id),
          member_id = COALESCE($2, member_id),
          coverage_type = COALESCE($3, coverage_type),
          relationship = COALESCE($4, relationship),
          dependent_number = COALESCE($5, dependent_number),
          plan_name = COALESCE($6, plan_name),
          network_type = COALESCE($7, network_type),
          start_date = COALESCE($8, start_date),
          end_date = COALESCE($9, end_date),
          is_active = COALESCE($10, is_active),
          updated_at = NOW()
        WHERE coverage_id = $11
        RETURNING *
      `;
      
      const result = await query(updateQuery, [
        insurerId,
        memberId || subscriberId || coverageIdentifier,
        coverageType,
        relationship,
        dependentNumber,
        planName,
        networkType,
        startDate,
        endDate,
        isActive,
        existingCoverage.rows[0].coverage_id
      ]);
      
      console.log(`[NPHIES Data] Updated coverage: ${coverageIdentifier}`);
      return result.rows[0];
    } else {
      // Insert new coverage
      const insertQuery = `
        INSERT INTO patient_coverage (
          patient_id, insurer_id, policy_number, member_id, coverage_type,
          relationship, dependent_number, plan_name, network_type,
          start_date, end_date, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        patientId,
        insurerId,
        policyNumber || coverageIdentifier, // Store as policy_number if no explicit policyNumber
        memberId || subscriberId || coverageIdentifier, // Also store as member_id
        coverageType,
        relationship,
        dependentNumber,
        planName,
        networkType,
        startDate,
        endDate,
        isActive
      ]);
      
      console.log(`[NPHIES Data] Created new coverage: ${coverageIdentifier}`);
      return result.rows[0];
    }
  }

  /**
   * Extract and UPSERT all data from NPHIES response bundle
   * @param {Object} responseBundle - NPHIES response bundle
   * @param {Object} existingData - Original entities { patient, provider, insurer, coverage }
   * @param {Object} requestBundle - Original request bundle for reference
   * @returns {Object} All upserted records
   */
  async processNphiesResponse(responseBundle, existingData = {}, requestBundle = null) {
    const result = {
      patient: null,
      insurer: null,
      coverage: null,
      provider: null
    };

    try {
      // Extract resources from bundle
      const patientResource = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'Patient'
      )?.resource;
      
      const coverageResource = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'Coverage'
      )?.resource;
      
      const insurerResource = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('payer-license'))
      )?.resource;

      const providerResource = responseBundle.entry?.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('provider-license'))
      )?.resource;

      // Process Patient
      if (patientResource) {
        const patientData = this.extractPatientData(patientResource);
        result.patient = await this.upsertPatient(patientData);
      }

      // Process Insurer
      if (insurerResource) {
        const insurerData = this.extractInsurerData(insurerResource);
        result.insurer = await this.upsertInsurer(insurerData);
      }

      // Process Coverage (requires patient and insurer)
      if (coverageResource && result.patient && result.insurer) {
        const coverageData = this.extractCoverageData(coverageResource);
        result.coverage = await this.upsertCoverage(
          coverageData,
          result.patient.patient_id,
          result.insurer.insurer_id
        );
      }

      console.log('[NPHIES Data] Successfully processed response data');
      return result;

    } catch (error) {
      console.error('[NPHIES Data] Error processing response:', error);
      throw error;
    }
  }

  /**
   * Extract patient data from FHIR Patient resource
   */
  extractPatientData(patientResource) {
    const identifier = patientResource.identifier?.[0];
    const name = patientResource.name?.[0];
    const telecom = patientResource.telecom?.find(t => t.system === 'phone');
    const email = patientResource.telecom?.find(t => t.system === 'email');
    const address = patientResource.address?.[0];

    // Determine identifier type from system or type code
    // NPHIES identifier codes:
    // - NI: National Identifier (Saudi National ID)
    // - PRC: Permanent Resident Card (Iqama)
    // - PPN: Passport Number
    // - MR: Medical Record Number
    let identifierType = 'national_id';
    const typeCode = identifier?.type?.coding?.[0]?.code;
    const identifierValue = identifier?.value;
    
    if (typeCode === 'MR' || identifier?.system?.includes('mrn')) {
      identifierType = 'mrn';
    } else if (typeCode === 'PPN' || identifier?.system?.includes('passport')) {
      identifierType = 'passport';
    } else if (typeCode === 'PRC' || identifier?.system?.includes('iqama')) {
      identifierType = 'iqama';
    } else if (typeCode === 'NI') {
      // NI can be either national_id or iqama based on system/value
      if (identifier?.system?.includes('iqama') || (identifierValue && identifierValue.startsWith('2'))) {
        identifierType = 'iqama';
      } else {
        identifierType = 'national_id';
      }
    }

    return {
      name: name?.text || [name?.given?.join(' '), name?.family].filter(Boolean).join(' '),
      identifier: identifier?.value,
      identifierType,
      identifierSystem: identifier?.system,
      gender: patientResource.gender,
      birthDate: patientResource.birthDate,
      phone: telecom?.value,
      email: email?.value,
      address: address?.text || address?.line?.join(', '),
      city: address?.city,
      country: address?.country || 'SAU',
      maritalStatus: patientResource.maritalStatus?.coding?.[0]?.code,
      nphiesPatientId: patientResource.id
    };
  }

  /**
   * Extract insurer data from FHIR Organization resource
   */
  extractInsurerData(organizationResource) {
    const nphiesId = organizationResource.identifier?.find(
      i => i.system?.includes('payer-license')
    )?.value;

    const telecom = organizationResource.telecom?.find(t => t.system === 'phone');
    const email = organizationResource.telecom?.find(t => t.system === 'email');
    const address = organizationResource.address?.[0];

    return {
      name: organizationResource.name,
      nphiesId,
      phone: telecom?.value,
      email: email?.value,
      address: address?.text || address?.line?.join(', ')
    };
  }

  /**
   * Extract coverage data from FHIR Coverage resource
   */
  extractCoverageData(coverageResource) {
    const identifier = coverageResource.identifier?.[0];
    const coverageClass = coverageResource.class?.[0];

    return {
      policyNumber: identifier?.value,
      memberId: coverageResource.subscriberId,
      subscriberId: coverageResource.subscriberId,
      coverageType: coverageResource.type?.coding?.[0]?.code || 'EHCPOL',
      relationship: coverageResource.relationship?.coding?.[0]?.code || 'self',
      dependentNumber: coverageResource.dependent,
      planName: coverageClass?.name,
      classCode: coverageClass?.value,
      className: coverageClass?.name,
      networkType: coverageResource.network,
      startDate: coverageResource.period?.start,
      endDate: coverageResource.period?.end,
      isActive: coverageResource.status === 'active',
      nphiesCoverageId: coverageResource.id
    };
  }

  /**
   * Store eligibility check result with all parsed data
   * Accepts either objects (with patient_id, provider_id, etc.) or direct IDs
   * @param {Object} params - All data for storing
   * @returns {Object} Created eligibility record
   */
  async storeEligibilityResult({
    patient,        // Object with patient_id or direct patientId
    provider,       // Object with provider_id or direct providerId  
    insurer,        // Object with insurer_id or direct insurerId
    coverage,       // Object with coverage_id or direct coverageId (can be null)
    patientId,      // Direct ID alternative
    providerId,     // Direct ID alternative
    insurerId,      // Direct ID alternative
    coverageId,     // Direct ID alternative
    motherPatient,  // Object with patient_id (for newborn requests)
    motherPatientId, // Direct mother patient ID alternative
    purpose,
    servicedDate,
    isTransfer,
    isNewborn,
    requestBundle,
    responseBundle,
    parsedResponse
  }) {
    // Extract IDs - support both object and direct ID patterns
    const finalPatientId = patient?.patient_id || patientId;
    const finalProviderId = provider?.provider_id || providerId;
    const finalInsurerId = insurer?.insurer_id || insurerId;
    const finalCoverageId = coverage?.coverage_id || coverageId || null;
    const finalMotherPatientId = motherPatient?.patient_id || motherPatientId || null;

    console.log(`[NPHIES Data] Storing eligibility result with:`, {
      patient_id: finalPatientId,
      mother_patient_id: finalMotherPatientId,
      has_motherPatient: !!motherPatient,
      motherPatient_patient_id: motherPatient?.patient_id,
      motherPatientId_param: motherPatientId
    });

    const insertQuery = `
      INSERT INTO eligibility (
        patient_id, provider_id, insurer_id, coverage_id, mother_patient_id,
        purpose, serviced_date, status, outcome, inforce,
        nphies_request_id, nphies_response_id,
        is_transfer, site_eligibility,
        raw_request, raw_response, benefits, error_codes,
        request_date, response_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
      )
      RETURNING eligibility_id
    `;

    const result = await query(insertQuery, [
      finalPatientId,
      finalProviderId,
      finalInsurerId,
      finalCoverageId,
      finalMotherPatientId,
      Array.isArray(purpose) ? purpose.join(',') : purpose,
      servicedDate || new Date(),
      parsedResponse?.inforce ? 'eligible' : 'not_eligible',
      parsedResponse?.outcome || 'unknown',
      parsedResponse?.inforce || false,
      requestBundle?.id,
      parsedResponse?.nphiesResponseId,
      isTransfer || false,
      parsedResponse?.siteEligibility?.code || null,
      JSON.stringify(requestBundle),
      JSON.stringify(responseBundle),
      JSON.stringify(parsedResponse?.benefits || []),
      JSON.stringify(parsedResponse?.errors || [])
    ]);

    console.log(`[NPHIES Data] Stored eligibility result: ${result.rows[0].eligibility_id}`);
    return { eligibilityId: result.rows[0].eligibility_id };
  }

  /**
   * Get default provider from database
   * Uses DEFAULT_PROVIDER_ID env variable or first provider in DB
   * @returns {Object} Provider record
   */
  async getDefaultProvider() {
    const defaultProviderId = process.env.DEFAULT_PROVIDER_ID;

    if (defaultProviderId) {
      const result = await query(
        'SELECT * FROM providers WHERE provider_id = $1',
        [defaultProviderId]
      );
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    // Fallback: get first provider
    const result = await query(
      'SELECT * FROM providers ORDER BY created_at ASC LIMIT 1'
    );

    if (result.rows.length === 0) {
      throw new Error('No provider found in database. Please configure a provider first.');
    }

    return result.rows[0];
  }

  /**
   * Get patient by ID or identifier
   */
  async getPatient(patientIdOrIdentifier) {
    // Try UUID first
    let result = await query(
      'SELECT * FROM patients WHERE patient_id = $1',
      [patientIdOrIdentifier]
    );

    if (result.rows.length === 0) {
      // Try identifier
      result = await query(
        'SELECT * FROM patients WHERE identifier = $1',
        [patientIdOrIdentifier]
      );
    }

    return result.rows[0] || null;
  }

  /**
   * Get insurer by ID or NPHIES ID
   */
  async getInsurer(insurerIdOrNphiesId) {
    // Try UUID first
    let result = await query(
      'SELECT * FROM insurers WHERE insurer_id = $1',
      [insurerIdOrNphiesId]
    );

    if (result.rows.length === 0) {
      // Try NPHIES ID
      result = await query(
        'SELECT * FROM insurers WHERE nphies_id = $1',
        [insurerIdOrNphiesId]
      );
    }

    return result.rows[0] || null;
  }

  /**
   * Get coverage by ID or policy number + patient
   */
  async getCoverage(coverageId, patientId = null) {
    // Try UUID first
    let result = await query(
      'SELECT * FROM patient_coverage WHERE coverage_id = $1',
      [coverageId]
    );

    if (result.rows.length === 0 && patientId) {
      // Try policy number
      result = await query(
        'SELECT * FROM patient_coverage WHERE policy_number = $1 AND patient_id = $2',
        [coverageId, patientId]
      );
    }

    return result.rows[0] || null;
  }
}

export default new NphiesDataService();
