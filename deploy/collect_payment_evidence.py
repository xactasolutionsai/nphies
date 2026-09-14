"""Collect sandbox request/response evidence privately and a non-clinical summary."""
import json
import os
import pwd
import tarfile
from pathlib import Path

root = Path('/home/ubuntu')
folders = sorted(root.glob('payment-cycle-2026-09-14T*'))
summaries = []
for folder in folders:
    report = json.loads((folder/'verification.json').read_text())
    request_file = folder/'request.json'
    response_file = folder/'response.json'
    if request_file.exists() and response_file.exists():
        request = json.loads(request_file.read_text())
        response = json.loads(response_file.read_text())
        headers = lambda b: next((e['resource'] for e in (b or {}).get('entry', []) if e.get('resource', {}).get('resourceType') == 'MessageHeader'), {})
        report['requestMessageId'] = headers(request).get('id')
        report['responseMessageId'] = headers(response).get('id')
        report['responseIdentifier'] = headers(response).get('response', {}).get('identifier')
        report['correlated'] = bool(report['requestMessageId']) and report['requestMessageId'] == report['responseIdentifier']
    summaries.append(report)
archive = root/'payment-evidence-20260914.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for folder in folders:
        tar.add(folder, arcname=folder.name)
summary = root/'payment-live-summary-20260914.json'
summary.write_text(json.dumps(summaries, ensure_ascii=False, indent=2))
user = pwd.getpwnam('ubuntu')
for file in [archive, summary]:
    os.chmod(file, 0o600)
    os.chown(file, user.pw_uid, user.pw_gid)
print(json.dumps({'exchanges': len(summaries), 'archive': str(archive), 'summary': str(summary)}))
