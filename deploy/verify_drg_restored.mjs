// Synthetic save/read/send-gate verification in a transaction always rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import pool,{query,transaction} from '../backend/db.js';
import controller from '../backend/controllers/claimSubmissionsController.js';
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const rollback=new Error('ROLLBACK_SYNTHETIC_CHECK');
const report={synthetic:true,rolledBack:false};
try {
  await transaction(async()=>{
    const suffix=randomUUID();
    const patient=(await query("INSERT INTO patients(name,identifier,gender,birth_date) VALUES('Synthetic DRG verification',$1,'male','1990-01-01') RETURNING patient_id",['TEST-'+suffix])).rows[0];
    const provider=(await query("INSERT INTO providers(provider_name,nphies_id) VALUES('Synthetic DRG provider',$1) RETURNING provider_id",['TEST-'+suffix])).rows[0];
    const insurer=(await query("INSERT INTO insurers(insurer_name,nphies_id) VALUES('Synthetic DRG insurer',$1) RETURNING insurer_id",['TEST-'+suffix])).rows[0];
    const body={...patient,...provider,...insurer,claim_type:'institutional',encounter_class:'inpatient',encounter_start:'2026-10-10T08:00:00+03:00',encounter_end:'2026-10-11T08:00:00+03:00',total_amount:100,drg_code:'E62B',drg_description:'Synthetic persistence test only',drg_code_system:'https://example.test/ardrg',drg_version:'9.0',drg_grouper_name:'Uncertified synthetic fixture',drg_grouper_version:'1',drg_grouper_certified:false,drg_mds_confirmed:false,drg_grouper_output:{adrg:'E62',mdc:4,eccs:0,dcl:[],error_flags:[]},drg_leave_days:0,drg_ventilation_used:false,ventilation_hours:0,drg_no_procedures:true,drg_procedures:[],discharge_disposition:'home',diagnoses:[{sequence:1,diagnosis_code:'Z00.0',diagnosis_type:'principal',on_admission:true}]};
    const created=response();await controller.create({body,user:{id:null}},created);
    assert.equal(created.statusCode,201,JSON.stringify(created.body));
    const row=(await query('SELECT * FROM claim_submissions WHERE patient_id=$1',[patient.patient_id])).rows[0];
    assert.equal(row.drg_code,'E62B');assert.deepEqual(row.drg_grouper_output,body.drg_grouper_output);
    assert.equal(row.drg_grouper_certified,false);
    const audit=(await query('SELECT count(*)::int AS count FROM claim_drg_audit WHERE claim_id=$1',[row.id])).rows[0];
    assert.equal(audit.count,1);
    const sent=response();await controller.sendToNphies({params:{id:row.id}},sent);
    assert.equal(sent.statusCode,422);assert.ok(sent.body.validation.errors.some(e=>e.code==='DRG_CERTIFICATION'));
    Object.assign(report,{saveAndRead:true,auditSaved:true,uncertifiedSendBlocked:true,sendStatus:sent.statusCode});
    throw rollback;
  });
} catch(error){if(error!==rollback) throw error;report.rolledBack=true;}
finally{await pool.end();}
fs.writeFileSync('/var/backups/nafes/drg-runtime-verification.json',JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify(report));
