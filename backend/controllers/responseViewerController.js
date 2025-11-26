import { query } from '../db.js';

class ResponseViewerController {
  // Get all claims for ResponseViewer
  async getClaims(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Simple query without complex parameter binding
      const dataQuery = `
        SELECT
          c.*,
          p.name as patient_name,
          pr.provider_name as provider_name,
          i.insurer_name as insurer_name
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        LEFT JOIN providers pr ON c.provider_id = pr.provider_id
        LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
        ORDER BY c.submission_date DESC 
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        LEFT JOIN providers pr ON c.provider_id = pr.provider_id
        LEFT JOIN insurers i ON c.insurer_id = i.insurer_id
      `;

      const [dataResult, countResult] = await Promise.all([
        query(dataQuery, [limit, offset]),
        query(countQuery, [])
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting claims for ResponseViewer:', error);
      res.status(500).json({ error: 'Failed to fetch claims' });
    }
  }

  // Get all authorizations for ResponseViewer
  async getAuthorizations(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const dataQuery = `
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
        ORDER BY a.auth_id DESC 
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM authorizations a
        LEFT JOIN patients p ON a.patient_id = p.patient_id
        LEFT JOIN providers pr ON a.provider_id = pr.provider_id
        LEFT JOIN insurers i ON a.insurer_id = i.insurer_id
      `;

      const [dataResult, countResult] = await Promise.all([
        query(dataQuery, [limit, offset]),
        query(countQuery, [])
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting authorizations for ResponseViewer:', error);
      res.status(500).json({ error: 'Failed to fetch authorizations' });
    }
  }

  // Get all eligibility for ResponseViewer
  async getEligibility(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const dataQuery = `
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
        ORDER BY e.eligibility_id DESC 
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM eligibility e
        LEFT JOIN patients p ON e.patient_id = p.patient_id
        LEFT JOIN providers pr ON e.provider_id = pr.provider_id
        LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
      `;

      const [dataResult, countResult] = await Promise.all([
        query(dataQuery, [limit, offset]),
        query(countQuery, [])
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting eligibility for ResponseViewer:', error);
      res.status(500).json({ error: 'Failed to fetch eligibility' });
    }
  }

  // Get all payments for ResponseViewer
  async getPayments(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const dataQuery = `
        SELECT
          p.*,
          p.payment_ref as payment_ref_number,
          p.amount as total_amount,
          i.insurer_name as insurer_name,
          pr.provider_name as provider_name
        FROM payments p
        LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
        LEFT JOIN providers pr ON p.provider_id = pr.provider_id
        ORDER BY p.payment_date DESC 
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM payments p
        LEFT JOIN insurers i ON p.insurer_id = i.insurer_id
        LEFT JOIN providers pr ON p.provider_id = pr.provider_id
      `;

      const [dataResult, countResult] = await Promise.all([
        query(dataQuery, [limit, offset]),
        query(countQuery, [])
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting payments for ResponseViewer:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
}

export default new ResponseViewerController();
