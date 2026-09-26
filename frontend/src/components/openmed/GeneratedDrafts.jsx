import React, { useEffect, useState } from 'react';

// Model-written drafts of one summary (clinical-evidence/generator.js). Shown only when the
// server enables generation and the user's pilot approves it. A draft appears only if every
// sentence passed automatic citation checks; it is still a draft for the clinician to review.

const PROBLEMS = {
  no_citation: 'بلا إسناد', unknown_citation: 'إسناد غير موجود', quote_not_found: 'اقتباس غير مطابق',
  number_not_in_citations: 'رقم غير موجود في المصدر', patient_claim_needs_patient_citation: 'ادعاء عن المريض بلا دليل من بياناته',
  cites_non_positive_fact: 'وصف منفي أو عائلي كأنه مثبت', cites_fact_needing_review: 'استند إلى معلومة تحتاج مراجعة'
};

const REASONS = {
  no_patient_facts: 'لا توجد معلومات مؤكدة كافية (العناصر التي تحتاج مراجعة لا تُرسل للنموذج)',
  summary_unavailable: 'الملخص غير متاح', identifier_in_input: 'في البيانات ما يشبه معرّف مريض، فلم يُرسل شيء للنموذج'
};

export default function GeneratedDrafts({ summaryId, request, generation }) {
  const [drafts, setDrafts] = useState([]);
  const [attempts, setAttempts] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [edit, setEdit] = useState({});

  useEffect(() => {
    let active = true;
    request(`/summaries/${summaryId}/drafts`).then(r => { if (active) { setDrafts(r.data); setAttempts(r.attempts); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [summaryId, request]);

  if (!generation?.enabled_on_server) return null;
  const run = async fn => { setWorking(true); setError(''); setNotice(''); try { await fn(); } catch (e) { setError(e.message); } finally { setWorking(false); } };
  const generate = () => run(async () => {
    const r = await request(`/summaries/${summaryId}/drafts`, { method: 'POST', body: '{}' });
    setAttempts(a => ({ total: (a?.total || 0) + 1, accepted: (a?.accepted || 0) + (r.attempt.accepted ? 1 : 0) }));
    if (r.draft) setDrafts(d => [{ ...r.draft, reviews: [] }, ...d]);
    else setNotice(r.attempt.reason === 'verification_failed'
      ? `رُفضت المسودة ولم تُعرض: ${[...new Set(r.attempt.problems.flatMap(p => p.problems))].map(p => PROBLEMS[p] || p).join('، ')}`
      : `تعذر إنشاء مسودة: ${REASONS[r.attempt.reason] || r.attempt.reason}`);
  });
  const review = (draft, decision) => run(async () => {
    const body = { decision, ...(decision === 'edited' ? { edited_text: edit[draft.id] } : {}) };
    const saved = await request(`/drafts/${draft.id}/reviews`, { method: 'POST', body: JSON.stringify(body) });
    setDrafts(list => list.map(d => (d.id === draft.id ? { ...d, reviews: [...(d.reviews || []), saved] } : d)));
  });

  return <div className="space-y-3 rounded-lg border border-purple-200 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">د. مسودة صياغة بالنموذج (تجريبية)</h3>
      <button className="rounded-lg bg-purple-700 px-3 py-2 text-white disabled:opacity-40"
        disabled={working || !generation.approved_for_user} onClick={generate}>صياغة مسودة</button>
    </div>
    {!generation.approved_for_user && <p className="text-sm text-amber-900">الصياغة بالنموذج غير معتمدة في تجربتك.</p>}
    <p className="text-sm text-gray-600">يكتب النموذج من البيانات المستخرجة والمقاطع المعتمدة أعلاه فقط. تُفحص كل جملة آلياً مقابل ما تستند إليه،
      وأي جملة غير مسندة ترفض المسودة كلها. الفحص الآلي لا يغني عن مراجعتك.</p>
    {attempts && <p className="text-xs text-gray-500">المحاولات: {attempts.total} · المقبولة آلياً: {attempts.accepted}</p>}
    {notice && <p role="status" className="rounded bg-amber-50 p-2 text-sm text-amber-900">{notice}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    {drafts.map(d => <div key={d.id} className="rounded border p-3">
      <p className="mb-2 inline-block rounded bg-purple-100 px-2 py-1 text-xs text-purple-900">مسودة مولّدة — تحتاج مراجعة</p>
      <ol className="list-decimal space-y-1 pr-5 text-sm" dir="ltr">{d.sentences.map((s, i) => <li key={i}>{s.text}
        <span className="text-xs text-gray-500"> [{s.citations.map(c => `${c.type === 'patient' ? c.id : 'ref'}: “${c.quote}”`).join('; ')}]</span></li>)}</ol>
      {!d.sentences.length && <p className="text-sm text-gray-500">حُذف نص المسودة وفق سياسة الاحتفاظ.</p>}
      <textarea dir="ltr" className="mt-2 w-full rounded border p-2 text-sm" placeholder="تعديلك (اختياري)" value={edit[d.id] || ''}
        onChange={e => setEdit(x => ({ ...x, [d.id]: e.target.value }))} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded bg-teal-700 px-3 py-1 text-white disabled:opacity-40" disabled={working} onClick={() => review(d, 'accepted')}>قبول</button>
        <button className="rounded bg-teal-700 px-3 py-1 text-white disabled:opacity-40" disabled={working || !(edit[d.id] || '').trim()} onClick={() => review(d, 'edited')}>حفظ تعديلي</button>
        <button className="rounded border px-3 py-1" disabled={working} onClick={() => review(d, 'rejected')}>رفض</button>
      </div>
      {(d.reviews || []).length > 0 && <p className="mt-1 text-xs text-gray-600">المراجعات: {d.reviews.map(r => ({ accepted: 'قبول', edited: 'تعديل', rejected: 'رفض' }[r.decision])).join('، ')}</p>}
    </div>)}
  </div>;
}
