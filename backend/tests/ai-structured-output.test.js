// C5: every LLM reply that drives a clinical/validation result is requested with Ollama
// structured output (`format` = JSON Schema), parsed as strict JSON and validated against the
// same schema. Prose, malformed JSON and schema violations fail closed (never "valid").
// Only fake LLM transports are used: generateCompletion is mocked, nothing leaves the process.
import test from 'node:test';
import assert from 'node:assert/strict';
import ollamaService, * as ollamaModule from '../services/ollamaService.js';
import medbotService from '../services/medbotService.js';
import medicationSafetyService, * as medicationModule from '../services/medicationSafetyService.js';
import priorAuthValidationService, * as priorAuthModule from '../services/priorAuthValidationService.js';
import generalRequestValidationService, * as generalModule from '../services/generalRequestValidationService.js';

console.error = () => {};
console.warn = () => {};

/** Fake LLM: records the options of every call and answers with the queued replies in order. */
function fakeCompletion(t, service, replies) {
  const calls = [];
  const queue = [...replies];
  t.mock.method(service, 'generateCompletion', async (prompt, options = {}) => {
    calls.push({ prompt, options });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { success: true, response: typeof next === 'function' ? next(options) : next, model: 'fake-model', duration: 5 };
  });
  return calls;
}

const EYE_FORM = { age: 40, sex: 'female', chief_complaints: 'blurred vision', right_eye_specs: {}, left_eye_specs: {} };

test('C5 structured-output helper: strict JSON only, schema keywords enforced', async () => {
  const { parseStructuredReply, validateAgainstSchema } = await import('../services/ai/structuredOutput.js');
  const schema = {
    type: 'object',
    properties: {
      score: { type: 'number', minimum: 0, maximum: 1 },
      code: { type: ['string', 'null'], pattern: '^[0-9]+$' },
      list: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
    },
    required: ['score', 'code', 'list']
  };
  assert.deepEqual(parseStructuredReply('{"score":0.5,"code":null,"list":["a"]}', schema),
    { ok: true, data: { score: 0.5, code: null, list: ['a'] }, errors: [] });
  assert.equal(parseStructuredReply('Sure! {"score":0.5,"code":null,"list":["a"]}', schema).ok, false, 'prose around JSON is refused');
  assert.equal(parseStructuredReply('```json\n{"score":0.5}\n```', schema).ok, false);
  assert.equal(parseStructuredReply(undefined, schema).ok, false);
  assert.ok(validateAgainstSchema(schema, { score: 1.5, code: 'x', list: [] }).length >= 3);
  assert.ok(validateAgainstSchema(schema, { score: 0.1, code: '12', list: [''] }).length === 1);
});

test('C5 eye form: schema sent as format; valid JSON used; prose and schema violations fail closed', async t => {
  const schema = ollamaModule.EYE_VALIDATION_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'EYE_VALIDATION_SCHEMA is exported');

  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({
    isValid: true, confidenceScore: 0.8,
    warnings: [{ field: 'right_eye', message: 'High cylinder', severity: 'medium' }],
    recommendations: ['Confirm refraction'], missingAnalyses: []
  })]);
  const valid = await ollamaService.validateEyeForm(EYE_FORM, []);
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.isValid, true);
  assert.equal(valid.confidenceScore, 0.8);
  assert.equal(valid.warnings[0].severity, 'medium');
  assert.notEqual(valid.analysisIncomplete, true);

  // (b) the old free-text contract: must no longer be read as a verdict
  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, ['VALIDITY: Yes\nCONFIDENCE: 0.95\nWARNINGS:\n- none - Severity: low\n']);
  const prose = await ollamaService.validateEyeForm(EYE_FORM, []);
  assert.equal(prose.isValid, null);
  assert.equal(prose.analysisIncomplete, true);
  assert.equal(prose.requiresManualReview, true);
  assert.equal(prose.confidenceScore, 0);

  // malformed JSON
  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, ['{"isValid": true, "confidenceScore": 0.9']);
  assert.equal((await ollamaService.validateEyeForm(EYE_FORM, [])).isValid, null);

  // (c) JSON that violates the schema
  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [JSON.stringify({ isValid: 'yes', confidenceScore: 3, warnings: [], recommendations: [], missingAnalyses: [] })]);
  const violating = await ollamaService.validateEyeForm(EYE_FORM, []);
  assert.equal(violating.isValid, null);
  assert.equal(violating.analysisIncomplete, true);
});

test('C5 clinical text enhancement: {enhancedText} schema; anything else returns the original text unchanged', async t => {
  const original = 'Cough for 3 days with mild fever';
  const schema = ollamaModule.ENHANCED_TEXT_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'ENHANCED_TEXT_SCHEMA is exported');

  const expanded = 'The patient reports a productive cough of three days duration accompanied by low-grade fever.';
  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({ enhancedText: expanded })]);
  const valid = await ollamaService.enhanceClinicalText(original, 'history_of_present_illness', {});
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.success, true);
  assert.equal(valid.enhanced, true);
  assert.equal(valid.enhancedText, expanded);

  // (b) prose instead of JSON
  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [`Here is the enhanced text: ${expanded}`]);
  const prose = await ollamaService.enhanceClinicalText(original, 'history_of_present_illness', {});
  assert.equal(prose.success, false);
  assert.equal(prose.enhanced, false);
  assert.equal(prose.enhancedText, original);
  assert.ok(prose.error);

  // (c) JSON with the wrong shape
  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [JSON.stringify({ text: expanded })]);
  const violating = await ollamaService.enhanceClinicalText(original, 'history_of_present_illness', {});
  assert.equal(violating.enhanced, false);
  assert.equal(violating.enhancedText, original);
});

test('C5 SNOMED suggestions: schema-validated JSON only; free-text code lines are not parsed', async t => {
  const schema = ollamaModule.SNOMED_SUGGESTIONS_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'SNOMED_SUGGESTIONS_SCHEMA is exported');

  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({ suggestions: [{ code: '25064002', display: 'Headache' }] })]);
  const valid = await ollamaService.suggestSnomedCodes('headache since morning');
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.success, true);
  assert.deepEqual(valid.suggestions, [{ code: '25064002', display: 'Headache' }]);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, ['CODE: 25064002 - Headache\nCODE: 162397003 - Pain in throat']);
  const prose = await ollamaService.suggestSnomedCodes('headache since morning');
  assert.equal(prose.success, false);
  assert.deepEqual(prose.suggestions, []);
  assert.equal(prose.analysisIncomplete, true);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [JSON.stringify({ suggestions: [{ code: 25064002, display: 'Headache' }] })]);
  const violating = await ollamaService.suggestSnomedCodes('headache since morning');
  assert.equal(violating.success, false);
  assert.deepEqual(violating.suggestions, []);
});

test('C5 SNOMED code validation: an unreadable reply is isValid:null, never a verdict', async t => {
  const schema = ollamaModule.SNOMED_VALIDATION_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'SNOMED_VALIDATION_SCHEMA is exported');

  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({
    isValid: true, confidence: 0.9, explanation: 'Matches', correctDescription: null, suggestedCode: null, suggestedDescription: null
  })]);
  const valid = await ollamaService.validateSnomedCode('25064002', 'Headache');
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.success, true);
  assert.equal(valid.isValid, true);
  assert.equal(valid.confidence, 0.9);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, ['VALID: YES\nCONFIDENCE: 0.99\nEXPLANATION: fine']);
  const prose = await ollamaService.validateSnomedCode('25064002', 'Headache');
  assert.equal(prose.isValid, null);
  assert.equal(prose.analysisIncomplete, true);
  assert.equal(prose.requiresManualReview, true);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [JSON.stringify({ isValid: 'YES', confidence: 2, explanation: 'x' })]);
  const violating = await ollamaService.validateSnomedCode('25064002', 'Headache');
  assert.equal(violating.isValid, null);
  assert.equal(violating.analysisIncomplete, true);
});

test('C5 medical necessity: no default assessment when the reply is unreadable', async t => {
  const schema = ollamaModule.MEDICAL_NECESSITY_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'MEDICAL_NECESSITY_SCHEMA is exported');
  const form = { auth_type: 'professional', diagnoses: [], items: [], clinical_info: {} };

  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({
    necessityScore: 0.7, assessment: 'NEEDS_INFO', reasoning: 'HPI is short', missingElements: ['Duration of symptoms'], suggestedJustification: 'x'
  })]);
  const valid = await ollamaService.assessMedicalNecessity(form);
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.success, true);
  assert.equal(valid.assessment, 'NEEDS_INFO');
  assert.equal(valid.necessityScore, 0.7);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, ['NECESSITY_SCORE: 0.95\nASSESSMENT: APPROVED\nREASONING: fine']);
  const prose = await ollamaService.assessMedicalNecessity(form);
  assert.equal(prose.success, false);
  assert.equal(prose.assessment, null);
  assert.equal(prose.necessityScore, null);
  assert.equal(prose.analysisIncomplete, true);
  assert.equal(prose.requiresManualReview, true);

  t.mock.restoreAll();
  fakeCompletion(t, ollamaService, [JSON.stringify({ necessityScore: 0.9, assessment: 'MAYBE', reasoning: '', missingElements: [], suggestedJustification: '' })]);
  const violating = await ollamaService.assessMedicalNecessity(form);
  assert.equal(violating.assessment, null);
  assert.equal(violating.analysisIncomplete, true);
});

test('C5 prior-auth AI validation: schema-validated; an unreadable reply never makes the request valid', async t => {
  const schema = priorAuthModule.PA_AI_VALIDATION_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'PA_AI_VALIDATION_SCHEMA is exported');
  const form = { auth_type: 'professional', vital_signs: {}, clinical_info: {} };
  const rulesPass = () => {
    t.mock.method(priorAuthValidationService, 'performBasicValidation', () => ({ passed: true, issues: [], completeness: { percentage: 100 } }));
    t.mock.method(priorAuthValidationService, 'validateVitalsPlausibility', () => ({ passed: true, issues: [], warnings: [] }));
    t.mock.method(priorAuthValidationService, 'validateTimeRelevance', () => ({ passed: true, issues: [] }));
    t.mock.method(priorAuthValidationService, 'retrieveRelevantGuidelines', async () => []);
  };

  rulesPass();
  const calls = fakeCompletion(t, ollamaService, [JSON.stringify({
    medicalNecessityScore: 0.85,
    consistencyCheck: { passed: true, explanation: '' },
    documentationGaps: [],
    rejectionRisks: [{ code: null, description: 'Prior therapy not documented' }],
    recommendations: ['Document prior therapy'],
    justificationNarrative: 'Symptoms persist despite first-line therapy.'
  })]);
  const valid = await priorAuthValidationService.validatePriorAuth(form);
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.isValid, true);
  assert.equal(valid.requiresManualReview, false);
  assert.equal(valid.validation.ai.passed, true);
  assert.equal(valid.validation.ai.rejectionRisks[0].code, null);

  // (b) the old free-text contract
  t.mock.restoreAll();
  rulesPass();
  fakeCompletion(t, ollamaService, ['MEDICAL_NECESSITY_SCORE: 0.95\nCONSISTENCY_CHECK: PASS\nRECOMMENDATIONS:\n- none needed here\n']);
  const prose = await priorAuthValidationService.validatePriorAuth(form);
  assert.equal(prose.validation.ai.analysisIncomplete, true);
  assert.equal(prose.validation.ai.passed, null);
  assert.equal(prose.validation.ai.medicalNecessityScore, null);
  assert.equal(prose.isValid, false, 'an unread AI review must not leave the request valid');
  assert.equal(prose.requiresManualReview, true);
  assert.ok(prose.suggestions.some(s => s.type === 'ai_incomplete'));

  // (c) JSON violating the schema
  t.mock.restoreAll();
  rulesPass();
  fakeCompletion(t, ollamaService, [JSON.stringify({ medicalNecessityScore: 'high', consistencyCheck: { passed: true } })]);
  const violating = await priorAuthValidationService.validatePriorAuth(form);
  assert.equal(violating.validation.ai.analysisIncomplete, true);
  assert.equal(violating.isValid, false);
});

test('C5 prior-auth service keeps no duplicate free-text parsers', () => {
  for (const name of ['parseEnhancedText', 'parseSnomedSuggestions', 'parseMedicalNecessityResponse',
    'enhanceClinicalText', 'suggestSnomedCodes', 'assessMedicalNecessity']) {
    assert.equal(typeof priorAuthValidationService[name], 'undefined', `${name} is removed (ollamaService owns it)`);
  }
  for (const name of ['detectPromptEcho', 'parseEnhancedTextResponse']) {
    assert.equal(typeof ollamaService[name], 'undefined', `${name} heuristic is removed`);
  }
});

test('C5 general request diagnosis/scan fit: strict schema; prose-wrapped or string booleans fail closed', async t => {
  const schema = generalModule.FIT_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'FIT_SCHEMA is exported');

  const valid = generalRequestValidationService.parseAIResponse('{"fit":true,"diagnoses":["Meniscal tear","ACL tear","Knee effusion"]}');
  assert.equal(valid.fit, true);
  assert.equal(valid.analysisIncomplete, undefined);

  const prose = generalRequestValidationService.parseAIResponse('Result: {"fit": true, "diagnoses": ["Meniscal tear"]} hope this helps');
  assert.equal(prose.fit, false);
  assert.equal(prose.analysisIncomplete, true);

  const violating = generalRequestValidationService.parseAIResponse('{"fit":"true","diagnoses":"Meniscal tear"}');
  assert.equal(violating.fit, false);
  assert.equal(violating.analysisIncomplete, true);

  // The end-to-end call passes the schemas and flags the traditional result for review.
  t.mock.method(generalRequestValidationService, 'getExamPrerequisites', async () => null);
  const calls = fakeCompletion(t, ollamaService, [
    options => options.format === schema ? 'not json at all' : JSON.stringify({})
  ]);
  const result = await generalRequestValidationService.validateDiagnosisToScan({ service: { diagnosis: 'Knee pain', description: 'MRI', laterality: '' } });
  assert.deepEqual(calls[0].options.format, schema);
  assert.deepEqual(calls[1].options.format, generalModule.TEST_RECOMMENDATIONS_SCHEMA);
  assert.equal(result.traditional.fit, false);
  assert.equal(result.traditional.analysisIncomplete, true);
  assert.equal(result.traditional.requiresManualReview, true);
  assert.equal(result.aiEnhanced.analysisIncomplete, true);
});

test('C5 general request test recommendations: format is a JSON schema, not "json"; invalid replies fail closed', async t => {
  const schema = generalModule.TEST_RECOMMENDATIONS_SCHEMA;
  assert.ok(schema && typeof schema === 'object', 'TEST_RECOMMENDATIONS_SCHEMA is exported');
  const reply = {
    testAppropriate: true, confidence: 0.7, reasoning: 'Standard pathway',
    prerequisiteChain: [{ order: 1, testName: 'X-ray knee', clinicalReason: 'First line', urgency: 'routine', typicalFindings: 'Normal', mustCompleteBeforeNext: true }],
    recommendedTests: [], alternativeTests: [], contraindications: [], criticalPrerequisites: [], emergencyModifications: null
  };
  const calls = fakeCompletion(t, ollamaService, [JSON.stringify(reply)]);
  const valid = await generalRequestValidationService.getAIBasedTestRecommendations({ service: { diagnosis: 'Knee pain', description: 'MRI' } });
  assert.deepEqual(calls[0].options.format, schema);
  assert.equal(valid.testAppropriate, true);
  assert.equal(valid.confidence, 0.7);
  assert.notEqual(valid.analysisIncomplete, true);

  const prose = generalRequestValidationService.parseTestRecommendations(`Here you go: ${JSON.stringify(reply)}`);
  assert.equal(prose.analysisIncomplete, true);
  assert.equal(prose.testAppropriate, false);
  assert.equal(prose.confidence, 0);

  const violating = generalRequestValidationService.parseTestRecommendations(JSON.stringify({ ...reply, confidence: 'high' }));
  assert.equal(violating.analysisIncomplete, true);
  assert.equal(violating.requiresManualReview, true);
});

test('C5 medication safety: prose-wrapped or schema-violating replies are incomplete, not "no interactions"', async t => {
  const ok = medicationSafetyService.parseInteractionsResponse('{"hasInteractions":false,"interactions":[]}');
  assert.equal(ok.hasInteractions, false);
  assert.equal(ok.analysisIncomplete, false);

  const prose = medicationSafetyService.parseInteractionsResponse('No problems found. {"hasInteractions":false,"interactions":[]}');
  assert.equal(prose.hasInteractions, null);
  assert.equal(prose.analysisIncomplete, true);

  const violating = medicationSafetyService.parseInteractionsResponse(JSON.stringify({
    hasInteractions: false, interactions: [{ severity: 'catastrophic', affectedDrugs: 'A', interaction: 'x', recommendation: 'y' }]
  }));
  assert.equal(violating.hasInteractions, null);
  assert.equal(violating.analysisIncomplete, true);

  const safetyOk = {
    drugInteractions: [], ageRelatedWarnings: [], pregnancyWarnings: [],
    sideEffectsOverview: { common: [], serious: [] }, overallRiskAssessment: 'low', recommendations: []
  };
  assert.equal(medicationSafetyService.parseSafetyAnalysisResponse(JSON.stringify(safetyOk)).analysisIncomplete, false);
  const safetyProse = medicationSafetyService.parseSafetyAnalysisResponse(`Analysis: ${JSON.stringify(safetyOk)}`);
  assert.equal(safetyProse.analysisIncomplete, true);
  assert.equal(safetyProse.overallRiskAssessment, 'unknown');
  const safetyViolating = medicationSafetyService.parseSafetyAnalysisResponse(JSON.stringify({ ...safetyOk, pregnancyWarnings: 'none' }));
  assert.equal(safetyViolating.analysisIncomplete, true);

  // Suggestions: a reply that cannot be read is reported, not an empty success.
  const calls = fakeCompletion(t, medbotService, ['1. Paracetamol 500 mg']);
  const suggestions = await medicationSafetyService.suggestMedications('Fever', 30, 'male');
  assert.deepEqual(calls[0].options.format, medicationModule.SUGGESTIONS_SCHEMA);
  assert.deepEqual(suggestions.suggestions, []);
  assert.equal(suggestions.analysisIncomplete, true);
});
