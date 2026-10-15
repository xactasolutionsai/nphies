import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewViaApi} from '../services/claimReviewApi.js';
const env = {CLAIM_REVIEW_API_URL:'https://provider.example/v1/chat/completions',CLAIM_REVIEW_API_KEY:'test-secret',CLAIM_REVIEW_API_MODEL:'configured-model'};
const reply = (content='راجع توثيق الحالة',finish_reason='stop') => new Response(JSON.stringify({choices:[{finish_reason,message:{content}}]}));
test('API sends selected clinical fields and returns advisory text without changing claim', async () => {
  const claim={patient_name:'excluded-name',patient_id:'excluded-id',attachments:[{base64_content:'excluded-file'}],supporting_info:[{sequence:1,value_string:'demo note'}],diagnoses:[{diagnosis_code:'E11',diagnosis_display:'Diabetes'}]};
  const before=structuredClone(claim);
  const result=await reviewViaApi(claim,{checks:[],explanations:[]},{env,fetcher:async(url,options)=>{
    assert.equal(url,env.CLAIM_REVIEW_API_URL); assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body); assert.equal(body.store,false);
    assert.ok(body.messages[1].content.includes('demo note'));
    assert.ok(!options.body.includes('excluded-')); assert.ok(!options.body.includes('test-secret'));
    return reply();
  }});
  assert.equal(result.status,'completed'); assert.equal(result.attempted,true); assert.deepEqual(claim,before);
});
test('Missing configuration, unsafe endpoint and oversized input never call provider', async()=>{
  let calls=0; const fetcher=async()=>{calls++;return reply();};
  for (const config of [{},{...env,CLAIM_REVIEW_API_URL:'http://provider.example'},{...env,CLAIM_REVIEW_API_URL:'https://provider.example?key=secret'}]) {
    assert.equal((await reviewViaApi({}, {}, {env:config,fetcher})).attempted,false);
  }
  assert.equal((await reviewViaApi({supporting_info:[{value_string:'a'.repeat(24001)}]}, {}, {env,fetcher})).status,'input_too_long');
  assert.equal(calls,0);
});
test('Failures, partial answers and oversized responses return no provider diagnostics',async()=>{
  for(const fetcher of [async()=>{throw Error('private detail');},async()=>new Response('private detail',{status:401}),async()=>reply('partial','length'),async()=>reply('x'.repeat(12001)),async()=>new Response('x'.repeat(100001)),async()=>new Response('invalid json')]){
    assert.deepEqual(await reviewViaApi({}, {}, {env,fetcher}),{status:'failed',attempted:true});
  }
});
test('Qwen compatibility options use max_tokens and disable optional thinking',async()=>{
  const config={...env,CLAIM_REVIEW_API_TOKEN_PARAMETER:'max_tokens',CLAIM_REVIEW_API_DISABLE_THINKING:'true'};
  const result=await reviewViaApi({}, {}, {env:config,fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(body.max_tokens,1200); assert.equal(body.max_completion_tokens,undefined);
    assert.deepEqual(body.chat_template_kwargs,{enable_thinking:false}); return reply();
  }});
  assert.equal(result.status,'completed');
});
