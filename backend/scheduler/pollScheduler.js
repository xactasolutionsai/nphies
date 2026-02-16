/**
 * Poll Scheduler
 * 
 * Optional background scheduler for system-level NPHIES polling.
 * Uses node-cron to periodically trigger polls.
 * 
 * Configuration (via environment variables):
 *   ENABLE_SCHEDULED_POLLING=true     - Enable/disable the scheduler (default: false)
 *   POLL_INTERVAL_MINUTES=5           - Interval between polls in minutes (default: 5)
 *   POLL_SCHEMA_NAME=public           - Database schema to poll (default: public)
 * 
 * Usage:
 *   import { startPollScheduler, stopPollScheduler } from './scheduler/pollScheduler.js';
 *   startPollScheduler(); // Call on server startup
 */

import systemPollService from '../services/systemPollService.js';

let intervalId = null;
let isRunning = false;

const POLL_INTERVAL_MINUTES = parseInt(process.env.POLL_INTERVAL_MINUTES || '5');
const POLL_SCHEMA_NAME = process.env.POLL_SCHEMA_NAME || 'public';

/**
 * Start the poll scheduler
 */
export function startPollScheduler() {
  const enabled = process.env.ENABLE_SCHEDULED_POLLING === 'true';

  if (!enabled) {
    console.log('[PollScheduler] Scheduled polling is disabled. Set ENABLE_SCHEDULED_POLLING=true to enable.');
    return;
  }

  if (intervalId) {
    console.log('[PollScheduler] Scheduler is already running.');
    return;
  }

  const intervalMs = POLL_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[PollScheduler] Starting scheduled polling every ${POLL_INTERVAL_MINUTES} minutes (${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    if (isRunning) {
      console.log('[PollScheduler] Previous poll still running, skipping...');
      return;
    }

    try {
      isRunning = true;
      console.log(`[PollScheduler] Scheduled poll triggered at ${new Date().toISOString()}`);

      const result = await systemPollService.executePoll(POLL_SCHEMA_NAME, 'scheduled');

      if (result.success) {
        console.log(`[PollScheduler] Poll completed: ${result.stats?.received || 0} messages received, ${result.stats?.matched || 0} matched`);
      } else {
        console.error(`[PollScheduler] Poll failed: ${result.message}`);
      }
    } catch (error) {
      console.error('[PollScheduler] Error during scheduled poll:', error);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  // Run initial poll after a short delay
  setTimeout(async () => {
    if (!isRunning) {
      try {
        isRunning = true;
        console.log('[PollScheduler] Running initial poll...');
        await systemPollService.executePoll(POLL_SCHEMA_NAME, 'scheduled');
      } catch (error) {
        console.error('[PollScheduler] Error during initial poll:', error);
      } finally {
        isRunning = false;
      }
    }
  }, 10000); // Wait 10 seconds after server start
}

/**
 * Stop the poll scheduler
 */
export function stopPollScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[PollScheduler] Scheduled polling stopped.');
  }
}

export default { startPollScheduler, stopPollScheduler };
