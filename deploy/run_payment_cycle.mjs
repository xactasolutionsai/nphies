// Explicit sandbox-only operations, with private request/response evidence.
// Run with --env-file=/etc/nafes/app.env. Never use for a production bank attestation.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
const backend = process.env.PAYMENT_REVIEW_BACKEND || '/opt/nafes/current/backend';
const action = process.argv[2];
if (!['poll','claim','notice'].includes(action)) throw Error('Specify poll, claim or notice <id>');
if (process.env.NPHIES_ENVIRONMENT !== 'sandbox' || new URL(process.env.NPHIES_BASE_URL).hostname !== '176.105.150.83') throw Error('Verified sandbox configuration required');
const {default:transport} = await import(backend+'/services/nphiesService.js');
const {default:payments} = await import(backend+'/services/paymentReconciliationService.js');
const {default:pool} = await import(backend+'/db.js');
const dir = '/home/ubuntu/payment-cycle-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+action;
fs.mkdirSync(dir,{mode:0o700});
const save = (name,data) => fs.writeFileSync(dir+'/'+name+'.json',JSON.stringify(data,null,2),{mode:0o600});
const summarize = data => {
  const resources = [data,...(data?.entry || []).map(e=>e.resource)].filter(Boolean);
  const header = resources.find(r=>r.resourceType==='MessageHeader');
  const claim = resources.find(r=>r.resourceType==='ClaimResponse');
  return {responseCode:header?.response?.code,outcome:claim?.outcome,
    errors:resources.filter(r=>r.resourceType==='OperationOutcome').flatMap(r=>r.issue||[]),claimErrors:claim?.error||[]};
};
const report = {action,environment:'sandbox',startedAt:new Date().toISOString(),directory:dir};
try {
  if (action === 'poll') {
    const result = await payments.pollAndProcessPaymentReconciliations('1010613708');
    save('result',result);
    const log = (await pool.query("SELECT poll_bundle,response_bundle FROM poll_logs WHERE poll_bundle->>'id'=$1 ORDER BY id DESC LIMIT 1",[result.pollRequestBundle.id])).rows[0];
    save('request',log?.poll_bundle); save('response',log?.response_bundle);
    Object.assign(report,{success:result.success,processed:result.processed,failed:result.failed,...summarize(log?.response_bundle)});
  } else if (action === 'notice') {
    const id = Number(process.argv[3]);
    if (![1,4].includes(id)) throw Error('Only the reviewed pending sandbox reconciliations 1 and 4 are in scope');
    const row = await payments.getById(id);
    const header = row?.request_bundle?.entry?.[0]?.resource;
    if (header?.sender?.identifier?.value !== 'INS-FHIR' || header?.destination?.[0]?.receiver?.identifier?.value !== '1010613708') throw Error('Sandbox provider/payer identity mismatch');
    save('original-reconciliation',row.request_bundle);
    const paymentStatus = process.argv[4] || 'paid';
    const result = await payments.sendPaymentNotice(id,paymentStatus,{syntheticTest:true,receivedDate:new Date().toISOString().slice(0,10),receiptReference:'SANDBOX-TEST-'+randomUUID()});
    save('request',result.paymentNoticeBundle);save('response',result.nphiesResponse);save('result',result);
    Object.assign(report,{reconciliationId:id,paymentStatus,attemptId:result.attemptId,success:result.success,deliveryState:result.deliveryState,...summarize(result.nphiesResponse)});
  } else {
    // This source was explicitly confirmed synthetic and accepted on September 13.
    const source='/home/ubuntu/current-test-claim-12d467da-4555-4f40-ad8c-26985ea983dd';
    const evidence=JSON.parse(fs.readFileSync(source+'/verification.json'));
    if (!evidence.syntheticDataConfirmedByUser || evidence.environment!=='sandbox') throw Error('Synthetic source evidence missing');
    let request=JSON.parse(fs.readFileSync(source+'/request.txt'));
    const replacements = new Map();
    for(const entry of request.entry) if(['MessageHeader','Claim'].includes(entry.resource.resourceType)) {
      const old=entry.resource.id,id=randomUUID();replacements.set(entry.fullUrl,entry.fullUrl.replace(old,id));replacements.set(old,id);
    }
    const replace=x=>typeof x==='string'?replacements.get(x)||x:Array.isArray(x)?x.map(replace):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,replace(v)])):x;
    request=replace(request);request.id=randomUUID();request.timestamp=new Date().toISOString();
    const claim=request.entry.find(e=>e.resource.resourceType==='Claim').resource;
    claim.created=request.timestamp;claim.identifier[0].value='TEST-'+randomUUID();
    save('request',request);
    const result=await transport.submitClaim(request);
    save('response',result.data || result.error?.details);save('result',result);
    const header=result.data?.entry?.find(e=>e.resource?.resourceType==='MessageHeader')?.resource;
    const response=result.data?.entry?.find(e=>e.resource?.resourceType==='ClaimResponse')?.resource;
    Object.assign(report,{httpStatus:result.status,correlated:header?.response?.identifier===request.entry[0].resource.id,
      claimRequestMatches:response?.request?.identifier?.value===claim.identifier[0].value,...summarize(result.data || result.error?.details)});
    report.success=!!(result.success && report.correlated && report.claimRequestMatches && report.outcome==='complete' && !report.claimErrors.length && !report.errors.length);
  }
} catch (error) { report.success=false;report.error=error.message; }
finally { await pool.end(); }
report.finishedAt=new Date().toISOString();save('verification',report);console.log(JSON.stringify(report));
process.exitCode=report.success?0:1;
