import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/services/http';

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}/openmed${path}`, {
    ...options, headers: { 'Content-Type': 'application/json' }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'تعذر إكمال الطلب');
  return body;
}
const button = 'rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40';
const field = 'w-full rounded-lg border p-3';
const labels = { unreviewed: 'بانتظار المراجعة', reviewed: 'تمت المراجعة البشرية', dismissed: 'مستبعد' };

export default function OpenMedAdvisory() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState('manual');
  const [text, setText] = useState('');
  const [mode, setMode] = useState('medications');
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    request('/status').then(value => { if (active) setStatus(value); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; generation.current++; };
  }, []);

  async function action(fn) {
    const current = generation.current;
    setBusy(true); setError('');
    try { await fn(current); }
    catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function selectPatient(value) {
    generation.current++;
    setPatient(value); setSources([]); setSource('manual'); setText(''); setHistory([]); setSelected(null); setNote('');
    await action(async current => {
      const [sourceResult, historyResult] = await Promise.all([
        request(`/patients/${value.patient_id}/sources`), request(`/analyses?patient_id=${value.patient_id}`)
      ]);
      if (current !== generation.current) return;
      setSources(sourceResult.data); setHistory(historyResult.data);
    });
  }
  function show(value) { setSelected(value); setNote(value.review_note || ''); }
  async function analyze() {
    await action(async current => {
      const [source_type, sourceId] = source.split(':');
      const result = await request('/analyses', { method: 'POST', body: JSON.stringify({
        patient_id: patient.patient_id, source_type, source_id: sourceId ? Number(sourceId) : null, text, mode
      }) });
      if (current !== generation.current) return;
      show(result); setHistory(previous => [result, ...previous].slice(0, 30));
    });
  }
  async function review(review_status) {
    await action(async current => {
      const result = await request(`/analyses/${selected.id}`, { method: 'PATCH',
        body: JSON.stringify({ review_status, review_note: note }) });
      if (current !== generation.current) return;
      show(result); setHistory(previous => previous.map(item => item.id === result.id ? result : item));
    });
  }
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4">
    <header>
      <h1 className="text-3xl font-bold text-teal-900">OpenMed الاستشاري</h1>
      <p className="mt-2 text-gray-600">استخراج إشارات من النص السريري محلياً، مع حفظ النتائج ومراجعتها البشرية.</p>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      النتائج اقتراحات استخراج نصي، وليست تشخيصاً أو توصية علاجية. وجود اسم مرض لا يثبت إصابة المريض به، وقد يكون منفياً أو ضمن تاريخ عائلي.
      النماذج الحالية للنص الإنجليزي فقط. هذه الصفحة لا ترسل إلى نفيس ولا تعدّل المطالبات أو الموافقات.
    </div>
    <p role="status" className="text-sm text-gray-600">{status
      ? `قاعدة البيانات متصلة · ${status.runtime_ready ? 'ملفات النماذج المحلية جاهزة' : 'يلزم تثبيت النماذج المحلية'} · OpenMed ${status.sdk_version}`
      : 'لم يتم تأكيد جاهزية الوحدة'}</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">1. المريض والمصدر</h2>
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); action(async current => {
        const result = await request(`/patients?search=${encodeURIComponent(search)}`);
        if (current === generation.current) setPatients(result.data);
      }); }}>
        <input aria-label="البحث عن مريض بالاسم أو المعرف" className={field} value={search} minLength={2} maxLength={100}
          placeholder="اسم المريض أو المعرف" onChange={event => setSearch(event.target.value)} required />
        <button className={button} disabled={busy || !status}>بحث</button>
      </form>
      <div className="flex flex-wrap gap-2">{patients.map(item => <button key={item.patient_id} disabled={busy}
        onClick={() => selectPatient(item)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">
        {item.name} · {item.identifier}</button>)}</div>
      {patient && <>
        <p className="font-semibold">المريض المحدد: {patient.name} · {patient.identifier}</p>
        <label className="block">مصدر النص
          <select value={source} className={field} disabled={busy} onChange={event => {
            const value = event.target.value; setSource(value); setText('');
            if (value === 'manual') return;
            action(async current => {
              const [type, id] = value.split(':');
              const result = await request(`/patients/${patient.patient_id}/sources/${type}/${id}`);
              if (current === generation.current) setText(result.text);
            });
          }}>
            <option value="manual">ملاحظة يدوية مرتبطة بالمريض</option>
            {sources.map(item => <option key={`${item.source_type}:${item.source_id}`} value={`${item.source_type}:${item.source_id}`}>
              {item.source_type === 'claim' ? 'مطالبة' : 'موافقة'} · {item.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-gray-500">يُقرأ التشخيص والمعلومات الداعمة النصية فقط من المصدر المختار. يمكنك تحرير نسخة النص أدناه؛ تُحفظ مع الاستشارة فقط.</p>
      </>}
    </section>
    {patient && <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">2. التحليل المحلي</h2>
      <label className="block">النموذج
        <select className={field} value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>
          <option value="medications">استخراج الأدوية والمواد الكيميائية</option><option value="diseases">استخراج أسماء الأمراض</option>
        </select>
      </label>
      <label className="block">النص المراد تحليله (إنجليزي)
        <textarea dir="ltr" className={`${field} min-h-[160px]`} maxLength={12000} value={text} disabled={busy}
          onChange={event => setText(event.target.value)} placeholder="Patient takes metformin for type 2 diabetes." />
      </label>
      <p className="text-sm text-gray-500">سيُحفظ النص والنتائج في السجل الاستشاري للمريض. لا يُطبق استخراج هوية تلقائي هنا.</p>
      <button className={button} disabled={busy || !status?.runtime_ready || !text.trim()} onClick={analyze}>
        {busy ? 'جارٍ تنفيذ الطلب…' : 'تحليل وحفظ الاستشارة'}</button>
    </section>}
    {selected && <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">3. النتيجة والمراجعة البشرية</h2>
      <p>{labels[selected.review_status]} · {selected.result.model.id}</p>
      <details><summary className="cursor-pointer">النص المحلل</summary><p dir="auto" className="whitespace-pre-wrap p-3">{selected.input_text}</p></details>
      <div className="overflow-x-auto"><table className="w-full text-right">
        <thead><tr><th className="p-2">النص المستخرج</th><th>التصنيف</th><th>درجة النموذج</th></tr></thead>
        <tbody>{selected.result.entities.map((item, i) => <tr key={i} className="border-t">
          <td dir="auto" className="p-2">{item.text}</td><td>{item.label}</td><td>{(item.confidence * 100).toFixed(1)}%</td>
        </tr>)}</tbody>
      </table></div>
      {!selected.result.entities.length && <p>لم يُستخرج شيء فوق عتبة النموذج؛ هذا لا ينفي وجود حالة أو دواء.</p>}
      <p className="text-sm text-gray-500">درجة النموذج ليست احتمال صحة تشخيص. تحقّق من السياق والنفي والجرعات في المصدر.</p>
      <label className="block">ملاحظة المراجع<textarea className={field} value={note} maxLength={2000} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => review('reviewed')}>تسجيل المراجعة</button>
        <button className="rounded-lg border px-4 py-2" disabled={busy} onClick={() => review('dismissed')}>استبعاد النتيجة</button></div>
    </section>}
    {patient && <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">استشاراتك لهذا المريض — آخر 30 نتيجة</h2>
      {!history.length && <p className="text-gray-500">لا توجد نتائج محفوظة.</p>}
      {history.map(item => <button key={item.id} disabled={busy} onClick={() => show(item)} className="block w-full rounded-lg border p-3 text-right">
        {new Date(item.created_at).toLocaleString('ar')} · {item.mode === 'medications' ? 'الأدوية' : 'الأمراض'} · {labels[item.review_status]}
      </button>)}
    </section>}
  </main>;
}
