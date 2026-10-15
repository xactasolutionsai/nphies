import assert from 'node:assert/strict';
import { reviewClaim } from '/opt/nafes/current/backend/services/claimReviewService.js';
const claim={items:[{}], diagnoses:[{diagnosis_display:'pneumonia'}], supporting_info:[{sequence:1,value_string:'No evidence of pneumonia. Family history of diabetes.'}]};
const before=structuredClone(claim);const start=Date.now();
const r=await reviewClaim(claim,{useModel:true,reviewMode:'clinical'});
assert.equal(r.model.status,'completed');assert.equal(r.external_data_sent,false);
assert.ok(r.clinical_audit.length>=2);assert.ok(r.clinical_audit.every(f=>f.code==='CONTEXT_REVIEW' && !f.auto_coding));
assert.deepEqual(claim,before);
console.log(JSON.stringify({passed:true,synthetic:true,unchanged:true,findings:r.clinical_audit.length,seconds:(Date.now()-start)/1000}));
