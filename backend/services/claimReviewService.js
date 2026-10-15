import { validateDrg } from './drgValidation.js';
import { runtimeReady, runLocalAnalysis } from '../openmed/inference.js';
import { reviewApiConfigured, reviewViaApi } from './claimReviewApi.js';
import { auditMentions } from './clinicalAudit.js';

const source = { title: 'NPHIES OBA v3.5 — DRG cycle 7.14 / UC-03', url: 'https://v-academy.nphies.sa/lesson/113/drg-doc-release' };
const explanations = {
  'IB-00030': 'الرمز أو نظام الترميز غير موجود في مجموعة القيم المطلوبة. إذا كان الحقل أول بند DRG، تحقق من استخدام http://nphies.sa/terminology/CodeSystem/drg ومن الرمز في الكتالوج الرسمي.',
  'BV-01185': 'وصف DRG مفقود أو لا يطابق الوصف الرسمي. استخدم وصف الرمز المطابق للكتالوج، ولا تغيّر الرمز السريري لمجرد تجاوز الخطأ.',
  'BV-01346': 'يجب إرسال رمز DRG واحد في أول بند للحالات المنومة أو اليوم الواحد عند تفعيل الإلزام.',
  'BV-01198': 'علامة Package غير مسموحة في مطالبة DRG. راجع بنود المطالبة وتفاصيلها.',
  'BV-01200': 'أرفق مستند الحالة المطلوب للتنويم قبل الإرسال.',
  'IB-00242': 'نوع المرفق غير مقبول. تحقق من contentType؛ التجربة الحالية تقبل PDF وJPEG، ولا تقبل application/json كمرفق.',
  'IC-01428': 'تاريخ إنشاء المرفق مطلوب. راجع valueAttachment.creation.'
};

export function explainClaimErrors(claim) {
  const found = new Map();
  const visit = (value, depth = 0) => {
    if (!value || depth > 18) return;
    if (Array.isArray(value)) { for (const item of value.slice(0, 500)) visit(item, depth + 1); return; }
    if (typeof value !== 'object') return;
    if (typeof value.code === 'string' && /^(IB|IC|BV)-\d{5}$/.test(value.code)) {
      const code = value.code;
      found.set(code, { code, message: explanations[code] || 'لا يوجد تفسير موثّق لهذا الرمز في قاعدة المساعد الحالية. راجع رسالة نفيس والمواصفة؛ لا تغيّر البيانات بناءً على تخمين.', known: !!explanations[code], source: explanations[code] ? { ...source, evidence: 'المواصفة والعينات الرسمية، وردود sandbox الموثقة في 13 أكتوبر 2026' } : null });
    }
    for (const [key, item] of Object.entries(value)) if (!['data', 'base64_content', 'request_bundle'].includes(key)) visit(item, depth + 1);
  };
  visit(claim.responses); visit(claim.response_bundle);
  return [...found.values()];
}

export async function reviewClaim(claim, { useModel = false, reviewMode = 'assistant', ready = runtimeReady, analyze = runLocalAnalysis } = {}) {
  const validation = validateDrg(claim);
  const result = { reviewed_at: new Date().toISOString(), advisory_only: true, claim_updated_at: claim.updated_at, external_data_sent: false,
    checks: validation.errors.map(e => ({ ...e, source: { title: 'CHI DRG Implementation Guideline — sections 3.4, 4.3, 5, 6', url: '/documents/drg/CHI-DRG-ImplementationGuidelines.pdf' } })),
    warnings: validation.warnings, explanations: explainClaimErrors(claim),
    model: { available: reviewApiConfigured() || ready(), status: 'not_requested', language: reviewApiConfigured() ? 'ar/en' : 'en' }, entities: [],
    limitations: ['المراجعة استشارية ولا تحفظ تعديلات أو ترسل المطالبة.', 'اكتمال الفحوص لا يضمن قبول نفيس أو صحة التصنيف السريري.', 'OpenMed يستخرج مصطلحات إنجليزية؛ لا يحسب DRG ولا يثبت التشخيص أو نفيه.'] };
  if (!claim.items?.length) result.checks.push({ code: 'CLAIM_ITEMS', field: 'items', message: 'المطالبة لا تحتوي بنود خدمات.', source: { title: 'فحص اكتمال محلي' } });
  result.review_mode = reviewMode;
  result.clinical_audit = [];
  if (!useModel) return result;
  if (reviewMode !== 'clinical' && reviewApiConfigured()) {
    result.api = await reviewViaApi(claim, result);
    result.external_data_sent = result.api.attempted;
    result.model.status = result.api.status === 'completed' ? 'api_completed' : 'api_unavailable';
    return result;
  }
  result.model.available = ready();
  result.model.language = 'en';
  const notes = (claim.supporting_info || []).filter(s => typeof s.value_string === 'string' && s.value_string.trim()).map(s => ({ sequence: s.sequence, text: s.value_string }));
  if (!result.model.available) { result.model.status = 'unavailable'; return result; }
  if (!notes.length) { result.model.status = 'no_text'; return result; }
  if (notes.some(n => /[\u0600-\u06ff]/.test(n.text))) { result.model.status = 'unsupported_language'; return result; }
  const combined = notes.map(n => n.text).join('\n\n');
  if (combined.length > 12000 || notes.length > 8) { result.model.status = 'input_too_long'; return result; }
  try {
    const output = await analyze(combined, 'diseases');
    result.model.details = output.model;
    let offset = 0;
    for (const note of notes) {
      result.entities.push(...output.entities.filter(e => e.start >= offset && e.end <= offset + note.text.length && combined.slice(e.start, e.end) === e.text).map(e => ({ ...e, start: e.start - offset, end: e.end - offset, supporting_info_sequence: note.sequence, source_text: note.text })));
      offset += note.text.length + 2;
    }
    result.model.status = 'completed';
    result.clinical_audit = auditMentions(claim, result.entities);
  } catch { result.model.status = 'failed_or_busy'; }
  return result;
}
