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

export default router;
