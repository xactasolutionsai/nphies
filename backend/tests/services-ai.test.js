import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import pool from '../db.js';
import { resolveOllamaBaseUrl, getOllamaConfig, createOllamaClient, DEFAULT_OLLAMA_BASE_URL } from '../services/ollamaConfig.js';
import ollamaService from '../services/ollamaService.js';
import medbotService from '../services/medbotService.js';
import ragService from '../services/ragService.js';
import medicineService, { escapeLike } from '../services/medicineService.js';
import medicationSafetyService, { INTERACTIONS_SCHEMA, SAFETY_ANALYSIS_SCHEMA } from '../services/medicationSafetyService.js';
import medicalValidationService from '../services/medicalValidationService.js';
import generalRequestValidationService from '../services/generalRequestValidationService.js';
import priorAuthValidationService from '../services/priorAuthValidationService.js';
import shadowBillingService from '../services/shadowBillingService.js';

console.warn = () => {};
console.error = () => {};

test('Ollama endpoint defaults to localhost and refuses plain HTTP to public hosts', () => {
  assert.equal(resolveOllamaBaseUrl({}), DEFAULT_OLLAMA_BASE_URL);
  assert.equal(resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'http://10.1.2.3:11434/' }), 'http://10.1.2.3:11434');
  assert.equal(resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'http://192.168.0.5:11434' }), 'http://192.168.0.5:11434');
  assert.equal(resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'https://ai.example.com' }), 'https://ai.example.com');
  assert.throws(() => resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'http://206.168.83.244:11434' }), /plain HTTP/);
  assert.throws(() => resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'http://172.32.0.1:11434' }), /plain HTTP/);
  assert.equal(resolveOllamaBaseUrl({ OLLAMA_BASE_URL: 'http://206.168.83.244:11434', OLLAMA_ALLOW_INSECURE_REMOTE: 'true' }),
    'http://206.168.83.244:11434');
  assert.ok(getOllamaConfig({ OLLAMA_BASE_URL: 'http://8.8.8.8' }).configError);
});

test('A timed-out Ollama request is aborted on the wire', async t => {
  let closed;
  const connectionClosed = new Promise(resolve => { closed = resolve; });
  const server = http.createServer((req) => { req.on('close', closed); }); // never answers
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const client = createOllamaClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 100 });
  const started = Date.now();
  await assert.rejects(() => client.generate({ model: 'm', prompt: 'p', stream: false }));
  assert.ok(Date.now() - started < 2000);
  await connectionClosed; // the server saw the request go away
});

test('RAG never stores or searches with a fabricated embedding', async t => {
  const embed = t.mock.method(ollamaService, 'generateEmbedding', async () => { throw new Error('model offline'); });
  await assert.rejects(() => ragService.generateEmbedding('text'), /Embedding generation failed/);
  const insert = t.mock.method(pool, 'query', async () => ({ rows: [{ id: 1 }] }));
  await assert.rejects(() => ragService.storeKnowledge('guideline'));
  assert.equal(insert.mock.callCount(), 0);
  assert.equal(typeof ragService.generateSimpleEmbedding, 'undefined');

  embed.mock.mockImplementation(async () => [0.1, 0.2, 0.3]);
  const original = ragService.embeddingDimension;
  t.after(() => { ragService.embeddingDimension = original; });
  ragService.embeddingDimension = 4;
  await assert.rejects(() => ragService.generateEmbedding('text'), /dimension mismatch/);
});

test('Medicine search escapes LIKE wildcards and falls back to text search without embeddings', async t => {
  assert.equal(escapeLike('50%_a\\b'), '50\\%\\_a\\\\b');
  t.mock.method(ollamaService, 'generateEmbedding', async () => { throw new Error('offline'); });
  const calls = [];
  t.mock.method(pool, 'query', async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; });
  await medicineService.hybridSearch('para_%', 10);
  assert.equal(calls[0].params[0], null);
  assert.equal(calls[0].params[3], 'para\\_\\%%');
  assert.match(calls[0].sql, /\$1::vector IS NOT NULL/);
});

test('Medicine lookup tries an all-digit MRID before the numeric id', async t => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    return { rows: sql.includes('WHERE m.mrid = $1') ? [{ id: 1, mrid: '123456', active_ingredient: 'x' }] : [] };
  });
  t.mock.method(medbotService, 'getMedicineInformation', async () => ({}));
  const result = await medicineService.getMedicineWithAIInfo('123456');
  assert.equal(result.mrid, '123456');
  assert.ok(calls.every(c => !c.sql.includes('WHERE m.id = $1')));
});

test('Medication interaction check fails closed and uses structured output', async t => {
  const parsedGarbage = medicationSafetyService.parseInteractionsResponse('the model rambled');
  assert.equal(parsedGarbage.hasInteractions, null);
  assert.equal(parsedGarbage.analysisIncomplete, true);
  const analysis = medicationSafetyService.parseSafetyAnalysisResponse('{"not":"the contract"}');
  assert.equal(analysis.analysisIncomplete, true);
  assert.equal(analysis.overallRiskAssessment, 'unknown');

  let options;
  const completion = t.mock.method(medbotService, 'generateCompletion', async (_prompt, opts) => {
    options = opts;
    return { response: '{"hasInteractions":false,"interactions":[]}', model: 'real-model', duration: 1 };
  });
  const result = await medicationSafetyService.checkDrugInteractions([{ medicationName: 'A' }, { medicationName: 'B' }]);
  assert.deepEqual(options.format, INTERACTIONS_SCHEMA);
  assert.equal(result.hasInteractions, false);
  assert.equal(result.analysisIncomplete, false);

  completion.mock.mockImplementation(async (_p, opts) => {
    options = opts;
    return { response: 'not json', model: 'real-model', duration: 1 };
  });
  const safety = await medicationSafetyService.analyzeMedicationSafety([{ medicationName: 'A' }]);
  assert.deepEqual(options.format, SAFETY_ANALYSIS_SCHEMA);
  assert.equal(safety.analysis.analysisIncomplete, true);
  assert.equal(safety.metadata.model, 'real-model');
});

test('Medbot sends format top-level and reports the model it actually uses', async t => {
  let request;
  t.mock.method(medbotService.client, 'generate', async req => { request = req; return { response: '{}', model: medbotService.model, done: true }; });
  await medbotService.generateCompletion('p', { format: { type: 'object' }, temperature: 0.1 });
  assert.deepEqual(request.format, { type: 'object' });
  assert.equal(request.options.format, undefined);
  assert.equal(request.model, medbotService.model);
});

test('Eye-form validation is not reported valid when the AI is unavailable', async t => {
  t.mock.method(ragService, 'retrieveRelevantGuidelines', async () => []);
  t.mock.method(ollamaService, 'validateEyeForm', async () => { throw new Error('offline'); });
  const result = await medicalValidationService.validateEyeForm({ age: 30 });
  assert.notEqual(result.isValid, true);
  assert.equal(result.aiUnavailable, true);
  assert.equal(result.requiresManualReview, true);

  const unparsed = ollamaService.parseValidationResponse('no verdict here');
  assert.equal(unparsed.isValid, null);
  assert.equal(unparsed.analysisIncomplete, true);
});

test('Prior-auth validation keeps rule-based results and flags missing AI', async t => {
  const completion = t.mock.method(ollamaService, 'generateCompletion', async () => { throw new Error('offline'); });
  const result = await priorAuthValidationService.validatePriorAuth({ auth_type: 'professional', vital_signs: {}, clinical_info: {} });
  assert.equal(result.success, true);
  assert.equal(result.aiUnavailable, true);
  assert.equal(result.isValid, false);
  assert.ok(result.validation.basic.issues.length > 0, 'rule-based checks are returned');
  assert.ok(result.suggestions.some(s => s.type === 'ai_unavailable'));

  // A risk line without an NPHIES code must not crash scoring.
  completion.mock.mockImplementation(async () => ({ response:
    'MEDICAL_NECESSITY_SCORE: 0.8\nCONSISTENCY_CHECK: PASS\nREJECTION_RISKS:\n- Documentation of prior therapy is missing\n' }));
  t.mock.method(priorAuthValidationService, 'retrieveRelevantGuidelines', async () => []);
  const withRisk = await priorAuthValidationService.validatePriorAuth({ auth_type: 'professional', vital_signs: {}, clinical_info: {} });
  assert.equal(withRisk.success, true);
  assert.equal(withRisk.aiUnavailable, false);
  assert.equal(withRisk.validation.ai.rejectionRisks[0].code, null);

  const unparsed = priorAuthValidationService.parseAIValidationResponse('free text only');
  assert.equal(unparsed.analysisIncomplete, true);
  assert.notEqual(unparsed.passed, true);
});

test('General request laterality uses whole words, ignores case, and the prompt omits identity', () => {
  assert.equal(generalRequestValidationService.extractDirection('Cleft palate'), '');
  assert.equal(generalRequestValidationService.extractDirection('bright red lesion'), '');
  assert.equal(generalRequestValidationService.extractDirection('Left knee pain'), 'left');
  assert.equal(generalRequestValidationService.checkLateralityMatch('left', 'Left'), true);
  assert.equal(generalRequestValidationService.checkLateralityMatch('left', 'right'), false);
  const prompt = generalRequestValidationService.buildDiagnosisTestRecommendationPrompt({
    patient: { idNumber: '1098765432', fullName: 'Synthetic Person', gender: 'female', dob: '1990-01-01' },
    provider: { doctorName: 'Dr Synthetic', facilityName: 'Synthetic Hospital', department: 'Radiology' },
    service: { diagnosis: 'Knee pain', description: 'MRI' }
  });
  for (const identity of ['1098765432', 'Synthetic Person', 'Dr Synthetic', 'Synthetic Hospital']) {
    assert.ok(!prompt.includes(identity), `prompt must not contain ${identity}`);
  }
  assert.match(prompt, /Gender: female/);
  const parsed = generalRequestValidationService.parseAIResponse('garbage');
  assert.equal(parsed.fit, false);
  assert.equal(parsed.analysisIncomplete, true);
});

test('Shadow billing does not rewrite codes when the catalog cannot be loaded', async t => {
  shadowBillingService.lastLoaded = null;
  shadowBillingService.lastFailedAt = null;
  t.after(() => { shadowBillingService.lastLoaded = null; shadowBillingService.lastFailedAt = null; });
  const dbQuery = t.mock.method(pool, 'query', async () => { throw new Error('database unavailable'); });
  const item = { product_or_service_code: '83600-00-10', product_or_service_system: 'http://nphies.sa/terminology/CodeSystem/services' };
  await shadowBillingService.processItem(item, 'professional', 'provider.example');
  assert.equal(item.product_or_service_code, '83600-00-10');
  assert.equal(item.shadow_code, undefined);
  assert.equal(item.shadowBillingUnverified, true);
  assert.equal(shadowBillingService.lastLoaded, null, 'a failed load must not be cached as loaded');
  assert.ok(shadowBillingService.lastFailedAt, 'a retry is scheduled');

  // Once the catalog loads, unknown codes are shadow-billed as before.
  shadowBillingService.lastFailedAt = null;
  dbQuery.mock.mockImplementation(async sql => ({ rows: sql.includes('medication_codes') ? [] : [{ system_code: 'services', code: '83600-00-10' }] }));
  const internal = { product_or_service_code: 'INTERNAL-1', product_or_service_system: 'http://nphies.sa/terminology/CodeSystem/services' };
  await shadowBillingService.processItem(internal, 'professional', 'provider.example');
  assert.equal(internal.shadow_code, 'INTERNAL-1');
  assert.equal(internal.product_or_service_code, '83700-00-00');
});
