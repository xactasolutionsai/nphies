// Centralized SQL queries for the Nafes Healthcare Management System
// All SQL queries are defined here for consistency and maintainability

export const queries = {
  // =============================================================================
  // DASHBOARD QUERIES
  // =============================================================================

  DASHBOARD: {
    // Get counts for all tables
    GET_COUNTS: {
      PATIENTS: 'SELECT COUNT(*) as total FROM patients',
      PROVIDERS: 'SELECT COUNT(*) as total FROM providers',
      INSURERS: 'SELECT COUNT(*) as total FROM insurers',
      AUTHORIZATIONS: 'SELECT COUNT(*) as total FROM authorizations',
      ELIGIBILITY: 'SELECT COUNT(*) as total FROM eligibility',
      CLAIMS: 'SELECT COUNT(*) as total FROM claims',
      CLAIM_BATCHES: 'SELECT COUNT(*) as total FROM claims_batch',
      PAYMENTS: 'SELECT COUNT(*) as total FROM payments'
    },

    // Get claims by status
    GET_CLAIMS_BY_STATUS: `
      SELECT status, COUNT(*) as count
      FROM claims
      GROUP BY status
    `,

    // Get payments by insurer
    GET_PAYMENTS_BY_INSURER: `
      SELECT i.insurer_name, COALESCE(SUM(p.amount), 0) as amount
      FROM insurers i
      LEFT JOIN payments p ON i.insurer_id = p.insurer_id
      GROUP BY i.insurer_id, i.insurer_name
      ORDER BY amount DESC
    `,

    // Get recent activity
    GET_RECENT_ACTIVITY: `
      SELECT 'patient' as type, name as title, CURRENT_TIMESTAMP as created_at, 'New patient registered' as description
      FROM patients
      UNION ALL
      SELECT 'claim' as type, claim_number as title, CURRENT_TIMESTAMP as created_at, 'New claim submitted' as description
      FROM claims
      UNION ALL
      SELECT 'payment' as type, payment_ref as title, COALESCE(payment_date, CURRENT_TIMESTAMP) as created_at, 'Payment processed' as description
      FROM payments
      UNION ALL
      SELECT 'authorization' as type, auth_id::text as title, COALESCE(request_date, CURRENT_TIMESTAMP) as created_at, 'Authorization requested' as description
      FROM authorizations
      ORDER BY created_at DESC
      LIMIT 20
    `
  },

  // =============================================================================
  // PATIENTS QUERIES
  // =============================================================================

  PATIENTS: {
    // Get all patients with search
    GET_ALL: `
      SELECT 
        *,
        TO_CHAR(birth_date, 'YYYY-MM-DD') as birthDate
      FROM patients
    `,

    // Get patient count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total FROM patients
    `,

    // Get patient by ID
    GET_BY_ID: `
      SELECT 
        *,
        TO_CHAR(birth_date, 'YYYY-MM-DD') as birthDate
      FROM patients 
      WHERE patient_id = $1
    `,

    // Get patient with related claims
    GET_WITH_CLAIMS: `
      SELECT c.*, pr.provider_name as provider_name, i.insurer_name as insurer_name
      FROM claims c
      LEFT JOIN providers pr ON c.provider_id = pr.provider_id
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
      WHERE c.patient_id = $1
      ORDER BY c.submission_date DESC
    `,

    // Get patient with related authorizations
    GET_WITH_AUTHORIZATIONS: `
      SELECT a.*, pr.provider_name as provider_name, i.insurer_name as insurer_name
      FROM authorizations a
      LEFT JOIN providers pr ON a.provider_id = pr.provider_id
      LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
      WHERE a.patient_id = $1
      ORDER BY a.request_date DESC
    `,

    // Search patients
    SEARCH_WHERE: `WHERE name ILIKE $3 OR identifier ILIKE $3`
  },

  // =============================================================================
  // PROVIDERS QUERIES
  // =============================================================================

  PROVIDERS: {
    // Get all providers with search
    GET_ALL: `
      SELECT 
        provider_id,
        provider_name,
        type,
        nphies_id as nphiesId,
        address,
        phone,
        email,
        doctor_name,
        department,
        provider_name as name
      FROM providers
    `,

    // Get provider count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total FROM providers
    `,

    // Get provider by ID
    GET_BY_ID: `
      SELECT 
        provider_id,
        provider_name,
        type,
        nphies_id as nphiesId,
        address,
        phone,
        email,
        doctor_name,
        department,
        provider_name as name
      FROM providers 
      WHERE provider_id = $1
    `,

    // Get provider with related claims
    GET_RELATED_CLAIMS: `
      SELECT c.*, p.name as patient_name, i.insurer_name as insurer_name
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
      WHERE c.provider_id = $1
      ORDER BY c.submission_date DESC
      LIMIT 10
    `,

    // Get provider claim count
    GET_CLAIM_COUNT: 'SELECT COUNT(*) as total_claims FROM claims WHERE provider_id = $1',

    // Search providers
    SEARCH_WHERE: `WHERE (provider_name ILIKE $3 OR nphies_id ILIKE $3)`
  },

  // =============================================================================
  // INSURERS QUERIES
  // =============================================================================

  INSURERS: {
    // Get all insurers with search
    GET_ALL: `
      SELECT 
        *,
        insurer_name as name,
        nphies_id as nphiesId,
        contact_person as contactPerson
      FROM insurers
    `,

    // Get insurer count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total FROM insurers
    `,

    // Get insurer by ID
    GET_BY_ID: `
      SELECT 
        *,
        insurer_name as name,
        nphies_id as nphiesId,
        contact_person as contactPerson
      FROM insurers 
      WHERE insurer_id = $1
    `,

    // Get insurer with related claims
    GET_RELATED_CLAIMS: `
      SELECT c.*, p.name as patient_name, pr.provider_name as provider_name
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN providers pr ON c.provider_id = pr.provider_id
      WHERE c.insurer_id = $1
      ORDER BY c.submission_date DESC
      LIMIT 10
    `,

    // Search insurers
    SEARCH_WHERE: ` WHERE (insurer_name ILIKE $1 OR nphies_id ILIKE $1)`,

    // Get insurer claim statistics
    GET_CLAIM_STATS: `
      SELECT
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as pending_claims,
        COUNT(CASE WHEN status = 'Denied' THEN 1 END) as denied_claims,
        COUNT(CASE WHEN status = 'Paid' THEN 1 END) as paid_claims
      FROM claims
      WHERE insurer_id = $1
    `,

    // Get insurer payment statistics
    GET_PAYMENT_STATS: `
      SELECT
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as amount
      FROM payments
      WHERE insurer_id = $1
    `
  },

  // =============================================================================
  // CLAIMS QUERIES
  // =============================================================================

  CLAIMS: {
    // Get all claims with joins and search
    GET_ALL_WITH_JOINS: `
      SELECT
        c.*,
        p.name as patient_name,
        pr.provider_name as provider_name,
        i.insurer_name as insurer_name
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN providers pr ON c.provider_id = pr.provider_id
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
    `,

    // Get claims count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN providers pr ON c.provider_id = pr.provider_id
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
    `,

    // Get claim by ID
    GET_BY_ID: `
      SELECT
        c.*,
        p.name as patient_name,
        p.identifier as patient_identifier,
        pr.provider_name as provider_name,
        pr.nphies_id as provider_nphies_id,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN providers pr ON c.provider_id = pr.provider_id
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
      WHERE c.claim_id = $1
    `,

    // Update claim status
    UPDATE_STATUS: `
      UPDATE claims
      SET status = $1
      WHERE claim_id = $2
      RETURNING *
    `,

    // Search claims
    SEARCH_WHERE: `WHERE (p.name ILIKE $3 OR pr.provider_name ILIKE $3 OR i.insurer_name ILIKE $3 OR c.claim_number ILIKE $3)`,
    STATUS_WHERE: `AND c.status = $4`,

    // Get claims statistics
    GET_STATS: `
      SELECT
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_claims,
        COUNT(CASE WHEN status = 'Paid' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'Denied' THEN 1 END) as denied_claims,
        COUNT(CASE WHEN status = 'Paid' THEN 1 END) as paid_claims
      FROM claims
    `
  },

  // =============================================================================
  // AUTHORIZATIONS QUERIES
  // =============================================================================

  AUTHORIZATIONS: {
    // Get all authorizations with joins and search
    GET_ALL_WITH_JOINS: `
      SELECT
        a.*,
        a.auth_id as id,
        a.auth_status as status,
        p.name as patient_name,
        pr.provider_name as provider_name,
        i.insurer_name as insurer_name
      FROM authorizations a
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN providers pr ON a.provider_id = pr.provider_id
      LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
    `,

    // Get authorizations count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total
      FROM authorizations a
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN providers pr ON a.provider_id = pr.provider_id
      LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
    `,

    // Get authorization by ID
    GET_BY_ID: `
      SELECT
        a.*,
        a.auth_id as id,
        a.auth_status as status,
        p.name as patient_name,
        p.identifier as patient_identifier,
        pr.provider_name as provider_name,
        pr.nphies_id as provider_nphies_id,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM authorizations a
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN providers pr ON a.provider_id = pr.provider_id
      LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
      WHERE a.auth_id = $1
    `,

    // Update authorization status
    UPDATE_STATUS: `
      UPDATE authorizations
      SET auth_status = $1
      WHERE auth_id = $2
      RETURNING *
    `,

    // Search authorizations
    SEARCH_WHERE: `WHERE (p.name ILIKE $3 OR pr.provider_name ILIKE $3 OR i.insurer_name ILIKE $3 OR a.auth_id::text ILIKE $3)`,
    STATUS_WHERE: `AND a.auth_status = $4`
  },

  // =============================================================================
  // ELIGIBILITY QUERIES
  // =============================================================================

  ELIGIBILITY: {
    // Get all eligibility requests with joins and search
    GET_ALL_WITH_JOINS: `
      SELECT
        e.*,
        e.eligibility_id as id,
        p.name as patient_name,
        pr.provider_name as provider_name,
        i.insurer_name as insurer_name
      FROM eligibility e
      LEFT JOIN patients p ON e.patient_id = p.patient_id
      LEFT JOIN providers pr ON e.provider_id = pr.provider_id
      LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
    `,

    // Get eligibility count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total
      FROM eligibility e
      LEFT JOIN patients p ON e.patient_id = p.patient_id
      LEFT JOIN providers pr ON e.provider_id = pr.provider_id
      LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
    `,

    // Get eligibility by ID
    GET_BY_ID: `
      SELECT
        e.*,
        e.eligibility_id as id,
        p.name as patient_name,
        p.identifier as patient_identifier,
        pr.provider_name as provider_name,
        pr.nphies_id as provider_nphies_id,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM eligibility e
      LEFT JOIN patients p ON e.patient_id = p.patient_id
      LEFT JOIN providers pr ON e.provider_id = pr.provider_id
      LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
      WHERE e.eligibility_id = $1
    `,

    // Update eligibility status
    UPDATE_STATUS: `
      UPDATE eligibility
      SET status = $1
      WHERE eligibility_id = $2
      RETURNING *
    `,

    // Search eligibility
    SEARCH_WHERE: `WHERE (p.name ILIKE $3 OR pr.provider_name ILIKE $3 OR i.insurer_name ILIKE $3 OR e.purpose ILIKE $3)`,
    STATUS_WHERE: `AND e.status = $4`
  },

  // =============================================================================
  // PAYMENTS QUERIES
  // =============================================================================

  PAYMENTS: {
    // Get all payments with joins and search
    GET_ALL_WITH_JOINS: `
      SELECT
        p.*,
        p.payment_ref as payment_ref_number,
        p.amount as total_amount,
        i.insurer_name as insurer_name,
        pr.provider_name as provider_name
      FROM payments p
      LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
      LEFT JOIN providers pr ON p.provider_id = pr.provider_id
    `,

    // Get payments count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
    `,

    // Get payment by ID
    GET_BY_ID: `
      SELECT
        p.*,
        p.payment_ref as payment_ref_number,
        p.amount as total_amount,
        i.insurer_name as insurer_name,
        i.nphies_id as insurer_nphies_id,
        pr.provider_name as provider_name,
        pr.nphies_id as provider_nphies_id
      FROM payments p
      LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
      LEFT JOIN providers pr ON p.provider_id = pr.provider_id
      WHERE p.payment_id = $1
    `,

    // Update payment details
    UPDATE_PAYMENT: `
      UPDATE payments
      SET payment_ref = COALESCE($1, payment_ref),
          amount = COALESCE($2, amount),
          payment_date = COALESCE($3, payment_date)
      WHERE payment_id = $4
      RETURNING *
    `,

    // Get payment statistics
    GET_STATS: `
      SELECT
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(AVG(amount), 0) as average_amount,
        COALESCE(MIN(amount), 0) as min_amount,
        COALESCE(MAX(amount), 0) as max_amount
      FROM payments
    `,

    // Get payments by insurer
    GET_BY_INSURER: `
      SELECT
        p.*,
        i.insurer_name as insurer_name
      FROM payments p
      LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
      WHERE p.insurer_id = $1
      ORDER BY p.payment_date DESC
      LIMIT $2 OFFSET $3
    `,

    // Get payments by insurer count
    GET_BY_INSURER_COUNT: 'SELECT COUNT(*) as total FROM payments WHERE insurer_id = $1',

    // Search payments
    SEARCH_WHERE: `WHERE (i.insurer_name ILIKE $3 OR p.payment_ref ILIKE $3)`
  },

  // =============================================================================
  // CLAIM BATCHES QUERIES
  // =============================================================================

  CLAIM_BATCHES: {
    // Get all claim batches with joins and search
    GET_ALL_WITH_JOINS: `
      SELECT
        cb.*,
        cb.batch_id as batch_identifier,
        pr.provider_name as provider_name,
        i.insurer_name as insurer_name
      FROM claims_batch cb
      LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
    `,

    // Get claim batches count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total
      FROM claims_batch cb
      LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
    `,

    // Get claim batch by ID
    GET_BY_ID: `
      SELECT
        cb.*,
        cb.batch_id as batch_identifier,
        pr.provider_name as provider_name,
        i.insurer_name as insurer_name
      FROM claims_batch cb
      LEFT JOIN providers pr ON cb.provider_id = pr.provider_id
      LEFT JOIN insurers i ON cb.insurer_id = i.insurer_id
      WHERE cb.batch_id = $1
    `,

    // Search claim batches
    SEARCH_WHERE: `WHERE (pr.provider_name ILIKE $3 OR i.insurer_name ILIKE $3)`,
    STATUS_WHERE: `AND cb.status = $4`
  },

  // =============================================================================
  // DENTAL APPROVALS QUERIES
  // =============================================================================

  DENTAL_APPROVALS: {
    // Get all dental approvals
    GET_ALL: `
      SELECT
        da.*,
        p.name as patient_name,
        pr.provider_name as provider_name_joined,
        i.insurer_name as insurer_name
      FROM dental_approvals da
      LEFT JOIN patients p ON da.patient_id = p.patient_id
      LEFT JOIN providers pr ON da.provider_id = pr.provider_id
      LEFT JOIN insurers i ON da.insurer_id = i.insurer_id
      ORDER BY da.created_at DESC
      LIMIT $1 OFFSET $2
    `,

    // Get dental approval count
    GET_COUNT: `
      SELECT COUNT(*) as total FROM dental_approvals
    `,

    // Get dental approval by ID with full details
    GET_BY_ID: `
      SELECT
        da.*,
        p.name as patient_name,
        pr.provider_name as provider_name_joined,
        i.insurer_name as insurer_name
      FROM dental_approvals da
      LEFT JOIN patients p ON da.patient_id = p.patient_id
      LEFT JOIN providers pr ON da.provider_id = pr.provider_id
      LEFT JOIN insurers i ON da.insurer_id = i.insurer_id
      WHERE da.id = $1
    `,

    // Get dental procedures by form ID
    GET_PROCEDURES: `
      SELECT * FROM dental_procedures
      WHERE form_id = $1
      ORDER BY id ASC
    `,

    // Get dental medications by form ID
    GET_MEDICATIONS: `
      SELECT * FROM dental_medications
      WHERE form_id = $1
      ORDER BY id ASC
    `,

    // Search dental approvals
    SEARCH_WHERE: `WHERE (da.provider_name ILIKE $3 OR da.insurance_company_name ILIKE $3 OR da.form_number ILIKE $3 OR da.insured_name ILIKE $3 OR p.name ILIKE $3)`
  },

  // =============================================================================
  // COMMON QUERY PATTERNS (for BaseController)
  // =============================================================================

  COMMON: {
    // Get all records with pagination
    GET_ALL: (table, limit = 10, offset = 0) => `
      SELECT * FROM ${table}
      ORDER BY ${table}_id DESC
      LIMIT $1 OFFSET $2
    `,

    // Get record by ID
    GET_BY_ID: (table) => `
      SELECT * FROM ${table} WHERE ${table}_id = $1
    `,

    // Insert new record
    INSERT: (table, columns) => `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING *
    `,

    // Update record
    UPDATE: (table, columns) => `
      UPDATE ${table}
      SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}
      WHERE ${table}_id = $${columns.length + 1}
      RETURNING *
    `,

    // Delete record
    DELETE: (table) => `
      DELETE FROM ${table} WHERE ${table}_id = $1 RETURNING *
    `,

    // Count records
    COUNT: (table) => `
      SELECT COUNT(*) as total FROM ${table}
    `
  }
};

// Helper function to build dynamic WHERE clauses
export const buildWhereClause = (searchWhere, statusWhere = '') => {
  let whereClause = 'WHERE 1=1';
  if (searchWhere) {
    whereClause += ` AND ${searchWhere}`;
  }
  if (statusWhere) {
    whereClause += ` ${statusWhere}`;
  }
  return whereClause;
};

// Helper function to get query with proper WHERE clause
export const getQueryWithWhere = (queryFn, searchWhere, statusWhere = '') => {
  const whereClause = buildWhereClause(searchWhere, statusWhere);
  return queryFn(whereClause);
};
