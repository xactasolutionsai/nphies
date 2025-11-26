/**
 * NPHIES Codes Routes
 * API endpoints for NPHIES code lookups
 */

import { Router } from 'express';
import nphiesCodesController from '../controllers/nphiesCodesController.js';

const router = Router();

// Get all code systems
router.get('/systems', (req, res) => nphiesCodesController.getCodeSystems(req, res));

// Refresh cache
router.post('/refresh', (req, res) => nphiesCodesController.refreshCache(req, res));

// Bulk lookup
router.post('/lookup', (req, res) => nphiesCodesController.bulkLookup(req, res));

// Convenience endpoints for common code systems
router.get('/benefit-categories', (req, res) => nphiesCodesController.getBenefitCategories(req, res));
router.get('/coverage-types', (req, res) => nphiesCodesController.getCoverageTypes(req, res));
router.get('/identifier-types', (req, res) => nphiesCodesController.getIdentifierTypes(req, res));
router.get('/provider-types', (req, res) => nphiesCodesController.getProviderTypes(req, res));
router.get('/relationships', (req, res) => nphiesCodesController.getRelationships(req, res));

// Get codes by system
router.get('/:systemCode', (req, res) => nphiesCodesController.getCodesBySystem(req, res));

// Get specific code display
router.get('/:systemCode/:code', (req, res) => nphiesCodesController.getCodeDisplay(req, res));

export default router;

