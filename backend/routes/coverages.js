import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/coverages - Get all coverages with pagination
router.get('/', async (req, res) => {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
    const search = typeof req.query.search === 'string' ? req.query.search : '';

    const params = [];
    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE pc.policy_number ILIKE $1
        OR pc.member_id ILIKE $1
        OR pc.plan_name ILIKE $1
        OR p.name ILIKE $1
        OR i.insurer_name ILIKE $1`;
    }

    // Use DISTINCT ON to remove duplicates based on policy_number + insurer_id + plan_name.
    // The count is taken over the same de-duplicated set so total/hasMore are correct.
    const dedupedQuery = `
      SELECT DISTINCT ON (COALESCE(pc.policy_number, pc.member_id), pc.insurer_id, pc.plan_name)
        pc.coverage_id,
        pc.patient_id,
        pc.insurer_id,
        pc.policy_number,
        pc.member_id,
        pc.coverage_type,
        pc.relationship,
        pc.dependent_number,
        pc.plan_name,
        pc.network_type,
        pc.start_date,
        pc.end_date,
        pc.is_active,
        pc.created_at,
        pc.updated_at,
        p.name as patient_name,
        p.identifier as patient_identifier,
        i.insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM patient_coverage pc
      LEFT JOIN patients p ON pc.patient_id = p.patient_id
      LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
      ${whereClause}
      ORDER BY COALESCE(pc.policy_number, pc.member_id), pc.insurer_id, pc.plan_name, pc.created_at DESC
    `;

    const result = await query(
      `${dedupedQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countResult = await query(`SELECT COUNT(*) FROM (${dedupedQuery}) deduped`, params);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching coverages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coverages'
    });
  }
});

// GET /api/coverages/:id - Get coverage by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        pc.*,
        p.name as patient_name,
        p.identifier as patient_identifier,
        i.insurer_name,
        i.nphies_id as insurer_nphies_id
      FROM patient_coverage pc
      LEFT JOIN patients p ON pc.patient_id = p.patient_id
      LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
      WHERE pc.coverage_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Coverage not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching coverage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coverage'
    });
  }
});

export default router;

