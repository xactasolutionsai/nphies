import express from 'express';
import { query } from '../db.js';
import { loadQueries } from '../db/queryLoader.js';

const router = express.Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Load queries dynamically
    const queries = await loadQueries();
    
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
      query(queries.DASHBOARD.GET_COUNTS.PATIENTS),
      query(queries.DASHBOARD.GET_COUNTS.PROVIDERS),
      query(queries.DASHBOARD.GET_COUNTS.INSURERS),
      query(queries.DASHBOARD.GET_COUNTS.AUTHORIZATIONS),
      query(queries.DASHBOARD.GET_COUNTS.ELIGIBILITY),
      query(queries.DASHBOARD.GET_COUNTS.CLAIMS),
      query(queries.DASHBOARD.GET_COUNTS.CLAIM_BATCHES),
      query(queries.DASHBOARD.GET_COUNTS.PAYMENTS)
    ]);

    // Get claims by status
    const claimsByStatus = await query(queries.DASHBOARD.GET_CLAIMS_BY_STATUS);

    // Get payments by insurer
    const paymentsByInsurer = await query(queries.DASHBOARD.GET_PAYMENTS_BY_INSURER);

    // Get recent activity (last 10 records from each table)
    const recentActivity = await query(queries.DASHBOARD.GET_RECENT_ACTIVITY);

    res.json({
      data: {
        counts: {
          patients: parseInt(patientsCount.rows[0].total),
          providers: parseInt(providersCount.rows[0].total),
          insurers: parseInt(insurersCount.rows[0].total),
          authorizations: parseInt(authorizationsCount.rows[0].total),
          eligibility: parseInt(eligibilityCount.rows[0].total),
          claims: parseInt(claimsCount.rows[0].total),
          claimBatches: parseInt(claimBatchesCount.rows[0].total),
          payments: parseInt(paymentsCount.rows[0].total)
        },
        claimsByStatus: claimsByStatus.rows,
        paymentsByInsurer: paymentsByInsurer.rows,
        recentActivity: recentActivity.rows
      }
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
      query(queries.DASHBOARD.GET_COUNTS.PATIENTS),
      query(queries.DASHBOARD.GET_COUNTS.PROVIDERS),
      query(queries.DASHBOARD.GET_COUNTS.INSURERS),
      query(queries.DASHBOARD.GET_COUNTS.AUTHORIZATIONS),
      query(queries.DASHBOARD.GET_COUNTS.ELIGIBILITY),
      query(queries.DASHBOARD.GET_COUNTS.CLAIMS),
      query(queries.DASHBOARD.GET_COUNTS.CLAIM_BATCHES),
      query(queries.DASHBOARD.GET_COUNTS.PAYMENTS),
      query('SELECT COUNT(*) as total FROM prior_authorizations')
    ]);

    // Get status distributions
    const [
      claimsByStatus,
      authorizationsByStatus,
      eligibilityByStatus,
      authorizationsByType
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_CLAIMS_BY_STATUS),
      query(queries.DASHBOARD.GET_AUTHORIZATIONS_BY_STATUS),
      query(queries.DASHBOARD.GET_ELIGIBILITY_BY_STATUS),
      query(queries.DASHBOARD.GET_AUTHORIZATIONS_BY_TYPE)
    ]);

    // Get time series data
    const [
      dailyTrends,
      paymentTrends,
      monthlyTrends
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_DAILY_TRENDS),
      query(queries.DASHBOARD.GET_PAYMENT_TRENDS),
      query(queries.DASHBOARD.GET_MONTHLY_TRENDS)
    ]);

    // Get performance metrics
    const [
      providerPerformance,
      insurerPerformance
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_PROVIDER_PERFORMANCE),
      query(queries.DASHBOARD.GET_INSURER_PERFORMANCE)
    ]);

    // Get financial data
    const [
      paymentsByInsurer,
      outstandingClaims,
      financialSummary
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_PAYMENTS_BY_INSURER),
      query(queries.DASHBOARD.GET_OUTSTANDING_CLAIMS),
      query(queries.DASHBOARD.GET_FINANCIAL_SUMMARY)
    ]);

    // Get top performers
    const [
      topPatients
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_TOP_PATIENTS)
    ]);

    // Get previous period stats for trends
    const previousStats = await query(queries.DASHBOARD.GET_PREVIOUS_PERIOD_STATS);

    // Get recent activity
    const recentActivity = await query(queries.DASHBOARD.GET_RECENT_ACTIVITY);

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
      query(queries.DASHBOARD.GET_PRIOR_AUTH_BY_TYPE_STATUS),
      query(queries.DASHBOARD.GET_PRIOR_AUTH_SUMMARY),
      query(queries.DASHBOARD.GET_PRIOR_AUTH_TRENDS),
      query(queries.DASHBOARD.GET_RECENT_PRIOR_AUTHS)
    ]);

    // Eligibility and coverage
    const [
      eligibilityByInsurer,
      coverageDistribution
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_ELIGIBILITY_BY_INSURER),
      query(queries.DASHBOARD.GET_COVERAGE_DISTRIBUTION)
    ]);

    // Claims pipeline and submissions
    const [
      claimsPipeline,
      claimSubmissionsSummary
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_CLAIMS_PIPELINE),
      query(queries.DASHBOARD.GET_CLAIM_SUBMISSIONS_SUMMARY)
    ]);

    // Enhanced performance metrics
    const [
      providerFullPerformance,
      insurerFullPerformance
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_PROVIDER_FULL_PERFORMANCE),
      query(queries.DASHBOARD.GET_INSURER_FULL_PERFORMANCE)
    ]);

    // Specialty approvals and financial breakdown
    const [
      specialtyApprovals,
      financialBreakdown
    ] = await Promise.all([
      query(queries.DASHBOARD.GET_SPECIALTY_APPROVALS),
      query(queries.DASHBOARD.GET_FINANCIAL_BREAKDOWN)
    ]);

    // Merge daily trends with payment trends
    const dailyDataMap = {};
    dailyTrends.rows.forEach(row => {
      const dateKey = new Date(row.date).toISOString().split('T')[0];
      dailyDataMap[dateKey] = {
        date: dateKey,
        day: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        claims: parseInt(row.claim_count) || 0,
        claimAmount: parseFloat(row.claim_amount) || 0,
        payments: 0,
        paymentAmount: 0
      };
    });

    paymentTrends.rows.forEach(row => {
      const dateKey = new Date(row.date).toISOString().split('T')[0];
      if (dailyDataMap[dateKey]) {
        dailyDataMap[dateKey].payments = parseInt(row.payment_count) || 0;
        dailyDataMap[dateKey].paymentAmount = parseFloat(row.payment_amount) || 0;
      } else {
        dailyDataMap[dateKey] = {
          date: dateKey,
          day: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          claims: 0,
          claimAmount: 0,
          payments: parseInt(row.payment_count) || 0,
          paymentAmount: parseFloat(row.payment_amount) || 0
        };
      }
    });

    const mergedDailyTrends = Object.values(dailyDataMap).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Process prior auth trends
    const priorAuthTrendsMap = {};
    priorAuthTrends.rows.forEach(row => {
      const dateKey = new Date(row.date).toISOString().split('T')[0];
      if (!priorAuthTrendsMap[dateKey]) {
        priorAuthTrendsMap[dateKey] = {
          date: dateKey,
          day: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

    const mergedPriorAuthTrends = Object.values(priorAuthTrendsMap).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate eligibility rate
    const totalEligible = eligibilityByStatus.rows.find(r => r.status === 'eligible')?.count || 0;
    const totalEligibilityChecks = eligibilityByStatus.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const eligibilityRate = totalEligibilityChecks > 0 
      ? Math.round((parseInt(totalEligible) / totalEligibilityChecks) * 100) 
      : 0;

    res.json({
      data: {
        counts: {
          patients: parseInt(patientsCount.rows[0].total),
          providers: parseInt(providersCount.rows[0].total),
          insurers: parseInt(insurersCount.rows[0].total),
          authorizations: parseInt(authorizationsCount.rows[0].total),
          eligibility: parseInt(eligibilityCount.rows[0].total),
          claims: parseInt(claimsCount.rows[0].total),
          claimBatches: parseInt(claimBatchesCount.rows[0].total),
          payments: parseInt(paymentsCount.rows[0].total),
          priorAuthorizations: parseInt(priorAuthsCount.rows[0].total),
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
          monthly: monthlyTrends.rows.map(row => ({
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
      }
    });
  } catch (error) {
    console.error('Error getting comprehensive dashboard statistics:', error);
    res.status(500).json({ error: 'Failed to fetch comprehensive dashboard statistics' });
  }
});

export default router;
