"""Fresh Ubuntu host provisioning. Run as root. Secrets never written to stdout."""
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import urllib.request

def run(*args):
    subprocess.run(args, check=True)

node_root = Path('/opt/node24')
if not (node_root/'bin/node').exists():
    index = json.load(urllib.request.urlopen('https://nodejs.org/dist/index.json'))
    version = next(row['version'] for row in index if row['version'].startswith('v24.') and row['lts'])
    archive = f'node-{version}-linux-x64.tar.xz'
    base = f'https://nodejs.org/dist/{version}/'
    checksums = urllib.request.urlopen(base+'SHASUMS256.txt').read().decode()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.endswith('  '+archive))
    target = Path('/tmp')/archive
    urllib.request.urlretrieve(base+archive, target)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == expected
    node_root.mkdir(exist_ok=True)
    run('tar','-xJf',str(target),'--strip-components=1','-C',str(node_root))
    for name in ('node','npm','npx'):
        run('ln','-sfn',str(node_root/'bin'/name),f'/usr/local/bin/{name}')

config = Path('/etc/nafes/app.env')
if not config.exists():
    app_password, advisor_password = secrets.token_hex(32), secrets.token_hex(32)
    # Values interpolated into SQL below are generated hex, never external input.
    sql = f"CREATE ROLE nafes_app LOGIN PASSWORD '{app_password}';"
    sql += f"CREATE ROLE nafes_openmed_app LOGIN PASSWORD '{advisor_password}';"
    subprocess.run(['sudo','-u','postgres','psql','-X','-v','ON_ERROR_STOP=1'],input=sql,text=True,check=True)
    run('sudo','-u','postgres','createdb','--owner=nafes_app','nafes_healthcare')
    values = {
        'DB_HOST':'127.0.0.1','DB_PORT':'5432','DB_NAME':'nafes_healthcare','DB_USER':'nafes_app','DB_PASSWORD':app_password,
        'PORT':'8001','NODE_ENV':'production','JWT_SECRET':secrets.token_hex(48),'JWT_EXPIRES_IN':'7d',
        'CORS_ORIGIN':'https://87.237.225.69','RATE_LIMIT_MAX_REQUESTS':'10000',
        'OPENMED_DATABASE_URL':f'postgresql://nafes_openmed_app:{advisor_password}@127.0.0.1:5432/nafes_healthcare',
        'OPENMED_PYTHON':'/opt/nafes/current/backend/.venv-openmed/bin/python',
        'OLLAMA_BASE_URL':'http://127.0.0.1:11434','AI_VALIDATION_ENABLED':'false',
        'ENABLE_SCHEDULED_POLLING':'false','NPHIES_ENVIRONMENT':'sandbox','NPHIES_ALLOW_INSECURE_SANDBOX':'false',
    }
    config.write_text(''.join(f'{key}={value}\n' for key,value in values.items()))
    config.chmod(0o640)
    run('chown','root:nafes',str(config))
run('ln','-sfn',str(config),'/opt/nafes/current/backend/.env')
print('Host runtime and private database configuration prepared')
