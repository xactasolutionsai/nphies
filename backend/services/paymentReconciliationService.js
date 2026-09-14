/**
 * Payment Reconciliation Service
 * 
 * Handles FHIR R4 PaymentReconciliation bundles from nphies
 * - Validates incoming FHIR bundles
 * - Parses PaymentReconciliation resources
 * - Extracts nphies-specific extensions (payment, early-fee, nphies-fee)
 * - Stores data in database
 * - Generates acknowledgement bundles
 */

import { query, transaction } from '../db.js';
import { reconciliationBundleErrors, paymentResourceErrors, originalPayment, resolveIdentifier, providerSystem, payerSystem, paymentError, validDate } from '../utils/paymentValidation.js';
import { randomUUID } from 'crypto';
import NphiesService from './nphiesService.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

// nphies Extension URLs
const EXTENSION_URLS = {
  COMPONENT_PAYMENT: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-component-payment',
  COMPONENT_EARLY_FEE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-component-early-fee',
  COMPONENT_NPHIES_FEE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-component-nphies-fee'
};

// Component type mapping
const COMPONENT_TYPE_MAP = {
  [EXTENSION_URLS.COMPONENT_PAYMENT]: { type: 'payment', display: 'Payment Amount' },
  [EXTENSION_URLS.COMPONENT_EARLY_FEE]: { type: 'early_fee', display: 'Early Settlement Fee' },
  [EXTENSION_URLS.COMPONENT_NPHIES_FEE]: { type: 'nphies_fee', display: 'nphies Service Fee' }
};

class PaymentReconciliationService {
  
  /**
   * Process an incoming FHIR Bundle containing PaymentReconciliation
   * @param {Object} bundle - FHIR Bundle
   * @returns {Object} - Processing result with acknowledgement bundle
   */
  async processBundle(bundle) {
    console.log('[PaymentReconciliation] Processing incoming bundle');
    
    // Step 1: Validate bundle structure
    const validationResult = this.validateBundle(bundle);
    if (!validationResult.valid) {
      console.error('[PaymentReconciliation] Validation failed:', validationResult.errors);
      return {
        success: false,
        errors: validationResult.errors,
        acknowledgement: this.buildErrorAcknowledgement(bundle, validationResult.errors)
      };
    }
    
    // Step 2: Extract PaymentReconciliation resource
    const paymentReconciliation = this.extractPaymentReconciliation(bundle);
    if (!paymentReconciliation) {
      return {
        success: false,
        errors: ['PaymentReconciliation resource not found in bundle'],
        acknowledgement: this.buildErrorAcknowledgement(bundle, ['PaymentReconciliation resource not found'])
      };
    }
    
    try {
      return await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([paymentReconciliation.identifier[0].system, paymentReconciliation.identifier[0].value])]);
        const existing = await client.query(`SELECT id, EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(request_bundle->'entry','[]'::jsonb)) e WHERE e->'resource'=$3::jsonb) AS identical FROM payment_reconciliations WHERE identifier_system=$1 AND identifier_value=$2`,
          [paymentReconciliation.identifier[0].system, paymentReconciliation.identifier[0].value, JSON.stringify(paymentReconciliation)]);
        if (existing.rows.length && !existing.rows[0].identical) throw paymentError('A different reconciliation already uses this business identifier', 409);
        if (existing.rows.length) return { success: true, duplicate: true, reconciliationId: existing.rows[0].id,
          acknowledgement: this.buildSuccessAcknowledgement(bundle, existing.rows[0].id) };
        const stored = await this.storeReconciliation(bundle, paymentReconciliation);
        const acknowledgement = this.buildSuccessAcknowledgement(bundle, stored.reconciliationId);
        await client.query('UPDATE payment_reconciliations SET response_bundle=$1 WHERE id=$2', [JSON.stringify(acknowledgement), stored.reconciliationId]);
        return { success: true, reconciliationId: stored.reconciliationId, acknowledgement };
      });
    } catch (error) {
      return { success: false, errors: [error.message], acknowledgement: this.buildErrorAcknowledgement(bundle, [error.message]) };
    }
  }


  /**
   * Validate FHIR Bundle structure
   */
  validateBundle(bundle) {
    const errors = reconciliationBundleErrors(bundle);
    return { valid: errors.length === 0, errors };
  }
  validateMandatoryFields(pr) { return paymentResourceErrors(pr); }

  extractPaymentReconciliation(bundle) {
    return bundle?.entry?.find(
      e => e.resource?.resourceType === 'PaymentReconciliation'
    )?.resource;
  }
  
  /**
   * Extract MessageHeader from bundle
   */
  extractMessageHeader(bundle) {
    return bundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
  }
  
  /**
   * Check if this PaymentReconciliation has already been processed
   */
  async checkDuplicate(pr) {
    const identifierSystem = pr.identifier?.[0]?.system;
    const identifierValue = pr.identifier?.[0]?.value;
    
    const result = await query(
      `SELECT id FROM payment_reconciliations 
       WHERE fhir_id = $1 
       OR (identifier_system = $2 AND identifier_value = $3)
       LIMIT 1`,
      [pr.id, identifierSystem, identifierValue]
    );
    
    return result.rows.length > 0;
  }
  
  /**
   * Store PaymentReconciliation and related data in database
   */
  async storeReconciliation(bundle, pr) {
    return await transaction(async (client) => {
      const messageHeader = this.extractMessageHeader(bundle);
      
      // 1. Insert main reconciliation record
      const reconciliationResult = await client.query(
        `INSERT INTO payment_reconciliations (
          fhir_id, identifier_system, identifier_value,
          status, outcome, disposition,
          period_start, period_end,
          created_date, payment_date,
          payment_amount, payment_currency,
          payment_identifier_system, payment_identifier_value, payment_method_code,
          payment_issuer_reference, requestor_reference,
          request_bundle, nphies_message_id,
          processing_status, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING id`,
        [
          pr.id,
          pr.identifier?.[0]?.system,
          pr.identifier?.[0]?.value,
          pr.status,
          pr.outcome,
          pr.disposition,
          pr.period?.start,
          pr.period?.end,
          pr.created,
          pr.paymentDate,
          pr.paymentAmount?.value,
          pr.paymentAmount?.currency || 'SAR',
          pr.paymentIdentifier?.system,
          pr.paymentIdentifier?.value,
          pr.paymentIdentifier?.type?.coding?.[0]?.code,
          pr.paymentIssuer?.reference,
          pr.requestor?.reference,
          JSON.stringify(bundle),
          messageHeader?.id,
          'processed',
          new Date()
        ]
      );
      
      const reconciliationId = reconciliationResult.rows[0].id;
      
      // 2. Insert detail records
      for (let i = 0; i < pr.detail.length; i++) {
        const detail = pr.detail[i];
        
        const detailResult = await client.query(
          `INSERT INTO payment_reconciliation_details (
            reconciliation_id, sequence,
            type_system, type_code, type_display,
            claim_reference, claim_identifier_system, claim_identifier_value,
            claim_response_reference, claim_response_identifier_system, claim_response_identifier_value,
            submitter_reference, payee_reference,
            amount, currency, detail_date,
            predecessor_reference, responsible_reference,
            extensions, detail_identifier, predecessor_identifier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING id`,
          [
            reconciliationId,
            i + 1,
            detail.type?.coding?.[0]?.system,
            detail.type?.coding?.[0]?.code,
            detail.type?.coding?.[0]?.display,
            detail.request?.reference,
            detail.request?.identifier?.system,
            detail.request?.identifier?.value,
            detail.response?.reference,
            detail.response?.identifier?.system,
            detail.response?.identifier?.value,
            detail.submitter?.reference,
            detail.payee?.reference,
            detail.amount?.value,
            detail.amount?.currency || 'SAR',
            detail.date,
            detail.predecessor?.reference,
            detail.responsible?.reference,
            detail.extension ? JSON.stringify(detail.extension) : null,
            detail.identifier ? JSON.stringify(detail.identifier) : null,
            detail.predecessor ? JSON.stringify(detail.predecessor) : null
          ]
        );
        
        const detailId = detailResult.rows[0].id;
        
        // 3. Extract and insert component extensions
        const components = this.extractComponents(detail);
        for (const component of components) {
          await client.query(
            `INSERT INTO payment_reconciliation_components (
              detail_id, component_type, extension_url,
              amount, currency, display_name, raw_extension
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              detailId,
              component.type,
              component.url,
              component.amount,
              component.currency,
              component.display,
              JSON.stringify(component.raw)
            ]
          );
        }
      }
      
      // 4. Try to link to existing claims/insurers/providers
      await this.linkToExistingRecords(client, reconciliationId, pr, bundle);
      
      return { reconciliationId };
    });
  }
  
  /**
   * Extract nphies component extensions from a detail
   */
  extractComponents(detail) {
    const components = [];
    
    if (!detail.extension || !Array.isArray(detail.extension)) {
      return components;
    }
    
    for (const ext of detail.extension) {
      const mapping = COMPONENT_TYPE_MAP[ext.url];
      
      if (mapping && ext.valueMoney) {
        components.push({
          type: mapping.type,
          url: ext.url,
          amount: ext.valueMoney.value,
          currency: ext.valueMoney.currency || 'SAR',
          display: mapping.display,
          raw: ext
        });
      } else if (ext.valueMoney) {
        // Unknown extension with money value - store as 'other'
        components.push({
          type: 'other',
          url: ext.url,
          amount: ext.valueMoney.value,
          currency: ext.valueMoney.currency || 'SAR',
          display: ext.url.split('/').pop(),
          raw: ext
        });
      }
    }
    
    return components;
  }
  
  /**
   * Try to link reconciliation to existing records
   */
  async linkToExistingRecords(client, reconciliationId, pr, bundle) {
    for (const [field, system, table, key, column] of [
      ['paymentIssuer', payerSystem, 'insurers', 'insurer_id', 'payment_issuer_id'],
      ['requestor', providerSystem, 'providers', 'provider_id', 'requestor_id']
    ]) {
      const identifier = resolveIdentifier(bundle, pr[field], system);
      if (!identifier) continue;
      const match = await client.query('SELECT '+key+' FROM '+table+' WHERE nphies_id=$1', [identifier.value]);
      if (match.rows.length === 1) await client.query('UPDATE payment_reconciliations SET '+column+'=$1 WHERE id=$2', [match.rows[0][key], reconciliationId]);
    }
    for (const detail of pr.detail || []) {
      if (!detail.request?.identifier) continue;
      const identifier = detail.request.identifier;
      const matches = await client.query(
        `SELECT id FROM claim_submissions WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(request_bundle->'entry','[]'::jsonb)) e,
          jsonb_array_elements(COALESCE(e->'resource'->'identifier','[]'::jsonb)) i
          WHERE e->'resource'->>'resourceType'='Claim' AND i->>'system'=$1 AND i->>'value'=$2)`,
        [identifier.system, identifier.value]);
      if (matches.rows.length === 1) await client.query(
        'UPDATE payment_reconciliation_details SET claim_submission_id=$1 WHERE reconciliation_id=$2 AND claim_identifier_system=$3 AND claim_identifier_value=$4',
        [matches.rows[0].id, reconciliationId, identifier.system, identifier.value]);
    }
  }

  /**
   * Extract ID from FHIR reference
   */
  extractIdFromReference(reference) {
    if (!reference) return null;
    // Handle both "Organization/123" and full URL formats
    const parts = reference.split('/');
    return parts[parts.length - 1];
  }
  
  /**
   * Build success acknowledgement bundle
   */
  buildSuccessAcknowledgement(originalBundle, reconciliationId) {
    const messageHeader = this.extractMessageHeader(originalBundle);
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    
    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'acknowledgement'
            },
            destination: messageHeader?.source ? [{
              endpoint: messageHeader.source.endpoint, receiver: messageHeader.sender
            }] : [],
            sender: messageHeader?.destination?.[0]?.receiver || { type: 'Organization', identifier: { system: providerSystem, value: NPHIES_CONFIG.DEFAULT_PROVIDER_ID } },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || messageHeader?.destination?.[0]?.endpoint || 'http://nafes.local'
            },
            response: {
              identifier: messageHeader?.id || originalBundle.id,
              code: 'ok'
            }
          }
        }
      ]
    };
  }
  
  /**
   * Build error acknowledgement bundle
   */
  buildErrorAcknowledgement(originalBundle, errors, httpStatus = '400') {
    const messageHeader = this.extractMessageHeader(originalBundle);
    const bundleId = randomUUID();
    const messageHeaderId = randomUUID();
    const operationOutcomeId = randomUUID();
    
    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:${messageHeaderId}`,
          resource: {
            resourceType: 'MessageHeader',
            id: messageHeaderId,
            meta: {
              profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
            },
            eventCoding: {
              system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
              code: 'acknowledgement'
            },
            destination: messageHeader?.source ? [{
              endpoint: messageHeader.source.endpoint, receiver: messageHeader.sender
            }] : [],
            sender: messageHeader?.destination?.[0]?.receiver || { type: 'Organization', identifier: { system: providerSystem, value: NPHIES_CONFIG.DEFAULT_PROVIDER_ID } },
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || messageHeader?.destination?.[0]?.endpoint || 'http://nafes.local'
            },
            response: {
              identifier: messageHeader?.id || originalBundle?.id || 'unknown',
              code: 'fatal-error', details: { reference: `urn:uuid:${operationOutcomeId}` }
            }
          }
        },
        {
          fullUrl: `urn:uuid:${operationOutcomeId}`,
          resource: {
            resourceType: 'OperationOutcome',
            id: operationOutcomeId,
            meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/operation-outcome|1.0.0'] },
            issue: errors.map(error => ({
              severity: 'error',
              code: 'invalid',
              details: {
                text: error
              },
              diagnostics: error
            }))
          }
        }
      ]
    };
  }
  
  /**
   * Get all reconciliations with pagination
   */
  async getAll({ page = 1, limit = 10, search = '', status = '', startDate = '', endDate = '' }) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += ` AND (
        pr.fhir_id ILIKE $${paramIndex} 
        OR pr.identifier_value ILIKE $${paramIndex}
        OR pr.disposition ILIKE $${paramIndex}
        OR pr.payment_identifier_value ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status) {
      whereClause += ` AND pr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (startDate) {
      whereClause += ` AND pr.payment_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereClause += ` AND pr.payment_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM payment_reconciliations pr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated data
    const dataResult = await query(
      `SELECT 
        pr.*,
        i.insurer_name as insurer_name,
        p.provider_name as provider_name,
        (SELECT COUNT(*) FROM payment_reconciliation_details WHERE reconciliation_id = pr.id) as detail_count,
        (SELECT SUM(amount) FROM payment_reconciliation_details WHERE reconciliation_id = pr.id) as total_detail_amount
      FROM payment_reconciliations pr
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      LEFT JOIN providers p ON pr.requestor_id = p.provider_id
      ${whereClause}
      ORDER BY pr.payment_date DESC, pr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Get reconciliation by ID with full details
   */
  async getById(id) {
    // Get main reconciliation
    const reconciliationResult = await query(
      `SELECT 
        pr.*,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id,
        p.provider_name as provider_name,
        p.nphies_id as provider_nphies_id
      FROM payment_reconciliations pr
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      LEFT JOIN providers p ON pr.requestor_id = p.provider_id
      WHERE pr.id = $1`,
      [id]
    );
    
    if (reconciliationResult.rows.length === 0) {
      return null;
    }
    
    const reconciliation = reconciliationResult.rows[0];
    
    // Get details with components
    const detailsResult = await query(
      `SELECT 
        d.*,
        cs.claim_number as linked_claim_number,
        cs.status as linked_claim_status
      FROM payment_reconciliation_details d
      LEFT JOIN claim_submissions cs ON d.claim_submission_id = cs.id
      WHERE d.reconciliation_id = $1
      ORDER BY d.sequence`,
      [id]
    );
    
    // Get components for each detail
    for (const detail of detailsResult.rows) {
      const componentsResult = await query(
        `SELECT * FROM payment_reconciliation_components WHERE detail_id = $1`,
        [detail.id]
      );
      detail.components = componentsResult.rows;
    }
    
    reconciliation.details = detailsResult.rows;
    reconciliation.notice_attempts = (await query('SELECT id,payment_status,status,http_status,errors,receipt_date,receipt_reference,created_at,completed_at FROM payment_notice_attempts WHERE reconciliation_id=$1 ORDER BY id DESC', [id])).rows;
    
    return reconciliation;
  }
  
  /**
   * Get reconciliations for a specific claim
   */
  async getByClaimId(claimId) {
    // Handle both numeric IDs and string claim numbers
    const numericId = parseInt(claimId, 10);
    const isNumeric = !isNaN(numericId);
    
    const result = await query(
      `SELECT DISTINCT
        pr.*,
        i.insurer_name as insurer_name,
        p.provider_name as provider_name,
        d.amount as claim_payment_amount,
        d.detail_date
      FROM payment_reconciliations pr
      INNER JOIN payment_reconciliation_details d ON d.reconciliation_id = pr.id
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      LEFT JOIN providers p ON pr.requestor_id = p.provider_id
      WHERE ${isNumeric ? 'd.claim_submission_id = $1' : 'FALSE'} 
         OR d.claim_identifier_value = $2
      ORDER BY pr.payment_date DESC`,
      [isNumeric ? numericId : null, String(claimId)]
    );
    
    return result.rows;
  }
  
  /**
   * Get statistics for dashboard
   */
  async getStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_reconciliations,
        COUNT(DISTINCT payment_issuer_id) as unique_insurers,
        SUM(payment_amount) as total_payment_amount,
        AVG(payment_amount) as avg_payment_amount,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_count,
        COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as error_count,
        (SELECT COUNT(*) FROM payment_reconciliation_details) as total_details,
        (SELECT SUM(amount) FROM payment_reconciliation_components WHERE component_type = 'payment') as total_component_payment,
        (SELECT SUM(amount) FROM payment_reconciliation_components WHERE component_type = 'early_fee') as total_early_fees,
        (SELECT SUM(amount) FROM payment_reconciliation_components WHERE component_type = 'nphies_fee') as total_nphies_fees
      FROM payment_reconciliations
    `);
    
    // Get monthly trends
    const monthlyTrends = await query(`
      SELECT 
        DATE_TRUNC('month', payment_date) as month,
        COUNT(*) as count,
        SUM(payment_amount) as amount
      FROM payment_reconciliations
      WHERE payment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', payment_date)
      ORDER BY month DESC
    `);
    
    // Get by insurer
    const byInsurer = await query(`
      SELECT 
        COALESCE(i.insurer_name, 'Unknown') as insurer_name,
        COUNT(*) as count,
        SUM(pr.payment_amount) as amount
      FROM payment_reconciliations pr
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      GROUP BY COALESCE(i.insurer_name, 'Unknown')
      ORDER BY amount DESC
      LIMIT 10
    `);
    
    return {
      summary: result.rows[0],
      monthlyTrends: monthlyTrends.rows,
      byInsurer: byInsurer.rows
    };
  }
  
  // Payment reconciliations are received from insurers via system poll, not generated locally.
  // See: https://portal.nphies.sa/ig/usecase-payment-reconciliation.html
  
  /**
   * Preview the poll request bundle (without sending)
   * @param {string} providerId - Optional provider ID
   * @returns {Object} - The poll request bundle
   */
  async previewPollBundle(providerId) {
    // Get provider ID if not provided
    providerId ||= NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
    
    // Build the poll request bundle using NphiesService
    const pollBundle = NphiesService.buildPaymentReconciliationPollBundle(providerId);
    
    return {
      success: true,
      providerId,
      bundle: pollBundle
    };
  }
  
  /**
   * Poll NPHIES for pending PaymentReconciliation messages and process them
   * @param {string} providerId - The provider's nphies ID (optional)
   * @returns {Object} - Summary of processed reconciliations
   */
  async pollAndProcessPaymentReconciliations(providerId) {
    console.log('[PaymentReconciliation] Starting poll for pending payment reconciliations...');
    
    // 1. Get provider ID if not provided
    providerId ||= NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
    
    // 2. Poll NPHIES for pending messages
    const pollResult = await NphiesService.pollPaymentReconciliations(providerId);
    // Preserve the actual exchange in the existing System Poll history.
    const pollLog = await query(`INSERT INTO poll_logs
      (poll_id, schema_name, provider_nphies_id, trigger_type, status,
       poll_bundle, response_bundle, response_code, messages_received, errors, started_at, completed_at)
      VALUES ($1, 'public', $2, 'manual', $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
      [randomUUID(), providerId, !pollResult.success ? 'error' : pollResult.count ? 'success' : 'no_messages',
        JSON.stringify(pollResult.pollRequestBundle), JSON.stringify(pollResult.data || null),
        pollResult.responseCode || String(pollResult.status || ''), pollResult.count || 0,
        pollResult.success ? null : JSON.stringify([{ type: 'payment_poll', message: pollResult.error }]),
        pollResult.pollRequestBundle.timestamp]);
    
    if (!pollResult.success) {
      console.error('[PaymentReconciliation] Poll failed:', pollResult.error);
      return {
        success: false,
        error: pollResult.error,
        processed: 0,
        failed: 0,
        results: [],
        pollRequestBundle: pollResult.pollRequestBundle // Include even on error
      };
    }
    
    console.log(`[PaymentReconciliation] Poll returned ${pollResult.count} payment reconciliation(s)`);
    
    if (pollResult.count === 0) {
      return {
        success: true,
        message: 'No pending payment reconciliations found',
        processed: 0,
        failed: 0,
        results: [],
        pollRequestBundle: pollResult.pollRequestBundle
      };
    }
    
    // 3. Process each PaymentReconciliation bundle
    const results = [];
    let processed = 0;
    let failed = 0;
    
    for (const bundle of pollResult.paymentReconciliations) {
      try {
        const processResult = await this.processBundle(bundle);
        
        if (processResult.success) {
          processed++;
          results.push({
            success: true,
            reconciliationId: processResult.reconciliationId,
            bundleId: bundle.id
          });
        } else {
          failed++;
          results.push({
            success: false,
            bundleId: bundle.id,
            errors: processResult.errors,
            duplicate: processResult.duplicate
          });
        }
      } catch (error) {
        failed++;
        results.push({
          success: false,
          bundleId: bundle.id,
          errors: [error.message]
        });
        console.error('[PaymentReconciliation] Error processing bundle:', error);
      }
    }
    
    console.log(`[PaymentReconciliation] Poll complete. Processed: ${processed}, Failed: ${failed}`);
    await query(`UPDATE poll_logs SET status=$1, messages_processed=$2, errors=$3, completed_at=NOW() WHERE id=$4`,
      [failed ? 'error' : 'success', processed,
        failed ? JSON.stringify(results.filter(r => !r.success)) : null, pollLog.rows[0].id]);
    
    return {
      success: failed === 0,
      message: `Processed ${processed} payment reconciliation(s), ${failed} failed`,
      processed,
      failed,
      total: pollResult.count,
      results,
      pollRequestBundle: pollResult.pollRequestBundle
    };
  }
  
  /**
   * Send Payment Notice acknowledgement to NPHIES for a PaymentReconciliation
   * @param {number|string} reconciliationId - The payment reconciliation ID
   * @param {string} [paymentStatus] - 'paid' or 'cleared', explicitly selected for sending.
   * @returns {Object} - Result with acknowledgement status
   */
  async preparePaymentNotice(reconciliationId, paymentStatus = 'paid', receipt = {}) {
    if (!['paid', 'cleared'].includes(paymentStatus)) throw paymentError('paymentStatus must be paid or cleared', 400);
    const reconciliation = await this.getById(reconciliationId);
    if (!reconciliation) throw paymentError('Payment reconciliation not found', 404);
    const { provider: identity } = originalPayment(reconciliation);
    const providers = await query('SELECT * FROM providers WHERE nphies_id=$1', [identity.value]);
    if (providers.rows.length !== 1) throw paymentError('The original destination must match exactly one configured provider');
    const bundle = NphiesService.buildPaymentNoticeBundle(reconciliation, identity.value, providers.rows[0], paymentStatus, receipt);
    return { reconciliation, bundle, paymentStatus };
  }

  async sendPaymentNotice(reconciliationId, paymentStatus, receipt = {}) {
    if (!paymentStatus) throw paymentError('Select paid or cleared explicitly', 400);
    const sandboxReceipt = process.env.NPHIES_ENVIRONMENT === 'sandbox' && receipt.syntheticTest === true;
    if (receipt.bankReceiptConfirmed !== true && !sandboxReceipt) throw paymentError('Confirm actual bank receipt before sending a PaymentNotice', 400);
    if (!validDate(receipt.receivedDate) || receipt.receivedDate > new Date().toISOString().slice(0, 10) ||
        typeof receipt.receiptReference !== 'string' || !receipt.receiptReference.trim()) throw paymentError('A valid non-future receipt date and receipt reference are required', 400);
    const { bundle } = await this.preparePaymentNotice(reconciliationId, paymentStatus, receipt);
    const attempt = await transaction(async client => {
      const locked = (await client.query('SELECT * FROM payment_reconciliations WHERE id=$1 FOR UPDATE', [reconciliationId])).rows[0];
      const historicalStatus = locked.payment_status_sent || locked.acknowledgement_bundle?.entry?.find(e => e.resource?.resourceType === 'PaymentNotice')?.resource.paymentStatus?.coding?.[0]?.code;
      if (historicalStatus === 'cleared' || (locked.acknowledgement_status === 'sent' && (!historicalStatus || historicalStatus === paymentStatus))) throw paymentError('This payment state has already been sent successfully', 409);
      const pending = await client.query(`SELECT id FROM payment_notice_attempts WHERE reconciliation_id=$1 AND status IN ('sending','unknown')`, [reconciliationId]);
      if (pending.rows.length) throw paymentError('An earlier send is pending or uncertain; reconcile its response before sending again', 409);
      return (await client.query(`INSERT INTO payment_notice_attempts (reconciliation_id,payment_status,status,request_bundle,receipt_date,receipt_reference)
        VALUES ($1,$2,'sending',$3,$4,$5) RETURNING id`, [reconciliationId,paymentStatus,JSON.stringify(bundle),receipt.receivedDate,receipt.receiptReference.trim()])).rows[0];
    });
    const result = await NphiesService.sendPaymentNotice(bundle);
    const delivery = result.deliveryState || (result.success ? 'accepted' : 'unknown');
    await transaction(async client => {
      await client.query(`UPDATE payment_notice_attempts SET status=$1,response_bundle=$2,http_status=$3,errors=$4,completed_at=NOW() WHERE id=$5`,
        [delivery,JSON.stringify(result.data || null),result.status || null,JSON.stringify(result.nphiesErrors || result.error || []),attempt.id]);
      await client.query(`UPDATE payment_reconciliations SET acknowledgement_status=$1,acknowledgement_date=NOW(),acknowledgement_bundle=$2,
        acknowledgement_response=$3,payment_status_sent=CASE WHEN $4 THEN $5 ELSE payment_status_sent END WHERE id=$6`,
        [result.success?'sent':delivery==='unknown'?'unknown':'failed',JSON.stringify(bundle),JSON.stringify(result.data || null),result.success,paymentStatus,reconciliationId]);
    });
    return { success: result.success, reconciliationId, attemptId: attempt.id, deliveryState: delivery,
      paymentNoticeBundle: bundle, paymentStatusSent: paymentStatus, nphiesResponse: result.data,
      nphiesErrors: result.nphiesErrors || [], nphiesResponseCode: result.nphiesResponseCode, error: result.error,
      message: result.success ? 'Payment notice accepted by NPHIES' : 'Payment notice '+delivery };
  }

  async previewPaymentNotice(reconciliationId, paymentStatus = 'paid', receipt = {}) {
    const { reconciliation, bundle } = await this.preparePaymentNotice(reconciliationId, paymentStatus, receipt);
    return { success: true, reconciliationId, bundle, paymentStatusSent: paymentStatus, alreadySent: reconciliation.acknowledgement_status === 'sent' };
  }
}
export default new PaymentReconciliationService();
