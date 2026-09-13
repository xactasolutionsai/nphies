"""Read-only snapshot audit; output contains local record IDs, not patient data."""
import collections
import datetime
import decimal
import hashlib
import html
import json
from pathlib import Path
import subprocess

SUCCESS = {'approved','accepted','success','successful','complete','completed','processed','sent','paid','cleared','finalized','eligible','no_messages','acknowledged'}
TABLES = ['eligibility','prior_authorizations','prior_authorization_responses','advanced_authorizations',
 'claim_submissions','claim_submission_responses','claim_batches','nphies_communications',
 'nphies_communication_requests','payment_reconciliations','poll_logs','claims','claims_batch',
 'payments','dental_approvals','eye_approvals','general_requests','standard_approvals_claims']
FIELDS = {'id','claim_id','prior_auth_id','claim_number','request_number','outbound_message_header_id',
 'status','outcome','adjudication_outcome','acknowledgement_status','acknowledgment_status',
 'processing_status','response_code','nphies_response_code','has_errors',
 'total_amount','approved_amount','eligible_amount','benefit_amount','copay_amount','tax_amount',
 'currency','payment_amount','payment_currency','total_claims','number_of_claims',
 'request_bundle','response_bundle','raw_request','raw_response','bundle_json',
 'acknowledgement_bundle','acknowledgement_response','acknowledgment_bundle','poll_bundle',
 'poll_response_bundle','payment_status_sent','claim_response_status','claim_response_use',
 'insurance_approval_status'}

PRIMARY_TABLES=set(TABLES)
TABLES += ['claim_submission_items','prior_authorization_items','payment_reconciliation_details']
FIELDS.update({'sequence','quantity','unit_price','factor','tax','net_amount','adjudication_amount',
 'adjudication_eligible_amount','adjudication_copay_amount','reconciliation_id','claim_submission_id',
 'claim_identifier_value','claim_identifier_system','amount'})

def psql(sql):
    r=subprocess.run(['sudo','-u','postgres','psql','-p','5433','-d','nafes_healthcare','-X','-t','-A','-v','ON_ERROR_STOP=1'],input=sql,capture_output=True,text=True,check=True)
    return r.stdout

schema=json.loads(psql("SELECT json_agg(t) FROM (SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public') t;"))
columns=collections.defaultdict(list)
for r in schema: columns[r['table_name']].append(r['column_name'])
queries=[]
for table in TABLES:
    if table not in columns: continue
    fields=[c for c in columns[table] if c in FIELDS or c==table.rstrip('s')+'_id' or c in {'eligibility_id','payment_id','batch_id'}]
    queries.append("SELECT json_build_object('table','"+table+"','rows',coalesce(json_agg(t),'[]')) FROM (SELECT "+','.join('"'+c+'"' for c in fields)+' FROM "'+table+'") t;')
raw=psql('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+'\n'.join(queries)+'\nROLLBACK;')
groups=[]
for part in raw.splitlines():
    # Aggregate JSON may span lines; parse below after stripping command tags.
    if part.strip() in {'BEGIN','ROLLBACK'}: continue
    groups.append(part)
remaining='\n'.join(groups).strip(); snapshot={}
while remaining:
    obj,end=json.JSONDecoder().raw_decode(remaining);snapshot[obj['table']]=obj['rows'];remaining=remaining[end:].strip()

def decode(x):
    if isinstance(x,str):
        try:return json.loads(x)
        except (ValueError,TypeError):return None
    return x if isinstance(x,(dict,list)) else None

def walk(x):
    if isinstance(x,dict):
        yield x
        for v in x.values():yield from walk(v)
    elif isinstance(x,list):
        for v in x:yield from walk(v)

def resources(x,kind):return [r for r in walk(x) if r.get('resourceType')==kind]
def key(row):
    return row.get('id',next((v for k,v in row.items() if k.endswith('_id')),None))
def number(x):
    try:return decimal.Decimal(str(x))
    except decimal.InvalidOperation:return None
def same(a,b):
    a,b=number(a),number(b)
    return a is not None and b is not None and abs(a-b)<=decimal.Decimal('0.01')

parent_index={t:{r.get('id'):r for r in snapshot.get(t,[])} for t in ['prior_authorizations','claim_submissions']}
children={}
for t,fk in [('claim_submission_items','claim_id'),('prior_authorization_items','prior_auth_id'),('payment_reconciliation_details','reconciliation_id')]:
    index=collections.defaultdict(list)
    for r in snapshot.get(t,[]):index[r.get(fk)].append(r)
    children[t]=index
results=[];coverage=[]
for table,rows in snapshot.items():
    if table not in PRIMARY_TABLES:continue
    selected=0;statuses=collections.Counter(str(r.get('status',r.get('outcome','unspecified'))) for r in rows)
    for row in rows:
        local={k:str(v).lower() for k,v in row.items() if (k in {'status','outcome','adjudication_outcome','insurance_approval_status'} or k.endswith('_status')) and v is not None}
        blobs={k:decode(v) for k,v in row.items() if 'bundle' in k or k in {'raw_request','raw_response','bundle_json'}}
        codes=[h.get('response',{}).get('code') for b in blobs.values() for h in resources(b,'MessageHeader')]
        fhir_complete=any(r.get('outcome')=='complete' for b in blobs.values() for r in walk(b) if r.get('resourceType') in {'ClaimResponse','CoverageEligibilityResponse'})
        if not (any(v in SUCCESS for v in local.values()) or 'ok' in codes or fhir_complete):continue
        selected+=1
        out={'table':table,'id':key(row),'local_states':local,'response_codes':codes,'checks':[]}
        def check(name,status,detail):out['checks'].append({'check':name,'status':status,'detail':detail})
        pairs=[]
        req=blobs.get('request_bundle') or blobs.get('raw_request') or blobs.get('poll_bundle')
        resp=blobs.get('response_bundle') or blobs.get('raw_response') or blobs.get('bundle_json')
        if table in {'prior_authorization_responses','claim_submission_responses'}:
            parent_table='prior_authorizations' if table=='prior_authorization_responses' else 'claim_submissions'
            parent_id=row.get('prior_auth_id' if table=='prior_authorization_responses' else 'claim_id')
            parent=parent_index[parent_table].get(parent_id,{})
            req=decode(parent.get('request_bundle'))
            check('historical_pairing','LIMITATION','Parent stores its latest request; absence of correlation cannot establish historical corruption.')
        if req or resp:pairs.append(('main',req,resp))
        if table=='payment_reconciliations':
            pairs=[('payment_notice',blobs.get('acknowledgement_bundle'),blobs.get('acknowledgement_response'))]
            pr=resources(blobs.get('request_bundle'),'PaymentReconciliation')
            if len(pr)==1:
                amount=pr[0].get('paymentAmount',{})
                if row.get('payment_amount') is not None and amount.get('value') is not None:
                    check('payment_amount','PASS' if same(row['payment_amount'],amount['value']) else 'MISMATCH','Database payment amount versus incoming reconciliation.')
                if row.get('payment_currency') and amount.get('currency'):
                    check('payment_currency','PASS' if row['payment_currency']==amount['currency'] else 'MISMATCH','Database versus incoming currency.')
            else:check('incoming_reconciliation','UNVERIFIABLE','A single original PaymentReconciliation is unavailable.')
        if blobs.get('poll_response_bundle'):pairs.append(('poll',blobs.get('poll_bundle'),blobs['poll_response_bundle']))
        if not pairs:check('request_response','UNVERIFIABLE','No request/response evidence stored in this table.')
        for label,request,response in pairs:
            if not request or not response:
                check(label+'_pair','UNVERIFIABLE','Request or response is absent; incoming-only records may legitimately lack an outbound request.')
                continue
            check(label+'_json','PASS','Request and response decode as JSON.')
            out[label+'_request_sha256']=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest()
            out[label+'_response_sha256']=hashlib.sha256(json.dumps(response,sort_keys=True).encode()).hexdigest()
            request_headers=resources(request,'MessageHeader');response_headers=resources(response,'MessageHeader')
            ids={h.get('id') for h in request_headers}
            replies=[h['response'] for h in response_headers if h.get('response')]
            if not replies:check(label+'_correlation','UNVERIFIABLE','No MessageHeader.response available.')
            else:
                matches=all(h.get('identifier') in ids for h in replies)
                check(label+'_correlation','PASS' if matches else 'REVIEW','All reply identifiers compared with request MessageHeader IDs; unmatched historical messages need tracing.')
                check(label+'_ack','PASS' if all(h.get('code')=='ok' for h in replies) else 'REVIEW','Acknowledgement codes: '+','.join(str(h.get('code')) for h in replies))
            errors=[i for o in resources(response,'OperationOutcome') for i in o.get('issue',[]) if i.get('severity') in {'error','fatal'}]
            responses=resources(response,'ClaimResponse')+resources(response,'CoverageEligibilityResponse')
            claim_errors=sum(len(c.get('error',[])) for c in responses)
            check(label+'_errors','REVIEW' if errors or claim_errors else 'PASS',f'Fatal/error OperationOutcome issues: {len(errors)}; resource errors: {claim_errors}. Technical receipt can coexist with business rejection.')
            outcomes=[c.get('outcome') for c in responses]
            out.setdefault('business_outcomes',[]).extend(outcomes)
            if outcomes:check(label+'_finality','PASS' if all(x=='complete' for x in outcomes) else 'REVIEW','Business outcomes: '+','.join(str(x) for x in outcomes)+'. complete is processing completion, not proof of payment.')
            if local.get('status')=='approved' and any(x in {'error','queued'} for x in outcomes):check('approved_vs_response','MISMATCH','Local approved status conflicts with error/queued in the saved business response.')
            claims=resources(request,'Claim')
            for c in responses:
                ref=c.get('request',{})
                ident=ref.get('identifier',{})
                if ident.get('value'):
                    matched=[cl for cl in claims if any(i.get('value')==ident['value'] and (not ident.get('system') or i.get('system')==ident['system']) for i in cl.get('identifier',[]))]
                else:
                    reference=ref.get('reference','');matched=[cl for cl in claims if reference and reference.split('/')[-1]==cl.get('id')]
                if not matched:
                    check(label+'_claim_reference','UNVERIFIABLE','Response request reference could not be paired with a saved Claim. Eligibility uses a different request resource.')
                    continue
                check(label+'_claim_reference','PASS','ClaimResponse request identifier/reference matches request Claim.')
                seq={i.get('sequence') for i in matched[0].get('item',[])}
                check(label+'_item_sequences','PASS' if all(i.get('itemSequence') in seq for i in c.get('item',[])) else 'MISMATCH','Response itemSequence values compared to request item sequence values; insurer addItem excluded.')
            if len(claims)==1:
                claim=claims[0];total=claim.get('total',{})
                if row.get('total_amount') is not None and total.get('value') is not None:check('database_request_total','PASS' if same(row['total_amount'],total['value']) else 'MISMATCH','Stored total_amount versus request Claim.total.')
                if row.get('currency') and total.get('currency'):check('request_currency','PASS' if row['currency']==total['currency'] else 'MISMATCH','Stored currency versus request Claim.total.currency.')
                items=claim.get('item',[])
                if items and all(i.get('net',{}).get('value') is not None for i in items) and total.get('value') is not None:
                    subtotal=sum(number(i['net']['value']) for i in items)
                    check('item_net_sum','PASS' if same(subtotal,total['value']) else 'REVIEW','Sum of request item net versus Claim.total; tax/adjustment semantics require review on differences.')
                missing_factor=sum('factor' not in i for i in items)
                if missing_factor:check('current_factor_rule','REVIEW',f'{missing_factor} items lack factor. A current sandbox test rejected this; not proof that historical acceptance was invalid.')
                childtable={'claim_submissions':'claim_submission_items','prior_authorizations':'prior_authorization_items'}.get(table)
                if childtable:
                    saved=children[childtable].get(row['id'],[])
                    check('database_item_count','PASS' if len(saved)==len(items) else 'MISMATCH','Database item count versus saved request.')
                    seqmap={i.get('sequence'):i for i in items}
                    for d in saved:
                        source=seqmap.get(d.get('sequence'))
                        if not source:
                            check('database_item_sequence','MISMATCH','Database sequence missing from request.');continue
                        check('database_item_sequence','PASS','Database sequence exists in saved request.')
                        for field,actual in [('quantity',source.get('quantity',{}).get('value')),('unit_price',source.get('unitPrice',{}).get('value')),('net_amount',source.get('net',{}).get('value')),('factor',source.get('factor',1))]:
                            if d.get(field) is not None and actual is not None:check('item_'+field,'PASS' if same(d[field],actual) else 'MISMATCH','Stored item value versus saved request, paired by sequence.')
                        for ext in source.get('extension',[]):
                            if ext.get('url','').endswith('extension-tax') and d.get('tax') is not None:
                                money=ext.get('valueMoney',{}).get('value')
                                if money is not None:check('item_tax','PASS' if same(d['tax'],money) else 'MISMATCH','Stored tax versus request item tax extension.')
                        if len(responses)==1:
                            item_resp=next((i for i in responses[0].get('item',[]) if i.get('itemSequence')==d.get('sequence')),None)
                            if item_resp:
                                categories={c.get('code'):a.get('amount',{}).get('value') for a in item_resp.get('adjudication',[]) for c in a.get('category',{}).get('coding',[])}
                                for field,category in [('adjudication_amount','benefit'),('adjudication_eligible_amount','eligible'),('adjudication_copay_amount','copay')]:
                                    if d.get(field) is not None and categories.get(category) is not None:check('item_'+field,'PASS' if same(d[field],categories[category]) else 'MISMATCH','Stored adjudication versus matching item category in response.')
            if table=='claim_batches' and label=='main':check('batch_claim_count','PASS' if row.get('total_claims')==len(claims) else 'MISMATCH','Stored total_claims versus actual Claim resources.')
            if len(responses)==1:
                totals={}
                for t in responses[0].get('total',[]):
                    for c in t.get('category',{}).get('coding',[]):
                        if t.get('amount',{}).get('value') is not None:totals[c.get('code')]=t['amount']['value']
                for field,code in [('eligible_amount','eligible'),('benefit_amount','benefit'),('copay_amount','copay'),('tax_amount','tax')]:
                    if row.get(field) is not None and code in totals:check(field,'PASS' if same(row[field],totals[code]) else 'MISMATCH','Database amount versus corresponding ClaimResponse total category.')
        states={c['status'] for c in out['checks']}
        out['classification']='MISMATCH' if 'MISMATCH' in states else 'REVIEW' if 'REVIEW' in states else 'UNVERIFIABLE' if 'UNVERIFIABLE' in states else 'CHECKS_PASSED'
        results.append(out)
    coverage.append({'table':table,'rows_scanned':len(rows),'success_candidate_rows':selected,'stored_status_counts':dict(statuses)})

root=Path('/home/ubuntu/success-records-audit');root.mkdir(mode=0o700,exist_ok=True)
summary={'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only':True,
 'snapshot_mode':'repeatable-read transaction','selection':'Local positive status OR stored MessageHeader ok OR business outcome complete. These are candidates, not proven successful payments.',
 'rows_scanned':sum(x['rows_scanned'] for x in coverage),'success_candidates':len(results),
 'classifications':dict(collections.Counter(x['classification'] for x in results)),
 'check_counts':dict(collections.Counter(c['status'] for r in results for c in r['checks'])),
 'limitations':['No live resubmission or insurer/bank verification.','Latest overwritten historical requests cannot be reconstructed.','No clinical appropriateness assessment or proof of payment.','No blanket historical tax/factor rule imposed retroactively.','Standalone test files outside database are outside this snapshot.','Child-table line values, attachments and all profile requirements are not exhaustively validated.','approved_amount is not compared to benefit without confirming its semantics.']}
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
(root/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2))
(root/'records.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
body=['<!doctype html><meta charset="utf-8"><title>Stored Success Records Audit</title><style>body{font:15px system-ui;margin:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}pre{white-space:pre-wrap}summary{cursor:pointer} .MISMATCH{color:#b00}.REVIEW{color:#965700}</style><h1>Stored Success Records Audit</h1>', '<p>Read-only database evidence audit. No transactions sent. No patient names or identifiers included.</p>', '<pre>'+html.escape(json.dumps(summary,indent=2))+'</pre>','<h2>Coverage</h2><pre>'+html.escape(json.dumps(coverage,indent=2))+'</pre><h2>Individual records</h2>']
for r in sorted(results,key=lambda r:({'MISMATCH':0,'REVIEW':1,'UNVERIFIABLE':2,'CHECKS_PASSED':3}[r['classification']],r['table'],str(r['id']))):
    body.append('<details><summary class="'+r['classification']+'">'+html.escape(f"{r['classification']} | {r['table']} #{r['id']}")+'</summary><pre>'+html.escape(json.dumps(r,ensure_ascii=False,indent=2))+'</pre></details>')
(root/'report.html').write_text('\n'.join(body),encoding='utf-8')
subprocess.run(['chown','-R','ubuntu:ubuntu',str(root)],check=True)
print(json.dumps(summary))
