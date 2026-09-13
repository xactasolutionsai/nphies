import { query } from '../db.js';

export async function getSelectedCoverage(patientId, insurerId, coverageId) {
  if (!coverageId) return null;
  const result = await query(`
    SELECT pc.*, i.insurer_name, i.nphies_id AS insurer_nphies_id
    FROM patient_coverage pc LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
    WHERE pc.coverage_id = $1 AND pc.patient_id = $2 AND pc.insurer_id = $3
  `, [coverageId, patientId, insurerId]);
  if (!result.rows[0]) {
    const error = new Error('Selected coverage does not belong to this patient and insurer');
    error.status = 400;
    throw error;
  }
  return result.rows[0];
}

export async function persistCoverageInput(value, existing = {}) {
  if (!Object.hasOwn(value, 'coverage_id')) {
    // A patient/insurer edit cannot leave a previously selected policy attached
    // to a different person or payer.
    if (existing.coverage_id && (Object.hasOwn(value, 'patient_id') || Object.hasOwn(value, 'insurer_id'))) {
      await getSelectedCoverage(value.patient_id ?? existing.patient_id,
        value.insurer_id ?? existing.insurer_id, existing.coverage_id);
    }
    return;
  }
  if (value.coverage_id) {
    await getSelectedCoverage(value.patient_id ?? existing.patient_id,
      value.insurer_id ?? existing.insurer_id, value.coverage_id);
  }
  // Keep the legacy integer column intact for historical data.
  value.selected_coverage_id = value.coverage_id || null;
  delete value.coverage_id;
}
