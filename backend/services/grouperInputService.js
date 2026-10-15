import { validateDrg, requiresDrg, drgFingerprint, DIAGNOSIS_SYSTEM } from './drgValidation.js';

// Internal interchange format, NOT a CHI or vendor API contract.
// No network calls, certification assertion, DRG assignment or claim mutation.
export function buildGrouperInput(claim) {
  const validation = validateDrg(claim);
  const errors = validation.errors.filter(e => e.code.startsWith('MDS_') || e.code === 'DRG_CLAIM_TYPE');
  if (!requiresDrg(claim)) errors.push({code:'GROUPER_SCOPE',field:'encounter_class',message:'تجهيز Grouper متاح للتنويم وحالات اليوم الواحد فقط.'});
  if (errors.length) throw Object.assign(new Error('استكمل بيانات MDS المحفوظة قبل تجهيز مدخلات Grouper.'), {status:422,validation:{valid:false,errors}});
  return {
    schema: 'nafes.grouper-input', schemaVersion: 1,
    integrationStatus: 'not_configured', externalDataSent: false,
    classification: {system:'AR-DRG',version:'9.0',diagnosisEdition:'ICD-10-AM 10th Edition',procedureEdition:'SBS v3'},
    source: {mdsFingerprint:drgFingerprint(claim),updatedAt:claim.updated_at || null},
    episode: {
      birthDate:claim.patient_birth_date, ageAtAdmissionDays:validation.ageDays, sex:claim.patient_gender,
      encounterType:['daycase','SS'].includes(claim.encounter_class)?'daycase':'inpatient',
      admission:claim.encounter_start,discharge:claim.encounter_end,dischargeDisposition:claim.discharge_disposition,
      leaveDays:Number(claim.drg_leave_days),lengthOfStayDays:validation.lengthOfStayDays,
      birthWeightGrams:claim.birth_weight == null ? null : Number(claim.birth_weight),
      ventilationUsed:claim.drg_ventilation_used,ventilationHours:claim.ventilation_hours == null ? null : Number(claim.ventilation_hours),
      noProcedures:claim.drg_no_procedures,
      diagnoses:(claim.diagnoses || []).map(d=>({sequence:d.sequence,code:d.diagnosis_code,system:d.diagnosis_system || DIAGNOSIS_SYSTEM,type:d.diagnosis_type,onAdmission:d.on_admission ?? null,conditionOnset:d.condition_onset ?? null})),
      procedures:(claim.drg_procedures || []).map(p=>({code:p.code,system:p.system,version:p.version,date:p.date}))
    }
  };
}
