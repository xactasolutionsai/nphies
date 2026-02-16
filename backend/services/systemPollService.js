/**
 * System Poll Service
 * 
 * Central orchestrator for system-level NPHIES polling.
 * Sends a generic (no focus) poll request to NPHIES, retrieves ALL
 * queued messages for the organization endpoint, then routes each
 * message through the correlator and updater.
 * 
 * This replaces the per-request polling that was scattered across
 * individual controllers and detail pages.
 */

import { randomUUID } from 'crypto';
import pool from '../db.js';
import nphiesService from './nphiesService.js';
import CommunicationMapper from './communicationMapper.js';
import messageCorrelator from './messageCorrelator.js';
import messageUpdater from './messageUpdater.js';
import advancedAuthParser from './advancedAuthParser.js';
import { NPHIES_CONFIG } from '../config/nphies.js';

const mapper = new CommunicationMapper();

class SystemPollService {

  /**
   * Execute a system-wide poll
   * 
   * @param {string} schemaName - Database schema name (default: 'public')
   * @param {string} triggerType - 'manual' or 'scheduled'
   * @returns {Object} Poll execution result with full details
   */
  async executePoll(schemaName = 'public', triggerType = 'manual') {
    const pollId = randomUUID();
    const startedAt = new Date();
    let pollLogId = null;

    console.log(`[SystemPoll] ===== Starting system-wide poll =====`);
    console.log(`[SystemPoll] Poll ID: ${pollId}`);
    console.log(`[SystemPoll] Schema: ${schemaName}`);
    console.log(`[SystemPoll] Trigger: ${triggerType}`);

    try {
      // 1. Resolve provider info
      const provider = await this.resolveProvider(schemaName);
      console.log(`[SystemPoll] Provider: ${provider.nphiesId} (${provider.name})`);

      // 2. Build generic poll bundle (no focus - endpoint-wide)
      const pollBundle = mapper.buildPollRequestBundle(
        provider.nphiesId,
        provider.name
      );

      // 3. Create poll_logs record
      pollLogId = await this.createPollLog({
        pollId,
        schemaName,
        providerNphiesId: provider.nphiesId,
        triggerType,
        pollBundle,
        startedAt
      });

      // 4. Send poll to NPHIES
      console.log(`[SystemPoll] Sending poll request to NPHIES...`);
      const pollResponse = await nphiesService.sendPoll(pollBundle);

      if (!pollResponse.success) {
        const errorDetails = this.extractErrorDetails(pollResponse);
        await this.updatePollLog(pollLogId, {
          status: 'error',
          responseBundle: pollResponse.data || null,
          responseCode: pollResponse.responseCode || null,
          errors: [{ type: 'nphies_error', details: errorDetails }],
          completedAt: new Date()
        });

        return {
          success: false,
          pollId,
          pollLogId,
          message: `NPHIES Error: ${errorDetails}`,
          pollBundle,
          responseBundle: pollResponse.data || null,
          responseCode: pollResponse.responseCode,
          errors: pollResponse.errors || []
        };
      }

      // 5. Process the response bundle
      const processingResult = await this.processResponseBundle(
        pollResponse.data,
        pollBundle,
        pollLogId,
        schemaName
      );

      // 6. Update poll_logs with final stats
      const completedAt = new Date();
      const status = processingResult.messagesReceived === 0 ? 'no_messages' : 'success';

      await this.updatePollLog(pollLogId, {
        status,
        responseBundle: pollResponse.data,
        responseCode: pollResponse.responseCode,
        messagesReceived: processingResult.messagesReceived,
        messagesProcessed: processingResult.messagesProcessed,
        messagesMatched: processingResult.messagesMatched,
        messagesUnmatched: processingResult.messagesUnmatched,
        processingSummary: processingResult.summary,
        errors: processingResult.errors.length > 0 ? processingResult.errors : null,
        completedAt
      });

      console.log(`[SystemPoll] ===== Poll completed =====`);
      console.log(`[SystemPoll] Messages: ${processingResult.messagesReceived} received, ${processingResult.messagesMatched} matched, ${processingResult.messagesUnmatched} unmatched`);

      return {
        success: true,
        pollId,
        pollLogId,
        message: processingResult.messagesReceived > 0
          ? `Processed ${processingResult.messagesReceived} message(s): ${processingResult.messagesMatched} matched, ${processingResult.messagesUnmatched} unmatched`
          : 'No new messages found',
        stats: {
          received: processingResult.messagesReceived,
          processed: processingResult.messagesProcessed,
          matched: processingResult.messagesMatched,
          unmatched: processingResult.messagesUnmatched
        },
        summary: processingResult.summary,
        messages: processingResult.messageDetails,
        pollBundle,
        responseBundle: pollResponse.data,
        responseCode: pollResponse.responseCode,
        errors: processingResult.errors,
        duration: completedAt - startedAt
      };

    } catch (error) {
      console.error('[SystemPoll] Fatal error during poll:', error);

      if (pollLogId) {
        await this.updatePollLog(pollLogId, {
          status: 'error',
          errors: [{ type: 'fatal', message: error.message, stack: error.stack }],
          completedAt: new Date()
        }).catch(e => console.error('[SystemPoll] Failed to update poll log on error:', e));
      }

      return {
        success: false,
        pollId,
        pollLogId,
        message: `Poll failed: ${error.message}`,
        error: error.message,
        errors: [{ type: 'fatal', message: error.message }]
      };
    }
  }

  /**
   * Process the response bundle from NPHIES
   * Extracts individual messages, classifies them, correlates, and updates DB
   */
  async processResponseBundle(responseData, pollBundle, pollLogId, schemaName) {
    const result = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesMatched: 0,
      messagesUnmatched: 0,
      summary: {},
      errors: [],
      messageDetails: []
    };

    if (!responseData || responseData.resourceType !== 'Bundle') {
      return result;
    }

    // Extract message bundles from the response
    const messageBundles = this.extractMessageBundles(responseData);
    result.messagesReceived = messageBundles.length;

    console.log(`[SystemPoll] Found ${messageBundles.length} message bundle(s) in response`);

    for (const messageBundle of messageBundles) {
      try {
        const messageResult = await this.processMessage(messageBundle, pollBundle, pollLogId, schemaName);
        result.messagesProcessed++;

        if (messageResult.matched) {
          result.messagesMatched++;
        } else {
          result.messagesUnmatched++;
        }

        // Track by resource type
        const rt = messageResult.resourceType || 'unknown';
        if (!result.summary[rt]) {
          result.summary[rt] = { matched: 0, unmatched: 0, newRecords: 0 };
        }
        if (messageResult.isNew) {
          result.summary[rt].newRecords++;
        } else if (messageResult.matched) {
          result.summary[rt].matched++;
        } else {
          result.summary[rt].unmatched++;
        }

        result.messageDetails.push(messageResult);

      } catch (error) {
        console.error(`[SystemPoll] Error processing message:`, error);
        result.errors.push({
          type: 'message_processing',
          message: error.message,
          messageBundle: messageBundle?.id
        });

        // Log the failed message
        await this.logPollMessage(pollLogId, {
          messageHeaderId: null,
          responseIdentifier: null,
          eventCode: null,
          resourceType: 'unknown',
          resourceData: messageBundle,
          messageType: 'unknown',
          matched: false,
          processingStatus: 'error',
          processingError: error.message
        }).catch(e => console.error('[SystemPoll] Failed to log message:', e));
      }
    }

    // Also check for direct resources (not wrapped in message bundles)
    await this.processDirectResources(responseData, pollBundle, pollLogId, schemaName, result);

    return result;
  }

  /**
   * Process a single message bundle
   */
  async processMessage(messageBundle, pollBundle, pollLogId, schemaName) {
    // Extract MessageHeader and payload resource
    const messageHeader = messageCorrelator.extractMessageHeader(messageBundle);
    const payloadResource = messageCorrelator.extractPayloadResource(messageBundle);
    const eventCode = messageHeader?.eventCoding?.code || messageHeader?.event?.coding?.[0]?.code || null;
    const resourceType = payloadResource?.resourceType || 'unknown';

    console.log(`[SystemPoll] Processing message: event=${eventCode}, resource=${resourceType}`);

    // Classify as solicited or unsolicited
    const messageType = messageCorrelator.classifyMessage(messageHeader);
    const responseIdentifier = messageHeader?.response?.identifier || null;

    let correlationResult;
    let updateResult;
    let matched = false;
    let isNew = false;
    let matchStrategy = null;
    let matchedTable = null;
    let matchedRecordId = null;

    if (messageType === 'solicited' && responseIdentifier) {
      // SOLICITED: Correlate to original outbound request
      correlationResult = await messageCorrelator.correlateToOutboundRequest(
        responseIdentifier, payloadResource, schemaName
      );

      if (correlationResult) {
        matched = true;
        matchStrategy = correlationResult.strategy;
        matchedTable = correlationResult.table;
        matchedRecordId = correlationResult.recordId;

        // Update the matched record
        updateResult = await this.updateMatchedRecord(
          correlationResult, payloadResource, pollBundle, messageBundle, schemaName
        );
      }
    } else {
      // UNSOLICITED: Handle as new inbound event
      correlationResult = await messageCorrelator.handleNewInboundEvent(
        messageBundle, payloadResource, schemaName
      );

      if (correlationResult && !correlationResult.unmatched) {
        // Process the unsolicited message
        updateResult = await this.processUnsolicitedMessage(
          correlationResult, payloadResource, pollBundle, messageBundle, schemaName
        );

        if (updateResult) {
          matched = true;
          isNew = correlationResult.isNew || updateResult.isNew || false;
          matchStrategy = correlationResult.strategy;
          matchedTable = updateResult.table || correlationResult.table;
          matchedRecordId = updateResult.recordId || correlationResult.recordId;
        }
      }
    }

    // Log to poll_messages table
    await this.logPollMessage(pollLogId, {
      messageHeaderId: messageHeader?.id || null,
      responseIdentifier,
      eventCode,
      resourceType,
      resourceData: messageBundle,
      messageType,
      matched,
      matchedTable,
      matchedRecordId,
      matchStrategy,
      processingStatus: matched ? (isNew ? 'new_record' : 'processed') : 'unmatched',
      processingError: correlationResult?.reason || null
    });

    return {
      messageHeaderId: messageHeader?.id,
      responseIdentifier,
      eventCode,
      resourceType,
      messageType,
      matched,
      isNew,
      matchStrategy,
      matchedTable,
      matchedRecordId,
      updateResult
    };
  }

  /**
   * Update a matched record based on correlation result
   */
  async updateMatchedRecord(correlationResult, resource, pollBundle, responseBundle, schemaName) {
    if (!resource) return null;

    switch (resource.resourceType) {
      case 'ClaimResponse':
        if (correlationResult.table === 'prior_authorizations') {
          return await messageUpdater.updatePriorAuthorization(
            correlationResult.recordId, resource, responseBundle, schemaName
          );
        } else if (correlationResult.table === 'claim_submissions') {
          return await messageUpdater.updateClaimSubmission(
            correlationResult.recordId, resource, responseBundle, schemaName
          );
        }
        break;

      case 'CommunicationRequest':
        return await messageUpdater.storeCommunicationRequest(
          resource, correlationResult, schemaName
        );

      case 'Communication':
        return await messageUpdater.storeCommunication(
          resource, correlationResult, schemaName
        );
    }

    return null;
  }

  /**
   * Process an unsolicited message
   */
  async processUnsolicitedMessage(correlationResult, resource, pollBundle, responseBundle, schemaName) {
    if (!resource) return null;

    switch (resource.resourceType) {
      case 'ClaimResponse':
        if (correlationResult.table === 'advanced_authorizations') {
          return await messageUpdater.saveAdvancedAuthorization(
            resource, pollBundle, responseBundle, schemaName
          );
        }
        // If correlator found a matching prior auth or claim via identifier
        if (correlationResult.table === 'prior_authorizations') {
          return await messageUpdater.updatePriorAuthorization(
            correlationResult.recordId, resource, responseBundle, schemaName
          );
        }
        if (correlationResult.table === 'claim_submissions') {
          return await messageUpdater.updateClaimSubmission(
            correlationResult.recordId, resource, responseBundle, schemaName
          );
        }
        break;

      case 'CommunicationRequest':
        return await messageUpdater.storeCommunicationRequest(
          resource, correlationResult, schemaName
        );

      case 'Communication':
        return await messageUpdater.storeCommunication(
          resource, correlationResult, schemaName
        );
    }

    return null;
  }

  /**
   * Some NPHIES responses contain resources directly at the top level
   * (not wrapped in nested message bundles). Handle those too.
   */
  async processDirectResources(responseData, pollBundle, pollLogId, schemaName, result) {
    for (const entry of responseData.entry || []) {
      const resource = entry.resource;
      if (!resource) continue;

      // Skip MessageHeader (already handled) and nested Bundles (already processed)
      if (resource.resourceType === 'MessageHeader') continue;
      if (resource.resourceType === 'Bundle') continue;

      // Check for direct ClaimResponse, CommunicationRequest, Communication
      if (['ClaimResponse', 'CommunicationRequest', 'Communication'].includes(resource.resourceType)) {
        try {
          // Wrap in a fake message bundle for consistent processing
          const fakeBundle = {
            resourceType: 'Bundle',
            type: 'message',
            entry: [{ resource }]
          };

          const messageResult = await this.processMessage(fakeBundle, pollBundle, pollLogId, schemaName);
          result.messagesProcessed++;
          result.messagesReceived++;

          if (messageResult.matched) {
            result.messagesMatched++;
          } else {
            result.messagesUnmatched++;
          }

          result.messageDetails.push(messageResult);
        } catch (error) {
          console.error(`[SystemPoll] Error processing direct resource:`, error);
          result.errors.push({
            type: 'direct_resource_processing',
            message: error.message,
            resourceType: resource.resourceType
          });
        }
      }
    }
  }

  // =========================================================================
  // Helper methods
  // =========================================================================

  /**
   * Extract message bundles from the poll response
   * NPHIES responses may contain nested message bundles
   */
  extractMessageBundles(responseBundle) {
    const messageBundles = [];

    for (const entry of responseBundle.entry || []) {
      const resource = entry.resource;
      if (resource?.resourceType === 'Bundle' && resource.type === 'message') {
        messageBundles.push(resource);
      }
    }

    return messageBundles;
  }

  /**
   * Resolve the provider to use for poll requests
   */
  async resolveProvider(schemaName) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}`);

      // Try configured provider ID first
      let result = await client.query(
        `SELECT nphies_id, provider_name FROM providers WHERE nphies_id = $1 LIMIT 1`,
        [NPHIES_CONFIG.DEFAULT_PROVIDER_ID]
      );

      if (result.rows.length === 0) {
        // Fallback: pick any provider with a numeric nphies_id
        result = await client.query(
          `SELECT nphies_id, provider_name FROM providers WHERE nphies_id ~ '^[0-9]+$' ORDER BY created_at DESC LIMIT 1`
        );
      }

      if (result.rows.length > 0) {
        return {
          nphiesId: result.rows[0].nphies_id,
          name: result.rows[0].provider_name
        };
      }

      return {
        nphiesId: NPHIES_CONFIG.DEFAULT_PROVIDER_ID,
        name: 'Healthcare Provider'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Extract error details from a failed NPHIES response
   */
  extractErrorDetails(pollResponse) {
    const nphiesErrors = pollResponse.errors || [];
    if (nphiesErrors.length > 0) {
      return nphiesErrors.map(e =>
        e.diagnostics || e.message || e.code || JSON.stringify(e)
      ).join('; ');
    }
    return pollResponse.error || 'Unknown error';
  }

  // =========================================================================
  // Database operations for poll_logs and poll_messages
  // =========================================================================

  async createPollLog({ pollId, schemaName, providerNphiesId, triggerType, pollBundle, startedAt }) {
    const result = await pool.query(`
      INSERT INTO poll_logs (poll_id, schema_name, provider_nphies_id, trigger_type, status, poll_bundle, started_at)
      VALUES ($1, $2, $3, $4, 'in_progress', $5, $6)
      RETURNING id
    `, [pollId, schemaName, providerNphiesId, triggerType, JSON.stringify(pollBundle), startedAt]);

    return result.rows[0].id;
  }

  async updatePollLog(pollLogId, updates) {
    const completedAt = updates.completedAt || new Date();
    const durationMs = updates.completedAt && updates.startedAt
      ? updates.completedAt - updates.startedAt
      : null;

    await pool.query(`
      UPDATE poll_logs SET
        status = COALESCE($1, status),
        response_bundle = COALESCE($2, response_bundle),
        response_code = COALESCE($3, response_code),
        messages_received = COALESCE($4, messages_received),
        messages_processed = COALESCE($5, messages_processed),
        messages_matched = COALESCE($6, messages_matched),
        messages_unmatched = COALESCE($7, messages_unmatched),
        processing_summary = COALESCE($8, processing_summary),
        errors = COALESCE($9, errors),
        completed_at = $10,
        duration_ms = $11
      WHERE id = $12
    `, [
      updates.status,
      updates.responseBundle ? JSON.stringify(updates.responseBundle) : null,
      updates.responseCode,
      updates.messagesReceived ?? null,
      updates.messagesProcessed ?? null,
      updates.messagesMatched ?? null,
      updates.messagesUnmatched ?? null,
      updates.processingSummary ? JSON.stringify(updates.processingSummary) : null,
      updates.errors ? JSON.stringify(updates.errors) : null,
      completedAt,
      durationMs,
      pollLogId
    ]);
  }

  async logPollMessage(pollLogId, msg) {
    await pool.query(`
      INSERT INTO poll_messages (
        poll_log_id, message_header_id, response_identifier, event_code,
        resource_type, resource_data, message_type,
        matched, matched_table, matched_record_id, match_strategy,
        processing_status, processing_error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      pollLogId,
      msg.messageHeaderId,
      msg.responseIdentifier,
      msg.eventCode,
      msg.resourceType,
      msg.resourceData ? JSON.stringify(msg.resourceData) : null,
      msg.messageType,
      msg.matched,
      msg.matchedTable,
      msg.matchedRecordId,
      msg.matchStrategy,
      msg.processingStatus,
      msg.processingError
    ]);
  }

  // =========================================================================
  // Query methods for poll history
  // =========================================================================

  async getPollLogs({ page = 1, limit = 20, status, schemaName } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (schemaName) {
      conditions.push(`schema_name = $${paramIdx++}`);
      params.push(schemaName);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM poll_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT id, poll_id, schema_name, provider_nphies_id, trigger_type, status,
              response_code, messages_received, messages_processed, messages_matched,
              messages_unmatched, processing_summary, errors, started_at, completed_at,
              duration_ms, created_at
       FROM poll_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getPollLog(pollLogId) {
    const logResult = await pool.query(
      `SELECT * FROM poll_logs WHERE id = $1`,
      [pollLogId]
    );

    if (logResult.rows.length === 0) return null;

    const messagesResult = await pool.query(
      `SELECT id, message_header_id, response_identifier, event_code, resource_type,
              message_type, matched, matched_table, matched_record_id, match_strategy,
              processing_status, processing_error, created_at
       FROM poll_messages WHERE poll_log_id = $1
       ORDER BY id ASC`,
      [pollLogId]
    );

    return {
      ...logResult.rows[0],
      messages: messagesResult.rows
    };
  }

  async getPollStats(schemaName) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_polls,
        COUNT(*) FILTER (WHERE created_at >= $1) as polls_today,
        COALESCE(SUM(messages_received), 0) as total_messages,
        COALESCE(SUM(messages_received) FILTER (WHERE created_at >= $1), 0) as messages_today,
        COALESCE(SUM(messages_matched), 0) as total_matched,
        COALESCE(SUM(messages_matched) FILTER (WHERE created_at >= $1), 0) as matched_today,
        COALESCE(SUM(messages_unmatched), 0) as total_unmatched,
        MAX(created_at) as last_poll_at,
        ROUND(
          CASE WHEN SUM(messages_received) > 0
            THEN (SUM(messages_matched)::NUMERIC / SUM(messages_received)::NUMERIC) * 100
            ELSE 0
          END, 1
        ) as match_rate_percent
      FROM poll_logs
      WHERE ($2::text IS NULL OR schema_name = $2)
    `, [today, schemaName || null]);

    return statsResult.rows[0];
  }

  /**
   * Get poll messages for a specific record (used by detail pages)
   */
  async getPollMessagesForRecord(matchedTable, matchedRecordId, { page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM poll_messages WHERE matched_table = $1 AND matched_record_id = $2`,
      [matchedTable, matchedRecordId]
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT pm.*, pl.poll_id, pl.trigger_type, pl.started_at as poll_started_at
       FROM poll_messages pm
       JOIN poll_logs pl ON pm.poll_log_id = pl.id
       WHERE pm.matched_table = $1 AND pm.matched_record_id = $2
       ORDER BY pm.created_at DESC
       LIMIT $3 OFFSET $4`,
      [matchedTable, matchedRecordId, limit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }
}

export default new SystemPollService();
