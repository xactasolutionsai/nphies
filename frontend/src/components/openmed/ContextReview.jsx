import React, { useEffect, useMemo, useState } from 'react';

// Clinical context of an OpenMed analysis (backend/clinical-context) and its versioned
// human review. Negated, family and uncertain mentions are never shown as patient findings.

const LABELS = {
  assertion: { present: 'مذكور كموجود', absent: 'منفي / مستبعد', possible: 'محتمل', conditional: 'مشروط', unknown: 'غير محدد' },
  experiencer: { patient: 'المريض', family: 'أحد أفراد العائلة', other: 'شخص آخر', unknown: 'غير محدد' },
  temporality: { current: 'حالي', historical: 'سابق', future: 'مستقبلي / مخطط', unknown: 'غير محدد' },
  medication_status: { current: 'حالي', discontinued: 'موقوف', proposed: 'مقترح', historical: 'سابق', unknown: 'غير محدد' },
  type: { problem: 'حالة / مرض', medication: 'دواء', allergy: 'حساسية', procedure: 'إجراء', not_an_entity: 'ليس كياناً' }
};
const REASONS = {
  conflicting_mentions: 'ذُكر بصيغتين متعارضتين في النص',
  context_not_determined: 'تعذر تحديد السياق',
  dose_without_unit: 'جرعة بلا وحدة',
  medication_status_unknown: 'حالة الدواء غير مذكورة'
};
const reasonLabel = r => REASONS[r] || (r.startsWith('competing_') ? 'قواعد متعارضة' : r);
const SECTIONS = [
  ['patient_problems_present', 'مذكور كموجود لدى المريض (حالي)'],
  ['patient_history', 'تاريخ مرضي للمريض'],
  ['absent_or_excluded', 'منفي أو مستبعد'],
  ['possible_or_conditional', 'محتمل أو مشروط'],
  ['family_history', 'تاريخ عائلي — ليس تشخيصاً للمريض'],
  ['other_person', 'يخص شخصاً آخر'],
  ['current_medications', 'أدوية حالية مذكورة'],
  ['allergies', 'حساسية مذكورة (غير موثقة)'],
  ['needs_review', 'يحتاج مراجعة بشرية']
];
const EDITABLE = ['assertion', 'experiencer', 'temporality', 'medication_status'];

function currentValue(entity, field) {
  return field === 'medication_status' ? entity.medication?.status : entity[field];
}

export default function ContextReview({ analysis, request, busy, onReviewed }) {
  const context = analysis.result?.context;
  const [edits, setEdits] = useState({});
  const [note, setNote] = useState(analysis.review_note || '');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setEdits({}); setNote(analysis.review_note || ''); setError('');
    request(`/analyses/${analysis.id}/reviews`).then(r => { if (active) setHistory(r.data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [analysis.id]);

  const corrections = useMemo(() => Object.entries(edits).flatMap(([index, fields]) =>
    Object.entries(fields).filter(([field, value]) => value !== currentValue(context.entities[index], field))
      .map(([field, value]) => ({ entity_index: Number(index), field, value }))), [edits, context]);

  if (!context || context.status !== 'ok') {
    return <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
      تعذر تحديد سياق النص آلياً ({context?.reason || 'غير متاح'}). راجع النص يدوياً ولا تعتمد على الكيانات المستخرجة.
    </p>;
  }

  async function submit(decision) {
    setError('');
    try {
      const body = { decision, note, ...(decision === 'corrected' ? { corrections } : {}) };
      const saved = await request(`/analyses/${analysis.id}/reviews`, { method: 'POST', body: JSON.stringify(body) });
      setHistory(previous => [...previous, saved]);
      setEdits({});
      onReviewed(saved);
    } catch (e) { setError(e.message); }
  }

  const byIndex = i => context.entities[i];
  return <div className="space-y-4">
    <p className="text-sm text-gray-600">{context.notice}</p>
    <p className="text-xs text-gray-500">محرك السياق: {context.engine.name} {context.engine.version} · قواعد حتمية للإنجليزية فقط</p>
    <div className="grid gap-3 md:grid-cols-2">
      {SECTIONS.map(([key, title]) => context.summary[key]?.length ? <div key={key} className="rounded-lg border p-3">
        <h3 className="font-semibold">{title}</h3>
        <ul className="mt-1 list-disc pr-5 text-sm">{context.summary[key].map(item => <li key={item.index} dir="auto">
          {item.text}{item.status ? ` · ${LABELS.medication_status[item.status]}` : ''}
          {item.reasons ? ` · ${item.reasons.map(reasonLabel).join('، ')}` : ''}</li>)}</ul>
      </div> : null)}
    </div>
    {context.conflicts.length > 0 && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
      تعارض في النص: {context.conflicts.map(c => c.entity_indexes.map(i => byIndex(i).text).join(' / ')).join('؛ ')}
    </p>}
    <div className="overflow-x-auto"><table className="w-full text-right text-sm">
      <thead><tr><th className="p-2">النص</th><th>النوع</th><th>الإثبات</th><th>صاحب الحالة</th><th>الزمن</th>
        <th>الدواء</th><th>الدليل</th><th>ينقص</th></tr></thead>
      <tbody>{context.entities.map(entity => <tr key={entity.index} className={`border-t ${entity.needs_review ? 'bg-amber-50' : ''}`}>
        <td dir="auto" className="p-2 font-medium">{entity.text}</td>
        <td>{LABELS.type[entity.type]}</td>
        {['assertion', 'experiencer', 'temporality'].map(field => <td key={field}>
          <select aria-label={`${field} ${entity.text}`} disabled={busy} className="rounded border p-1"
            value={edits[entity.index]?.[field] ?? entity[field]}
            onChange={e => setEdits(prev => ({ ...prev, [entity.index]: { ...prev[entity.index], [field]: e.target.value } }))}>
            {Object.entries(LABELS[field]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></td>)}
        <td>{entity.medication ? <>
          <select aria-label={`medication status ${entity.text}`} disabled={busy} className="rounded border p-1"
            value={edits[entity.index]?.medication_status ?? entity.medication.status}
            onChange={e => setEdits(prev => ({ ...prev, [entity.index]: { ...prev[entity.index], medication_status: e.target.value } }))}>
            {Object.entries(LABELS.medication_status).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div dir="ltr" className="text-xs text-gray-600">{['dose', 'unit', 'route', 'frequency', 'duration']
            .map(k => entity.medication[k]).filter(Boolean).join(' ') || '—'}</div>
        </> : entity.allergy ? 'حساسية غير موثقة' : '—'}</td>
        <td dir="ltr" className="text-xs">{entity.evidence.filter(e => e.source !== 'default').map(e => e.trigger).join(', ') || 'افتراضي'}</td>
        <td className="text-xs">{[...entity.missing, ...entity.review_reasons.map(reasonLabel)].join('، ') || '—'}</td>
      </tr>)}</tbody>
    </table></div>
    {context.entities.length === 0 && <p>لم يُستخرج كيان؛ هذا لا ينفي وجود حالة أو دواء.</p>}
    {context.measurements.length > 0 && <p dir="ltr" className="text-sm">
      {context.measurements.map(m => `${m.text}${m.unit ? '' : ' (no unit)'}`).join(' · ')}</p>}
    <label className="block">ملاحظة المراجع
      <textarea className="w-full rounded-lg border p-3" value={note} maxLength={2000} disabled={busy}
        onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40" disabled={busy || corrections.length > 0}
        onClick={() => submit('accepted')}>قبول كما هو</button>
      <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40" disabled={busy || corrections.length === 0}
        onClick={() => submit('corrected')}>حفظ التصحيحات ({corrections.length})</button>
      <button className="rounded-lg border px-4 py-2" disabled={busy} onClick={() => submit('rejected')}>رفض النتيجة</button>
    </div>
    {history.length > 0 && <div>
      <h3 className="font-semibold">سجل المراجعات</h3>
      <ol className="list-decimal pr-5 text-sm">{history.map(r => <li key={r.id}>
        الإصدار {r.version} · {{ accepted: 'قبول', corrected: 'تصحيح', rejected: 'رفض' }[r.decision]} ·
        {' '}{new Date(r.created_at).toLocaleString('ar')}
        {r.corrections.length > 0 && ` · ${r.corrections.map(c => `${byIndex(c.entity_index)?.text}: ${c.field} → ${c.value}`).join('، ')}`}
        {r.note && ` · ${r.note}`}</li>)}</ol>
    </div>}
  </div>;
}
