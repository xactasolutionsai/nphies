"""Run shipped regression tests on a throwaway database, never on imported clinical data."""
import os
import secrets
import subprocess

suffix=secrets.token_hex(8)
database=f'deploy_{suffix}_regression'
user=f'deploy_test_{suffix}'
password=secrets.token_hex(24)
def sql(command):
    subprocess.run(['sudo','-u','postgres','psql','-p','5433','-X','-v','ON_ERROR_STOP=1'],input=command,text=True,check=True)
sql(f"CREATE ROLE {user} LOGIN SUPERUSER PASSWORD '{password}';")
subprocess.run(['sudo','-u','postgres','createdb','-p','5433',database],check=True)
try:
    env=dict(os.environ)
    url=f'postgresql://{user}:{password}@127.0.0.1:5433/{database}'
    env.update(TEST_DATABASE_URL=url,TEST_OPENMED_DATABASE_URL=url,TEST_OPENMED_REAL_MODELS='true',
               DB_HOST='127.0.0.1',DB_PORT='5433',DB_NAME=database,DB_USER=user,DB_PASSWORD=password)
    result=subprocess.run(['npm','test'],cwd='/opt/nafes/current/backend',env=env)
finally:
    subprocess.run(['sudo','-u','postgres','dropdb','-p','5433',database],check=True)
    sql(f'DROP ROLE {user};')
raise SystemExit(result.returncode)
