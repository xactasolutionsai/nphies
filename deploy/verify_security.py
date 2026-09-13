"""Check deployed access controls without credentials or clinical data."""
import json
import urllib.request
import urllib.error

base = 'https://87.237.225.69'
def request(path, payload=None):
    req = urllib.request.Request(base + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers

for path in ['/api/auth/register', '/api/auth/register/', '/api/AUTH/REGISTER']:
    status, _ = request(path, {})
    assert status == 403, (path, status)
    print(path, status)
for path in ['/api/patients', '/api/contacts', '/api/openmed/status']:
    status, headers = request(path)
    assert status == 401, (path, status)
    assert headers.get('Cache-Control') == 'no-store'
    print(path, 'unauthenticated access blocked; no-store')
status, headers = request('/')
assert status == 200
assert "object-src 'none'" in headers.get('Content-Security-Policy', '')
assert headers.get('X-Content-Type-Options') == 'nosniff'
print('HTTPS and browser security headers: PASS')
