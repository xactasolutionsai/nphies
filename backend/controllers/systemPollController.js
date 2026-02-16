/**
 * System Poll Controller
 * 
 * API endpoints for managing system-level NPHIES polling.
 * Provides manual poll trigger, poll history, and statistics.
 */

import systemPollService from '../services/systemPollService.js';

class SystemPollController {

  /**
   * POST /api/system-poll/trigger
   * Triggers a manual system-wide poll
   */
  async triggerPoll(req, res) {
    try {
      const schemaName = req.schemaName || 'public';
      
      console.log(`[SystemPollController] Manual poll triggered`);

      const result = await systemPollService.executePoll(schemaName, 'manual');

      const statusCode = result.success ? 200 : 502;
      res.status(statusCode).json(result);
    } catch (error) {
      console.error('[SystemPollController] Error triggering poll:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to trigger poll'
      });
    }
  }

  /**
   * GET /api/system-poll/logs
   * Returns paginated list of poll logs
   * Query params: page, limit, status
   */
  async getPollLogs(req, res) {
    try {
      const schemaName = req.schemaName || 'public';
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const status = req.query.status || undefined;

      const result = await systemPollService.getPollLogs({ page, limit, status, schemaName });
      res.json(result);
    } catch (error) {
      console.error('[SystemPollController] Error fetching poll logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch poll logs' });
    }
  }

  /**
   * GET /api/system-poll/logs/:id
   * Returns a specific poll log with its messages
   */
  async getPollLog(req, res) {
    try {
      const { id } = req.params;
      const result = await systemPollService.getPollLog(parseInt(id));

      if (!result) {
        return res.status(404).json({ error: 'Poll log not found' });
      }

      res.json(result);
    } catch (error) {
      console.error('[SystemPollController] Error fetching poll log:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch poll log' });
    }
  }

  /**
   * GET /api/system-poll/stats
   * Returns aggregate polling statistics
   */
  async getPollStats(req, res) {
    try {
      const schemaName = req.schemaName || 'public';
      const stats = await systemPollService.getPollStats(schemaName);
      res.json(stats);
    } catch (error) {
      console.error('[SystemPollController] Error fetching poll stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch poll stats' });
    }
  }

  /**
   * GET /api/system-poll/messages/:table/:recordId
   * Returns poll messages for a specific record (used by detail pages)
   */
  async getRecordPollMessages(req, res) {
    try {
      const { table, recordId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);

      const allowedTables = ['prior_authorizations', 'claim_submissions', 'advanced_authorizations'];
      if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: `Invalid table: ${table}` });
      }

      const result = await systemPollService.getPollMessagesForRecord(
        table, parseInt(recordId), { page, limit }
      );
      res.json(result);
    } catch (error) {
      console.error('[SystemPollController] Error fetching record poll messages:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch poll messages' });
    }
  }
}

export default new SystemPollController();
