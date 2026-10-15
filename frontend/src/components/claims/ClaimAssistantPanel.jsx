import React, { useState } from 'react';
import api, { extractErrorMessage } from '@/services/api';

export default function ClaimAssistantPanel({ claim }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [useModel, setUseModel] = useState(true);
  const [reviewMode, setReviewMode] = useState('assistant');
  const statuses = { completed: 'اكتمل استخراج المصطلحات المحلي', not_requested: 'لم يُطلب تحليل النموذج', unavailable: 'نموذج استخراج المصطلحات غير جاهز؛ اكتملت مراجعة القواعد', no_text: 'لا توجد ملاحظات نصية محفوظة لتحليلها', unsupported_language: 'النموذج الحالي يدعم الإنجليزية فقط؛ اكتملت مراجعة القواعد', input_too_long: 'النص يتجاوز حد التحليل؛ لم يُختصر تلقائيًا', failed_or_busy: 'النموذج مشغول أو تعذر تشغيله؛ نتائج القواعد متاحة' };
  async function review() {
    setBusy(true); setError(''); setResult(null);
    try { const response = await api.request(`/claim-submissions/${claim.id}/assistant-review`, { method: 'POST', body: JSON.stringify({ useModel, reviewMode }), signal: AbortSignal.timeout(130000) }); setResult(response.data); }
    catch (e) { setError(extractErrorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section dir="rtl" className="rounded-xl border bg-white p-6 space-y-4">
    <h2 className="text-lg font-bold">مساعد مراجعة المطالبات</h2>
    <p>يراجع البيانات المحفوظة ويشرح أخطاء نفيس بمصادر موثّقة. احفظ تعديلاتك قبل المراجعة.</p>
    <label className="block">نوع المراجعة<select className="border rounded p-2 mx-2" value={reviewMode} onChange={e => { setReviewMode(e.target.value); setResult(null); }} disabled={busy}><option value="assistant">شرح الأخطاء ومراجعة المطالبة</option><option value="clinical">تدقيق التوثيق السريري — تجريبي، الإنجليزية</option></select></label>
    <p className="text-sm text-gray-600">التدقيق السريري يستخرج مصطلحات من الملاحظات النصية المحفوظة ويقارنها بأوصاف التشخيصات. لا يقرأ المرفقات ولا يولّد رموزًا أو يحسب DRG.</p>
    <label className="flex gap-2"><input type="checkbox" checked={useModel} onChange={e => setUseModel(e.target.checked)} />تفعيل التحليل المساعد — النتائج تحتاج مراجعة المختص</label>
    <button disabled={busy} onClick={review} className="rounded-lg bg-purple-700 text-white px-4 py-2 disabled:opacity-50">{busy ? 'جارٍ التحليل…' : 'مراجعة المطالبة'}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result && <div className="space-y-4">
      <p>{result.model.status === 'api_completed' ? 'اكتملت مراجعة API' : result.model.status === 'api_unavailable' ? 'تعذرت مراجعة API؛ فحوص القواعد متاحة' : statuses[result.model.status]} — {result.external_data_sent ? 'أُرسلت محاولة تحليل إلى المزود الخارجي المُعدّ على الخادم.' : 'لم تُرسل البيانات إلى خدمة خارجية.'}</p>
      {result.api?.text && <article className="border rounded-lg p-4"><h3 className="font-bold">اقتراحات مساعد المراجعة — تحتاج مراجعة</h3><p className="whitespace-pre-wrap">{result.api.text}</p></article>}
      <h3 className="font-bold">ملاحظات الاكتمال والاتساق ({result.checks.length})</h3>
      {!result.checks.length && <p>لم ترصد الفحوص المتاحة نواقص. هذه ليست موافقة على المطالبة.</p>}
      {[...result.checks, ...result.warnings, ...result.explanations].map((item, i) => <article key={i} className="border rounded-lg p-3 space-y-1"><strong>{item.code}</strong><p>{item.message}</p>{item.field && <p dir="ltr">{item.field}</p>}{item.source?.url ? <a className="text-purple-700 underline" href={item.source.url} target="_blank" rel="noreferrer">{item.source.title}</a> : item.source?.title}</article>)}
      {result.clinical_audit?.length > 0 && <div className="space-y-2"><h3 className="font-bold">تدقيق التوثيق — مقارنة نصية تجريبية</h3>{result.clinical_audit.map((finding, i) => <article key={i} className="border rounded p-3"><strong dir="auto">{finding.text}</strong><p>{finding.message}</p><p>المصدر: ملاحظة {finding.supporting_info_sequence}</p><blockquote dir="auto">{finding.source_text}</blockquote></article>)}</div>}
      <h3 className="font-bold">مصطلحات مستخرجة — تحتاج مراجعة المختص</h3>
      {result.entities.map((entity, i) => <article className="border rounded p-3" key={i}><strong dir="auto">{entity.text}</strong><p>المصدر: ملاحظة {entity.supporting_info_sequence}؛ درجة النموذج {(entity.confidence * 100).toFixed(0)}% (ليست احتمال صحة التشخيص)</p><blockquote dir="auto" className="text-sm whitespace-pre-wrap">{entity.source_text}</blockquote></article>)}
      {result.limitations.map(text => <p className="text-sm text-gray-600" key={text}>{text}</p>)}
    </div>}
  </section>;
}
