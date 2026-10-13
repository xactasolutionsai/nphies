import React, { useState } from 'react';
import api, { extractErrorMessage } from '@/services/api';

const procedureSystem = 'http://nphies.sa/terminology/CodeSystem/procedures';
const diagnosisSystem = 'http://hl7.org/fhir/sid/icd-10-am';
const controls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100';
const fields = [
  ['drg_code', 'رمز AR-DRG من Grouper'], ['drg_description', 'وصف DRG'],
  ['drg_code_system', 'URI نظام ترميز DRG من Grouper'], ['drg_version', 'إصدار AR-DRG'],
  ['drg_grouper_name', 'اسم Grouper المعتمد'], ['drg_grouper_version', 'إصدار برنامج Grouper'],
  ['encounter_start', 'تاريخ ووقت الدخول', 'datetime-local'], ['encounter_end', 'تاريخ ووقت الخروج', 'datetime-local'],
  ['drg_leave_days', 'أيام الإجازة (0 عند عدم وجودها)', 'number'], ['birth_weight', 'وزن الولادة بالجرام — لحديثي الولادة', 'number'],
  ['ventilation_hours', 'إجمالي ساعات التهوية الميكانيكية', 'number'],
];

function localSaudiDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 16) : '';
}

function initialValues(claim) {
  const values = {};
  fields.forEach(([key, , type]) => { values[key] = type === 'datetime-local' ? localSaudiDate(claim[key]) : claim[key] ?? (key === 'drg_version' ? '9.0' : ''); });
  ['discharge_disposition', 'encounter_class', 'drg_ventilation_used', 'drg_no_procedures', 'drg_error_explanation'].forEach(key => { values[key] = claim[key] ?? ''; });
  values.drg_grouper_certified = claim.drg_grouper_certified === true;
  // Explicit confirmation required each time the operator saves a grouping.
  values.drg_mds_confirmed = !['draft', 'error'].includes(claim.status) && claim.drg_mds_confirmed === true;
  values.drg_procedures = (claim.drg_procedures || []).map(p => ({ ...p, date: localSaudiDate(p.date) }));
  return values;
}

export default function ClaimDrgPanel({ claim, onSaved, onDirtyChange }) {
  const [form, setForm] = useState(() => initialValues(claim));
  const [diagnoses, setDiagnoses] = useState(() => (claim.diagnoses || []).map(d => ({ sequence: d.sequence, diagnosis_code: d.diagnosis_code || '', diagnosis_system: d.diagnosis_system || diagnosisSystem, diagnosis_display: d.diagnosis_display || '', diagnosis_type: d.diagnosis_type || 'secondary', on_admission: d.on_admission, condition_onset: d.condition_onset })));
  const [output, setOutput] = useState(() => JSON.stringify(claim.drg_grouper_output || {}, null, 2));
  const [review, setReview] = useState({ justification: '', cds_reviewer: '', coding_reviewer: '' });
  const [validation, setValidation] = useState(claim.drg_validation);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [audit, setAudit] = useState(null);
  const loadAudit = async () => {
    try { setAudit((await api.request(`/claim-submissions/${claim.id}/drg-audit`)).data); }
    catch (failure) { setError(extractErrorMessage(failure)); }
  };
  const editable = ['draft', 'error'].includes(claim.status);
  const changedCode = Boolean(claim.drg_code && form.drg_code !== claim.drg_code);
  const change = (key, value) => {
    onDirtyChange(true);
    setForm(previous => ({ ...previous, [key]: value, ...(key !== 'drg_mds_confirmed' ? { drg_mds_confirmed: false } : {}) }));
    setMessage('');
  };
  const updateDiagnosis = (i, key, value) => {
    onDirtyChange(true);
    setDiagnoses(previous => previous.map((d, index) => index === i ? { ...d, [key]: value } : d));
    setForm(previous => ({ ...previous, drg_mds_confirmed: false }));
  };
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { ...form, drg_grouper_output: JSON.parse(output || '{}'), diagnoses: diagnoses.map(d => ({ ...d })) };
      if (form.encounter_class === 'inpatient') payload.sub_type = 'ip';
      if (form.encounter_class === 'daycase') payload.sub_type = 'daycase';
      if (!payload.drg_grouper_output || Array.isArray(payload.drg_grouper_output) || typeof payload.drg_grouper_output !== 'object') throw new Error('ناتج Grouper يجب أن يكون كائن JSON.');
      fields.forEach(([key, , type]) => {
        if (type === 'number') payload[key] = form[key] === '' ? null : Number(form[key]);
        if (type === 'datetime-local') payload[key] = form[key] ? `${form[key]}:00+03:00` : null;
      });
      ['drg_ventilation_used', 'drg_no_procedures'].forEach(key => { payload[key] = form[key] === '' ? null : form[key] === true || form[key] === 'true'; });
      payload.drg_procedures = form.drg_procedures.map(p => ({ ...p, date: p.date ? `${p.date}:00+03:00` : null }));
      if (changedCode) payload.drg_review = review;
      const response = await api.updateClaimSubmission(claim.id, payload);
      setValidation(response.data.drg_validation);
      onDirtyChange(false);
      onSaved(response.data);
      setMessage(response.data.drg_validation?.valid ? 'حُفظت البيانات واجتاز التحقق من الاكتمال والاتساق.' : 'حُفظت المسودة. استكمل الأخطاء أدناه قبل الإرسال.');
    } catch (failure) { setError(extractErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <section dir="rtl" className="space-y-5 rounded-xl border bg-white p-6">
    <h2 className="text-xl font-bold">بيانات DRG والتحقق من MDS</h2>
    <p className="text-sm text-gray-600">أدخل ناتج Grouper المعتمد وبيانات الحلقة. تستمر المطالبة على أساس FFS أثناء الفوترة الظلية. أوقات هذا النموذج بتوقيت السعودية (UTC+3).</p>
    <div className="rounded-lg bg-gray-50 p-3 text-sm">المريض: {claim.patient_name} · الميلاد: {claim.patient_birth_date || 'غير مسجل'} · الجنس: {claim.patient_gender || 'غير مسجل'}. تُعدّل بيانات الميلاد والجنس من سجل المريض.</div>
    {validation && <div className={`rounded-lg border p-4 ${validation.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`} aria-live="polite">
      <p className="font-semibold">{validation.required ? (validation.valid ? 'البيانات المحفوظة مكتملة ومتسقة' : 'الإرسال محجوب حتى استكمال البيانات المحفوظة') : 'هذه الحلقة خارج نطاق DRG ما لم تكن تنويمًا أو يومًا واحدًا'}</p>
      <p className="mt-2 text-sm">العمر عند الدخول: {validation.ageDays ?? '—'} يوم · مدة الإقامة بعد الإجازة: {validation.lengthOfStayDays ?? '—'} يوم</p>
      <ul className="mt-2 space-y-1 text-sm">{validation.errors.map((issue, i) => <li key={i}>{issue.message} <span className="text-gray-500" dir="ltr">({issue.field})</span></li>)}</ul>
      {validation.warnings?.map((warning, i) => <p key={i} className="mt-2 text-sm text-amber-800">{warning.message}</p>)}
    </div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    <fieldset disabled={!editable || busy} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="block text-sm">نوع اللقاء</span><select className={controls} value={form.encounter_class} onChange={e => change('encounter_class', e.target.value)}><option value="">حدد النوع</option><option value="inpatient">تنويم</option><option value="daycase">يوم واحد</option>{!['inpatient', 'daycase', ''].includes(form.encounter_class) && <option value={form.encounter_class}>{form.encounter_class}</option>}</select></label>
        {fields.map(([key, label, type = 'text']) => <label key={key} className="space-y-1"><span className="block text-sm">{label}</span><input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} maxLength={type === 'text' ? 1000 : undefined} className={controls} dir={type === 'datetime-local' ? 'ltr' : undefined} value={form[key]} onChange={e => change(key, e.target.value)} /></label>)}
        <label className="space-y-1"><span className="block text-sm">حالة الخروج</span><select className={controls} value={form.discharge_disposition} onChange={e => change('discharge_disposition', e.target.value)}><option value="">حدد حالة الخروج</option>{[['home', 'المنزل / أخرى'], ['acute-hospital', 'التحويل إلى مستشفى رعاية حادة'], ['LAMA', 'غادر ضد النصيحة الطبية'], ['died', 'توفي'], ['SDTC', 'خروج إحصائي — تغيير نوع الرعاية'], ['DTRAS', 'خدمة الشيخوخة السكنية'], ['DTPH', 'مستشفى نفسي'], ['DTOHA', 'رعاية صحية أخرى'], ['SDFL', 'خروج إحصائي من إجازة']].map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        <label className="space-y-1"><span className="block text-sm">استخدام التهوية الميكانيكية</span><select className={controls} value={String(form.drg_ventilation_used)} onChange={e => change('drg_ventilation_used', e.target.value)}><option value="">حدد الحالة</option><option value="true">استُخدمت</option><option value="false">لم تُستخدم</option></select></label>
      </div>
      <div className="space-y-3"><h3 className="font-semibold">التشخيص الرئيسي والتشخيصات الإضافية (ICD-10-AM الإصدار العاشر)</h3>
        {diagnoses.map((diagnosis, i) => <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4"><input aria-label={`رمز التشخيص ${i + 1}`} className={controls} value={diagnosis.diagnosis_code} onChange={e => updateDiagnosis(i, 'diagnosis_code', e.target.value.toUpperCase())} placeholder="ICD-10-AM" /><input aria-label={`وصف التشخيص ${i + 1}`} className={controls} value={diagnosis.diagnosis_display} onChange={e => updateDiagnosis(i, 'diagnosis_display', e.target.value)} placeholder="الوصف" /><select aria-label={`نوع التشخيص ${i + 1}`} className={controls} value={diagnosis.diagnosis_type} onChange={e => updateDiagnosis(i, 'diagnosis_type', e.target.value)}><option value="principal">رئيسي</option><option value="secondary">إضافي</option><option value="admitting">دخول</option><option value="discharge">خروج</option></select><button type="button" onClick={() => { onDirtyChange(true); setDiagnoses(previous => previous.filter((_, index) => index !== i).map((d, index) => ({ ...d, sequence: index + 1 }))); change('drg_mds_confirmed', false); }} className="text-red-600">حذف التشخيص</button></div>)}
        <button type="button" className="text-purple-700" onClick={() => { onDirtyChange(true); setDiagnoses(previous => [...previous, { sequence: previous.length + 1, diagnosis_code: '', diagnosis_system: diagnosisSystem, diagnosis_display: '', diagnosis_type: previous.length ? 'secondary' : 'principal' }]); change('drg_mds_confirmed', false); }}>+ إضافة تشخيص</button>
      </div>
      <div className="space-y-3"><h3 className="font-semibold">الإجراءات السريرية — SBS v3</h3>
        <label className="block text-sm">تأكيد وجود الإجراءات<select className={`${controls} mt-1`} value={String(form.drg_no_procedures)} onChange={e => change('drg_no_procedures', e.target.value)}><option value="">حدد الحالة</option><option value="false">توجد إجراءات — مسجلة أدناه</option><option value="true">لا توجد إجراءات خلال الحلقة</option></select></label>
        {form.drg_procedures.map((procedure, i) => <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4"><input aria-label={`رمز الإجراء ${i + 1}`} className={controls} value={procedure.code} onChange={e => change('drg_procedures', form.drg_procedures.map((p, index) => index === i ? { ...p, code: e.target.value } : p))} placeholder="رمز SBS" /><input aria-label={`وصف الإجراء ${i + 1}`} className={controls} value={procedure.display || ''} onChange={e => change('drg_procedures', form.drg_procedures.map((p, index) => index === i ? { ...p, display: e.target.value } : p))} placeholder="الوصف" /><input aria-label={`تاريخ الإجراء ${i + 1}`} type="datetime-local" dir="ltr" className={controls} value={procedure.date} onChange={e => change('drg_procedures', form.drg_procedures.map((p, index) => index === i ? { ...p, date: e.target.value } : p))} /><button type="button" className="text-red-600" onClick={() => change('drg_procedures', form.drg_procedures.filter((_, index) => index !== i))}>حذف الإجراء</button></div>)}
        <button type="button" className="text-purple-700" onClick={() => change('drg_procedures', [...form.drg_procedures, { code: '', display: '', system: procedureSystem, version: '3', date: '' }])}>+ إضافة إجراء</button>
      </div>
      <label className="block space-y-1"><span className="text-sm">تفسير Error DRG (960Z / 961Z / 963Z / 801)</span><textarea rows={2} maxLength={4000} className={controls} value={form.drg_error_explanation} onChange={e => change('drg_error_explanation', e.target.value)} /></label>
      <label className="block space-y-1"><span className="text-sm">ناتج Grouper الكامل (JSON): مفاتيح adrg وmdc وeccs وdcl وerror_flags</span><textarea aria-label="ناتج Grouper JSON" rows={6} dir="ltr" className={`${controls} font-mono text-sm`} value={output} onChange={e => { setOutput(e.target.value); change('drg_mds_confirmed', false); }} /></label>
      {changedCode && <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">مراجعة تغيير رمز DRG المحفوظ</h3>{[['justification', 'التبرير السريري (10 أحرف على الأقل)'], ['cds_reviewer', 'اسم مراجع CDS'], ['coding_reviewer', 'اسم اختصاصي الترميز المراجع']].map(([key, label]) => <label key={key} className="block text-sm">{label}<input className={controls} value={review[key]} onChange={e => { onDirtyChange(true); setReview(previous => ({ ...previous, [key]: e.target.value })); }} /></label>)}<p className="text-sm">يُحفظ التغيير والمراجعة في سجل تدقيق المطالبة.</p></div>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.drg_grouper_certified} onChange={e => change('drg_grouper_certified', e.target.checked)} />أقر بأن الناتج صادر من Grouper معتمد من CHI.</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.drg_mds_confirmed} onChange={e => change('drg_mds_confirmed', e.target.checked)} />راجعت ناتج Grouper وأؤكد مطابقته لبيانات الحلقة الحالية.</label>
      {editable && <button type="button" onClick={save} className="rounded-lg bg-purple-600 px-5 py-2 text-white">{busy ? 'جارٍ الحفظ...' : 'حفظ المسودة والتحقق من البيانات'}</button>}
    </fieldset>
    <div className="border-t pt-4"><button type="button" onClick={loadAudit} className="text-purple-700">عرض / تحديث سجل مراجعات DRG</button>{audit && <div className="mt-3 space-y-2">{audit.length === 0 && <p className="text-sm text-gray-500">لا توجد مراجعات محفوظة.</p>}{audit.map(entry => <div key={entry.id} className="rounded-lg bg-gray-50 p-3 text-sm"><p>{entry.previous_code || 'بدون رمز'} ← {entry.new_code || 'بدون رمز'} · {new Date(entry.created_at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}</p><p>{entry.justification || 'حفظ بيانات الحلقة'} {entry.cds_reviewer && `· CDS: ${entry.cds_reviewer}`} {entry.coding_reviewer && `· اختصاصي الترميز: ${entry.coding_reviewer}`}</p></div>)}</div>}</div>
  </section>;
}
