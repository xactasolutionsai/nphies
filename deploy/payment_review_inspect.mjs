// Read-only operational inventory. Credentials and clinical records are never printed.
const root = process.argv[2] || '/opt/nafes/current/backend';
const {default:pool} = await import(root+'/db.js');
try {
  const rows = (await pool.query('SELECT id,acknowledgement_status,payment_status_sent,request_bundle FROM payment_reconciliations ORDER BY id')).rows;
  const summaries = rows.map(row => {
    const resources = row.request_bundle?.entry?.map(e=>e.resource) || [];
    const pr = resources.find(r=>r.resourceType==='PaymentReconciliation');
    const h = resources.find(r=>r.resourceType==='MessageHeader');
    return {id:row.id,acknowledgementStatus:row.acknowledgement_status,paymentStatus:row.payment_status_sent,
      originalMessageId:h?.id,provider:h?.destination?.[0]?.receiver?.identifier,payer:h?.sender?.identifier,
      outcome:pr?.outcome,paymentDate:pr?.paymentDate,originalIdentifier:pr?.identifier};
  });
  console.log(JSON.stringify({database:process.env.DB_NAME,environment:process.env.NPHIES_ENVIRONMENT,
    endpoint:process.env.NPHIES_BASE_URL,records:summaries},null,2));
} finally {await pool.end();}
