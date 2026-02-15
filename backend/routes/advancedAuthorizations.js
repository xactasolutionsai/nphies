import express from 'express';
import advancedAuthorizationsController from '../controllers/advancedAuthorizationsController.js';

const router = express.Router();

/**
 * Advanced Authorization Routes
 * 
 * GET    /api/advanced-authorizations              - List all with pagination/filters
 * GET    /api/advanced-authorizations/poll/preview  - Preview poll bundle (without sending)
 * POST   /api/advanced-authorizations/poll          - Poll NPHIES for new APAs
 * GET    /api/advanced-authorizations/:id           - Get by ID with full details
 * GET    /api/advanced-authorizations/:id/download  - Download raw JSON
 * DELETE /api/advanced-authorizations/:id           - Delete record
 */

// Poll preview and poll (must be before :id route to avoid conflict)
router.get('/poll/preview', (req, res) => advancedAuthorizationsController.previewPollBundle(req, res));
router.post('/poll', (req, res) => advancedAuthorizationsController.poll(req, res));

// CRUD operations
router.get('/', (req, res) => advancedAuthorizationsController.getAll(req, res));
router.get('/:id', (req, res) => advancedAuthorizationsController.getById(req, res));
router.get('/:id/download', (req, res) => advancedAuthorizationsController.downloadJson(req, res));
router.delete('/:id', (req, res) => advancedAuthorizationsController.delete(req, res));

export default router;
