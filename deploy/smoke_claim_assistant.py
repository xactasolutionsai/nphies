import json,time,sys,urllib.request,urllib.error
from pathlib import Path
base='https://aimedical.xactasolutions.tech/api'
credentials=json.loads(Path('/etc/nafes/admin-bootstrap.json').read_text())
token=None
def call(path,method='GET',body=None):
 headers={'Content-Type':'application/json'}
 if token: headers['Authorization']='Bearer '+token
 request=urllib.request.Request(base+path,method=method,headers=headers,data=None if body is None else json.dumps(body).encode())
 with urllib.request.urlopen(request,timeout=135) as response:return json.load(response)
try:
 call('/claim-submissions/1/assistant-review','POST',{'useModel':False})
 raise AssertionError('Anonymous access allowed')
except urllib.error.HTTPError as e: assert e.code==401
print('Anonymous request blocked: PASS')
token=call('/auth/login','POST',{'email':credentials['email'],'password':credentials['password']})['data']['token']
status=call('/openmed/status');assert status['runtime_ready'];print('OpenMed runtime and restricted database: PASS')
claim=call('/claim-submissions?limit=1')['data'][0]
before=call('/claim-submissions/'+str(claim['id']))['data']
review=call('/claim-submissions/'+str(claim['id'])+'/assistant-review','POST',{'useModel':False})['data']
after=call('/claim-submissions/'+str(claim['id']))['data']
assert before==after
assert review['external_data_sent'] is False and review['advisory_only'] is True
print('Authenticated review, source fields, unchanged claim: PASS')
if '--clinical' in sys.argv:
 review=call('/claim-submissions/'+str(claim['id'])+'/assistant-review','POST',{'useModel':True,'reviewMode':'clinical'})['data']
 assert review['review_mode']=='clinical' and review['external_data_sent'] is False
 assert review['model']['status'] in ['completed','no_text','unsupported_language','input_too_long']
 assert isinstance(review['clinical_audit'],list)
 assert before==call('/claim-submissions/'+str(claim['id']))['data']
 try:
  call('/claim-submissions/'+str(claim['id'])+'/assistant-review','POST',{'reviewMode':'untrusted'})
  raise AssertionError('Invalid mode accepted')
 except urllib.error.HTTPError as e: assert e.code==400
 print(json.dumps({'clinical_https':'PASS','status':review['model']['status'],'unchanged_claim':True,'invalid_mode_blocked':True}))
if '--api' in sys.argv:
 start=time.monotonic()
 review=call('/claim-submissions/'+str(claim['id'])+'/assistant-review','POST',{'useModel':True})['data']
 assert review['model']['status']=='api_completed', review['model']['status']
 assert review['external_data_sent'] is True and review['api']['text']
 assert before==call('/claim-submissions/'+str(claim['id']))['data']
 print(json.dumps({'api_review':'PASS','provider':review['api']['provider'],'model':review['api']['model'],'elapsed_seconds':round(time.monotonic()-start,2),'unchanged_claim':True}))
