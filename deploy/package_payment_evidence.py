"""Package original payment exchanges without rewriting payloads or sending them."""
import csv
import hashlib
import json
import shutil
import tarfile
import zipfile
from pathlib import Path

base = Path.home() / 'Downloads/payment-review-20260914'
out = base / 'NPHIES-Payment-Evidence-20260914'
out.mkdir(exist_ok=True)
with tarfile.open(base / 'payment-evidence-20260914.tar.gz') as archive:
    for member in archive.getmembers():
        if member.isfile() and Path(member.name).name in ('request.json', 'response.json', 'original-reconciliation.json', 'verification.json'):
            target = out / 'current' / member.name
            if not target.resolve().is_relative_to(out.resolve()):
                raise ValueError('Invalid archive path')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
for folder in sorted((Path.home() / 'Downloads/payment-evidence').glob('[1-5]')):
    target = out / 'historical' / ('reconciliation-' + folder.name)
    target.mkdir(parents=True, exist_ok=True)
    for name in ('request', 'response', 'original-reconciliation'):
        source = folder / (name + '.txt')
        if source.exists():
            json.loads(source.read_text(encoding='utf-8-sig'))
            shutil.copyfile(source, target / (name + '.json'))

def resources(bundle):
    return [e.get('resource', {}) for e in bundle.get('entry', [])]

def header(bundle):
    return next((r for r in resources(bundle) if r.get('resourceType') == 'MessageHeader'), {})

rows = []
for request_file in sorted(out.rglob('request.json')):
    response_file = request_file.with_name('response.json')
    request = json.loads(request_file.read_text(encoding='utf-8-sig'))
    response = json.loads(response_file.read_text(encoding='utf-8-sig')) if response_file.exists() else {}
    rh, sh = header(request), header(response)
    issues = [i for r in resources(response) if r.get('resourceType') == 'OperationOutcome' for i in r.get('issue', [])]
    claim_errors = [i for r in resources(response) if r.get('resourceType') == 'ClaimResponse' for i in r.get('error', [])]
    errors = [i for i in issues if i.get('severity') in ('fatal', 'error')] + claim_errors
    codes = [c.get('code', '') for i in errors for c in (i.get('details', i.get('code', {})) or {}).get('coding', [])]
    correlated = bool(rh.get('id')) and sh.get('response', {}).get('identifier') == rh['id']
    notice = next((r for r in resources(request) if r.get('resourceType') == 'PaymentNotice'), {})
    original_file = request_file.with_name('original-reconciliation.json')
    reference_match = ''
    if notice and original_file.exists():
        original = json.loads(original_file.read_text(encoding='utf-8-sig'))
        pr = next(r for r in resources(original) if r.get('resourceType') == 'PaymentReconciliation')
        reference = notice.get('payment', {}).get('identifier', {})
        reference_match = bool(reference.get('value')) and any(reference.get('system') == identifier.get('system') and reference.get('value') == identifier.get('value') for identifier in pr.get('identifier', []))
    rows.append(dict(exchange=str(request_file.parent.relative_to(out)).replace('\\', '/'), event=rh.get('eventCoding', {}).get('code'), requestBundleId=request.get('id'), responseBundleId=response.get('id'), requestMessageHeaderId=rh.get('id'), responseMessageHeaderId=sh.get('id'), responseIdentifier=sh.get('response', {}).get('identifier'), correlated=correlated, responseCode=sh.get('response', {}).get('code'), errorCodes=', '.join(codes), errorCount=len(errors), originalReferenceMatches=reference_match, requestFile=str(request_file.relative_to(out)).replace('\\', '/'), responseFile=str(response_file.relative_to(out)).replace('\\', '/'), requestSHA256=hashlib.sha256(request_file.read_bytes()).hexdigest(), responseSHA256=hashlib.sha256(response_file.read_bytes()).hexdigest() if response_file.exists() else ''))
(out / 'manifest.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
with (out / 'bundle-ids.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
lines = ['# NPHIES payment request/response evidence — 2026-09-14', '', 'Environment: sandbox. Current exchanges were captured on September 14; historical exchanges are retained records, not newly sent requests. JSON payloads are copied without rewriting. This package has not been sent to support.', '', 'Verification: IDs and response codes below are read directly from the saved payloads. Correlation compares response MessageHeader.response.identifier with request MessageHeader.id, not Bundle.id. SHA-256 hashes and exact paths are in manifest.json and bundle-ids.csv.', '', 'The public implementation guide was reviewed; authenticated portal transaction records were NOT accessed or independently compared. This is not a full FHIR validator certification. Rejected responses remain rejected. The new claim is independent of reconciliation 4; no reconciliation for that new claim has arrived. Bank confirmation in current notice tests was synthetic sandbox confirmation.', '', 'Sources: https://portal.nphies.sa/ig/usecase-payment-notification.html and https://portal.nphies.sa/ig/StructureDefinition-message-header.html', '', '| Exchange | Request Bundle ID | Response Bundle ID | Code | Correlated | Errors |', '|---|---|---|---|---|---|']
for r in rows:
    lines.append(f"| {r['exchange']} | `{r['requestBundleId']}` | `{r['responseBundleId']}` | {r['responseCode']} | {r['correlated']} | {r['errorCodes'] or r['errorCount']} |")
lines += ['', 'Original reconciliation messages for records 1–5 are included. For original payer submissions, no paired payer-to-NPHIES acknowledgement is available in this package; none has been invented. Historical reconciliation 4 has only its original message; its new notice exchanges are under current/.', '', 'A successful notice receives acknowledgement ok; complete is not a required notice response outcome. A zero-result poll does not prove a new payment cycle is complete.']
(out / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
with zipfile.ZipFile(base / (out.name + '.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(out.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(base))
print(json.dumps({'package': str(base / (out.name + '.zip')), 'exchanges': len(rows), 'correlated': sum(r['correlated'] for r in rows), 'results': [{k:r[k] for k in ('exchange','requestBundleId','responseBundleId','responseCode','errorCodes','originalReferenceMatches')} for r in rows]}, indent=2))
