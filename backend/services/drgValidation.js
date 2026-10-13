// CHI Implementation Guideline v1.0 sections 3.4, 4.3, 5 and 6.
// Completeness/consistency checks, not clinical grouping or code-catalog certification.
import { createHash } from 'node:crypto';
export const DRG_ERROR_CODES = new Set(['960Z', '961Z', '963Z', '801', '801A', '801B', '801C']);
export const DISCHARGE_CODES = ['LAMA', 'home', 'acute-hospital', 'SDTC', 'died', 'DTRAS', 'DTPH', 'DTOHA', 'SDFL'];
export const PROCEDURE_SYSTEM = 'http://nphies.sa/terminology/CodeSystem/procedures';
export const DIAGNOSIS_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-am';
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const number = value => present(value) && Number.isFinite(Number(value)) ? Number(value) : null;
const instant = value => present(value) && Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : null;

export function drgFingerprint(claim, patient = {}) {
  const canonical = {
    birth: instant(patient.birth_date || claim.patient_birth_date), sex: patient.gender || claim.patient_gender || null,
    patient: claim.patient_id, admission: instant(claim.encounter_start), discharge: instant(claim.encounter_end),
    encounter: claim.encounter_class, disposition: claim.discharge_disposition,
    birthWeight: number(claim.birth_weight), ventilation: number(claim.ventilation_hours), leave: number(claim.drg_leave_days),
    ventilationUsed: claim.drg_ventilation_used, noProcedures: claim.drg_no_procedures,
    diagnoses: (claim.diagnoses || []).map(d => ({ sequence: Number(d.sequence), code: d.diagnosis_code, system: d.diagnosis_system || DIAGNOSIS_SYSTEM, type: d.diagnosis_type, onAdmission: d.on_admission ?? null, onset: d.condition_onset || 'NR' })),
    procedures: (claim.drg_procedures || []).map(p => ({ code: p.code, system: p.system, version: p.version, date: instant(p.date) })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function requiresDrg(claim) {
  return ['inpatient', 'daycase', 'IMP', 'SS'].includes(claim.encounter_class) || ['ip', 'daycase'].includes(claim.sub_type);
}

export function validateDrg(claim, patient = {}) {
  const required = requiresDrg(claim);
  const errors = [];
  const warnings = [];
  let ageDays = null;
  let lengthOfStayDays = null;
  const add = (field, code, message) => errors.push({ field, code, message });
  if (!required && !present(claim.drg_code)) return { required, valid: true, errors, warnings, ageDays, lengthOfStayDays };
  if (!required) add('encounter_class', 'DRG_SCOPE', 'DRG خاص بالتنويم وحالات اليوم الواحد.');
  if (claim.claim_type !== 'institutional') add('claim_type', 'DRG_CLAIM_TYPE', 'مطالبات DRG تتطلب نوع Institutional.');
  if (!['inpatient', 'daycase', 'IMP', 'SS'].includes(claim.encounter_class)) add('encounter_class', 'MDS_ENCOUNTER', 'حدد نوع اللقاء: تنويم أو حالة يوم واحد.');
  if (!/^(?:[A-Z]\d{2}[A-Z]|\d{3}[A-Z]?)$/.test(claim.drg_code || '')) add('drg_code', 'DRG_CODE', 'أدخل رمز AR-DRG الصادر من Grouper.');
  if (!present(claim.drg_description)) add('drg_description', 'DRG_DESCRIPTION', 'وصف AR-DRG إلزامي.');
  if (claim.drg_version !== '9.0') add('drg_version', 'DRG_VERSION', 'الإصدار المطلوب هو AR-DRG v9.0.');
  if (!/^https?:\/\/\S+$/.test(claim.drg_code_system || '')) add('drg_code_system', 'DRG_SYSTEM', 'أدخل URI نظام ترميز DRG المعتمد من مصدر Grouper.');
  if (!present(claim.drg_grouper_name) || !present(claim.drg_grouper_version)) add('drg_grouper_name', 'DRG_SOURCE', 'اسم وإصدار برنامج Grouper مطلوبان لتوثيق مصدر الإسناد.');
  if (claim.drg_grouper_certified !== true) add('drg_grouper_certified', 'DRG_CERTIFICATION', 'أكد أن الناتج صادر من Grouper معتمد من CHI.');
  if (claim.drg_mds_confirmed !== true) add('drg_mds_confirmed', 'DRG_MDS_REVIEW', 'أكد أن ناتج Grouper مطابق لبيانات الحلقة الحالية.');
  else if (claim.drg_mds_fingerprint !== drgFingerprint(claim, patient)) add('drg_mds_confirmed', 'DRG_MDS_CHANGED', 'بيانات الحلقة أو سجل المريض تغيرت منذ المراجعة؛ أعد التحقق من ناتج Grouper واحفظ تأكيدًا جديدًا.');
  const output = claim.drg_grouper_output;
  if (!output || typeof output !== 'object' || Array.isArray(output) || !['adrg', 'mdc', 'eccs', 'dcl', 'error_flags'].every(key => Object.hasOwn(output, key))) add('drg_grouper_output', 'DRG_OUTPUT', 'أرفق ناتج Grouper الكامل بمفاتيح adrg وmdc وeccs وdcl وerror_flags.');
  else {
    if (!Array.isArray(output.dcl) || !Array.isArray(output.error_flags)) add('drg_grouper_output', 'DRG_OUTPUT_ARRAYS', 'dcl وerror_flags يجب أن تكونا قائمتين في ناتج Grouper.');
    if (!DRG_ERROR_CODES.has(claim.drg_code) && (!present(output.adrg) || number(output.mdc) === null || Number(output.mdc) < 0 || Number(output.mdc) > 23 || number(output.eccs) === null || Number(output.eccs) < 0)) add('drg_grouper_output', 'DRG_OUTPUT_VALUES', 'ناتج الحلقة المصنفة يتطلب ADRG وMDC من 0 إلى 23 وECCS غير سالب.');
  }
  if (DRG_ERROR_CODES.has(claim.drg_code)) {
    if (!present(claim.drg_error_explanation)) add('drg_error_explanation', 'DRG_ERROR_FLAG', 'رمز Error DRG يتطلب تفسيرًا موثقًا قبل الإرسال.');
    warnings.push({ field: 'drg_code', code: 'DRG_GROUPING_ERROR', message: 'هذه الحلقة تحمل خطأ تصنيف؛ يلزم مراجعة الترميز والبيانات حتى عند وجود تفسير.' });
  }
  const diagnoses = Array.isArray(claim.diagnoses) ? claim.diagnoses : [];
  if (diagnoses.filter(d => d.diagnosis_type === 'principal').length !== 1) add('diagnoses', 'MDS_PRINCIPAL', 'يجب تحديد تشخيص رئيسي واحد فقط.');
  const sequences = new Set();
  diagnoses.forEach((diagnosis, i) => {
    if (!/^[A-Z]\d{2}(?:\.[A-Z0-9]{1,4})?$/.test(diagnosis.diagnosis_code || '') || (diagnosis.diagnosis_system && diagnosis.diagnosis_system !== DIAGNOSIS_SYSTEM)) add(`diagnoses.${i}`, 'MDS_DIAGNOSIS', 'التشخيص يجب أن يستخدم رمز ICD-10-AM ونظامه الصحيح.');
    if (!['principal', 'secondary', 'admitting', 'discharge'].includes(diagnosis.diagnosis_type)) add(`diagnoses.${i}.diagnosis_type`, 'MDS_DIAGNOSIS_TYPE', 'حدد نوع كل تشخيص بوضوح.');
    if (!Number.isInteger(Number(diagnosis.sequence)) || Number(diagnosis.sequence) < 1 || sequences.has(Number(diagnosis.sequence))) add(`diagnoses.${i}.sequence`, 'MDS_DIAGNOSIS_SEQUENCE', 'تسلسل التشخيصات يجب أن يكون موجبًا وغير مكرر.');
    sequences.add(Number(diagnosis.sequence));
  });
  const admission = instant(claim.encounter_start);
  const discharge = instant(claim.encounter_end);
  const birth = instant(patient.birth_date || claim.patient_birth_date);
  if (admission === null) add('encounter_start', 'MDS_ADMISSION', 'تاريخ ووقت الدخول مطلوبان.');
  if (discharge === null) add('encounter_end', 'MDS_DISCHARGE', 'تاريخ ووقت الخروج مطلوبان قبل إرسال المطالبة.');
  if (admission !== null && discharge !== null) {
    if (discharge < admission) add('encounter_end', 'MDS_DATE_ORDER', 'الخروج لا يمكن أن يسبق الدخول.');
    else {
      // Saudi calendar days, including same-day episodes; leave days reduce LOS.
      const saudiDay = time => Math.floor((time + 3 * 3600000) / 86400000);
      const days = saudiDay(discharge) - saudiDay(admission);
      const leave = number(claim.drg_leave_days);
      if (leave === null || !Number.isInteger(leave) || leave < 0 || leave > days) add('drg_leave_days', 'MDS_LEAVE', 'سجل أيام الإجازة كعدد صحيح بين صفر ومدة الإقامة.');
      else lengthOfStayDays = days - leave;
      if (['daycase', 'SS'].includes(claim.encounter_class) && days !== 0) add('encounter_end', 'MDS_SAME_DAY', 'حالة اليوم الواحد يجب أن تبدأ وتنتهي في اليوم نفسه بتوقيت السعودية.');
    }
  }
  if (birth === null || (admission !== null && birth > admission)) add('patient_birth_date', 'MDS_AGE', 'تاريخ ميلاد صحيح لا يتجاوز تاريخ الدخول مطلوب لحساب العمر عند الدخول.');
  else if (admission !== null) ageDays = Math.floor((admission - birth) / 86400000);
  if (!['male', 'female'].includes(patient.gender || claim.patient_gender)) add('patient_gender', 'MDS_SEX', 'الجنس مطلوب للتصنيف؛ استكمل سجل المريض.');
  if (!DISCHARGE_CODES.includes(claim.discharge_disposition)) add('discharge_disposition', 'MDS_DISPOSITION', 'حدد حالة خروج فعلية من قائمة نفيس.');
  const hasClinicalAttachment = (claim.attachments || []).some(a => ['application/pdf', 'image/jpeg'].includes(a.content_type) && present(a.base64_content)) || (claim.supporting_info || []).some(s => s.category === 'attachment' && ['application/pdf', 'image/jpeg'].includes(s.value_attachment?.contentType) && present(s.value_attachment?.data));
  if (!hasClinicalAttachment) add('attachments', 'DRG_ATTACHMENT', 'أرفق مستند الحالة بصيغة PDF أو JPEG في تبويب Clinical قبل الإرسال.');
  if ((ageDays !== null && ageDays <= 28) || claim.is_newborn === true) {
    if (!(number(claim.birth_weight) > 0)) add('birth_weight', 'MDS_BIRTH_WEIGHT', 'وزن الولادة بالجرام إلزامي لحديثي الولادة.');
  }
  const ventilation = number(claim.ventilation_hours);
  if (claim.drg_ventilation_used === null || claim.drg_ventilation_used === undefined) add('drg_ventilation_used', 'MDS_VENTILATION_STATUS', 'حدد ما إذا استُخدمت التهوية الميكانيكية.');
  else if (claim.drg_ventilation_used === true && !(ventilation > 0)) add('ventilation_hours', 'MDS_VENTILATION', 'أدخل إجمالي ساعات التهوية الميكانيكية الموثقة.');
  else if (claim.drg_ventilation_used === false && ventilation !== null && ventilation !== 0) add('ventilation_hours', 'MDS_VENTILATION_CONFLICT', 'ساعات التهوية لا تتوافق مع اختيار عدم استخدام التهوية.');
  const procedures = Array.isArray(claim.drg_procedures) ? claim.drg_procedures : [];
  if (!procedures.length && claim.drg_no_procedures !== true) add('drg_procedures', 'MDS_PROCEDURES', 'سجل الإجراءات أو أكد عدم وجود إجراءات خلال الحلقة.');
  if (procedures.length && claim.drg_no_procedures === true) add('drg_no_procedures', 'MDS_PROCEDURES_CONFLICT', 'لا يمكن تأكيد عدم وجود إجراءات مع وجود إجراءات مسجلة.');
  procedures.forEach((procedure, i) => {
    if (!present(procedure.code) || procedure.system !== PROCEDURE_SYSTEM || procedure.version !== '3') add(`drg_procedures.${i}`, 'MDS_PROCEDURE_CODE', 'كل إجراء يتطلب رمز SBS v3 ونظام الترميز الصحيح.');
    const date = instant(procedure.date);
    if (date === null || (admission !== null && date < admission) || (discharge !== null && date > discharge)) add(`drg_procedures.${i}.date`, 'MDS_PROCEDURE_DATE', 'تاريخ الإجراء مطلوب ويجب أن يكون ضمن فترة الدخول والخروج.');
  });
  warnings.push({ field: 'drg_code', code: 'DRG_CLINICAL_REVIEW', message: 'التحقق هنا من اكتمال البيانات واتساقها؛ صلاحية الرموز الدقيقة والتطابق السريري تعتمد على Grouper المعتمد ومراجعة المرمز.' });
  return { required, valid: errors.length === 0, errors, warnings, ageDays, lengthOfStayDays };
}

export function assertDrgReady(claim, patient) {
  const validation = validateDrg(claim, patient);
  if (!validation.valid) {
    const error = new Error('استكمل متطلبات DRG وMDS قبل الإرسال: ' + validation.errors.map(e => e.message).join(' '));
    error.status = 422;
    error.validation = validation;
    throw error;
  }
  return validation;
}

// The sandbox accepts PDF/JPEG attachments, not application/json. Preserve the
// structured grouping payload as textual supporting information instead.
// No invented NPHIES extension/category or alternative payment amount is introduced.
export function applyDrgToBundle(bundle, claim, patient) {
  if (!requiresDrg(claim) || !present(claim.drg_code)) return bundle;
  const resource = bundle.entry?.find(e => e.resource?.resourceType === 'Claim')?.resource;
  if (!resource) return bundle;
  // Sandbox BV-01198: package flags are forbidden for admitted DRG claims,
  // including the false flag that the legacy institutional mapper emits.
  const stripPackageFlag = item => {
    if (item.extension) {
      item.extension = item.extension.filter(extension => extension.url !== 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package');
      if (!item.extension.length) delete item.extension;
    }
    for (const detail of item.detail || []) stripPackageFlag(detail);
    for (const detail of item.subDetail || []) stripPackageFlag(detail);
  };
  for (const item of resource.item || []) stripPackageFlag(item);
  const principal = resource.diagnosis?.find(d => d.type?.some(t => t.coding?.some(c => c.code === 'principal')));
  if (principal) principal.packageCode = { coding: [{ system: claim.drg_code_system, version: claim.drg_version, code: claim.drg_code, display: claim.drg_description }] };
  if (claim.drg_procedures?.length) resource.procedure = claim.drg_procedures.map((p, i) => ({ sequence: i + 1, date: p.date, procedureCodeableConcept: { coding: [{ system: p.system, version: p.version, code: p.code, ...(p.display ? { display: p.display } : {}) }] } }));
  const validation = validateDrg(claim, patient);
  const payload = {
    schemaVersion: 1, phase: 'shadow-billing',
    drg: { code: claim.drg_code, description: claim.drg_description, system: claim.drg_code_system, version: claim.drg_version, grouperName: claim.drg_grouper_name, grouperVersion: claim.drg_grouper_version, certifiedSourceDeclared: claim.drg_grouper_certified, output: claim.drg_grouper_output || {}, errorExplanation: claim.drg_error_explanation || null },
    mds: { diagnoses: claim.diagnoses, procedures: claim.drg_procedures || [], noProcedures: claim.drg_no_procedures, ageAtAdmissionDays: validation.ageDays, sex: patient.gender || claim.patient_gender, admission: claim.encounter_start, discharge: claim.encounter_end, dischargeDisposition: claim.discharge_disposition, birthWeightGrams: claim.birth_weight || null, ventilationUsed: claim.drg_ventilation_used, ventilationHours: claim.ventilation_hours ?? null, encounterType: claim.encounter_class, leaveDays: claim.drg_leave_days, lengthOfStayDays: validation.lengthOfStayDays },
  };
  const supportingInfo = resource.supportingInfo || (resource.supportingInfo = []);
  supportingInfo.push({ sequence: Math.max(0, ...supportingInfo.map(s => s.sequence)) + 1, category: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category', code: 'info' }] }, valueString: JSON.stringify(payload) });
  for (const info of supportingInfo) {
    if (info.valueAttachment && !info.valueAttachment.creation) info.valueAttachment.creation = new Date(claim.encounter_end || bundle.timestamp).toISOString().slice(0, 10);
  }
  // Neonatal weight must be present even if legacy is_newborn was not selected.
  if (validation.ageDays !== null && validation.ageDays <= 28 && Number(claim.birth_weight) > 0 && !supportingInfo.some(s => s.category?.coding?.some(c => c.code === 'birth-weight'))) supportingInfo.push({ sequence: Math.max(...supportingInfo.map(s => s.sequence)) + 1, category: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category', code: 'birth-weight' }] }, valueQuantity: { value: Number(claim.birth_weight) / 1000, system: 'http://unitsofmeasure.org', code: 'kg', unit: 'kg' } });
  if (claim.drg_ventilation_used === true && Number(claim.ventilation_hours) > 0 && !supportingInfo.some(s => s.category?.coding?.some(c => c.code === 'ventilation-hours'))) supportingInfo.push({ sequence: Math.max(...supportingInfo.map(s => s.sequence)) + 1, category: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category', code: 'ventilation-hours' }] }, valueQuantity: { value: Number(claim.ventilation_hours), system: 'http://unitsofmeasure.org', code: 'h', unit: 'hours' } });
  return bundle;
}
