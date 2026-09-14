import fs from 'node:fs';
const {default:pool}=await import('/opt/nafes/current/backend/db.js');
try {
 await pool.query('BEGIN READ ONLY');
 const schema=(await pool.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND (table_name LIKE '%poll%' OR table_name LIKE '%payment%' OR table_name LIKE '%message%') ORDER BY table_name,ordinal_position")).rows;
 const rows=(await pool.query('SELECT * FROM payment_reconciliations WHERE id=1')).rows;
 const attempts=(await pool.query('SELECT * FROM payment_notice_attempts WHERE reconciliation_id=1 ORDER BY id')).rows;
 const needle='%'+rows[0].identifier_value+'%';
 const pollLogs=(await pool.query('SELECT id,poll_id,provider_nphies_id,status,response_code,started_at,poll_bundle,response_bundle FROM poll_logs WHERE response_bundle::text LIKE $1 OR poll_bundle::text LIKE $1',[needle])).rows;
 const pollMessages=(await pool.query('SELECT * FROM poll_messages WHERE resource_data::text LIKE $1 OR message_header_id=$2',[needle,rows[0].nphies_message_id])).rows;
 const details=(await pool.query('SELECT * FROM payment_reconciliation_details WHERE reconciliation_id=1')).rows;
 const result={capturedAt:new Date().toISOString(),environment:process.env.NPHIES_ENVIRONMENT,schema,rows,attempts,pollLogs,pollMessages,details};
 fs.writeFileSync('/home/ubuntu/payment-db-trace.json',JSON.stringify(result,null,2),{mode:0o600});
 const r=rows[0];
 console.log(JSON.stringify({record:{id:r.id,receivedAt:r.received_at,createdAt:r.created_at,processingStatus:r.processing_status,nphiesMessageId:r.nphies_message_id,nphiesRequestId:r.nphies_request_id,originalBundleId:r.request_bundle?.id,hasResponse:!!r.response_bundle,amount:r.payment_amount,currency:r.payment_currency},pollLogMatches:pollLogs.length,pollMessageMatches:pollMessages.length,details:details.map(d=>({id:d.id,claimSubmissionId:d.claim_submission_id,claimIdentifier:d.claim_identifier_value})),attempts:attempts.map(a=>({id:a.id,status:a.status,http:a.http_status,created:a.created_at}))}));
 await pool.query('ROLLBACK');
} finally {await pool.end();}
