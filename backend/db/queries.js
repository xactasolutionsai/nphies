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
    `,

    // Comprehensive dashboard queries
    GET_DAILY_TRENDS: `
      SELECT 
        DATE_TRUNC('day', submission_date) as date,
        COUNT(*) as claim_count,
        SUM(COALESCE(amount, 0)) as claim_amount
      FROM claims
      WHERE submission_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', submission_date)
      ORDER BY date DESC
    `,

    GET_PAYMENT_TRENDS: `
      SELECT 
        DATE_TRUNC('day', payment_date) as date,
        COUNT(*) as payment_count,
        SUM(COALESCE(amount, 0)) as payment_amount
      FROM payments
      WHERE payment_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', payment_date)
      ORDER BY date DESC
    `,

    GET_MONTHLY_TRENDS: `
      SELECT 
        DATE_TRUNC('month', submission_date) as month,
        COUNT(*) as claim_count,
        SUM(COALESCE(amount, 0)) as claim_amount
      FROM claims
      WHERE submission_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', submission_date)
      ORDER BY month DESC
    `,

    GET_PROVIDER_PERFORMANCE: `
      SELECT 
        p.provider_id,
        p.provider_name,
        COUNT(c.claim_id) as total_claims,
        SUM(COALESCE(c.amount, 0)) as total_amount,
        COUNT(CASE WHEN c.status = 'Paid' THEN 1 END) as paid_claims,
        ROUND(100.0 * COUNT(CASE WHEN c.status = 'Paid' THEN 1 END) / NULLIF(COUNT(c.claim_id), 0), 2) as approval_rate
      FROM providers p
      LEFT JOIN claims c ON p.provider_id = c.provider_id
      GROUP BY p.provider_id, p.provider_name
      HAVING COUNT(c.claim_id) > 0
      ORDER BY total_amount DESC
      LIMIT 10
    `,

    GET_INSURER_PERFORMANCE: `
      SELECT 
        i.insurer_id,
        i.insurer_name,
        COUNT(c.claim_id) as total_claims,
        SUM(COALESCE(c.amount, 0)) as total_amount,
        COUNT(CASE WHEN c.status = 'Paid' THEN 1 END) as paid_claims,
        ROUND(100.0 * COUNT(CASE WHEN c.status = 'Paid' THEN 1 END) / NULLIF(COUNT(c.claim_id), 0), 2) as approval_rate,
        COALESCE(SUM(p.amount), 0) as total_payments
      FROM insurers i
      LEFT JOIN claims c ON i.insurer_id = c.insurer_id
      LEFT JOIN payments p ON i.insurer_id = p.insurer_id
      GROUP BY i.insurer_id, i.insurer_name
      HAVING COUNT(c.claim_id) > 0 OR SUM(p.amount) > 0
      ORDER BY total_amount DESC
      LIMIT 10
    `,

    GET_AUTHORIZATIONS_BY_STATUS: `
      SELECT status, COUNT(*) as count
      FROM prior_authorizations
      GROUP BY status
      ORDER BY count DESC
    `,

    GET_ELIGIBILITY_BY_STATUS: `
      SELECT status, COUNT(*) as count
      FROM eligibility
      GROUP BY status
      ORDER BY count DESC
    `,

    GET_AUTHORIZATIONS_BY_TYPE: `
      SELECT 
        auth_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_count
      FROM prior_authorizations
      GROUP BY auth_type
      ORDER BY count DESC
    `,

    GET_OUTSTANDING_CLAIMS: `
      SELECT 
        i.insurer_name,
        COUNT(c.claim_id) as claim_count,
        SUM(COALESCE(c.amount, 0)) as outstanding_amount
      FROM claims c
      LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
      WHERE c.status NOT IN ('Paid', 'Finalized')
      GROUP BY i.insurer_name
      ORDER BY outstanding_amount DESC
    `,

    GET_TOP_PATIENTS: `
      SELECT 
        p.patient_id,
        p.name,
        COUNT(c.claim_id) as claim_count,
        SUM(COALESCE(c.amount, 0)) as total_amount
      FROM patients p
      LEFT JOIN claims c ON p.patient_id = c.patient_id
      GROUP BY p.patient_id, p.name
      HAVING COUNT(c.claim_id) > 0
      ORDER BY claim_count DESC
      LIMIT 5
    `,

    GET_FINANCIAL_SUMMARY: `
      SELECT 
        COALESCE(SUM(c.amount), 0) as total_claims_amount,
        COALESCE(SUM(CASE WHEN c.status = 'Paid' THEN c.amount ELSE 0 END), 0) as paid_claims_amount,
        COALESCE(SUM(CASE WHEN c.status NOT IN ('Paid', 'Finalized') THEN c.amount ELSE 0 END), 0) as outstanding_amount,
        COALESCE((SELECT SUM(amount) FROM payments), 0) as total_payments,
        COALESCE(AVG(c.amount), 0) as avg_claim_amount
      FROM claims c
    `,

    GET_PREVIOUS_PERIOD_STATS: `
      SELECT 
        (SELECT COUNT(*) FROM patients) as previous_patients,
        (SELECT COUNT(*) FROM providers) as previous_providers,
        (SELECT COUNT(*) FROM claims WHERE submission_date < CURRENT_DATE - INTERVAL '30 days') as previous_claims,
        (SELECT COUNT(*) FROM payments WHERE payment_date < CURRENT_DATE - INTERVAL '30 days') as previous_payments,
        (SELECT COUNT(*) FROM prior_authorizations WHERE encounter_start < CURRENT_DATE - INTERVAL '30 days') as previous_authorizations
    `,

    // =========================================================================
    // ENHANCED DASHBOARD QUERIES (New)
    // =========================================================================

    // Prior Authorization breakdown by type with detailed status
    GET_PRIOR_AUTH_BY_TYPE_STATUS: `
      SELECT 
        auth_type,
        status,
        COUNT(*) as count,
        SUM(COALESCE(
          (SELECT SUM(net_amount) FROM prior_authorization_items WHERE prior_auth_id = pa.id), 
          0
        )) as total_amount
      FROM prior_authorizations pa
      GROUP BY auth_type, status
      ORDER BY auth_type, count DESC
    `,

    // Prior Authorization summary by type
    GET_PRIOR_AUTH_SUMMARY: `
      SELECT 
        auth_type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error,
        ROUND(100.0 * COUNT(CASE WHEN status = 'approved' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as approval_rate
      FROM prior_authorizations
      GROUP BY auth_type
      ORDER BY total DESC
    `,

    // Eligibility by insurer with breakdown
    GET_ELIGIBILITY_BY_INSURER: `
      SELECT 
        i.insurer_name,
        i.insurer_id,
        COUNT(*) as total_checks,
        COUNT(CASE WHEN e.status = 'eligible' THEN 1 END) as eligible,
        COUNT(CASE WHEN e.status = 'not_eligible' THEN 1 END) as not_eligible,
        COUNT(CASE WHEN e.status IN ('pending', 'Pending') THEN 1 END) as pending,
        COUNT(CASE WHEN e.status = 'Active' THEN 1 END) as active,
        ROUND(100.0 * COUNT(CASE WHEN e.status = 'eligible' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as eligibility_rate
      FROM eligibility e
      JOIN insurers i ON e.insurer_id = i.insurer_id
      GROUP BY i.insurer_id, i.insurer_name
      ORDER BY total_checks DESC
    `,

    // Coverage distribution - patients per insurer
    GET_COVERAGE_DISTRIBUTION: `
      SELECT 
        i.insurer_name,
        i.insurer_id,
        i.plan_type,
        COUNT(DISTINCT pc.patient_id) as patient_count,
        COUNT(DISTINCT pc.coverage_id) as coverage_count
      FROM insurers i
      LEFT JOIN patient_coverage pc ON i.insurer_id = pc.insurer_id
      GROUP BY i.insurer_id, i.insurer_name, i.plan_type
      ORDER BY patient_count DESC
    `,

    // Claims pipeline/funnel data
    GET_CLAIMS_PIPELINE: `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(COALESCE(amount, 0)) as total_amount,
        AVG(COALESCE(amount, 0)) as avg_amount
      FROM claims
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'Pending' THEN 1
          WHEN 'Under Review' THEN 2
          WHEN 'Resubmitted' THEN 3
          WHEN 'Approved' THEN 4
          WHEN 'Denied' THEN 5
          WHEN 'Rejected' THEN 6
          WHEN 'Paid' THEN 7
          WHEN 'Finalized' THEN 8
          ELSE 9
        END
    `,

    // Claim submissions summary
    GET_CLAIM_SUBMISSIONS_SUMMARY: `
      SELECT 
        claim_type,
        status,
        outcome,
        COUNT(*) as count
      FROM claim_submissions
      GROUP BY claim_type, status, outcome
      ORDER BY count DESC
    `,

    // Prior authorization trends (last 30 days)
    GET_PRIOR_AUTH_TRENDS: `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        auth_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
      FROM prior_authorizations
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at), auth_type
      ORDER BY date DESC
    `,

    // Provider performance with prior authorizations
    GET_PROVIDER_FULL_PERFORMANCE: `
      SELECT 
        p.provider_id,
        p.provider_name,
        p.type as provider_type,
        COUNT(DISTINCT c.claim_id) as total_claims,
        SUM(COALESCE(c.amount, 0)) as claims_amount,
        COUNT(DISTINCT pa.id) as total_auths,
        COUNT(DISTINCT CASE WHEN pa.status = 'approved' THEN pa.id END) as approved_auths,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN pa.status = 'approved' THEN pa.id END) / 
          NULLIF(COUNT(DISTINCT pa.id), 0), 1) as auth_approval_rate
      FROM providers p
      LEFT JOIN claims c ON p.provider_id = c.provider_id
      LEFT JOIN prior_authorizations pa ON p.provider_id = pa.provider_id
      GROUP BY p.provider_id, p.provider_name, p.type
      HAVING COUNT(DISTINCT c.claim_id) > 0 OR COUNT(DISTINCT pa.id) > 0
      ORDER BY total_claims DESC, total_auths DESC
      LIMIT 10
    `,

    // Insurer full performance
    GET_INSURER_FULL_PERFORMANCE: `
      SELECT 
        i.insurer_id,
        i.insurer_name,
        i.plan_type,
        COUNT(DISTINCT c.claim_id) as total_claims,
        SUM(COALESCE(c.amount, 0)) as claims_amount,
        COUNT(DISTINCT CASE WHEN c.status = 'Paid' THEN c.claim_id END) as paid_claims,
        COALESCE((SELECT SUM(amount) FROM payments WHERE insurer_id = i.insurer_id), 0) as total_payments,
        COUNT(DISTINCT e.eligibility_id) as eligibility_checks,
        COUNT(DISTINCT CASE WHEN e.status = 'eligible' THEN e.eligibility_id END) as eligible_count,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.status = 'eligible' THEN e.eligibility_id END) / 
          NULLIF(COUNT(DISTINCT e.eligibility_id), 0), 1) as eligibility_rate
      FROM insurers i
      LEFT JOIN claims c ON i.insurer_id = c.insurer_id
      LEFT JOIN eligibility e ON i.insurer_id = e.insurer_id
      GROUP BY i.insurer_id, i.insurer_name, i.plan_type
      ORDER BY total_claims DESC, eligibility_checks DESC
      LIMIT 10
    `,

    // Dental and Eye approvals summary
    GET_SPECIALTY_APPROVALS: `
      SELECT 
        auth_type as type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status IN ('pending', 'draft') THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error
      FROM prior_authorizations
      GROUP BY auth_type
      ORDER BY total DESC
    `,

    // Recent prior authorizations
    GET_RECENT_PRIOR_AUTHS: `
      SELECT 
        pa.id,
        pa.request_number,
        pa.auth_type,
        pa.status,
        pa.outcome,
        pa.created_at,
        p.name as patient_name,
        pr.provider_name,
        i.insurer_name
      FROM prior_authorizations pa
      LEFT JOIN patients p ON pa.patient_id = p.patient_id
      LEFT JOIN providers pr ON pa.provider_id = pr.provider_id
      LEFT JOIN insurers i ON pa.insurer_id = i.insurer_id
      ORDER BY pa.created_at DESC
      LIMIT 10
    `,

    // Financial breakdown by category
    GET_FINANCIAL_BREAKDOWN: `
      SELECT 
        'claims' as category,
        COUNT(*) as count,
        SUM(COALESCE(amount, 0)) as total_amount,
        AVG(COALESCE(amount, 0)) as avg_amount
      FROM claims
      UNION ALL
      SELECT 
        'payments' as category,
        COUNT(*) as count,
        SUM(COALESCE(amount, 0)) as total_amount,
        AVG(COALESCE(amount, 0)) as avg_amount
      FROM payments
      UNION ALL
      SELECT 
        'prior_auth_items' as category,
        COUNT(*) as count,
        SUM(COALESCE(net_amount, 0)) as total_amount,
        AVG(COALESCE(net_amount, 0)) as avg_amount
      FROM prior_authorization_items
    `
  },

  // =============================================================================
  // PATIENTS QUERIES
  // =============================================================================

  PATIENTS: {
    // Get all patients with search
    GET_ALL: `
      SELECT 
        patient_id,
        name,
        identifier,
        identifier_type,
        identifier_system,
        gender,
        TO_CHAR(birth_date, 'YYYY-MM-DD') as birth_date,
        phone,
        email,
        nationality,
        marital_status,
        address,
        city,
        country,
        occupation,
        is_newborn,
        nphies_patient_id,
        telecom,
        address_details,
        created_at,
        updated_at
      FROM patients
    `,

    // Get patient count
    GET_ALL_COUNT: `
      SELECT COUNT(*) as total FROM patients
    `,

    // Get patient by ID
    GET_BY_ID: `
      SELECT 
        patient_id,
        name,
        identifier,
        identifier_type,
        identifier_system,
        gender,
        TO_CHAR(birth_date, 'YYYY-MM-DD') as birth_date,
        phone,
        email,
        nationality,
        marital_status,
        address,
        city,
        country,
        occupation,
        is_newborn,
        nphies_patient_id,
        telecom,
        address_details,
        created_at,
        updated_at
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
        nphies_id,
        address,
        phone,
        email,
        doctor_name,
        department,
        provider_type,
        location_license,
        contact_person,
        created_at,
        updated_at
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
        nphies_id,
        address,
        phone,
        email,
        doctor_name,
        department,
        provider_type,
        location_license,
        contact_person,
        created_at,
        updated_at
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
