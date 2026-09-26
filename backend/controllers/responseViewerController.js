import { query } from '../db.js';

// Per-tab list definitions. Only these column expressions ever reach ORDER BY / WHERE;
// request values are bound as parameters.
const LISTS = {
  claims: {
    select: `c.*, p.name as patient_name, pr.provider_name as provider_name, i.insurer_name as insurer_name`,
    from: `FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        LEFT JOIN providers pr ON c.provider_id = pr.provider_id
        LEFT JOIN insurers i ON c.insurer_id = i.insurer_id`,
    date: 'c.submission_date', status: 'c.status', amount: 'c.amount', patient: 'p.name', id: 'c.claim_id',
    search: ['c.claim_number', 'p.name', 'pr.provider_name', 'i.insurer_name'],
    error: 'Failed to fetch claims'
  },
  authorizations: {
    select: `a.*, a.auth_id as id, a.auth_status as status, p.name as patient_name,
          pr.provider_name as provider_name, i.insurer_name as insurer_name`,
    from: `FROM authorizations a
        LEFT JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN providers pr ON a.provider_id = pr.provider_id
        LEFT JOIN insurers i ON a.insurer_id = i.insurer_id`,
    date: 'a.request_date', status: 'a.auth_status', amount: 'a.amount', patient: 'p.name', id: 'a.auth_id',
    search: ['a.purpose', 'p.name', 'pr.provider_name', 'i.insurer_name'],
    error: 'Failed to fetch authorizations'
  },
  eligibility: {
    select: `e.*, e.eligibility_id as id, p.name as patient_name, pr.provider_name as provider_name, i.insurer_name as insurer_name`,
    from: `FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id`,
    // eligibility has no amount; sorting by amount falls back to the date
    date: 'e.request_date', status: 'e.status', amount: null, patient: 'p.name', id: 'e.eligibility_id',
    search: ['e.purpose', 'p.name', 'pr.provider_name', 'i.insurer_name'],
    error: 'Failed to fetch eligibility'
  },
  payments: {
    select: `p.*, p.payment_ref as payment_ref_number, p.amount as total_amount,
          i.insurer_name as insurer_name, pr.provider_name as provider_name`,
    from: `FROM payments p
        LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
        LEFT JOIN providers pr ON p.provider_id = pr.provider_id`,
    // payments have no patient; sorting by patient falls back to the date
    date: 'p.payment_date', status: 'p.status', amount: 'p.amount', patient: null, id: 'p.payment_id',
    search: ['p.payment_ref', 'i.insurer_name', 'pr.provider_name'],
    error: 'Failed to fetch payments'
  }
};

// dateRange values offered by the Response Viewer (calendar periods up to now).
const DATE_RANGES = { today: 'day', week: 'week', month: 'month', quarter: 'quarter' };
const SORT_KEYS = { created_at: 'date', date: 'date', status: 'status', amount: 'amount', patient_name: 'patient' };
const MAX_PAGE_SIZE = 100;

/**
 * Build the data and count queries of one Response Viewer tab from request query
 * parameters: page, limit, search, status, dateRange, sortBy, sortOrder.
 * Exported for the schema test that prepares every variant against the migrated database.
 */
export function buildResponseViewerQuery(tab, params = {}) {
  const list = LISTS[tab];
  if (!list) throw new Error(`Unknown response viewer list: ${tab}`);
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(params.limit, 10) || 10), MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions = [];
  const values = [];
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(${list.search.map(column => `${column}::text ILIKE $${values.length}`).join(' OR ')})`);
  }
  const status = typeof params.status === 'string' ? params.status.trim() : '';
  if (status && status.toLowerCase() !== 'all') {
    values.push(status);
    conditions.push(`LOWER(${list.status}) = LOWER($${values.length})`);
  }
  const period = DATE_RANGES[params.dateRange];
  if (period) conditions.push(`${list.date} >= date_trunc('${period}', CURRENT_DATE)`);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortColumn = list[SORT_KEYS[params.sortBy]] || list.date;
  const direction = String(params.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*) as total ${list.from} ${where}`;
  const dataSql = `
      SELECT ${list.select}
      ${list.from}
      ${where}
      ORDER BY ${sortColumn} ${direction} NULLS LAST, ${list.id} ${direction}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  return { dataSql, countSql, countParams: values, dataParams: [...values, limit, offset], page, limit };
}

async function listTab(tab, req, res) {
  try {
    const { dataSql, countSql, countParams, dataParams, page, limit } = buildResponseViewerQuery(tab, req.query || {});
    const [dataResult, countResult] = await Promise.all([
      query(dataSql, dataParams),
      query(countSql, countParams)
    ]);
    const total = parseInt(countResult.rows[0].total);
    res.json({
      data: dataResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(`Error getting ${tab} for ResponseViewer:`, error);
    res.status(500).json({ error: LISTS[tab].error });
  }
}

class ResponseViewerController {
  // Each list supports ?page, limit (max 100), search, status, dateRange (today|week|month|quarter),
  // sortBy (created_at|status|amount|patient_name) and sortOrder (ASC|DESC).
  async getClaims(req, res) { return listTab('claims', req, res); }

  async getAuthorizations(req, res) { return listTab('authorizations', req, res); }

  async getEligibility(req, res) { return listTab('eligibility', req, res); }

  async getPayments(req, res) { return listTab('payments', req, res); }
}

export default new ResponseViewerController();
