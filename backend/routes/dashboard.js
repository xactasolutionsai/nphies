import express from 'express';
import { query } from '../db.js';
import { loadQueries } from '../db/queryLoader.js';

const router = express.Router();

// One failing dashboard query (e.g. a table missing on this database) must not
// fail the whole dashboard: log it, record the section, and return empty rows.
function createSafeQuery(failedSections) {
  return (sql, label) => query(sql).catch(error => {
    console.error(`[Dashboard] Query failed (${label}):`, error.message);
    failedSections.push(label);
    return { rows: [] };
  });
}

const count = result => parseInt(result.rows[0]?.total) || 0;

// DATE_TRUNC returns timestamps; pg turns them into local-time Dates. toISOString()
// would shift them to UTC (the previous day in UTC+3), so build the key from local parts.
function localDateKey(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Load queries dynamically
    const queries = await loadQueries();
    const failedSections = [];
    const safeQuery = createSafeQuery(failedSections);
    
    // Get counts for all tables
    const [
      patientsCount,
      providersCount,
      insurersCount,
      authorizationsCount,
      eligibilityCount,
      claimsCount,
      claimBatchesCount,
      paymentsCount
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_COUNTS.PATIENTS, 'GET_COUNTS.PATIENTS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.PROVIDERS, 'GET_COUNTS.PROVIDERS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.INSURERS, 'GET_COUNTS.INSURERS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.AUTHORIZATIONS, 'GET_COUNTS.AUTHORIZATIONS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.ELIGIBILITY, 'GET_COUNTS.ELIGIBILITY'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.CLAIMS, 'GET_COUNTS.CLAIMS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.CLAIM_BATCHES, 'GET_COUNTS.CLAIM_BATCHES'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.PAYMENTS, 'GET_COUNTS.PAYMENTS')
    ]);

    // Get claims by status
    const claimsByStatus = await safeQuery(queries.DASHBOARD.GET_CLAIMS_BY_STATUS, 'GET_CLAIMS_BY_STATUS');

    // Get payments by insurer
    const paymentsByInsurer = await safeQuery(queries.DASHBOARD.GET_PAYMENTS_BY_INSURER, 'GET_PAYMENTS_BY_INSURER');

    // Get recent activity (last 10 records from each table)
    const recentActivity = await safeQuery(queries.DASHBOARD.GET_RECENT_ACTIVITY, 'GET_RECENT_ACTIVITY');

    res.json({
      data: {
        counts: {
          patients: count(patientsCount),
          providers: count(providersCount),
          insurers: count(insurersCount),
          authorizations: count(authorizationsCount),
          eligibility: count(eligibilityCount),
          claims: count(claimsCount),
          claimBatches: count(claimBatchesCount),
          payments: count(paymentsCount)
        },
        claimsByStatus: claimsByStatus.rows,
        paymentsByInsurer: paymentsByInsurer.rows,
        recentActivity: recentActivity.rows
      },
      ...(failedSections.length > 0 && { partial: true, failedSections })
    });
  } catch (error) {
    console.error('Error getting dashboard statistics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// GET /api/dashboard/comprehensive-stats - Get comprehensive dashboard statistics
router.get('/comprehensive-stats', async (req, res) => {
  try {
    const queries = await loadQueries();
    const failedSections = [];
    const safeQuery = createSafeQuery(failedSections);
    
    // Get all basic counts
    const [
      patientsCount,
      providersCount,
      insurersCount,
      authorizationsCount,
      eligibilityCount,
      claimsCount,
      claimBatchesCount,
      paymentsCount,
      priorAuthsCount
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_COUNTS.PATIENTS, 'GET_COUNTS.PATIENTS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.PROVIDERS, 'GET_COUNTS.PROVIDERS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.INSURERS, 'GET_COUNTS.INSURERS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.AUTHORIZATIONS, 'GET_COUNTS.AUTHORIZATIONS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.ELIGIBILITY, 'GET_COUNTS.ELIGIBILITY'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.CLAIMS, 'GET_COUNTS.CLAIMS'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.CLAIM_BATCHES, 'GET_COUNTS.CLAIM_BATCHES'),
      safeQuery(queries.DASHBOARD.GET_COUNTS.PAYMENTS, 'GET_COUNTS.PAYMENTS'),
      safeQuery('SELECT COUNT(*) as total FROM prior_authorizations', 'PRIOR_AUTHORIZATIONS_COUNT')
    ]);

    // Get status distributions
    const [
      claimsByStatus,
      authorizationsByStatus,
      eligibilityByStatus,
      authorizationsByType
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_CLAIMS_BY_STATUS, 'GET_CLAIMS_BY_STATUS'),
      safeQuery(queries.DASHBOARD.GET_AUTHORIZATIONS_BY_STATUS, 'GET_AUTHORIZATIONS_BY_STATUS'),
      safeQuery(queries.DASHBOARD.GET_ELIGIBILITY_BY_STATUS, 'GET_ELIGIBILITY_BY_STATUS'),
      safeQuery(queries.DASHBOARD.GET_AUTHORIZATIONS_BY_TYPE, 'GET_AUTHORIZATIONS_BY_TYPE')
    ]);

    // Get time series data
    const [
      dailyTrends,
      paymentTrends,
      monthlyTrends
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_DAILY_TRENDS, 'GET_DAILY_TRENDS'),
      safeQuery(queries.DASHBOARD.GET_PAYMENT_TRENDS, 'GET_PAYMENT_TRENDS'),
      safeQuery(queries.DASHBOARD.GET_MONTHLY_TRENDS, 'GET_MONTHLY_TRENDS')
    ]);

    // Get performance metrics
    const [
      providerPerformance,
      insurerPerformance
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_PROVIDER_PERFORMANCE, 'GET_PROVIDER_PERFORMANCE'),
      safeQuery(queries.DASHBOARD.GET_INSURER_PERFORMANCE, 'GET_INSURER_PERFORMANCE')
    ]);

    // Get financial data
    const [
      paymentsByInsurer,
      outstandingClaims,
      financialSummary
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_PAYMENTS_BY_INSURER, 'GET_PAYMENTS_BY_INSURER'),
      safeQuery(queries.DASHBOARD.GET_OUTSTANDING_CLAIMS, 'GET_OUTSTANDING_CLAIMS'),
      safeQuery(queries.DASHBOARD.GET_FINANCIAL_SUMMARY, 'GET_FINANCIAL_SUMMARY')
    ]);

    // Get top performers
    const [
      topPatients
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_TOP_PATIENTS, 'GET_TOP_PATIENTS')
    ]);

    // Get previous period stats for trends
    const previousStats = await safeQuery(queries.DASHBOARD.GET_PREVIOUS_PERIOD_STATS, 'GET_PREVIOUS_PERIOD_STATS');

    // Get recent activity
    const recentActivity = await safeQuery(queries.DASHBOARD.GET_RECENT_ACTIVITY, 'GET_RECENT_ACTIVITY');

    // =========================================================================
    // NEW: Enhanced dashboard data
    // =========================================================================
    
    // Prior Authorization analytics
    const [
      priorAuthByTypeStatus,
      priorAuthSummary,
      priorAuthTrends,
      recentPriorAuths
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_PRIOR_AUTH_BY_TYPE_STATUS, 'GET_PRIOR_AUTH_BY_TYPE_STATUS'),
      safeQuery(queries.DASHBOARD.GET_PRIOR_AUTH_SUMMARY, 'GET_PRIOR_AUTH_SUMMARY'),
      safeQuery(queries.DASHBOARD.GET_PRIOR_AUTH_TRENDS, 'GET_PRIOR_AUTH_TRENDS'),
      safeQuery(queries.DASHBOARD.GET_RECENT_PRIOR_AUTHS, 'GET_RECENT_PRIOR_AUTHS')
    ]);

    // Eligibility and coverage
    const [
      eligibilityByInsurer,
      coverageDistribution
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_ELIGIBILITY_BY_INSURER, 'GET_ELIGIBILITY_BY_INSURER'),
      safeQuery(queries.DASHBOARD.GET_COVERAGE_DISTRIBUTION, 'GET_COVERAGE_DISTRIBUTION')
    ]);

    // Claims pipeline and submissions
    const [
      claimsPipeline,
      claimSubmissionsSummary
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_CLAIMS_PIPELINE, 'GET_CLAIMS_PIPELINE'),
      safeQuery(queries.DASHBOARD.GET_CLAIM_SUBMISSIONS_SUMMARY, 'GET_CLAIM_SUBMISSIONS_SUMMARY')
    ]);

    // Enhanced performance metrics
    const [
      providerFullPerformance,
      insurerFullPerformance
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_PROVIDER_FULL_PERFORMANCE, 'GET_PROVIDER_FULL_PERFORMANCE'),
      safeQuery(queries.DASHBOARD.GET_INSURER_FULL_PERFORMANCE, 'GET_INSURER_FULL_PERFORMANCE')
    ]);

    // Specialty approvals and financial breakdown
    const [
      specialtyApprovals,
      financialBreakdown
    ] = await Promise.all([
      safeQuery(queries.DASHBOARD.GET_SPECIALTY_APPROVALS, 'GET_SPECIALTY_APPROVALS'),
      safeQuery(queries.DASHBOARD.GET_FINANCIAL_BREAKDOWN, 'GET_FINANCIAL_BREAKDOWN')
    ]);

    // Merge daily trends with payment trends
    const dailyDataMap = {};
    dailyTrends.rows.forEach(row => {
      const dateKey = localDateKey(row.date);
      dailyDataMap[dateKey] = {
        date: dateKey,
        day: dayLabel(dateKey),
        claims: parseInt(row.claim_count) || 0,
        claimAmount: parseFloat(row.claim_amount) || 0,
        payments: 0,
        paymentAmount: 0
      };
    });

    paymentTrends.rows.forEach(row => {
      const dateKey = localDateKey(row.date);
      if (dailyDataMap[dateKey]) {
        dailyDataMap[dateKey].payments = parseInt(row.payment_count) || 0;
        dailyDataMap[dateKey].paymentAmount = parseFloat(row.payment_amount) || 0;
      } else {
        dailyDataMap[dateKey] = {
          date: dateKey,
          day: dayLabel(dateKey),
          claims: 0,
          claimAmount: 0,
          payments: parseInt(row.payment_count) || 0,
          paymentAmount: parseFloat(row.payment_amount) || 0
        };
      }
    });

    const mergedDailyTrends = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

    // Process prior auth trends
    const priorAuthTrendsMap = {};
    priorAuthTrends.rows.forEach(row => {
      const dateKey = localDateKey(row.date);
      if (!priorAuthTrendsMap[dateKey]) {
        priorAuthTrendsMap[dateKey] = {
          date: dateKey,
          day: dayLabel(dateKey),
          total: 0,
          approved: 0,
          dental: 0,
          pharmacy: 0,
          vision: 0,
          institutional: 0
        };
      }
      priorAuthTrendsMap[dateKey].total += parseInt(row.count) || 0;
      priorAuthTrendsMap[dateKey].approved += parseInt(row.approved_count) || 0;
      priorAuthTrendsMap[dateKey][row.auth_type] = (priorAuthTrendsMap[dateKey][row.auth_type] || 0) + parseInt(row.count);
    });

    const mergedPriorAuthTrends = Object.values(priorAuthTrendsMap).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate eligibility rate
    const totalEligible = eligibilityByStatus.rows.find(r => r.status === 'eligible')?.count || 0;
    const totalEligibilityChecks = eligibilityByStatus.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const eligibilityRate = totalEligibilityChecks > 0 
      ? Math.round((parseInt(totalEligible) / totalEligibilityChecks) * 100) 
      : 0;

    res.json({
      data: {
        counts: {
          patients: count(patientsCount),
          providers: count(providersCount),
          insurers: count(insurersCount),
          authorizations: count(authorizationsCount),
          eligibility: count(eligibilityCount),
          claims: count(claimsCount),
          claimBatches: count(claimBatchesCount),
          payments: count(paymentsCount),
          priorAuthorizations: count(priorAuthsCount),
          eligibilityRate: eligibilityRate
        },
        previousPeriod: {
          patients: parseInt(previousStats.rows[0]?.previous_patients) || 0,
          providers: parseInt(previousStats.rows[0]?.previous_providers) || 0,
          claims: parseInt(previousStats.rows[0]?.previous_claims) || 0,
          payments: parseInt(previousStats.rows[0]?.previous_payments) || 0,
          authorizations: parseInt(previousStats.rows[0]?.previous_authorizations) || 0
        },
        statusDistributions: {
          claims: claimsByStatus.rows,
          authorizations: authorizationsByStatus.rows,
          eligibility: eligibilityByStatus.rows,
          authorizationsByType: authorizationsByType.rows
        },
        timeSeries: {
          daily: mergedDailyTrends,
          // Chronological order for charts (the query returns newest first)
          monthly: [...monthlyTrends.rows].sort((a, b) => new Date(a.month) - new Date(b.month)).map(row => ({
            month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            claimCount: parseInt(row.claim_count) || 0,
            claimAmount: parseFloat(row.claim_amount) || 0
          })),
          priorAuthTrends: mergedPriorAuthTrends
        },
        performance: {
          providers: providerPerformance.rows,
          insurers: insurerPerformance.rows
        },
        financial: {
          paymentsByInsurer: paymentsByInsurer.rows,
          outstandingClaims: outstandingClaims.rows,
          summary: financialSummary.rows[0] || {},
          breakdown: financialBreakdown.rows
        },
        topPerformers: {
          patients: topPatients.rows
        },
        recentActivity: recentActivity.rows,
        
        // NEW: Enhanced data
        priorAuthorizations: {
          byTypeStatus: priorAuthByTypeStatus.rows,
          summary: priorAuthSummary.rows,
          recent: recentPriorAuths.rows
        },
        eligibilityAnalytics: {
          byInsurer: eligibilityByInsurer.rows,
          rate: eligibilityRate
        },
        coverageDistribution: coverageDistribution.rows,
        claimsPipeline: claimsPipeline.rows,
        claimSubmissions: claimSubmissionsSummary.rows,
        enhancedPerformance: {
          providers: providerFullPerformance.rows,
          insurers: insurerFullPerformance.rows
        },
        specialtyApprovals: specialtyApprovals.rows
      },
      ...(failedSections.length > 0 && { partial: true, failedSections })
    });
  } catch (error) {
    console.error('Error getting comprehensive dashboard statistics:', error);
    res.status(500).json({ error: 'Failed to fetch comprehensive dashboard statistics' });
  }
});

export default router;
