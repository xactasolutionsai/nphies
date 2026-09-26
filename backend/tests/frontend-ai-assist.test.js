// Pure helpers behind the advisory AI UI (frontend/src/utils/aiAssist.js): what the clinical-text
// enhancement sends, how its reply is read (never applied without Accept), SNOMED chips, the
// review-panel duration, the chat status dot and the safe chat Markdown subset.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_UNAVAILABLE_TEXT, buildEnhanceContext, interpretEnhanceResponse, formatDuration,
  readSnomedSuggestions, parseChatMarkdown, chatHealthStatus
} from '../../frontend/src/utils/aiAssist.js';

test('enhance context: age/gender and clinical context only, no patient name, national ID, provider or insurer names', () => {
  const formData = {
    auth_type: 'professional', priority: 'normal', encounter_class: 'ambulatory',
    patient_name: 'Synthetic Person', national_id: '1098765432',
    clinical_info: { chief_complaint_text: 'Abdominal pain', chief_complaint_code: '21522001' },
    diagnoses: [{ diagnosis_code: 'R10.4', diagnosis_display: 'Abdominal pain', diagnosis_type: 'principal' }],
    vital_signs: { systolic: '120', diastolic: '80' },
    items: [{ product_or_service_code: '83610-00-00', service_description: 'Consultation', quantity: 1 }]
  };
  const context = buildEnhanceContext(formData, { patientAge: 42, patientGender: 'female', providerType: 'hospital' });
  for (const key of ['patientName', 'patientId', 'providerName', 'insurerName']) assert.equal(key in context, false, key);
  const text = JSON.stringify(context);
  for (const phi of ['Synthetic Person', '1098765432']) assert.ok(!text.includes(phi), `${phi} sent`);
  assert.equal(context.patientAge, 42);
  assert.equal(context.patientGender, 'female');
  assert.equal(context.chiefComplaint, 'Abdominal pain');
  assert.deepEqual(context.diagnoses[0], { code: 'R10.4', display: 'Abdominal pain', description: '', type: 'principal' });
  assert.equal(context.requestedServices[0].code, '83610-00-00');
});

test('enhance reply: a suggestion is returned for preview; enhanced:false / disabled / errors are "unavailable"', () => {
  assert.equal(AI_UNAVAILABLE_TEXT, 'AI unavailable — manual review required');
  assert.deepEqual(interpretEnhanceResponse({ success: true, enhanced: true, enhancedText: ' Longer text. ' }, 'short'),
    { status: 'suggestion', text: 'Longer text.' });
  assert.deepEqual(interpretEnhanceResponse({ success: true, enhanced: true, enhancedText: 'same' }, 'same'), { status: 'unchanged' });
  const failed = interpretEnhanceResponse({ success: false, enhanced: false, enhancedText: 'short', error: 'Ollama unreachable' }, 'short');
  assert.deepEqual(failed, { status: 'unavailable', reason: 'Ollama unreachable' });
  assert.equal(interpretEnhanceResponse({ success: false, disabled: true, message: AI_UNAVAILABLE_TEXT }, 'x').status, 'unavailable');
  assert.equal(interpretEnhanceResponse({ success: true, enhanced: false, analysisIncomplete: true }, 'x').status, 'unavailable');
  assert.equal(interpretEnhanceResponse(null, 'x').status, 'unavailable');
  assert.equal(interpretEnhanceResponse({ success: true, enhanced: true, enhancedText: '' }, 'x').status, 'unavailable');
});

test('durations carry a unit', () => {
  assert.equal(formatDuration(922), '0.9 s');
  assert.equal(formatDuration(12345), '12 s');
  assert.equal(formatDuration('922'), '0.9 s');
  assert.equal(formatDuration('1.23s'), '1.23s');
  assert.equal(formatDuration(undefined), null);
});

test('SNOMED suggestions: at most three chips; failures are unavailable, never an empty success', () => {
  const ok = readSnomedSuggestions({ success: true, suggestions: [
    { code: '21522001', display: 'Abdominal pain ' }, { code: '', display: 'no code' }, { code: '1', display: 'a' },
    { code: '2', display: 'b' }, { code: '3', display: 'c' }
  ] });
  assert.deepEqual(ok, { available: true, suggestions: [{ code: '21522001', display: 'Abdominal pain' }, { code: '1', display: 'a' }, { code: '2', display: 'b' }] });
  assert.deepEqual(readSnomedSuggestions({ success: false, suggestions: [], error: 'fetch failed' }), { available: false, reason: 'fetch failed' });
  assert.equal(readSnomedSuggestions({ success: true, suggestions: [] }).available, false);
  assert.equal(readSnomedSuggestions({ success: false, disabled: true }).available, false);
});

test('chat status dot follows /api/ai/health', () => {
  assert.equal(chatHealthStatus({ enabled: true, reachable: true, modelPresent: true }), 'online');
  assert.equal(chatHealthStatus({ enabled: true, reachable: false }), 'offline');
  assert.equal(chatHealthStatus({ enabled: false, reachable: null }), 'offline');
  assert.equal(chatHealthStatus({ enabled: true, reachable: true, modelPresent: false }), 'offline');
  assert.equal(chatHealthStatus(null), 'unknown');
});

test('chat Markdown: bold, lists and line breaks become data; HTML stays literal text', () => {
  const blocks = parseChatMarkdown('**Main interactions**\nWith ibuprofen:\n\n- **Warfarin**: bleeding risk\n- ACE inhibitors\n\n1. First\n2. Second\n## Note\n<img src=x onerror=alert(1)>');
  assert.deepEqual(blocks[0], { type: 'paragraph', lines: [[{ text: 'Main interactions', bold: true }], [{ text: 'With ibuprofen:', bold: false }]] });
  assert.deepEqual(blocks[1], { type: 'list', ordered: false, items: [
    [{ text: 'Warfarin', bold: true }, { text: ': bleeding risk', bold: false }],
    [{ text: 'ACE inhibitors', bold: false }]
  ] });
  assert.deepEqual(blocks[2], { type: 'list', ordered: true, items: [[{ text: 'First', bold: false }], [{ text: 'Second', bold: false }]] });
  assert.deepEqual(blocks[3], { type: 'heading', inline: [{ text: 'Note', bold: false }] });
  assert.deepEqual(blocks[4], { type: 'paragraph', lines: [[{ text: '<img src=x onerror=alert(1)>', bold: false }]] });
  assert.deepEqual(parseChatMarkdown(''), []);
  assert.deepEqual(parseChatMarkdown('a ** b'), [{ type: 'paragraph', lines: [[{ text: 'a ** b', bold: false }]] }]);
});
