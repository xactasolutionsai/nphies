"""Import the explicitly supplied final_DB archive into a separate PostgreSQL 18 cluster.
Never overwrites the initial PostgreSQL 16 database or source archive.
"""
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlsplit

CONFIG = Path('/etc/nafes/app.env')
values = dict(line.split('=',1) for line in CONFIG.read_text().splitlines() if '=' in line)
password = values['DB_PASSWORD']
advisor_password = urlsplit(values['OPENMED_DATABASE_URL']).password
assert all(c in '0123456789abcdef' for c in password+advisor_password)
def sql(command, database='postgres'):
    subprocess.run(['sudo','-u','postgres','psql','-p','5433','-X','-v','ON_ERROR_STOP=1','-d',database],
                   input=command,text=True,check=True)

sql(f"CREATE ROLE nafes_app LOGIN PASSWORD '{password}'; CREATE ROLE nafes_openmed_app LOGIN PASSWORD '{advisor_password}';")
subprocess.run(['sudo','-u','postgres','createdb','-p','5433','--owner=nafes_app','nafes_healthcare'],check=True)
sql('CREATE EXTENSION vector; CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;', 'nafes_healthcare')
subprocess.run(['chown','root:postgres','/var/lib/nafes-import'],check=True)
subprocess.run(['chmod','750','/var/lib/nafes-import'],check=True)
subprocess.run(['chown','root:postgres','/var/lib/nafes-import/final_DB'],check=True)
subprocess.run(['chmod','640','/var/lib/nafes-import/final_DB'],check=True)
subprocess.run(['sudo','-u','postgres','/usr/lib/postgresql/18/bin/pg_restore','-p','5433',
                '--exit-on-error','--no-owner','--no-privileges','--no-comments','--role=nafes_app',
                '--jobs=2','--dbname=nafes_healthcare','/var/lib/nafes-import/final_DB'],check=True)
for name in ('062_user_roles.sql','063_selected_coverage.sql','064_openmed_advisory.sql'):
    sql((Path('/opt/nafes/current/backend/migrations')/name).read_text(), 'nafes_healthcare')
sql('GRANT nafes_openmed TO nafes_openmed_app;', 'nafes_healthcare')
shutil.copy2(CONFIG, '/etc/nafes/before-import.env')
values['DB_PORT']='5433'
values['OPENMED_DATABASE_URL']=values['OPENMED_DATABASE_URL'].replace(':5432/',':5433/')
CONFIG.write_text(''.join(f'{key}={value}\n' for key,value in values.items()))
print('Imported user database on PostgreSQL 18; configuration switched to port 5433')
