import fs from 'node:fs';
import pool from '/opt/nafes/current/backend/db.js';
try {
 for (const name of ['payment-reconciliation-poll-2026-09-13T18-22-32-484Z','payment-reconciliation-poll-2026-09-13T18-23-19-479Z']) {
  const dir='/home/ubuntu/'+name;
  const req=JSON.parse(fs.readFileSync(dir+'/request.txt','utf8'));
  const res=JSON.parse(fs.readFileSync(dir+'/response.txt','utf8'));
  const report=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8'));
  const accepted=report.httpSuccess&&report.correlated&&report.responseCodes.includes('ok');
  const result=await pool.query(`INSERT INTO poll_logs (poll_id,schema_name,provider_nphies_id,trigger_type,status,poll_bundle,response_bundle,response_code,messages_received,messages_processed,messages_matched,messages_unmatched,processing_summary,errors,started_at,completed_at,duration_ms,created_at)
   VALUES ($1,'public','1010613708','manual',$2,$3,$4,$5,0,0,0,0,$6,$7,$8,$9,$10,$8)
   ON CONFLICT (poll_id) DO UPDATE SET poll_id=EXCLUDED.poll_id RETURNING id,status`,
   [req.id,accepted?'no_messages':'error',JSON.stringify(req),JSON.stringify(res),report.responseCodes[0]||String(report.httpStatus),JSON.stringify({source:'Imported actual payment-reconciliation test',httpStatus:report.httpStatus}),accepted?null:JSON.stringify(report.issues.map(i=>({type:'nphies_error',details:i.details?.coding?.[0]?.display||i.code}))),report.startedAt,report.finishedAt,Date.parse(report.finishedAt)-Date.parse(report.startedAt)]);
  console.log(JSON.stringify(result.rows[0]));
 }
} finally {await pool.end();}