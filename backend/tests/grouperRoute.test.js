import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from '../routes/claimSubmissions.js';
import controller from '../controllers/claimSubmissionsController.js';
import {clinicalInput} from './fixtures/clinicalInput.js';

test('Grouper input route authenticates, validates saved MDS and never updates the claim', async t=>{
  const {claim,patient}=clinicalInput('institutional');
  Object.assign(claim,{patient_birth_date:patient.birth_date,patient_gender:patient.gender,drg_leave_days:0,drg_no_procedures:true,drg_procedures:[],drg_ventilation_used:false,ventilation_hours:0,discharge_disposition:'home'});
  const before=structuredClone(claim);
  let record=claim;
  t.mock.method(controller,'getByIdInternal',async()=>record);
  t.mock.method(controller,'update',()=>assert.fail('Read-only operation'));
  const app=express();
  app.use((req,res,next)=>{if(req.headers.authorization==='Bearer test') req.user={id:1};next();});
  app.use('/claims',router);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/claims/1/grouper-input`;
  try {
    assert.equal((await fetch(base)).status,401);
    const options={headers:{Authorization:'Bearer test'}};
    const result=await fetch(base,options);
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
    assert.equal((await result.json()).data.integrationStatus,'not_configured');
    assert.deepEqual(claim,before);
    record={...claim,diagnoses:[]};assert.equal((await fetch(base,options)).status,422);
    record=null;assert.equal((await fetch(base,options)).status,404);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
