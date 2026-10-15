// Transport baseline using only the public NPHIES synthetic institutional example.
// This does not certify a grouper or bypass the platform's DRG send gate.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
if (process.env.NPHIES_ENVIRONMENT !== 'sandbox' || process.env.NPHIES_BASE_URL !== 'http://176.105.150.83') throw Error('Sandbox configuration required');
const backend='/opt/nafes/current/backend';
const {default:transport}=await import(backend+'/services/nphiesService.js');
const {applyDrgToBundle}=await import(process.env.DRG_TEST_MODULE || backend+'/services/drgValidation.js');
const source=process.argv[2];
let bundle=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
const substitutions=new Map();
for (const entry of bundle.entry) {
  const resource=entry.resource, id=randomUUID(), fullUrl='http://PR-FHIR.com.sa/'+resource.resourceType+'/'+id;
  substitutions.set(entry.fullUrl,fullUrl);
  substitutions.set(resource.resourceType+'/'+resource.id,fullUrl);
  resource.id=id;
  entry.fullUrl=fullUrl;
  delete resource.text;
}
const walk=value=>typeof value==='string' ? substitutions.get(value) || value.replaceAll('2023-12-04','2026-10-10').replaceAll('2023-12-05','2026-10-11').replaceAll('2023-12-06','2026-10-12') : Array.isArray(value)?value.map(walk):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,walk(v)])):value;
bundle=walk(bundle);
bundle.id=randomUUID();bundle.timestamp=new Date().toISOString();delete bundle.text;
const resources=bundle.entry.map(e=>e.resource);
const header=resources.find(r=>r.resourceType==='MessageHeader');
const claim=resources.find(r=>r.resourceType==='Claim');
header.sender.identifier.value='1010613708';
header.destination[0].endpoint='http://nphies.sa/license/payer-license/INS-FHIR';
for(const resource of resources) for(const identifier of resource.identifier||[]) if(identifier.system==='http://nphies.sa/license/provider-license') identifier.value='1010613708';
claim.identifier[0].value='TEST-'+randomUUID();
for (const resource of resources) {
  if (resource.resourceType==='Encounter') resource.meta.profile=['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0'];
  if (resource.resourceType==='Practitioner') for (const identifier of resource.identifier||[]) identifier.type={coding:[{system:'http://terminology.hl7.org/CodeSystem/v2-0203',code:'MD'}]};
}
claim.created=bundle.timestamp;
claim.extension.unshift({url:'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',valueDate:'2026-10-01'});
for(const item of claim.item) item.factor=1;
if (process.env.DRG_WIRE_PROBE === 'true') {
  // Deliberately synthetic transport fixture, never an assertion of certified grouping.
  const encounter=resources.find(r=>r.resourceType==='Encounter');
  const patient=resources.find(r=>r.resourceType==='Patient');
  const fixture={claim_type:'institutional',encounter_class:'inpatient',encounter_start:encounter.period.start,encounter_end:encounter.period.end,drg_code:'E62B',drg_description:'RESPIR INFECTN/INFLAMM, MINC',drg_code_system:'http://nphies.sa/terminology/CodeSystem/drg',drg_version:'9.0',drg_grouper_name:'Synthetic fixture - not a certified grouper',drg_grouper_version:'test',drg_grouper_certified:false,drg_mds_confirmed:false,drg_grouper_output:{synthetic:true},diagnoses:[],drg_procedures:[]};
  applyDrgToBundle(bundle,fixture,{birth_date:patient.birthDate,gender:patient.gender});
  if (!process.env.DRG_TEST_PDF) throw Error('Synthetic test PDF required');
  claim.supportingInfo.push({sequence:Math.max(...claim.supportingInfo.map(s=>s.sequence))+1,category:{coding:[{system:'http://nphies.sa/terminology/CodeSystem/claim-information-category',code:'attachment'}]},valueAttachment:{contentType:'application/pdf',creation:'2026-10-12',title:'SYNTHETIC sandbox case - not certified grouping',data:fs.readFileSync(process.env.DRG_TEST_PDF).toString('base64')}});

}
const dir='/var/backups/nafes/sandbox-'+new Date().toISOString().replace(/[:.]/g,'-');fs.mkdirSync(dir,{mode:0o700});
const save=(name,value)=>fs.writeFileSync(dir+'/'+name+'.json',JSON.stringify(value,null,2),{mode:0o600});
save('request',bundle);
const result=await transport.submitClaim(bundle);save('result',result);
const response=result.data || result.error?.details;save('response',response || null);
const returned=response?.entry?.map(e=>e.resource)||[];
const acknowledgement=returned.find(r=>r.resourceType==='MessageHeader');
const adjudication=returned.find(r=>r.resourceType==='ClaimResponse');
const report={environment:'sandbox',synthetic:true,test:process.env.DRG_WIRE_PROBE==='true'?'synthetic DRG transport probe; not certified clinical grouping':'institutional transport baseline; not DRG acceptance',directory:dir,claimIdentifier:claim.identifier[0].value,httpStatus:result.status,acknowledgement:acknowledgement?.response?.code,outcome:adjudication?.outcome,correlated:acknowledgement?.response?.identifier===header.id,claimRequestMatches:adjudication?.request?.identifier?.value===claim.identifier[0].value,claimErrors:adjudication?.error||[],issues:returned.filter(r=>r.resourceType==='OperationOutcome').flatMap(r=>r.issue||[]),transportError:result.error};
report.accepted=!!(result.success && report.acknowledgement==='ok' && report.outcome==='complete' && report.correlated && report.claimRequestMatches && !report.claimErrors.length && !report.issues.length);
save('verification',report);console.log(JSON.stringify(report));
process.exitCode=report.accepted?0:1;
