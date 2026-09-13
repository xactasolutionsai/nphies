"""Read-only deployment checks. Never prints credentials or returned clinical rows."""
import json
from pathlib import Path
import urllib.request
import urllib.error

credentials = json.loads(Path('/etc/nafes/admin-bootstrap.json').read_text())
base = 'https://87.237.225.69'
request = urllib.request.Request(base+'/api/auth/login',data=json.dumps({
    'email':credentials['email'],'password':credentials['password']}).encode(),
    headers={'Content-Type':'application/json'})
with urllib.request.urlopen(request) as response:
    login = json.load(response)
token = login.get('data',{}).get('token')
assert token, 'Login did not return a token'
paths = ['patients','providers','insurers','authorizations','eligibility','claims','claim-batches','payments',
         'dashboard/stats','standard-approvals','dental-approvals','eye-approvals','general-requests',
         'prior-authorizations','claim-submissions','payment-reconciliation','advanced-authorizations','users','contacts',
         'openmed/status']
failed = []
for path in paths:
    request = urllib.request.Request(base+'/api/'+path,headers={'Authorization':'Bearer '+token})
    try:
        with urllib.request.urlopen(request) as response:
            body=json.load(response)
            print(f'{path}: {response.status}')
            if path=='openmed/status': print(json.dumps(body))
    except urllib.error.HTTPError as error:
        body=json.load(error)
        print(f'{path}: {error.code} {body.get("error", "")}')
        failed.append(path)
Path('/tmp/nafes-smoke-result.json').write_text(json.dumps({'failed':failed}))
if failed: raise SystemExit(1)
