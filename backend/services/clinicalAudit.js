// Text matching is a documentation aid, never a clinical code equivalence test.
const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function auditMentions(claim, entities) {
  const descriptions = (claim.diagnoses || []).map(d => normalize(d.diagnosis_display)).filter(Boolean);
  return entities.map(entity => {
    const prefix = entity.source_text.slice(Math.max(0, entity.start - 100), entity.start);
    const sentencePrefix = prefix.split(/[.!?\n]/).at(-1);
    const contextual = /\b(no|not|denies|without|negative|rule out|suspected|possible|differential|versus|family|history)\b/i.test(sentencePrefix) || /DIFFERENTIAL|STATUS|DATE/.test(entity.label || '');
    const term = normalize(entity.text);
    const matched = !!term && descriptions.some(d => d === term || (` ${d} `).includes(` ${term} `));
    return { ...entity, code: contextual ? 'CONTEXT_REVIEW' : matched ? 'TEXT_MATCH' : 'DOCUMENTATION_REVIEW',
      message: contextual ? 'السياق قد يتضمن نفيًا أو تاريخًا مرضيًا أو احتمالًا؛ لا تضف تشخيصًا اعتمادًا على الاستخراج.' : matched ? 'يوجد تطابق نصي مع وصف تشخيص محفوظ؛ هذا ليس تحققًا من صحة الرمز.' : 'راجع هذا المصطلح مع التشخيصات المحفوظة؛ عدم التطابق النصي لا يعني وجود تشخيص ناقص.',
      requires_human_review: true, auto_coding: false };
  });
}
