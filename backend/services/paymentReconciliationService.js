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
import { randomUUID } from 'crypto';

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
    
    // Step 3: Check for duplicates
    const isDuplicate = await this.checkDuplicate(paymentReconciliation);
    if (isDuplicate) {
      console.log('[PaymentReconciliation] Duplicate detected:', paymentReconciliation.id);
      return {
        success: false,
        duplicate: true,
        errors: ['Duplicate PaymentReconciliation'],
        acknowledgement: this.buildErrorAcknowledgement(bundle, ['Duplicate PaymentReconciliation already processed'], '409')
      };
    }
    
    // Step 4: Parse and store the reconciliation
    try {
      const result = await this.storeReconciliation(bundle, paymentReconciliation);
      console.log('[PaymentReconciliation] Successfully stored reconciliation:', result.reconciliationId);
      
      return {
        success: true,
        reconciliationId: result.reconciliationId,
        acknowledgement: this.buildSuccessAcknowledgement(bundle, result.reconciliationId)
      };
    } catch (error) {
      console.error('[PaymentReconciliation] Storage error:', error);
      return {
        success: false,
        errors: [error.message],
        acknowledgement: this.buildErrorAcknowledgement(bundle, [error.message])
      };
    }
  }
  
  /**
   * Validate FHIR Bundle structure
   */
  validateBundle(bundle) {
    const errors = [];
    
    if (!bundle) {
      errors.push('Bundle is empty');
      return { valid: false, errors };
    }
    
    if (bundle.resourceType !== 'Bundle') {
      errors.push('Resource is not a FHIR Bundle');
      return { valid: false, errors };
    }
    
    // Accept both 'message' and 'collection' bundle types
    if (!['message', 'collection'].includes(bundle.type)) {
      errors.push(`Bundle type must be 'message' or 'collection', got '${bundle.type}'`);
    }
    
    if (!bundle.entry || !Array.isArray(bundle.entry) || bundle.entry.length === 0) {
      errors.push('Bundle has no entries');
      return { valid: false, errors };
    }
    
    // Find PaymentReconciliation resource
    const paymentReconciliation = bundle.entry.find(
      e => e.resource?.resourceType === 'PaymentReconciliation'
    )?.resource;
    
    if (!paymentReconciliation) {
      errors.push('Bundle must contain a PaymentReconciliation resource');
      return { valid: false, errors };
    }
    
    // Validate mandatory PaymentReconciliation fields
    const mandatoryErrors = this.validateMandatoryFields(paymentReconciliation);
    errors.push(...mandatoryErrors);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate mandatory fields per nphies IG
   */
  validateMandatoryFields(pr) {
    const errors = [];
    
    // PaymentReconciliation.id
    if (!pr.id) {
      errors.push('PaymentReconciliation.id is required');
    }
    
    // PaymentReconciliation.status
    if (!pr.status) {
      errors.push('PaymentReconciliation.status is required');
    } else if (!['active', 'cancelled', 'draft', 'entered-in-error'].includes(pr.status)) {
      errors.push(`Invalid PaymentReconciliation.status: ${pr.status}`);
    }
    
    // PaymentReconciliation.created
    if (!pr.created) {
      errors.push('PaymentReconciliation.created is required');
    }
    
    // PaymentReconciliation.paymentDate
    if (!pr.paymentDate) {
      errors.push('PaymentReconciliation.paymentDate is required');
    }
    
    // PaymentReconciliation.paymentAmount
    if (!pr.paymentAmount) {
      errors.push('PaymentReconciliation.paymentAmount is required');
    } else if (pr.paymentAmount.value === undefined || pr.paymentAmount.value === null) {
      errors.push('PaymentReconciliation.paymentAmount.value is required');
    }
    
    // PaymentReconciliation.detail (must have at least one)
    if (!pr.detail || !Array.isArray(pr.detail) || pr.detail.length === 0) {
      errors.push('PaymentReconciliation.detail is required and must have at least one entry');
    } else {
      // Validate each detail
      pr.detail.forEach((detail, index) => {
        // detail.request (Claim reference)
        if (!detail.request) {
          errors.push(`PaymentReconciliation.detail[${index}].request is required`);
        }
        
        // detail.response (ClaimResponse reference)
        if (!detail.response) {
          errors.push(`PaymentReconciliation.detail[${index}].response is required`);
        }
        
        // detail.amount
        if (!detail.amount || detail.amount.value === undefined) {
          errors.push(`PaymentReconciliation.detail[${index}].amount is required`);
        }
      });
    }
    
    return errors;
  }
  
  /**
   * Extract PaymentReconciliation resource from bundle
   */
  extractPaymentReconciliation(bundle) {
    return bundle.entry?.find(
      e => e.resource?.resourceType === 'PaymentReconciliation'
    )?.resource;
  }
  
  /**
   * Extract MessageHeader from bundle
   */
  extractMessageHeader(bundle) {
    return bundle.entry?.find(
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
            extensions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
            detail.extension ? JSON.stringify(detail.extension) : null
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
      await this.linkToExistingRecords(client, reconciliationId, pr);
      
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
  async linkToExistingRecords(client, reconciliationId, pr) {
    // Try to match insurer by reference
    if (pr.paymentIssuer?.reference) {
      const insurerMatch = await client.query(
        `SELECT insurer_id FROM insurers 
         WHERE nphies_id = $1 OR name ILIKE $2
         LIMIT 1`,
        [
          this.extractIdFromReference(pr.paymentIssuer.reference),
          `%${this.extractIdFromReference(pr.paymentIssuer.reference)}%`
        ]
      );
      
      if (insurerMatch.rows.length > 0) {
        await client.query(
          `UPDATE payment_reconciliations SET payment_issuer_id = $1 WHERE id = $2`,
          [insurerMatch.rows[0].insurer_id, reconciliationId]
        );
      }
    }
    
    // Try to match provider by reference
    if (pr.requestor?.reference) {
      const providerMatch = await client.query(
        `SELECT provider_id FROM providers 
         WHERE nphies_id = $1 OR name ILIKE $2
         LIMIT 1`,
        [
          this.extractIdFromReference(pr.requestor.reference),
          `%${this.extractIdFromReference(pr.requestor.reference)}%`
        ]
      );
      
      if (providerMatch.rows.length > 0) {
        await client.query(
          `UPDATE payment_reconciliations SET requestor_id = $1 WHERE id = $2`,
          [providerMatch.rows[0].provider_id, reconciliationId]
        );
      }
    }
    
    // Try to link details to claim_submissions
    const details = await client.query(
      `SELECT id, claim_identifier_value FROM payment_reconciliation_details 
       WHERE reconciliation_id = $1 AND claim_identifier_value IS NOT NULL`,
      [reconciliationId]
    );
    
    for (const detail of details.rows) {
      const claimMatch = await client.query(
        `SELECT id FROM claim_submissions 
         WHERE claim_number = $1 OR nphies_claim_id = $1
         LIMIT 1`,
        [detail.claim_identifier_value]
      );
      
      if (claimMatch.rows.length > 0) {
        await client.query(
          `UPDATE payment_reconciliation_details SET claim_submission_id = $1 WHERE id = $2`,
          [claimMatch.rows[0].id, detail.id]
        );
      }
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
              endpoint: messageHeader.source.endpoint
            }] : [],
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://nafes.local'
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
              endpoint: messageHeader.source.endpoint
            }] : [],
            source: {
              endpoint: process.env.NPHIES_PROVIDER_ENDPOINT || 'http://nafes.local'
            },
            response: {
              identifier: messageHeader?.id || originalBundle?.id || 'unknown',
              code: httpStatus === '409' ? 'fatal-error' : 'fatal-error'
            }
          }
        },
        {
          fullUrl: `urn:uuid:${operationOutcomeId}`,
          resource: {
            resourceType: 'OperationOutcome',
            id: operationOutcomeId,
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
        i.name as insurer_name,
        p.name as provider_name,
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
        i.name as insurer_name,
        i.nphies_id as insurer_nphies_id,
        p.name as provider_name,
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
    
    return reconciliation;
  }
  
  /**
   * Get reconciliations for a specific claim
   */
  async getByClaimId(claimId) {
    const result = await query(
      `SELECT DISTINCT
        pr.*,
        i.name as insurer_name,
        p.name as provider_name,
        d.amount as claim_payment_amount,
        d.detail_date
      FROM payment_reconciliations pr
      INNER JOIN payment_reconciliation_details d ON d.reconciliation_id = pr.id
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      LEFT JOIN providers p ON pr.requestor_id = p.provider_id
      WHERE d.claim_submission_id = $1 
         OR d.claim_identifier_value = $2
      ORDER BY pr.payment_date DESC`,
      [claimId, claimId]
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
        COALESCE(i.name, 'Unknown') as insurer_name,
        COUNT(*) as count,
        SUM(pr.payment_amount) as amount
      FROM payment_reconciliations pr
      LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
      GROUP BY COALESCE(i.name, 'Unknown')
      ORDER BY amount DESC
      LIMIT 10
    `);
    
    return {
      summary: result.rows[0],
      monthlyTrends: monthlyTrends.rows,
      byInsurer: byInsurer.rows
    };
  }
}

export default new PaymentReconciliationService();

