"""Run on the new host as root, after creating the empty application database."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parent / 'fresh-schema'
DB = 'nafes_healthcare'
def psql(sql):
    return subprocess.check_output(['sudo','-u','postgres','psql','-X','-At','-v','ON_ERROR_STOP=1','-d',DB,'-c',sql], text=True).strip()

if psql("SELECT to_regclass('public.deployment_schema_migrations') IS NULL") == 't':
    if psql("SELECT count(*) FROM pg_tables WHERE schemaname='public'") != '0':
        raise SystemExit('Refusing bootstrap of a nonempty database')
    psql('CREATE TABLE public.deployment_schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())')
completed = set(psql('SELECT name FROM public.deployment_schema_migrations').splitlines())
for name in json.loads((ROOT/'manifest.json').read_text()):
    if name in completed:
        continue
    print(f'Applying {name}', flush=True)
    subprocess.run(['sudo','-u','postgres','psql','-X','-v','ON_ERROR_STOP=1','-d',DB,'-f',str(ROOT/name)], check=True)
    assert "'" not in name
    psql(f"INSERT INTO public.deployment_schema_migrations(name) VALUES ('{name}')")
print('Fresh schema installation complete')
