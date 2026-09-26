import React, { useState } from 'react';

// Error report for one analysis during the pilot. A serious report pauses the assistant for
// the whole pilot until an administrator resolves it.

const CATEGORIES = {
  wrong_assertion: 'إثبات/نفي خاطئ', wrong_experiencer: 'صاحب الحالة خاطئ', wrong_temporality: 'زمن خاطئ',
  wrong_medication_status: 'حالة دواء خاطئة', missed_entity: 'كيان لم يُستخرج', wrong_entity: 'كيان مستخرج خطأً',
  wrong_medication_detail: 'جرعة/وحدة/طريق خاطئ', wrong_reference: 'مرجع غير مناسب', unsupported_statement: 'معلومة غير مسندة',
  access_or_privacy: 'وصول أو خصوصية', performance: 'بطء أو تعطل', other: 'أخرى'
};
const SEVERITY = { minor: 'بسيط', moderate: 'متوسط', serious: 'خطير — يوقف التجربة حتى المراجعة' };

export default function IssueReport({ analysis, request }) {
  const entities = analysis.result?.context?.entities || [];
  const [form, setForm] = useState({ category: 'wrong_assertion', severity: 'minor', entity_index: '', description: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true); setError(''); setMessage('');
    try {
      const saved = await request('/issues', { method: 'POST', body: JSON.stringify({
        analysis_id: analysis.id, category: form.category, severity: form.severity,
        entity_index: form.entity_index === '' ? null : Number(form.entity_index), description: form.description }) });
      setMessage(saved.pauses_pilot ? 'سُجّل البلاغ. أُوقف المساعد لجميع المشاركين حتى يراجع المسؤول البلاغ.' : 'سُجّل البلاغ. شكراً.');
      setForm(f => ({ ...f, description: '' }));
    } catch (e) { setError(e.message); } finally { setSending(false); }
  }

  return <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">الإبلاغ عن خطأ في هذه النتيجة</summary>
    <form className="mt-3 space-y-2" onSubmit={submit}>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm">نوع الخطأ
          <select className="w-full rounded border p-2" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">الخطورة
          <select className="w-full rounded border p-2" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            {Object.entries(SEVERITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">الكيان (اختياري)
          <select className="w-full rounded border p-2" value={form.entity_index} onChange={e => setForm(f => ({ ...f, entity_index: e.target.value }))}>
            <option value="">—</option>
            {entities.map(e => <option key={e.index} value={e.index}>{e.text}</option>)}</select></label>
      </div>
      <label className="block text-sm">الوصف — لا تكتب اسم المريض أو هويته أو رقم ملفه
        <textarea className="w-full rounded border p-2" maxLength={2000} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
      {form.severity === 'serious' && <p className="text-sm text-red-800">البلاغ الخطير يوقف المساعد لكل المشاركين في التجربة حتى يُراجع.</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-2 text-red-800">{error}</p>}
      {message && <p role="status" className="rounded bg-teal-50 p-2 text-teal-900">{message}</p>}
      <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40" disabled={sending}>إرسال البلاغ</button>
    </form>
  </details>;
}
