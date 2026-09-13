import { query, transaction } from '../db.js';

// Buffer JSON responses until COMMIT, and roll back even when a controller catches
// a database error and converts it to an HTTP error. Never wrap network send/poll.
export function atomicMethods(controller, methods, table) {
  if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid transaction table');
  for (const name of methods) {
    const handler = controller[name].bind(controller);
    controller[name] = async (req, res, next) => {
      let status = 200;
      let body;
      const rollbackResponse = new Error('Controller rejected request');
      const buffered = {
        status(code) { status = code; return this; },
        json(data) { body = data; return this; }
      };
      try {
        await transaction(async () => {
          if (req.params?.id && ['update', 'delete', 'addClaimsToBatch', 'removeClaimsFromBatch'].includes(name)) {
            await query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [req.params.id]);
          }
          await handler(req, buffered);
          if (status >= 400) throw rollbackResponse;
        });
      } catch (error) {
        if (error !== rollbackResponse) {
          if (next) return next(error);
          return res.status(500).json({ error: 'Unable to save changes' });
        }
      }
      return res.status(status).json(body);
    };
  }
}
