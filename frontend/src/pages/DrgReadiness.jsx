import React, { useState } from 'react';
import { FileText, Calculator, ClipboardCheck } from 'lucide-react';

const checklist = [
  'توفير وتثبيت Grouper معتمد من CHI يدعم AR-DRG v9.0',
  'ربط Grouper بنظام HIS لتجهيز المطالبات تلقائيًا',
  'اختبار إرسال DRG في بيئة نفيس التجريبية',
  'اختبار إرسال DRG في بيئة نفيس الإنتاجية',
  'تفعيل ICD-10-AM الإصدار العاشر في HIS',
  'استكمال جميع حقول الحد الأدنى للبيانات MDS',
  'إنشاء برنامج CDI وتعيين منسق له',
  'إكمال تدريب الأطباء على DRG',
  'تدريب المرمزين على AR-DRG v9.0 ومنطق DCL/ECCS',
  'توفير لوحة متابعة CMI ومعدل الأخطاء ومدة الإقامة',
  'تحقيق معدل Error DRG أقل من 5% في الاختبار الأولي',
  'توثيق وتفعيل برنامج ضمان جودة الترميز الداخلي',
  'تدريب الفريق المالي على معادلة DRG وMRP',
  'إبلاغ شركة التأمين أو TPA بتاريخ بدء الفوترة الظلية',
];

const mds = [
  ['التشخيص الرئيسي', 'ICD-10-AM؛ السبب الرئيسي للدخول بعد التقييم.'],
  ['التشخيصات الإضافية', 'الأمراض المصاحبة والمضاعفات المؤثرة في العلاج أو الموارد.'],
  ['الإجراءات', 'جميع التدخلات بترميز ACHI / SBS.'],
  ['العمر والجنس', 'العمر عند الدخول والجنس المسجل للمريض.'],
  ['الدخول والخروج', 'التاريخ والوقت الفعلي لكل منهما.'],
  ['حالة الخروج', 'المنزل أو التحويل أو الوفاة وغيرها وفق السجل الطبي.'],
  ['وزن الولادة', 'إلزامي لحديثي الولادة بعمر 28 يومًا أو أقل.'],
  ['ساعات التهوية الميكانيكية', 'إجمالي الساعات الموثقة عند انطباقها.'],
  ['نوع اللقاء', 'تنويم أو حالة يوم واحد.'],
  ['أيام الإجازة', 'الأيام التي غاب فيها المريض مؤقتًا أثناء التنويم عند انطباقها.'],
];

const errors = [
  ['960Z', 'حلقة لا يمكن تصنيفها ضمن MDC'],
  ['961Z', 'تشخيص رئيسي غير مقبول'],
  ['963Z', 'عدم اتساق بيانات حديث الولادة مع العمر أو وزن الولادة'],
  ['801', 'إجراء غير مرتبط سريريًا بالتشخيص الرئيسي'],
];

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500';
const panelClass = 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm';
const money = value => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(value);

export default function DrgReadiness() {
  const [tab, setTab] = useState('overview');
  const [baseRate, setBaseRate] = useState('');
  const [weight, setWeight] = useState('');
  const [ffs, setFfs] = useState('');
  const [statuses, setStatuses] = useState({});
  const base = Number(baseRate);
  const relativeWeight = Number(weight);
  const ffsAmount = Number(ffs);
  const hasEstimate = baseRate.trim() !== '' && weight.trim() !== '' && Number.isFinite(base) && Number.isFinite(relativeWeight) && base > 0 && relativeWeight > 0 && Number.isFinite(base * relativeWeight);
  const hasFfs = ffs.trim() !== '' && Number.isFinite(ffsAmount) && ffsAmount >= 0;
  const estimate = hasEstimate ? Math.round(base * relativeWeight * 100) / 100 : null;
  const completed = checklist.filter((_, i) => statuses[i]?.status === 'yes').length;
  const exportReadiness = () => {
    const report = { source: 'CHI DRG Implementation Guideline v1.0, Appendix C', createdAt: new Date().toISOString(), completed, total: checklist.length, items: checklist.map((criterion, i) => ({ criterion, status: statuses[i]?.status || 'unspecified', targetDate: statuses[i]?.date || null })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chi-drg-readiness.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const documents = [
    ['دليل تطبيق CHI-DRG — الإصدار 1.0', 'CHI-DRG-ImplementationGuidelines.pdf'],
    ['خطة الفوترة الظلية — 5 يوليو 2026', 'CHI_DRG_ShadowBillingPlan_5July2026.pdf'],
  ];

  return (
    <div dir="rtl" className="space-y-6 text-gray-800">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">CHI-DRG والفوترة الظلية</h1>
        <p className="mt-2 text-gray-600">أدلة التطبيق، المقارنة المالية ومتطلبات الجاهزية من ملفات Naphisnew.</p>
      </header>
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-purple-900">
        في مرحلة الفوترة الظلية تُدفع المطالبة وفق FFS، وتُستخدم بيانات DRG للتحقق والتحليل. افتح تبويب DRG / MDS داخل المطالبة لإدخال ناتج Grouper المعتمد والتحقق قبل الإرسال.
      </div>
      <nav aria-label="أقسام DRG" className="flex flex-wrap gap-2">
        { [['overview', 'الأدلة والمتطلبات', FileText], ['calculator', 'مقارنة DRG وFFS', Calculator], ['readiness', 'قائمة الجاهزية', ClipboardCheck]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={`flex items-center gap-2 rounded-lg px-4 py-3 font-medium ${tab === id ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon className="h-5 w-5" />{label}</button>
        )) }
      </nav>

      {tab === 'overview' && <div className="space-y-6">
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">المراجع الأصلية</h2>
          <div className="mt-4 flex flex-wrap gap-3">{documents.map(([label, name]) => <a key={name} href={`${import.meta.env.BASE_URL}documents/drg/${name}`} target="_blank" rel="noreferrer" className="rounded-lg border border-purple-200 px-4 py-3 text-purple-700 hover:bg-purple-50">{label} ↗</a>)}</div>
          <p className="mt-4 text-sm text-gray-500">المحتوى مستخلص من النسخ المرفقة. تحدد الخطة فترة 2026–2027 للفوترة الظلية و2028 للتطبيق الكامل؛ تاريخ إطلاق الإنتاج في عرض يوليو 2026 غير محدد (TBD).</p>
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">النطاق ومسار المطالبة</h2>
          <p className="mt-3">يشمل التنويم وحالات اليوم الواحد. لا يشمل العيادات الخارجية والطوارئ دون دخول، أو التأهيل والرعاية دون تصنيف تنويم.</p>
          <ol className="mt-4 list-inside list-decimal space-y-2"><li>استكمال التوثيق السريري وترميز التشخيصات والإجراءات.</li><li>إسناد AR-DRG v9.0 باستخدام Grouper معتمد.</li><li>إرفاق رمز DRG ووصفه كبيانات منظمة مع مطالبة FFS بعد الخروج.</li><li>تحقق نفيس وشركة التأمين، ثم تحليل الملاحظات دون أثر على الدفع في المرحلة الظلية.</li></ol>
          <p className="mt-4 text-sm text-gray-600">المعايير: ICD-10-AM الإصدار العاشر وSBS v3. ناتج Grouper الكامل يشمل DRG وADRG وMDC وECCS وDCL وإشارات الأخطاء.</p>
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">الحد الأدنى للبيانات MDS</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="bg-gray-50"><th className="p-3">الحقل</th><th className="p-3">المتطلب</th></tr></thead><tbody>{mds.map(([label, detail]) => <tr key={label} className="border-t"><th scope="row" className="p-3 font-medium">{label}</th><td className="p-3">{detail}</td></tr>)}</tbody></table></div>
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={panelClass}><h2 className="text-xl font-semibold">أخطاء التصنيف</h2><ul className="mt-4 space-y-3">{errors.map(([code, label]) => <li key={code}><span className="inline-block rounded bg-red-50 px-2 font-mono text-red-700" dir="ltr">{code}</span> — {label}</li>)}</ul><p className="mt-4 text-sm text-gray-600">يحدد القسم 4.2.3 سقفًا شهريًا 3% للأخطاء 960Z و961Z و963Z. تجاوزه لشهرين متتاليين يستلزم خطة تحسين. معيار الاختبار الأولي في قائمة الجاهزية أقل من 5%.</p></section>
          <section className={panelClass}><h2 className="text-xl font-semibold">المراقبة والتقارير</h2><p className="mt-4">متابعة عدد حالات الدخول، توزيع DRG، متوسط الأوزان النسبية (CMI)، معدل الأخطاء، متوسط الإقامة، الحالات الشاذة والفارق المالي مع FFS.</p><p className="mt-3">تدقيق ترميز داخلي ربع سنوي وخارجي سنوي بدءًا من 2027، تقارير جاهزية ربع سنوية، وإبلاغ CHI بالمشكلات الحرجة خلال 5 أيام عمل.</p><p className="mt-3 text-sm text-gray-500">أهداف القسم 8.4 المقترحة بانتظار تأكيد CHI: اكتمال MDS ≥98%، دقة الترميز ≥80%، الإرسال خلال 7 أيام ≥95%، عدم تطابق DRG ≤5%.</p></section>
        </div>
        <section className={panelClass}><h2 className="text-xl font-semibold">العناصر المفوترة منفصلة عند التطبيق الكامل</h2><p className="mt-3">الأطراف الصناعية والغرسات، أدوية العلاج الكيميائي، الأجهزة المتخصصة، الطوارئ قبل الدخول والمتابعة بعد الخروج.</p><p className="mt-3 text-sm text-gray-500">MRP مرجع تفاوضي غير ملزم. تعديلات مدة الإقامة والتحويل تحتاج قواعد معتمدة ومخرجات Grouper.</p></section>
      </div>}

      {tab === 'calculator' && <section className={panelClass}>
        <h2 className="text-xl font-semibold">تقدير السعر الأساسي للحالة</h2>
        <p className="mt-2 text-gray-600">السعر الأساسي للحالة = السعر المتفق عليه × الوزن النسبي. أدخل الوزن من المصدر المعتمد والسعر من عقد مقدم الخدمة مع شركة التأمين.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">{[['base', 'السعر المتفق عليه (SAR)', baseRate, setBaseRate], ['weight', 'الوزن النسبي RW', weight, setWeight], ['ffs', 'مبلغ FFS للمقارنة (SAR)', ffs, setFfs]].map(([id, label, value, setter]) => <label key={id} htmlFor={id} className="space-y-2"><span className="block text-sm font-medium">{label}</span><input id={id} type="number" min="0" step="any" value={value} onChange={e => setter(e.target.value)} className={inputClass} dir="ltr" /></label>)}</div>
        <div aria-live="polite" className="mt-6 rounded-xl bg-purple-50 p-5"><p>تقدير DRG: <strong>{hasEstimate ? money(estimate) : 'أدخل سعرًا ووزنًا موجبين'}</strong></p>{hasEstimate && hasFfs && <><p className="mt-2">الفارق (DRG − FFS): <strong>{money(estimate - ffsAmount)}</strong></p><p className="mt-2">نسبة الفارق: {ffsAmount > 0 ? `${((estimate - ffsAmount) / ffsAmount * 100).toFixed(2)}%` : 'غير محسوبة عندما يكون FFS صفرًا'}</p></>}</div>
        <p className="mt-4 text-sm text-gray-500">تقدير للتحليل فقط قبل تعديلات الإقامة والتحويل والعناصر المستثناة. لا يحدد استحقاق الدفع ولا يغيّر مبلغ المطالبة.</p>
      </section>}

      {tab === 'readiness' && <section className={panelClass}>
        <h2 className="text-xl font-semibold">قائمة الجاهزية — الملحق C</h2>
        <button type="button" onClick={exportReadiness} className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-white">تنزيل تقرير الجاهزية</button>
        <p className="mt-2 text-gray-600">مكتمل: {completed} من {checklist.length}. هذه قائمة عمل مؤقتة للجلسة؛ النسخة الموقعة تُرفع عبر بوابة CHI.</p>
        <div className="mt-4 h-2 overflow-hidden rounded bg-gray-100"><div className="h-full bg-purple-600" style={{ width: `${completed / checklist.length * 100}%` }} /></div>
        <div className="mt-6 space-y-4">{checklist.map((label, i) => <div key={label} className="grid items-center gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-[1fr_160px_170px]"><p>{i + 1}. {label}</p><select aria-label={`حالة: ${label}`} className={inputClass} value={statuses[i]?.status || ''} onChange={e => setStatuses(previous => ({ ...previous, [i]: { ...previous[i], status: e.target.value } }))}><option value="">غير محدد</option><option value="yes">نعم</option><option value="no">لا</option><option value="progress">قيد التنفيذ</option></select><label className="text-sm text-gray-500">التاريخ المستهدف<input aria-label={`التاريخ المستهدف: ${label}`} type="date" className={inputClass} value={statuses[i]?.date || ''} onChange={e => setStatuses(previous => ({ ...previous, [i]: { ...previous[i], date: e.target.value } }))} /></label></div>)}</div>
      </section>}
    </div>
  );
}
