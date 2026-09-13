"""Compare COPY row counts in the source archive with restored tables. No row contents printed."""
import json
import re
import subprocess
from pathlib import Path

process = subprocess.Popen(['/usr/lib/postgresql/18/bin/pg_restore','--data-only','--no-owner','--no-privileges',
                            '--file=-','/var/lib/nafes-import/final_DB'],stdout=subprocess.PIPE,text=True)
counts, current = {}, None
for line in process.stdout:
    if current is not None:
        if line.rstrip('\r\n') == r'\.': current = None
        else: counts[current] += 1
    elif line.startswith('COPY '):
        match = re.match(r'^COPY ([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+) \(',line)
        if not match: raise RuntimeError('Unexpected COPY table identifier')
        current=match.group(1); counts[current]=0
assert process.wait()==0
mismatches=[]
for table, expected in counts.items():
    actual=int(subprocess.check_output(['sudo','-u','postgres','psql','-p','5433','-X','-At','-d','nafes_healthcare',
                                       '-c',f'SELECT count(*) FROM {table}'],text=True).strip())
    # One deployment administrator was deliberately added; imported accounts are untouched.
    adjusted=expected+(1 if table=='public.users' else 0)
    if actual!=adjusted: mismatches.append({'table':table,'expected':adjusted,'actual':actual})
report={'source_tables_checked':len(counts),'source_rows':sum(counts.values()),'mismatches':mismatches}
Path('/var/backups/nafes/import-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if mismatches: raise SystemExit(1)
