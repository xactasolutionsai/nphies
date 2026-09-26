/**
 * Pure helpers for advisory AI UI (no React, no imports), shared by the prior-authorization form,
 * the AI panels and the chat. Tested in backend/tests/frontend-ai-assist.test.js.
 */

export const AI_UNAVAILABLE_TEXT = 'AI unavailable — manual review required';

/**
 * Context sent with "Enhance with AI". Only age/gender and clinical context: no patient name,
 * national ID / iqama, provider or insurer names (the enhancement does not need identifiers).
 */
export function buildEnhanceContext(formData = {}, { patientAge = null, patientGender = '', providerType = '' } = {}) {
  const clinical = formData.clinical_info || {};
  const vitals = formData.vital_signs || {};
  return {
    patientAge,
    patientGender: patientGender || '',
    authType: formData.auth_type || '',
    priority: formData.priority || '',
    encounterClass: formData.encounter_class || '',
    claimSubtype: formData.claim_subtype || '',
    chiefComplaint: clinical.chief_complaint_display || clinical.chief_complaint_text || '',
    chiefComplaintCode: clinical.chief_complaint_code || '',
    diagnoses: (formData.diagnoses || []).map(d => ({
      code: d.diagnosis_code || '',
      display: d.diagnosis_display || '',
      description: d.diagnosis_description || '',
      type: d.diagnosis_type || ''
    })),
    vitalSigns: {
      systolic: vitals.systolic || '',
      diastolic: vitals.diastolic || '',
      pulse: vitals.pulse || '',
      temperature: vitals.temperature || '',
      oxygen_saturation: vitals.oxygen_saturation || '',
      respiratory_rate: vitals.respiratory_rate || '',
      height: vitals.height || '',
      weight: vitals.weight || ''
    },
    requestedServices: (formData.items || []).map(item => ({
      code: item.product_or_service_code || item.medication_code || '',
      description: item.service_description || item.medication_name || '',
      quantity: item.quantity || '',
      bodySite: item.body_site || '',
      tooth: item.tooth_number || ''
    })),
    providerType: providerType || '',
    admissionWeight: formData.admission_info?.admission_weight || '',
    estimatedLengthOfStay: formData.admission_info?.estimated_length_of_stay || ''
  };
}

/**
 * Reads an /ai-validation/enhance-clinical reply. The suggestion is never applied here:
 * { status: 'suggestion', text } | { status: 'unchanged' } | { status: 'unavailable', reason }.
 * A failed, disabled or partial enhancement (enhanced:false) is "unavailable", never a silent no-op.
 */
export function interpretEnhanceResponse(response, originalText) {
  if (!response || response.disabled || response.enhanced === false || response.success === false) {
    return { status: 'unavailable', reason: response?.error || response?.message || '' };
  }
  const text = typeof response.enhancedText === 'string' ? response.enhancedText.trim() : '';
  if (!text) return { status: 'unavailable', reason: 'The AI returned no text.' };
  if (text === String(originalText ?? '').trim()) return { status: 'unchanged' };
  return { status: 'suggestion', text };
}

/**
 * Duration for display: numbers are milliseconds ("922" -> "0.9 s"); strings that already carry a
 * unit ("1.23s") are returned as is. Unknown -> null.
 */
export function formatDuration(value) {
  if (value === null || value === undefined || value === '') return null;
  const ms = typeof value === 'number' ? value : (/^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : NaN);
  if (!Number.isFinite(ms)) return String(value);
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
}

/**
 * Reads an /ai-validation/suggest-snomed reply into at most `max` chips:
 * { available: true, suggestions: [{ code, display }] } or { available: false, reason }.
 */
export function readSnomedSuggestions(response, max = 3) {
  if (!response || response.disabled || response.success !== true || !Array.isArray(response.suggestions)) {
    return { available: false, reason: response?.error || response?.message || '' };
  }
  const suggestions = response.suggestions
    .filter(s => s && typeof s.code === 'string' && s.code.trim() && typeof s.display === 'string')
    .slice(0, max)
    .map(s => ({ code: s.code.trim(), display: s.display.trim() }));
  if (suggestions.length === 0) return { available: false, reason: 'No SNOMED suggestion was returned.' };
  return { available: true, suggestions };
}

/**
 * Minimal Markdown subset for chat answers, parsed into plain data (never HTML):
 * blocks { type: 'paragraph', lines: [inline[]] } | { type: 'list', ordered, items: [inline[]] }
 * | { type: 'heading', inline }. Inline runs are { text, bold }. Supports **bold** / __bold__,
 * "-", "*", "•" and "1." list items, "#" headings and line breaks. Everything else stays text.
 */
export function parseChatMarkdown(text) {
  const blocks = [];
  let paragraph = null;
  let list = null;
  const close = () => { paragraph = null; list = null; };
  for (const rawLine of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) { close(); continue; }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      close();
      blocks.push({ type: 'heading', inline: parseInline(heading[1]) });
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        paragraph = null;
        list = { type: 'list', ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(parseInline((bullet || numbered)[1]));
    } else {
      list = null;
      if (!paragraph) { paragraph = { type: 'paragraph', lines: [] }; blocks.push(paragraph); }
      paragraph.lines.push(parseInline(line.trim()));
    }
  }
  return blocks;
}

function parseInline(text) {
  const runs = [];
  const pattern = /(\*\*|__)(.+?)\1/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), bold: false });
    runs.push({ text: match[2], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs;
}

/** Status of the chat header dot from GET /api/ai/health: 'online' | 'offline' | 'unknown'. */
export function chatHealthStatus(health) {
  if (!health) return 'unknown';
  if (health.enabled !== true || health.reachable === false || health.modelPresent === false) return 'offline';
  return health.reachable === true ? 'online' : 'unknown';
}
