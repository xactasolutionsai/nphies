import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMentions } from '../services/clinicalAudit.js';
import { reviewClaim } from '../services/claimReviewService.js';
test('Negated and historical mentions cannot be presented as missing diagnoses', () => {
 for (const source_text of ['No evidence of pneumonia.', 'Family history of pneumonia.', 'Possible pneumonia.']) {
  const start = source_text.indexOf('pneumonia');
  const [finding] = auditMentions({}, [{text:'pneumonia',start,end:start+9,source_text}]);
  assert.equal(finding.code,'CONTEXT_REVIEW'); assert.equal(finding.auto_coding,false);
 }
});
test('Text matches do not imply code equivalence; missing description remains a question', () => {
 const entity={text:'pneumonia',start:0,end:9,source_text:'pneumonia'};
 assert.equal(auditMentions({diagnoses:[{diagnosis_display:'Pneumonia'}]},[entity])[0].code,'TEXT_MATCH');
 assert.equal(auditMentions({diagnoses:[{diagnosis_code:'J18.9'}]},[entity])[0].code,'DOCUMENTATION_REVIEW');
});
test('Clinical mode uses local evidence even when external API is configured', async () => {
 const keys=['URL','KEY','MODEL'].map(s=>'CLAIM_REVIEW_API_'+s);
 const saved=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='test');
 try {
  const claim={supporting_info:[{sequence:1,value_string:'pneumonia'}]};const before=structuredClone(claim);
  const r=await reviewClaim(claim,{useModel:true,reviewMode:'clinical',ready:()=>true,analyze:async()=>({model:{},entities:[{text:'pneumonia',start:0,end:9,confidence:.9}]})});
  assert.equal(r.external_data_sent,false);assert.equal(r.model.status,'completed');assert.equal(r.clinical_audit.length,1);assert.deepEqual(claim,before);
 } finally {keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
