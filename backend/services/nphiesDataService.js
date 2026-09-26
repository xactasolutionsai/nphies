/**
 * NPHIES Data Service
 * Handles UPSERT operations for storing NPHIES response data
 * Reference: https://portal.nphies.sa/ig/usecase-eligibility.html
 */

import { query, transaction } from '../db.js';

// Only values actually provided may overwrite stored columns: undefined/'' become NULL so
// COALESCE(new, stored) keeps what is already in the database.
const provided = value => (value === undefined || value === '' ? null : value);

class NphiesDataService {

  /**
   * Run an upsert atomically: one transaction, serialised per natural key with a
   * transaction-scoped advisory lock so concurrent requests cannot both insert.
   */
  async withUpsertLock(scope, key, callback) {
    return transaction(async () => {
      await query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${scope}:${key}`]);
      return callback();
    });
  }
  
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
      identifierType,
      gender,
      birthDate,
      phone,
      email,
      address,
      city,
      country,
      maritalStatus,
      isNewborn
    } = patientData;

    if (!identifier) {
      throw new Error('Patient identifier is required');
    }

    return this.withUpsertLock('patient', identifier, async () => {
      // Check if patient exists by identifier
      const existingPatient = await query(
        'SELECT patient_id FROM patients WHERE identifier = $1',
        [identifier]
      );

      if (existingPatient.rows.length > 0) {
        // Update existing patient: only fields that were provided
        const result = await query(`
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
        `, [
          provided(name), provided(identifierType), provided(gender), provided(birthDate),
          provided(phone), provided(email), provided(address), provided(city), provided(country),
          provided(maritalStatus), isNewborn ?? null, identifier
        ]);
        
        console.log(`[NPHIES Data] Updated patient ${result.rows[0]?.patient_id}`);
        return result.rows[0];
      }

      // Insert new patient (column defaults only for a brand-new record)
      const result = await query(`
        INSERT INTO patients (
          name, identifier, identifier_type, gender, birth_date,
          phone, email, address, city, country, marital_status, is_newborn
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        provided(name) || 'Unknown',
        identifier,
        provided(identifierType) || 'national_id',
        provided(gender),
        provided(birthDate),
        provided(phone),
        provided(email),
        provided(address),
        provided(city),
        provided(country) || 'SAU',
        provided(maritalStatus),
        isNewborn ?? false
      ]);
      
      console.log(`[NPHIES Data] Created patient ${result.rows[0]?.patient_id} (newborn: ${isNewborn ?? false})`);
      return result.rows[0];
    });
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
      status,
      phone,
      email,
      address
    } = insurerData;

    if (!nphiesId) {
      throw new Error('Insurer NPHIES ID is required');
    }

    return this.withUpsertLock('insurer', nphiesId, async () => {
      // Check if insurer exists by nphies_id
      const existingInsurer = await query(
        'SELECT insurer_id FROM insurers WHERE nphies_id = $1',
        [nphiesId]
      );

      if (existingInsurer.rows.length > 0) {
        // Update existing insurer: only fields that were provided
        const result = await query(`
          UPDATE insurers SET
            insurer_name = COALESCE($1, insurer_name),
            status = COALESCE($2, status),
            phone = COALESCE($3, phone),
            email = COALESCE($4, email),
            address = COALESCE($5, address),
            updated_at = NOW()
          WHERE nphies_id = $6
          RETURNING *
        `, [provided(name), provided(status), provided(phone), provided(email), provided(address), nphiesId]);
        
        console.log(`[NPHIES Data] Updated insurer: ${nphiesId}`);
        return result.rows[0];
      }

      // Insert new insurer
      const result = await query(`
        INSERT INTO insurers (
          insurer_name, nphies_id, status, phone, email, address
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        provided(name) || 'Unknown Insurer',
        nphiesId,
        provided(status) || 'Active',
        provided(phone),
        provided(email),
        provided(address)
      ]);
      
      console.log(`[NPHIES Data] Created new insurer: ${nphiesId}`);
      return result.rows[0];
    });
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
      locationLicense,
      providerType,
      phone,
      email,
      address
    } = providerData;

    if (!nphiesId) {
      throw new Error('Provider NPHIES ID is required');
    }

    return this.withUpsertLock('provider', nphiesId, async () => {
      // Check if provider exists by nphies_id
      const existingProvider = await query(
        'SELECT provider_id FROM providers WHERE nphies_id = $1',
        [nphiesId]
      );

      if (existingProvider.rows.length > 0) {
        // Update existing provider: only fields that were provided
        const result = await query(`
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
        `, [
          provided(name), provided(locationLicense), provided(providerType),
          provided(phone), provided(email), provided(address), nphiesId
        ]);
        
        console.log(`[NPHIES Data] Updated provider: ${nphiesId}`);
        return result.rows[0];
      }

      // Insert new provider. No placeholder location license: a Location is only
      // sent to NPHIES when the provider's real license is known.
      const result = await query(`
        INSERT INTO providers (
          provider_name, nphies_id, location_license, provider_type, phone, email, address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        provided(name) || 'Unknown Provider',
        nphiesId,
        provided(locationLicense),
        provided(providerType) || '1',
        provided(phone),
        provided(email),
        provided(address)
      ]);
      
      console.log(`[NPHIES Data] Created new provider: ${nphiesId}`);
      return result.rows[0];
    });
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
      coverageType,
      relationship,
      dependentNumber,
      planName,
      networkType,
      startDate,
      endDate,
      isActive
    } = coverageData;

    // Use policyNumber or memberId as the primary identifier
    const coverageIdentifier = policyNumber || memberId;
    
    if (!coverageIdentifier) {
      throw new Error('Coverage identifier (policyNumber or memberId) is required');
    }
    // A real member id only; never the policy number standing in for it
    const memberIdentifier = provided(memberId) || provided(subscriberId);

    return this.withUpsertLock('coverage', `${patientId}:${coverageIdentifier}`, async () => {
      // Check if coverage exists by policy_number + patient_id OR member_id + patient_id
      const existingCoverage = await query(
        'SELECT coverage_id FROM patient_coverage WHERE (policy_number = $1 OR member_id = $1) AND patient_id = $2',
        [coverageIdentifier, patientId]
      );

      if (existingCoverage.rows.length > 0) {
        // Update existing coverage: only fields that were provided
        const result = await query(`
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
        `, [
          provided(insurerId),
          memberIdentifier,
          provided(coverageType),
          provided(relationship),
          provided(dependentNumber),
          provided(planName),
          provided(networkType),
          provided(startDate),
          provided(endDate),
          isActive ?? null,
          existingCoverage.rows[0].coverage_id
        ]);
        
        console.log(`[NPHIES Data] Updated coverage ${existingCoverage.rows[0].coverage_id}`);
        return result.rows[0];
      }

      // Insert new coverage
      const result = await query(`
        INSERT INTO patient_coverage (
          patient_id, insurer_id, policy_number, member_id, coverage_type,
          relationship, dependent_number, plan_name, network_type,
          start_date, end_date, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        patientId,
        insurerId,
        policyNumber || coverageIdentifier, // Store as policy_number if no explicit policyNumber
        memberIdentifier,
        provided(coverageType) || 'EHCPOL',
        provided(relationship) || 'self',
        provided(dependentNumber),
        provided(planName),
        provided(networkType),
        provided(startDate),
        provided(endDate),
        isActive ?? true
      ]);
      
      console.log(`[NPHIES Data] Created coverage ${result.rows[0]?.coverage_id}`);
      return result.rows[0];
    });
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

      // Process Insurer: only the insurer the request was sent to. A payer Organization with a
      // different license (e.g. a sandbox test payer) must not create a new insurer row or
      // re-link this coverage/eligibility to it.
      if (insurerResource) {
        const insurerData = this.extractInsurerData(insurerResource);
        const requestedInsurer = existingData.insurer;
        if (!requestedInsurer?.nphies_id || insurerData.nphiesId === requestedInsurer.nphies_id) {
          result.insurer = await this.upsertInsurer(insurerData);
        } else {
          console.warn('[NPHIES Data] Response payer license differs from the requested insurer; keeping the requested insurer');
          result.insurer = requestedInsurer.insurer_id ? requestedInsurer : null;
        }
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
    // - BN: Border Number
    // - DP: Displaced Person
    // - VS: Visa
    let identifierType = 'national_id';
    const typeCode = identifier?.type?.coding?.[0]?.code;
    const identifierValue = identifier?.value;
    
    switch (typeCode) {
      case 'MR':
        identifierType = 'mrn';
        break;
      case 'PPN':
        identifierType = 'passport';
        break;
      case 'PRC':
        identifierType = 'iqama';
        break;
      case 'BN':
        identifierType = 'border_number';
        break;
      case 'DP':
        identifierType = 'displaced_person';
        break;
      case 'NI':
        // NI can be either national_id or iqama based on system/value
        if (identifier?.system?.includes('iqama') || (identifierValue && identifierValue.startsWith('2'))) {
          identifierType = 'iqama';
        } else {
          identifierType = 'national_id';
        }
        break;
      default:
        // Fallback: check system URL for identifier type
        if (identifier?.system?.includes('mrn')) {
          identifierType = 'mrn';
        } else if (identifier?.system?.includes('passport')) {
          identifierType = 'passport';
        } else if (identifier?.system?.includes('iqama')) {
          identifierType = 'iqama';
        } else if (identifier?.system?.includes('bordernumber')) {
          identifierType = 'border_number';
        } else if (identifier?.system?.includes('displacedperson')) {
          identifierType = 'displaced_person';
        }
        break;
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
      country: address?.country,
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
      coverageType: coverageResource.type?.coding?.[0]?.code,
      relationship: coverageResource.relationship?.coding?.[0]?.code,
      dependentNumber: coverageResource.dependent,
      planName: coverageClass?.name,
      classCode: coverageClass?.value,
      className: coverageClass?.name,
      networkType: coverageResource.network,
      startDate: coverageResource.period?.start,
      endDate: coverageResource.period?.end,
      // Unknown status must not overwrite the stored flag
      isActive: coverageResource.status ? coverageResource.status === 'active' : undefined,
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

    const insertParams = [
      finalPatientId,
      finalProviderId,
      finalInsurerId,
      finalCoverageId,
      finalMotherPatientId, // $5 - This should be the mother_patient_id
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
    ];

    const result = await query(insertQuery, insertParams);
    const eligibilityId = result.rows[0].eligibility_id;
    console.log(`[NPHIES Data] Stored eligibility ${eligibilityId} (outcome: ${parsedResponse?.outcome || 'unknown'})`);
    return { eligibilityId };
  }
}

export default new NphiesDataService();
