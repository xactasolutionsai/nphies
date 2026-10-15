"""Install administrator-supplied API settings without printing credentials."""
import json, os, shutil, sys, tempfile
from pathlib import Path
from datetime import datetime, timezone

config_path=Path(sys.argv[1])
config=json.loads(config_path.read_text(encoding='utf-8-sig'))
required={'CLAIM_REVIEW_API_URL','CLAIM_REVIEW_API_KEY','CLAIM_REVIEW_API_MODEL'}
allowed=required|{'CLAIM_REVIEW_API_TOKEN_PARAMETER','CLAIM_REVIEW_API_DISABLE_THINKING'}
assert required.issubset(config) and set(config).issubset(allowed)
assert all(isinstance(v,str) and v and not any(c in v for c in '\n\r\x00\"\'\\') for v in config.values())
target=Path('/etc/nafes/app.env')
stat=target.stat()
backup=Path('/var/backups/nafes')/('app-before-claim-api-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.env')
fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(target.read_text())
lines=[line for line in target.read_text().splitlines() if line.split('=',1)[0].strip() not in allowed]
lines.extend(f'{k}="{v}"' for k,v in config.items())
fd,name=tempfile.mkstemp(prefix='.claim-api-',dir=target.parent)
try:
    with os.fdopen(fd,'w') as f: f.write('\n'.join(lines)+'\n')
    os.chown(name,stat.st_uid,stat.st_gid); os.chmod(name,0o640)
    os.replace(name,target)
finally:
    if os.path.exists(name): os.unlink(name)
config_path.unlink()
print('API configuration installed; original environment backed up with mode 600.')
