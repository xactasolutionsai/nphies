"""Read saved delivery state through the authenticated application API."""
import json
import urllib.request
from pathlib import Path

base = 'http://127.0.0.1:8001/api'
credentials = json.loads(Path('/etc/nafes/admin-bootstrap.json').read_text())
request = urllib.request.Request(base+'/auth/login', data=json.dumps({'email':credentials['email'],'password':credentials['password']}).encode(), headers={'Content-Type':'application/json'})
with urllib.request.urlopen(request, timeout=20) as response:
    token = json.load(response)['data']['token']
result = []
for identifier in [1,4]:
    request = urllib.request.Request(base+'/payment-reconciliation/'+str(identifier), headers={'Authorization':'Bearer '+token})
    with urllib.request.urlopen(request, timeout=20) as response:
        record = json.load(response)['data']
    result.append({'id':identifier,'acknowledgementStatus':record['acknowledgement_status'],
                   'paymentStatus':record['payment_status_sent'],
                   'attempts':[{'id':a['id'],'paymentStatus':a['payment_status'],'status':a['status']} for a in record['notice_attempts']]})
assert result[0]['acknowledgementStatus'] == 'failed'
assert result[1]['acknowledgementStatus'] == 'sent' and result[1]['paymentStatus'] == 'cleared'
assert [a['status'] for a in result[1]['attempts']] == ['accepted','accepted']
print(json.dumps(result))
