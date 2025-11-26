import express from 'express';
import eligibilityController from '../controllers/eligibilityController.js';

const router = express.Router();

// GET /api/eligibility - Get all eligibility records with pagination and search
router.get('/', eligibilityController.getAll.bind(eligibilityController));

// GET /api/eligibility/:id - Get eligibility record by ID with full details
router.get('/:id', eligibilityController.getById.bind(eligibilityController));

// POST /api/eligibility - Create new eligibility record
router.post('/', eligibilityController.create.bind(eligibilityController));

// PUT /api/eligibility/:id - Update eligibility record
router.put('/:id', eligibilityController.update.bind(eligibilityController));

// PATCH /api/eligibility/:id/status - Update eligibility status
router.patch('/:id/status', eligibilityController.updateStatus.bind(eligibilityController));

// DELETE /api/eligibility/:id - Delete eligibility record
router.delete('/:id', eligibilityController.delete.bind(eligibilityController));

// POST /api/eligibility/check-nphies - Check eligibility with NPHIES
router.post('/check-nphies', eligibilityController.checkNphiesEligibility.bind(eligibilityController));

// POST /api/eligibility/check-nphies-direct - Send example bundle directly to NPHIES (testing)
router.post('/check-nphies-direct', eligibilityController.checkNphiesExampleDirect.bind(eligibilityController));

// POST /api/eligibility/check-dynamic - Check eligibility with dynamic data (form input or IDs)
router.post('/check-dynamic', eligibilityController.checkDynamicEligibility.bind(eligibilityController));

// POST /api/eligibility/preview - Preview the FHIR bundle without sending to NPHIES
router.post('/preview', eligibilityController.previewEligibilityRequest.bind(eligibilityController));

// GET /api/eligibility/:id/nphies-details - Get full NPHIES details with FHIR data
router.get('/:id/nphies-details', eligibilityController.getNphiesDetails.bind(eligibilityController));

// GET /api/eligibility/patient/:patientId/coverages - Get patient coverages
router.get('/patient/:patientId/coverages', eligibilityController.getPatientCoverages.bind(eligibilityController));

export default router;
