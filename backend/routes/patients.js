import express from 'express';
import patientsController from '../controllers/patientsController.js';

const router = express.Router();

// GET /api/patients - Get all patients with pagination and search
router.get('/', patientsController.getAll.bind(patientsController));

// GET /api/patients/:id - Get patient by ID with related data
router.get('/:id', patientsController.getById.bind(patientsController));

// POST /api/patients - Create new patient
router.post('/', patientsController.create.bind(patientsController));

// PUT /api/patients/:id - Update patient
router.put('/:id', patientsController.update.bind(patientsController));

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', patientsController.delete.bind(patientsController));

export default router;
