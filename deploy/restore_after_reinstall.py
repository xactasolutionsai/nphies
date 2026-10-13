"""Restore the verified July archive on an empty PostgreSQL 18 host only."""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path('/opt/nafes/current')
DUMP = Path('/var/lib/nafes-import/final_DB')

def sql(statement):
    return subprocess.check_output(['sudo','-u','postgres','psql','-X','-At','-v','ON_ERROR_STOP=1','-d','nafes_healthcare'], input=statement, text=True)

assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public';").strip() == '0', 'Restore requires an empty database'
sql('CREATE EXTENSION vector; CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;')
subprocess.run(['chown','root:postgres',str(DUMP.parent),str(DUMP)],check=True)
DUMP.parent.chmod(0o750)
DUMP.chmod(0o640)
subprocess.run(['sudo','-u','postgres','pg_restore','--exit-on-error','--no-owner','--no-privileges','--no-comments','--role=nafes_app','--jobs=2','--dbname=nafes_healthcare',str(DUMP)],check=True)
process = subprocess.Popen(['pg_restore','--data-only','--no-owner','--no-privileges','--file=-',str(DUMP)], stdout=subprocess.PIPE,text=True)
counts, current = {}, None
for line in process.stdout:
    if current is not None:
        if line.rstrip('\r\n') == r'\.': current = None
        else: counts[current] += 1
    elif line.startswith('COPY '):
        match = re.match(r'^COPY ([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+) \(',line)
        assert match
        current=match.group(1)
        counts[current]=0
assert process.wait()==0
mismatches=[]
for table, expected in counts.items():
    actual=int(sql(f'SELECT count(*) FROM {table};').strip())
    if actual!=expected: mismatches.append({'table':table,'expected':expected,'actual':actual})
report={'source_tables_checked':len(counts),'source_rows':sum(counts.values()),'mismatches':mismatches}
Path('/var/backups/nafes/import-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
assert not mismatches
for name in ['062_user_roles.sql','063_selected_coverage.sql','064_openmed_advisory.sql','065_payment_notice_attempts.sql']:
    sql((ROOT/'backend/migrations'/name).read_text())
sql('GRANT nafes_openmed TO nafes_openmed_app; GRANT ALL ON ALL TABLES IN SCHEMA public TO nafes_app; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO nafes_app;')
print('Restore verified; migrations 062–065 applied. DRG activation is a separate backed-up step.')
