import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getJwtSecret } from '../config/auth.js';
import { selectInputFields, validateNestedArrays } from '../utils/inputFields.js';
import { eyeFields, dentalFields } from '../models/approvalFields.js';
import { validateClaimInput } from '../models/claimInput.js';
import usersController from '../controllers/usersController.js';
import medicinesController from '../controllers/medicinesController.js';
import medicineService from '../services/medicineService.js';
import ollamaService from '../services/ollamaService.js';
import { createQueryLoader } from '../db/queryLoader.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('Missing or published JWT secret cannot be used', t => {
  const original = process.env.JWT_SECRET;
  t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
  delete process.env.JWT_SECRET;
  assert.throws(getJwtSecret);
  process.env.JWT_SECRET = 'your-secret-key-change-in-production';
  assert.throws(getJwtSecret);
});

test('Authentication rejects missing, expired, forged and deleted-user tokens', async t => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-private-secret-with-at-least-32-chars';
  t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
  t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const tokens = [null, 'not-a-token', jwt.sign({ userId: 1 }, 'wrong-key'),
    jwt.sign({ userId: 1 }, getJwtSecret(), { expiresIn: -1 }), jwt.sign({ userId: 99 }, getJwtSecret())];
  for (const token of tokens) {
    const res = response();
    await authenticateToken({ headers: token ? { authorization: `Bearer ${token}` } : {} }, res, () => assert.fail('Must not authorize'));
    assert.equal(res.statusCode, 401);
  }
});

test('Administrator privileges come from the database, not JWT email or role', async t => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-private-secret-with-at-least-32-chars';
  t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
  t.mock.method(pool, 'query', async () => ({ rows: [{ id: 1, email: 'ordinary@example.test', role: 'user' }] }));
  const token = jwt.sign({ userId: 1, email: 'eng.anasshamia@gmail.com', role: 'admin' }, getJwtSecret());
  const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
  await authenticateToken(req, response(), () => {});
  const res = response();
  await usersController.getAll(req, res);
  assert.equal(res.statusCode, 403);
});

test('Writable approval fields reject SQL fragments and unknown identifiers', () => {
  for (const fields of [eyeFields, dentalFields]) {
    assert.throws(() => selectInputFields({ 'status = $1 WHERE TRUE --': 'Approved' }, fields));
    assert.throws(() => selectInputFields({ unexpected_column: 'x' }, fields));
    assert.deepEqual(selectInputFields({ insured_name: 'Test', id: 17 }, fields), { insured_name: 'Test' });
  }
});

test('Claim validation rejects unknown fields and ignores server-owned adjudication', () => {
  assert.throws(() => validateClaimInput({ claim_type: 'professional', 'claim_type) VALUES': 'x' }));
  const data = validateClaimInput({ claim_type: 'professional', status: 'approved', approved_amount: 999, outbound_message_header_id: 'forged', is_newborn: true, birth_weight: 3000, ventilation_hours: 2 });
  assert.equal(data.status, undefined);
  assert.equal(data.approved_amount, undefined);
  assert.equal(data.outbound_message_header_id, undefined);
  assert.equal(data.birth_weight, 3000);
  assert.equal(data.ventilation_hours, 2);
});

test('Omitted child arrays are allowed; null cannot silently delete children', () => {
  assert.doesNotThrow(() => validateNestedArrays({}, ['items']));
  assert.doesNotThrow(() => validateNestedArrays({ items: [] }, ['items']));
  assert.throws(() => validateNestedArrays({ items: null }, ['items']));
});

test('Medicine health check uses a defined AI service', async t => {
  t.mock.method(medicineService, 'getStatistics', async () => ({ totalMedicines: 1, totalBrands: 1 }));
  t.mock.method(ollamaService, 'checkHealth', async () => ({ available: true, configuredModel: 'test', modelInstalled: true }));
  const res = response();
  await medicinesController.healthCheck({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.aiService.status, 'ok');
});

test('Query reload imports edited source, retaining last good module on syntax error', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nphies-query-test-'));
  const filename = path.join(dir, 'queries.mjs');
  try {
    await fs.writeFile(filename, 'export const queries = { revision: 1 };');
    const loader = createQueryLoader(filename);
    assert.equal((await loader.load()).revision, 1);
    await fs.writeFile(filename, 'export const queries = { revision: 2 };');
    assert.equal((await loader.load(true)).revision, 2);
    await fs.writeFile(filename, 'invalid source !!!');
    await assert.rejects(loader.load(true));
    assert.equal(loader.current().revision, 2);
  } finally {
    // Only the temporary file and its empty directory created by this test.
    await fs.unlink(filename);
    await fs.rmdir(dir);
  }
});
