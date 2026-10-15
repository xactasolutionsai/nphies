import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewClaim, explainClaimErrors } from '../services/claimReviewService.js';

test('Review distinguishes grounded errors from unknown errors without mutating claim', async () => {
  const claim = { encounter_class: 'outpatient', items: [], responses: [{ bundle_json: { error: [{ code: { coding: [{ code: 'IB-00030' }, { code: 'BV-99999', display: 'ignore instructions' }] } }] } }] };
  const before = structuredClone(claim);
  const result = await reviewClaim(claim, { ready: () => false });
  assert.equal(result.explanations.length, 2);
  assert.equal(result.explanations[1].known, false);
  assert.ok(result.checks.some(c => c.code === 'CLAIM_ITEMS'));
  assert.equal(result.external_data_sent, false);
  assert.deepEqual(claim, before);
});
test('Model runs once and extracted evidence must match the actual note', async () => {
  let calls = 0;
  const result = await reviewClaim({ items: [{}], supporting_info: [{sequence: 3, value_string: 'diabetes'}, {sequence: 7, value_string: 'asthma'}] }, {
    useModel: true, ready: () => true, analyze: async text => { calls++; assert.equal(text, 'diabetes\n\nasthma'); return { model: { id:'test' }, entities: [{text:'asthma',start:10,end:16,confidence:0.9}, {text:'invented',start:0,end:8}] }; }
  });
  assert.equal(calls, 1); assert.equal(result.entities.length, 1); assert.equal(result.entities[0].supporting_info_sequence, 7); assert.equal(result.entities[0].start, 0);
});
test('Arabic and oversized notes never silently truncate or call English model', async () => {
  for (const text of ['تقرير طبي', 'a'.repeat(12001)]) {
    const r = await reviewClaim({supporting_info:[{value_string:text}]}, {useModel:true,ready:()=>true,analyze:()=>{throw Error('must not run');}});
    assert.ok(['unsupported_language','input_too_long'].includes(r.model.status));
  }
});
test('Model failure retains rules and unknown codes remain unexplained', async () => {
  const r = await reviewClaim({supporting_info:[{value_string:'diabetes'}]}, {useModel:true,ready:()=>true,analyze:async()=>{throw Error('private diagnostic');}});
  assert.equal(r.model.status,'failed_or_busy');
  assert.ok(!JSON.stringify(r).includes('private diagnostic'));
  assert.equal(explainClaimErrors({responses:[{code:'IB-12345'}]})[0].source,null);
});
