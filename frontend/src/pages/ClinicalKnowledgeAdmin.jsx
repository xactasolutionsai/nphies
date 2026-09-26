import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/services/http';

// Admin page: hospital-approved reference sources for the clinical assistant (migration 072)
// and per-patient clinical AI access grants (migration 071). Admin-only on the server.

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.problems?.join('، ') || body?.phi?.map(p => p.kind).join('، ') || body?.details?.join('، ');
    throw new Error([body?.error || 'تعذر إكمال الطلب', detail].filter(Boolean).join(': '));
  }
  return body;
}
const field = 'w-full rounded-lg border p-2';
const button = 'rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-40';
const STATUS = { draft: 'مسودة', approved: 'معتمد', retired: 'مسحوب' };
const PROBLEMS = {
  license: 'الترخيص', usage_rights: 'حقوق الاستخدام', version: 'الإصدار', published_on: 'تاريخ النشر', scope: 'نطاق التطبيق',
  approval_reference: 'مرجع الاعتماد', precedence_rank: 'أولوية المصدر', no_passages: 'لا توجد مقاطع',
  unreviewed_injection_flags: 'مقاطع فيها صياغة تشبه التعليمات لم تُراجع', language_not_supported: 'اللغة غير مدعومة (الإنجليزية فقط حالياً)'
};
const META = [['license', 'الترخيص'], ['usage_rights', 'حقوق الاستخدام'], ['version', 'الإصدار'], ['published_on', 'تاريخ النشر (YYYY-MM-DD)'],
  ['reviewed_on', 'تاريخ مراجعة الناشر'], ['next_review_due', 'موعد مراجعة المستشفى'], ['scope', 'نطاق التطبيق']];

function SourceDetail({ id, onChanged }) {
  const [source, setSource] = useState(null);
  const [meta, setMeta] = useState({});
  const [passage, setPassage] = useState({ section: '', locator: '', text: '' });
  const [approval, setApproval] = useState({ approval_reference: '', precedence_rank: 1 });
  const [error, setError] = useState('');
  const load = useCallback(() => request(`/clinical-knowledge/sources/${id}`).then(s => {
    setSource(s); setMeta(Object.fromEntries(META.map(([k]) => [k, s[k]?.slice?.(0, k.endsWith('_on') || k === 'next_review_due' ? 10 : undefined) ?? ''])));
  }).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async fn => { setError(''); try { await fn(); await load(); onChanged(); } catch (e) { setError(e.message); } };
  if (!source) return error ? <p role="alert" className="text-red-700">{error}</p> : null;
  const draft = source.status === 'draft';
  return <div className="space-y-3 rounded-lg border p-4">
    <h3 className="text-lg font-semibold" dir="auto">{source.title} · {STATUS[source.status]}</h3>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-red-800">{error}</p>}
    <div className="grid gap-2 md:grid-cols-2">{META.map(([k, label]) => <label key={k} className="text-sm">{label}
      <input className={field} dir="ltr" disabled={!draft} value={meta[k] ?? ''} onChange={e => setMeta(m => ({ ...m, [k]: e.target.value }))} /></label>)}</div>
    {draft && <button className={button} onClick={() => act(() => request(`/clinical-knowledge/sources/${id}`, { method: 'PATCH',
      body: JSON.stringify(Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v === '' ? null : v]))) }))}>حفظ البيانات</button>}
    <h4 className="font-semibold">المقاطع ({source.passages.length})</h4>
    <ul className="space-y-2 text-sm">{source.passages.map(p => <li key={p.id} className="rounded border p-2">
      <p dir="ltr">{p.text}</p>
      <p className="text-xs text-gray-500" dir="ltr">{[p.section, p.locator].filter(Boolean).join(' · ')}</p>
      {p.injection_flags.length > 0 && <p className="text-xs text-amber-800">صياغة تشبه التعليمات ({p.injection_flags.join(', ')}) ·
        {p.injection_reviewed ? ' روجعت' : <button className="mr-2 underline" disabled={!draft} onClick={() => act(() =>
          request(`/clinical-knowledge/sources/${id}/passages/${p.id}/review-injection`, { method: 'POST', body: '{}' }))}>أؤكد أنها نص مرجعي مشروع</button>}</p>}
    </li>)}</ul>
    {draft && <div className="space-y-2 rounded border p-2">
      <p className="text-sm text-gray-600">أضف النص كما هو في المصدر. لا تضف رقم صفحة أو قسماً غير موجود فيه. يُرفض المقطع إذا احتوى معرفات مرضى.</p>
      <div className="grid gap-2 md:grid-cols-2">
        <input className={field} placeholder="القسم" value={passage.section} onChange={e => setPassage(v => ({ ...v, section: e.target.value }))} />
        <input className={field} placeholder="الموضع كما في المصدر (صفحة/بند)" value={passage.locator} onChange={e => setPassage(v => ({ ...v, locator: e.target.value }))} />
      </div>
      <textarea dir="ltr" className={`${field} min-h-[100px]`} value={passage.text} onChange={e => setPassage(v => ({ ...v, text: e.target.value }))} />
      <button className={button} disabled={passage.text.trim().length < 20} onClick={() => act(async () => {
        await request(`/clinical-knowledge/sources/${id}/passages`, { method: 'POST', body: JSON.stringify(passage) });
        setPassage({ section: '', locator: '', text: '' });
      })}>إضافة مقطع</button>
    </div>}
    {draft && <div className="space-y-2 rounded border border-teal-300 p-2">
      {source.approval_problems.length > 0 && <p className="text-sm text-amber-900">قبل الاعتماد: {source.approval_problems.map(p => PROBLEMS[p] || p).join('، ')}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <input className={field} placeholder="مرجع الاعتماد (مثل رقم محضر اللجنة)" value={approval.approval_reference}
          onChange={e => setApproval(a => ({ ...a, approval_reference: e.target.value }))} />
        <label className="text-sm">الأولوية حسب سياسة المستشفى (1 = الأعلى)
          <input type="number" min="1" className={field} value={approval.precedence_rank}
            onChange={e => setApproval(a => ({ ...a, precedence_rank: Number(e.target.value) }))} /></label>
      </div>
      <button className={button} onClick={() => act(() => request(`/clinical-knowledge/sources/${id}/approve`, { method: 'POST', body: JSON.stringify(approval) }))}>اعتماد المصدر</button>
    </div>}
    {source.status !== 'retired' && <button className="rounded-lg border px-3 py-2" onClick={() => {
      const reason = window.prompt('سبب سحب المصدر');
      if (reason) act(() => request(`/clinical-knowledge/sources/${id}/retire`, { method: 'POST', body: JSON.stringify({ reason }) }));
    }}>سحب المصدر</button>}
  </div>;
}

function AccessGrants() {
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState({ user_id: '', patient_id: '', reason: '', expires_at: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => request('/clinical-ai-access').then(r => setGrants(r.data)).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const act = async fn => { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  return <section className="space-y-3 rounded-xl border bg-white p-5">
    <h2 className="text-xl font-semibold">تفويضات الوصول للمرضى (المساعد السريري)</h2>
    <p className="text-sm text-gray-600">لا يرى المستخدم مريضاً في صفحة OpenMed إلا بتفويض نشط. يُحفظ سبب المنح والسحب ومن قام بهما.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-red-800">{error}</p>}
    <div className="grid gap-2 md:grid-cols-4">
      <input className={field} placeholder="رقم المستخدم" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} />
      <input className={field} dir="ltr" placeholder="patient UUID" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} />
      <input className={field} placeholder="السبب (مثل: الفريق المعالج)" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
      <input className={field} type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
    </div>
    <button className={button} onClick={() => act(() => request('/clinical-ai-access', { method: 'POST', body: JSON.stringify({
      user_id: Number(form.user_id), patient_id: form.patient_id.trim(), reason: form.reason,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null }) }))}>منح التفويض</button>
    <table className="w-full text-right text-sm"><thead><tr><th className="p-2">المستخدم</th><th>المريض</th><th>السبب</th><th>ينتهي</th><th /></tr></thead>
      <tbody>{grants.map(g => <tr key={g.id} className="border-t"><td className="p-2">{g.user_id}</td><td dir="ltr">{g.patient_id}</td><td>{g.reason}</td>
        <td>{g.expires_at ? new Date(g.expires_at).toLocaleString('ar') : '—'}</td>
        <td><button className="underline" onClick={() => { const reason = window.prompt('سبب السحب');
          if (reason) act(() => request(`/clinical-ai-access/${g.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) })); }}>سحب</button></td></tr>)}</tbody></table>
  </section>;
}

export default function ClinicalKnowledgeAdmin() {
  const [sources, setSources] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ title: '', publisher: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => request('/clinical-knowledge/sources').then(r => setSources(r.data)).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4">
    <header>
      <h1 className="text-3xl font-bold text-teal-900">المصادر المرجعية المعتمدة</h1>
      <p className="mt-2 text-gray-600">لا يستخدم المساعد السريري إلا المقاطع المعتمدة غير المتجاوزة لموعد مراجعتها. لا تُدخل نصاً لا يملك المستشفى حق استخدامه.</p>
    </header>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">المصادر</h2>
      <div className="flex flex-wrap gap-2">
        <input className={field} placeholder="عنوان المصدر" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        <input className={field} placeholder="الجهة الناشرة" value={draft.publisher} onChange={e => setDraft(d => ({ ...d, publisher: e.target.value }))} />
        <button className={button} disabled={draft.title.trim().length < 2 || draft.publisher.trim().length < 2} onClick={async () => {
          setError('');
          try { const s = await request('/clinical-knowledge/sources', { method: 'POST', body: JSON.stringify(draft) });
            setDraft({ title: '', publisher: '' }); await load(); setSelected(s.id); } catch (e) { setError(e.message); }
        }}>إنشاء مسودة</button>
      </div>
      <table className="w-full text-right text-sm"><thead><tr><th className="p-2">العنوان</th><th>الناشر</th><th>الإصدار</th><th>الحالة</th><th>الأولوية</th><th>المقاطع</th></tr></thead>
        <tbody>{sources.map(s => <tr key={s.id} className={`cursor-pointer border-t ${selected === s.id ? 'bg-teal-50' : ''}`} onClick={() => setSelected(s.id)}>
          <td className="p-2" dir="auto">{s.title}</td><td dir="auto">{s.publisher}</td><td>{s.version || '—'}</td><td>{STATUS[s.status]}</td>
          <td>{s.precedence_rank ?? '—'}</td><td>{s.passage_count}</td></tr>)}</tbody></table>
      {!sources.length && <p className="text-sm text-gray-500">لا توجد مصادر بعد. تُضاف قائمة المصادر بالاتفاق مع لجنة المستشفى.</p>}
      {selected && <SourceDetail key={selected} id={selected} onChanged={load} />}
    </section>
    <AccessGrants />
  </main>;
}
