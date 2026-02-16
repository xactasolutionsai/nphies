import express from 'express';
import systemPollController from '../controllers/systemPollController.js';

const router = express.Router();

/**
 * System Poll Routes
 * 
 * POST   /api/system-poll/trigger                    - Trigger a manual system-wide poll
 * GET    /api/system-poll/logs                        - Get paginated poll history
 * GET    /api/system-poll/logs/:id                    - Get specific poll log with messages
 * GET    /api/system-poll/stats                       - Get aggregate polling statistics
 * GET    /api/system-poll/messages/:table/:recordId   - Get poll messages for a specific record
 */

router.post('/trigger', (req, res) => systemPollController.triggerPoll(req, res));
router.get('/logs', (req, res) => systemPollController.getPollLogs(req, res));
router.get('/logs/:id', (req, res) => systemPollController.getPollLog(req, res));
router.get('/stats', (req, res) => systemPollController.getPollStats(req, res));
router.get('/messages/:table/:recordId', (req, res) => systemPollController.getRecordPollMessages(req, res));

export default router;
