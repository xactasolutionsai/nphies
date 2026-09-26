import React, { useEffect, useState } from 'react';

// Evidence-backed summary of one analysis (backend/clinical-evidence). Extractive only:
// patient data, approved reference passages and inference are shown as separate sections,
// every line with its source. No model writes any sentence here.

const CATEGORY = {
  problem_present: 'مذكور كموجود لدى المريض',
  problem_history: 'تاريخ مرضي للمريض',
  planned: 'مخطط / مستقبلي',
  absent: 'منفي أو مستبعد',
  possible: 'محتمل أو مشروط',
  family: 'تاريخ عائلي — ليس للمريض',
  other_person: 'يخص شخصاً آخر',
  medication_current: 'دواء حالي مذكور',
  medication_other: 'دواء غير حالي',
  allergy: 'حساسية مذكورة (غير موثقة)',
  allergy_absent: 'حساسية منفية',
  allergy_statement: 'عبارة حساسية',
  measurement: 'قياس مذكور',
  needs_review: 'يحتاج مراجعة'
};
const STATUS = { current: 'حالي', discontinued: 'موقوف', proposed: 'مقترح', historical: 'سابق', unknown: 'غير محدد' };
const GAP = {
  conflict: 'تعارض في النص', needs_review: 'يحتاج مراجعة', missing_medication_detail: 'تفاصيل دواء ناقصة',
  measurement_without_unit: 'قياس بلا وحدة', ambiguous_date: 'تاريخ ملتبس (يوم/شهر)', context_unavailable: 'سياق غير متاح'
};

export default function EvidenceSummary({ analysisId, request, busy }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let active = true;
    setItems([]); setError('');
    request(`/analyses/${analysisId}/summaries`).then(r => { if (active) setItems(r.data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [analysisId, request]);

  async function run(fn) {
    setWorking(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setWorking(false); }
  }
  const generate = () => run(async () => {
    const created = await request(`/analyses/${analysisId}/summaries`, { method: 'POST', body: '{}' });
    setItems(previous => [{ ...created, reviews: [] }, ...previous]);
  });
  const review = decision => run(async () => {
    const saved = await request(`/summaries/${items[0].id}/reviews`, { method: 'POST', body: JSON.stringify({ decision, note }) });
    setItems(previous => previous.map((s, i) => (i === 0 ? { ...s, reviews: [...(s.reviews || []), saved] } : s)));
    setNote('');
  });

  const latest = items[0];
  const c = latest?.content;
  const disabled = busy || working;
  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">4. ملخص مدعوم بالأدلة</h2>
      <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40" disabled={disabled} onClick={generate}>
        {items.length ? 'إنشاء إصدار جديد' : 'إنشاء الملخص'}</button>
    </div>
    <p className="text-sm text-gray-600">ملخص استخراجي: يُنقل كل سطر حرفياً من النص أو من مصدر معتمد من المستشفى. لا يكتب أي نموذج جملاً هنا، ولا يُقدَّم استنتاج أو توصية.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {c && c.status !== 'ok' && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">تعذر إنشاء الملخص لأن سياق النص غير متاح. راجع النص يدوياً.</p>}
    {c?.status === 'ok' && <>
      <p className="text-xs text-gray-500">الإصدار {latest.version} · {new Date(latest.created_at).toLocaleString('ar')} · وضع التوليد: استخراجي (بلا نموذج) ·
        المصادر المتاحة وقت الإنشاء: {latest.corpus.sources.length}</p>

      <div className="rounded-lg border p-3">
        <h3 className="font-semibold">أ. بيانات المريض (من النص المحلل فقط)</h3>
        <ul className="mt-2 space-y-1 text-sm">{c.patient_data.map(f => <li key={f.id}>
          <span className="font-medium">{CATEGORY[f.category] || f.category}</span>
          {f.status ? ` (${STATUS[f.status]})` : ''}: <q dir="ltr">{f.quote}</q>
          <span className="text-xs text-gray-500"> · {f.id} · موضع {f.start}–{f.end}</span></li>)}</ul>
        {!c.patient_data.length && <p className="text-sm">لا توجد بيانات مستخرجة.</p>}
      </div>

      <div className="rounded-lg border p-3">
        <h3 className="font-semibold">ب. معرفة مرجعية من مصادر معتمدة</h3>
        {c.reference_knowledge.map(block => <div key={block.term} className="mt-3">
          <p className="text-sm font-medium" dir="auto">{block.term}{block.multiple_sources ? ' — أكثر من مصدر: راجعها كلها؛ الترتيب حسب أولوية المستشفى ولا يُحسم الاختلاف آلياً' : ''}</p>
          {block.passages.map(p => <figure key={p.passage_id} className="mt-2 border-r-4 border-teal-600 pr-3">
            <blockquote dir="ltr" className="text-sm">{p.quote}</blockquote>
            <figcaption className="text-xs text-gray-600" dir="ltr">{p.citation.source_title} · {p.citation.publisher} · v{p.citation.version}
              {' '}· published {p.citation.published_on?.slice(0, 10)}{p.citation.reviewed_on ? ` · reviewed ${p.citation.reviewed_on.slice(0, 10)}` : ''}
              {p.section ? ` · ${p.section}` : ''}{p.locator ? ` · ${p.locator}` : ''} · licence: {p.citation.license}</figcaption>
          </figure>)}
        </div>)}
        {!c.reference_knowledge.length && <p className="text-sm">لا يوجد مقطع معتمد مطابق.</p>}
        {c.abstentions.length > 0 && <p className="mt-3 text-sm text-amber-900">لا يوجد دليل معتمد كافٍ، فلا تُقدَّم معلومة مرجعية عن: <span dir="ltr">{c.abstentions.map(a => a.term).join(', ')}</span></p>}
      </div>

      <div className="rounded-lg border p-3">
        <h3 className="font-semibold">ج. الاستنتاج</h3>
        <p className="text-sm">لا يوجد. الوضع الاستخراجي لا يستنتج ولا يربط بين بيانات المريض والمراجع؛ الربط والحكم للممارس.</p>
      </div>

      {c.gaps.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <h3 className="font-semibold">نواقص وتعارضات تحتاج استكمالاً</h3>
        <ul className="list-disc pr-5 text-sm">{c.gaps.map((g, i) => <li key={i}>{GAP[g.kind] || g.kind}
          {g.text ? <> — <span dir="ltr">{g.text}</span></> : ''}{g.fields ? `: ${g.fields.join(', ')}` : ''}</li>)}</ul>
      </div>}

      <label className="block">ملاحظة المراجع
        <textarea className="w-full rounded-lg border p-3" value={note} maxLength={2000} disabled={disabled}
          onChange={e => setNote(e.target.value)} /></label>
      <div className="flex gap-2">
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40" disabled={disabled} onClick={() => review('accepted')}>قبول الملخص</button>
        <button className="rounded-lg border px-4 py-2" disabled={disabled} onClick={() => review('rejected')}>رفض الملخص</button>
      </div>
      {(latest.reviews || []).length > 0 && <p className="text-sm">مراجعات هذا الإصدار: {latest.reviews.map(r =>
        `${r.decision === 'accepted' ? 'قبول' : 'رفض'}${r.note ? ` (${r.note})` : ''}`).join('، ')}</p>}
    </>}
    {items.length > 1 && <p className="text-xs text-gray-500">الإصدارات السابقة: {items.slice(1).map(s => s.version).join('، ')}</p>}
  </section>;
}
