/**
 * Payment Reconciliation Controller
 * 
 * Handles API endpoints for nphies Payment Reconciliation module
 * - Receive FHIR bundles from insurers
 * - List and view reconciliations
 * - Dashboard statistics
 */

import paymentReconciliationService from '../services/paymentReconciliationService.js';

class PaymentReconciliationController {
  
  /**
   * POST /api/payment-reconciliation
   * Receive and process a FHIR Bundle containing PaymentReconciliation
   */
  async receiveBundle(req, res) {
    try {
      console.log('[PaymentReconciliation] Received incoming bundle');
      
      // Validate content type
      const contentType = req.headers['content-type'];
      if (!contentType?.includes('application/fhir+json') && !contentType?.includes('application/json')) {
        return res.status(415).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            details: { text: 'Content-Type must be application/fhir+json or application/json' }
          }]
        });
      }
      
      const bundle = req.body;
      
      if (!bundle || Object.keys(bundle).length === 0) {
        return res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            details: { text: 'Request body is empty' }
          }]
        });
      }
      
      // Process the bundle
      const result = await paymentReconciliationService.processBundle(bundle);
      
      if (result.success) {
        // Return 200 OK with acknowledgement bundle
        res.set('Content-Type', 'application/fhir+json');
        return res.status(200).json(result.acknowledgement);
      } else if (result.duplicate) {
        // Return 409 Conflict for duplicates
        res.set('Content-Type', 'application/fhir+json');
        return res.status(409).json(result.acknowledgement);
      } else {
        // Return 400 Bad Request with error acknowledgement
        res.set('Content-Type', 'application/fhir+json');
        return res.status(400).json(result.acknowledgement);
      }
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error processing bundle:', error);
      
      res.set('Content-Type', 'application/fhir+json');
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'fatal',
          code: 'exception',
          details: { text: 'Internal server error processing PaymentReconciliation' },
          diagnostics: error.message
        }]
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation
   * List all reconciliations with pagination and filtering
   */
  async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        startDate = '',
        endDate = ''
      } = req.query;
      
      const result = await paymentReconciliationService.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        startDate,
        endDate
      });
      
      return res.json(result);
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching reconciliations:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch payment reconciliations',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/stats
   * Get dashboard statistics
   */
  async getStats(req, res) {
    try {
      const stats = await paymentReconciliationService.getStats();
      return res.json({ data: stats });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching stats:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch statistics',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/:id
   * Get a single reconciliation with full details
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid reconciliation ID' });
      }
      
      const reconciliation = await paymentReconciliationService.getById(parseInt(id));
      
      if (!reconciliation) {
        return res.status(404).json({ error: 'Payment reconciliation not found' });
      }
      
      return res.json({ data: reconciliation });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching reconciliation:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch payment reconciliation',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/claim/:claimId
   * Get reconciliations for a specific claim
   */
  async getByClaimId(req, res) {
    try {
      const { claimId } = req.params;
      
      if (!claimId) {
        return res.status(400).json({ error: 'Claim ID is required' });
      }
      
      const reconciliations = await paymentReconciliationService.getByClaimId(claimId);
      
      return res.json({ data: reconciliations });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching reconciliations for claim:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch reconciliations for claim',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/:id/bundle
   * Get the original FHIR bundle for a reconciliation
   */
  async getOriginalBundle(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid reconciliation ID' });
      }
      
      const reconciliation = await paymentReconciliationService.getById(parseInt(id));
      
      if (!reconciliation) {
        return res.status(404).json({ error: 'Payment reconciliation not found' });
      }
      
      if (!reconciliation.request_bundle) {
        return res.status(404).json({ error: 'Original bundle not available' });
      }
      
      res.set('Content-Type', 'application/fhir+json');
      return res.json(reconciliation.request_bundle);
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching original bundle:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch original bundle',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/:id/acknowledgement
   * Get the acknowledgement bundle that was sent back
   */
  async getAcknowledgementBundle(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid reconciliation ID' });
      }
      
      const reconciliation = await paymentReconciliationService.getById(parseInt(id));
      
      if (!reconciliation) {
        return res.status(404).json({ error: 'Payment reconciliation not found' });
      }
      
      if (!reconciliation.response_bundle) {
        return res.status(404).json({ error: 'Acknowledgement bundle not available' });
      }
      
      res.set('Content-Type', 'application/fhir+json');
      return res.json(reconciliation.response_bundle);
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error fetching acknowledgement bundle:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch acknowledgement bundle',
        details: error.message
      });
    }
  }
  
  /**
   * POST /api/payment-reconciliation/simulate/:claimId
   * Generate a simulated PaymentReconciliation from an approved claim
   * Used for testing/development purposes
   */
  async simulatePayment(req, res) {
    try {
      const { claimId } = req.params;
      
      if (!claimId) {
        return res.status(400).json({ error: 'Claim ID is required' });
      }
      
      console.log(`[PaymentReconciliation] Simulating payment for claim: ${claimId}`);
      
      const result = await paymentReconciliationService.generateSimulatedPaymentReconciliation(claimId);
      
      return res.status(201).json({
        success: true,
        data: result,
        message: result.message
      });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error simulating payment:', error);
      
      // Determine appropriate status code based on error
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('not approved') || error.message.includes('already exists')) {
        statusCode = 400;
      }
      
      return res.status(statusCode).json({ 
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * POST /api/payment-reconciliation/poll
   * Poll NPHIES for pending PaymentReconciliation messages
   */
  async pollNphies(req, res) {
    try {
      const { providerId } = req.body;
      
      console.log('[PaymentReconciliation] Initiating poll to NPHIES...');
      
      const result = await paymentReconciliationService.pollAndProcessPaymentReconciliations(providerId);
      
      return res.json({
        success: result.success,
        data: {
          processed: result.processed,
          failed: result.failed,
          total: result.total,
          results: result.results,
          pollRequestBundle: result.pollRequestBundle // Include the poll request bundle
        },
        message: result.message || result.error
      });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error polling NPHIES:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to poll NPHIES for payment reconciliations',
        details: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/preview-simulate/:claimId
   * Preview the PaymentReconciliation bundle that would be generated (without saving)
   */
  async previewSimulate(req, res) {
    try {
      const { claimId } = req.params;
      
      if (!claimId) {
        return res.status(400).json({ error: 'Claim ID is required' });
      }
      
      console.log(`[PaymentReconciliation] Previewing simulate bundle for claim: ${claimId}`);
      
      const result = await paymentReconciliationService.previewSimulatedPaymentReconciliation(claimId);
      
      return res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error previewing simulate:', error);
      
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('not approved')) {
        statusCode = 400;
      }
      
      return res.status(statusCode).json({ 
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/preview-poll
   * Preview the poll request bundle (without sending)
   */
  async previewPoll(req, res) {
    try {
      const { providerId } = req.query;
      
      console.log('[PaymentReconciliation] Previewing poll bundle...');
      
      const result = await paymentReconciliationService.previewPollBundle(providerId);
      
      return res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error previewing poll:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to preview poll bundle',
        details: error.message
      });
    }
  }
  
  /**
   * POST /api/payment-reconciliation/:id/acknowledge
   * Send Payment Notice acknowledgement to NPHIES
   */
  async sendAcknowledgement(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid reconciliation ID' 
        });
      }
      
      console.log(`[PaymentReconciliation] Sending Payment Notice for reconciliation: ${id}`);
      
      const result = await paymentReconciliationService.sendPaymentNotice(parseInt(id));
      
      if (result.success) {
        return res.json({
          success: true,
          data: {
            reconciliationId: result.reconciliationId,
            paymentNoticeBundle: result.paymentNoticeBundle,
            nphiesResponse: result.nphiesResponse
          },
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error || result.message
        });
      }
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error sending acknowledgement:', error);
      
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('already been sent')) {
        statusCode = 409;
      }
      
      return res.status(statusCode).json({ 
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * GET /api/payment-reconciliation/:id/preview-acknowledge
   * Preview the Payment Notice bundle (without sending)
   */
  async previewAcknowledgement(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid reconciliation ID' 
        });
      }
      
      console.log(`[PaymentReconciliation] Previewing Payment Notice for reconciliation: ${id}`);
      
      const result = await paymentReconciliationService.previewPaymentNotice(parseInt(id));
      
      return res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('[PaymentReconciliation] Error previewing acknowledgement:', error);
      
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      }
      
      return res.status(statusCode).json({ 
        success: false,
        error: error.message
      });
    }
  }
}

export default new PaymentReconciliationController();

