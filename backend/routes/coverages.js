import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/coverages - Get all coverages with pagination
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search = '' } = req.query;

    let queryText = `
      SELECT 
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
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      queryText += ` WHERE pc.policy_number ILIKE $${paramIndex} 
        OR pc.member_id ILIKE $${paramIndex}
        OR pc.plan_name ILIKE $${paramIndex}
        OR p.name ILIKE $${paramIndex}
        OR i.insurer_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ` ORDER BY pc.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM patient_coverage pc';
    const countParams = [];
    
    if (search) {
      countQuery += ` LEFT JOIN patients p ON pc.patient_id = p.patient_id
        LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
        WHERE pc.policy_number ILIKE $1 
        OR pc.member_id ILIKE $1
        OR pc.plan_name ILIKE $1
        OR p.name ILIKE $1
        OR i.insurer_name ILIKE $1`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching coverages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coverages',
      message: error.message
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
      error: 'Failed to fetch coverage',
      message: error.message
    });
  }
});

export default router;

