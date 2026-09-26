import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/services/http';

// Admin page for the clinical assistant pilot (migration 074): register a pilot, participants,
// activation with the hospital's approval and the evaluated build, pause/resume/close,
// aggregate metrics and error-report triage.

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}/clinical-pilot${path}`, { ...options, headers: { 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.problems?.join('، ') || body?.details?.join('، ') || (body?.deployed_build ? `النسخة المنشورة: ${body.deployed_build}` : '');
    throw new Error([body?.error || 'تعذر إكمال الطلب', detail].filter(Boolean).join(': '));
  }
  return body;
}
const field = 'w-full rounded-lg border p-2';
const button = 'rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-40';
const STATUS = { draft: 'مسودة', active: 'نشطة', paused: 'موقوفة', closed: 'مغلقة' };
const ISSUE_STATUS = { open: 'مفتوح', triaged: 'قيد المعالجة', fixed: 'أُصلح', wont_fix: 'لن يُصلح', duplicate: 'مكرر' };
const PROBLEMS = { dates: 'التواريخ', max_participants: 'الحد الأقصى للمشاركين', participants: 'مشارك واحد على الأقل', ends_on_in_past: 'تاريخ النهاية مضى' };
const APPROVAL = [['approval_reference', 'مرجع قرار الاعتماد'], ['approved_by_name', 'اسم المعتمد'], ['approved_by_role', 'صفة المعتمد'],
  ['evaluation_report_ref', 'مرجع تقرير التقييم المستقل'], ['criteria_ref', 'مرجع معايير النجاح المسجلة مسبقاً'],
  ['evaluation_build_sha256', 'بصمة النسخة التي قُيّمت (من تقرير التقييم)']];

function Pilot({ id, deployedBuild, onChanged }) {
  const [pilot, setPilot] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [issues, setIssues] = useState([]);
  const [draft, setDraft] = useState({});
  const [member, setMember] = useState({ user_id: '', role_label: '' });
  const [approval, setApproval] = useState({});
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const all = await request('/pilots');
      const p = all.data.find(x => x.id === id);
      setPilot(p);
      setDraft({ starts_on: p?.starts_on?.slice(0, 10) || '', ends_on: p?.ends_on?.slice(0, 10) || '', max_participants: p?.max_participants || '' });
      setParticipants((await request(`/pilots/${id}/participants`)).data);
      setMetrics(await request(`/pilots/${id}/metrics`));
      setIssues((await request(`/issues?pilot_id=${id}`)).data);
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const act = async fn => { setError(''); try { await fn(); await load(); onChanged(); } catch (e) { setError(e.message); } };
  const withReason = (path, label) => { const reason = window.prompt(label); if (reason) act(() => request(path, { method: 'POST', body: JSON.stringify({ reason }) })); };
  if (!pilot) return error ? <p role="alert" className="text-red-700">{error}</p> : null;
  const isDraft = pilot.status === 'draft';
  return <div className="space-y-4 rounded-lg border p-4">
    <h3 className="text-lg font-semibold">{pilot.name} · {STATUS[pilot.status]}</h3>
    <p className="text-sm text-gray-600">{pilot.scope}</p>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-red-800">{error}</p>}
    {pilot.open_serious_issues > 0 && <p className="rounded bg-red-50 p-2 text-red-800">بلاغات خطيرة مفتوحة: {pilot.open_serious_issues}. المساعد متوقف لكل المشاركين حتى معالجتها.</p>}
    {pilot.evaluation_build_sha256 && pilot.evaluation_build_sha256 !== deployedBuild && pilot.status === 'active' &&
      <p className="rounded bg-amber-50 p-2 text-amber-900">النسخة المنشورة تختلف عن النسخة المقيّمة، والمساعد متوقف. أي تعديل في الكود يحتاج تقييماً جديداً وتجربة جديدة.</p>}

    <div className="grid gap-2 md:grid-cols-3">
      <label className="text-sm">البداية<input type="date" className={field} disabled={!isDraft} value={draft.starts_on || ''} onChange={e => setDraft(d => ({ ...d, starts_on: e.target.value }))} /></label>
      <label className="text-sm">النهاية<input type="date" className={field} disabled={!isDraft} value={draft.ends_on || ''} onChange={e => setDraft(d => ({ ...d, ends_on: e.target.value }))} /></label>
      <label className="text-sm">الحد الأقصى للمشاركين<input type="number" min="1" className={field} disabled={!isDraft} value={draft.max_participants || ''} onChange={e => setDraft(d => ({ ...d, max_participants: e.target.value }))} /></label>
    </div>
    {isDraft && <button className={button} onClick={() => act(() => request(`/pilots/${id}`, { method: 'PATCH', body: JSON.stringify({
      ...(draft.starts_on ? { starts_on: draft.starts_on } : {}), ...(draft.ends_on ? { ends_on: draft.ends_on } : {}),
      ...(draft.max_participants ? { max_participants: Number(draft.max_participants) } : {}) }) }))}>حفظ</button>}

    <h4 className="font-semibold">المشاركون</h4>
    <ul className="text-sm">{participants.map(m => <li key={m.user_id}>{m.email} · {m.role_label} {m.removed_at ? '(أُزيل)' : <button className="mr-2 underline"
      onClick={() => act(() => request(`/pilots/${id}/participants/${m.user_id}/remove`, { method: 'POST', body: '{}' }))}>إزالة</button>}</li>)}</ul>
    {pilot.status !== 'closed' && <div className="flex flex-wrap gap-2">
      <input className="rounded border p-2" placeholder="رقم المستخدم" value={member.user_id} onChange={e => setMember(m => ({ ...m, user_id: e.target.value }))} />
      <input className="rounded border p-2" placeholder="الدور (طبيب، صيدلي، مرمز…)" value={member.role_label} onChange={e => setMember(m => ({ ...m, role_label: e.target.value }))} />
      <button className={button} onClick={() => act(() => request(`/pilots/${id}/participants`, { method: 'POST', body: JSON.stringify({ user_id: Number(member.user_id), role_label: member.role_label }) }))}>إضافة</button>
    </div>}

    {isDraft && <div className="space-y-2 rounded border border-teal-300 p-3">
      <h4 className="font-semibold">التفعيل بعد موافقة المستشفى</h4>
      <p className="text-sm text-gray-600">لا تُفعَّل التجربة إلا بعد اجتياز التقييم المستقل ومعاييره المسجلة مسبقاً. انسخ بصمة النسخة من تقرير التقييم، ولا تنسخها من هنا.
        النسخة المنشورة حالياً: <code dir="ltr">{deployedBuild}</code></p>
      <div className="grid gap-2 md:grid-cols-2">{APPROVAL.map(([k, l]) => <label key={k} className="text-sm">{l}
        <input className={field} dir={k === 'evaluation_build_sha256' ? 'ltr' : 'auto'} value={approval[k] || ''} onChange={e => setApproval(a => ({ ...a, [k]: e.target.value.trim() }))} /></label>)}</div>
      <button className={button} onClick={() => act(() => request(`/pilots/${id}/activate`, { method: 'POST', body: JSON.stringify(approval) }).catch(e => {
        throw new Error(e.message.replace(/dates|max_participants|participants|ends_on_in_past/g, m => PROBLEMS[m] || m)); }))}>تفعيل التجربة</button>
    </div>}
    {pilot.status === 'active' && <button className="rounded-lg border px-3 py-2" onClick={() => withReason(`/pilots/${id}/pause`, 'سبب الإيقاف')}>إيقاف مؤقت</button>}
    {pilot.status === 'paused' && <button className="rounded-lg border px-3 py-2" onClick={() => withReason(`/pilots/${id}/resume`, 'سبب الاستئناف')}>استئناف</button>}
    {pilot.status !== 'closed' && <button className="mr-2 rounded-lg border px-3 py-2" onClick={() => withReason(`/pilots/${id}/close`, 'سبب الإغلاق')}>إغلاق التجربة</button>}

    {metrics && <div className="rounded border p-3 text-sm">
      <h4 className="font-semibold">المؤشرات (مجمّعة، بلا بيانات مرضى)</h4>
      <p>التحليلات: {metrics.analyses.total} · مستخدمون: {metrics.analyses.users} · فشل السياق: {metrics.analyses.context_failed}</p>
      <p>تغطية المراجعة: {metrics.rates.review_coverage ?? '—'} · نسبة المصحح أو المرفوض: {metrics.rates.corrected_or_rejected ?? '—'} · نسبة الامتناع في الملخصات: {metrics.rates.abstention_share ?? '—'}</p>
      <p>التصحيحات حسب الحقل: {metrics.corrections.map(c => `${c.field}: ${c.n}`).join('، ') || '—'}</p>
      <p>تشغيل هذا الخادم (لكل المستخدمين، لا لهذه التجربة وحدها): مكتمل {metrics.runtime?.stats?.completed ?? 0} · مهلة {metrics.runtime?.stats?.timeouts ?? 0} · تعطل {metrics.runtime?.stats?.crashes ?? 0}</p>
      <p className="text-xs text-gray-500">{metrics.note}</p>
    </div>}

    <h4 className="font-semibold">بلاغات الأخطاء</h4>
    <table className="w-full text-right text-sm"><thead><tr><th className="p-2">النوع</th><th>الخطورة</th><th>الوصف</th><th>الحالة</th><th /></tr></thead>
      <tbody>{issues.map(i => <tr key={i.id} className={`border-t ${i.severity === 'serious' && ['open', 'triaged'].includes(i.status) ? 'bg-red-50' : ''}`}>
        <td className="p-2">{i.category}</td><td>{i.severity}</td><td dir="auto">{i.description}</td><td>{ISSUE_STATUS[i.status]}</td>
        <td><select className="rounded border p-1" value="" onChange={e => {
          const status = e.target.value; if (!status) return;
          const triage_note = window.prompt('ملاحظة المعالجة') || '';
          const fixed_in_build = status === 'fixed' ? window.prompt('بصمة النسخة التي تحتوي الإصلاح') : null;
          act(() => request(`/issues/${i.id}`, { method: 'PATCH', body: JSON.stringify({ status, triage_note, fixed_in_build }) }));
        }}><option value="">تغيير الحالة…</option>{Object.entries(ISSUE_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td></tr>)}</tbody></table>
  </div>;
}

export default function ClinicalPilotAdmin() {
  const [pilots, setPilots] = useState([]);
  const [deployedBuild, setDeployedBuild] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', scope: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => request('/pilots').then(r => { setPilots(r.data); setDeployedBuild(r.deployed_build); }).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4">
    <header>
      <h1 className="text-3xl font-bold text-teal-900">التجربة الداخلية للمساعد السريري</h1>
      <p className="mt-2 text-gray-600">لا يعمل المساعد إلا لمشاركي تجربة نشطة اعتمدها المستشفى، ضمن تواريخها، وعلى النسخة التي قُيّمت. البلاغ الخطير يوقفه تلقائياً.</p>
    </header>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap gap-2">
        <input className={field} placeholder="اسم التجربة" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className={field} placeholder="النطاق (القسم، الاستخدام)" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} />
        <button className={button} disabled={form.name.trim().length < 3 || form.scope.trim().length < 3} onClick={async () => {
          setError('');
          try { const p = await request('/pilots', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', scope: '' }); await load(); setSelected(p.id); }
          catch (e) { setError(e.message); }
        }}>تسجيل مسودة</button>
      </div>
      <table className="w-full text-right text-sm"><thead><tr><th className="p-2">التجربة</th><th>الحالة</th><th>من</th><th>إلى</th><th>المشاركون</th><th>بلاغات خطيرة مفتوحة</th></tr></thead>
        <tbody>{pilots.map(p => <tr key={p.id} className={`cursor-pointer border-t ${selected === p.id ? 'bg-teal-50' : ''}`} onClick={() => setSelected(p.id)}>
          <td className="p-2">{p.name}</td><td>{STATUS[p.status]}</td><td>{p.starts_on?.slice(0, 10) || '—'}</td><td>{p.ends_on?.slice(0, 10) || '—'}</td>
          <td>{p.participants}</td><td>{p.open_serious_issues}</td></tr>)}</tbody></table>
      {!pilots.length && <p className="text-sm text-gray-500">لا توجد تجارب مسجلة. لن يعمل المساعد حتى تُسجَّل تجربة معتمدة وتُفعَّل.</p>}
      {selected && <Pilot key={selected} id={selected} deployedBuild={deployedBuild} onChanged={load} />}
    </section>
  </main>;
}
