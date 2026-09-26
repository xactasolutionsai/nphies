import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  statusFromParsedResponse, contentDisposition, safeSchemaName, safeJsonParse, sendCommunicationRequestAttachment
} from '../controllers/controllerHelpers.js';
import priorAuthMapper from '../services/priorAuthMapper/index.js';
import pool from '../db.js';

const claimResponseBundle = (outcome, adjudication, extra = {}) => ({
  resourceType: 'Bundle',
  type: 'message',
  entry: [{
    resource: {
      resourceType: 'ClaimResponse',
      id: 'cr-1',
      outcome,
      extension: adjudication ? [{
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-adjudication-outcome',
        valueCodeableConcept: { coding: [{ code: adjudication }] }
      }] : [],
      ...extra
    }
  }]
});

test('NPHIES validation errors map to error, never denied; partial/pended are distinct', () => {
  const operationOutcome = {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code: 'invalid', details: { coding: [{ code: 'BV-00001', display: 'bad' }] } }]
  };
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(operationOutcome)), 'error');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse({ resourceType: 'Bundle' })), 'error');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(
    claimResponseBundle('error', null, { error: [{ code: { coding: [{ code: 'BV-1', display: 'x' }] } }] }))), 'error');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(claimResponseBundle('complete', 'rejected'))), 'denied');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(claimResponseBundle('complete', 'approved'))), 'approved');
  // FHIR outcome 'complete' with a partial adjudication is partial, not approved
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(claimResponseBundle('complete', 'partial'))), 'partial');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(claimResponseBundle('complete', 'pended'))), 'queued');
  assert.equal(statusFromParsedResponse(priorAuthMapper.parsePriorAuthResponse(claimResponseBundle('queued', null))), 'queued');
  assert.equal(statusFromParsedResponse(null), 'error');
});

test('Content-Disposition accepts Arabic filenames via RFC 5987 with an ASCII fallback', () => {
  const header = contentDisposition('تقرير "طبي".pdf');
  assert.doesNotThrow(() => http.validateHeaderValue('Content-Disposition', header));
  assert.match(header, /^attachment; filename="[\x20-\x7E]+"; filename\*=UTF-8''/);
  assert.ok(header.includes(encodeURIComponent('تقرير')));
  assert.ok(!/[\r\n]/.test(contentDisposition('a\r\nSet-Cookie: x')));
});

test('Schema names are validated before interpolation', () => {
  assert.equal(safeSchemaName(undefined), 'public');
  assert.equal(safeSchemaName('tenant_1'), 'tenant_1');
  for (const bad of ['public; DROP TABLE x', 'Public', '1abc', 'a-b']) {
    assert.throws(() => safeSchemaName(bad), /Invalid schema name/);
  }
  assert.equal(safeJsonParse('{bad', 'fallback'), 'fallback');
});

test('CommunicationRequest attachment download is scoped to its parent and survives Arabic titles', async t => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ request_bundle: { payload: [{ contentAttachment: {
      data: Buffer.from('pdf').toString('base64'), title: 'نتيجة.pdf', contentType: 'application/pdf' } }] } }] };
  });
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) { http.validateHeaderValue(name, value); headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.sent = body; return this; }
  };
  await sendCommunicationRequestAttachment({ params: { id: '7', requestId: '3', payloadIndex: '0' } }, res, 'prior_auth_id');
  assert.equal(res.statusCode, 200);
  assert.equal(res.sent.toString(), 'pdf');
  assert.match(calls[0].sql, /prior_auth_id::text = \$2/);
  assert.deepEqual(calls[0].params, [3, '7']);
  assert.ok(!/search_path/.test(calls.map(c => c.sql).join()));
  assert.match(headers['Content-Disposition'], /filename\*=UTF-8''/);
});
