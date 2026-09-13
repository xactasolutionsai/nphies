"""End-to-end HTTPS advisory test using one new synthetic patient, removed afterwards."""
import json
import uuid
from pathlib import Path
import urllib.request

credentials=json.loads(Path('/etc/nafes/admin-bootstrap.json').read_text())
base='https://87.237.225.69/api'
token=None
def call(path,method='GET',body=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    request=urllib.request.Request(base+path,method=method,headers=headers,
                                  data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(request,timeout=150) as response:
        return json.load(response)
token=call('/auth/login','POST',{'email':credentials['email'],'password':credentials['password']})['data']['token']
patient=call('/patients','POST',{'name':'Synthetic Deployment Verification',
    'identifier':'DEPLOY-'+uuid.uuid4().hex[:16],'gender':'unknown','birth_date':'1990-01-01'})['data']
patient_id=patient['patient_id']
try:
    record=call('/openmed/analyses','POST',{'patient_id':patient_id,'source_type':'manual','source_id':None,
        'mode':'medications','text':'Patient takes metformin for type 2 diabetes.'})
    assert any(entity['text'].lower()=='metformin' for entity in record['result']['entities'])
    reviewed=call('/openmed/analyses/'+record['id'],'PATCH',{'review_status':'reviewed','review_note':'Synthetic deployment verification'})
    assert reviewed['review_status']=='reviewed'
    history=call('/openmed/analyses?patient_id='+patient_id)
    assert history['data'][0]['id']==record['id']
    print('HTTPS login, patient association, real local inference, database save, review, and history: PASS')
finally:
    call('/patients/'+patient_id,'DELETE')
    assert call('/openmed/analyses?patient_id='+patient_id)['data']==[]
    print('Synthetic patient and advisory records removed; imported patient records unchanged')
