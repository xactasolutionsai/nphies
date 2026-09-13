"""Build a data-free installer from the repository's original schema and migrations.
This is ONLY for an empty database, never for upgrading a populated deployment.
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deploy' / 'fresh-schema'
OUT.mkdir(exist_ok=True)
dump = (ROOT / 'nafes_backup.sql').read_text(encoding='utf-8-sig')
lines, copying = [], False
for line in dump.splitlines():
    if line.startswith('COPY '):
        copying = True
        continue
    if copying:
        if line == r'\.':
            copying = False
        continue
    if line.startswith('\\') or 'OWNER TO ' in line or line.startswith('SET transaction_timeout'):
        continue
    lines.append(line)
base = '\n'.join(lines) + '\nSET search_path TO public;\n'
assert 'COPY ' not in base and 'INSERT INTO' not in base
(OUT / '000_base.sql').write_text(base, encoding='utf-8')
files = ['000_base.sql']
ordered = [
    'database_migration_add_missing_columns.sql',
    'backend/migrations/add_nphies_integration_uuid.sql',
    'backend/migrations/add_nphies_required_columns.sql',
    'backend/migrations/add_eligibility_extensions.sql',
    'backend/migrations/add_missing_nphies_columns.sql',
    'backend/migration_standard_approvals.sql',
    'backend/migration_dental_approvals.sql',
    'backend/migration_eye_approvals.sql',
    'backend/migrations/create_general_requests_table.sql',
    'backend/migrations/create_prior_authorization_tables.sql',
    'backend/migrations/create_claim_submissions_tables.sql',
    'backend/migrations/create_advanced_authorizations.sql',
    'backend/migrations/create_nphies_code_tables.sql',
    'backend/migrations/create_icd10_codes_table.sql',
    'backend/migrations/create_medication_codes_table.sql',
    'backend/migrations/create_medicines_tables.sql',
    'backend/migrations/add_pgvector_extension.sql',
    'backend/migrations/add_policy_holders.sql',
    'backend/migrations/add_admit_source_column.sql',
    'backend/migrations/add_chief_complaint_code_system.sql',
    'backend/migrations/add_drug_interaction_justification_column.sql',
    'backend/migrations/add_manual_entry_fields.sql',
    'backend/migrations/add_medication_safety_analysis_column.sql',
    'backend/migrations/add_newborn_extension_fields.sql',
    'backend/migrations/add_nphies_response_fields.sql',
    'backend/migrations/add_practice_code_column.sql',
    'backend/migrations/add_vision_prescription_column.sql',
    'backend/migrations/fix_column_lengths.sql',
]
ordered += [str(path.relative_to(ROOT)).replace('\\','/') for path in sorted((ROOT/'backend/migrations').glob('[0-9]*.sql'))
            if not path.name.startswith(('031_', '049_'))]
for index, filename in enumerate(ordered, 1):
    content = (ROOT / filename).read_text(encoding='utf-8-sig')
    if filename.endswith('add_nphies_integration_uuid.sql'):
        content = content.split('-- 6. Insert sample test data')[0]
    if filename.endswith('add_policy_holders.sql'):
        content = re.sub(r'-- 3\. Insert example.*?(?=-- 4\.)', '', content, flags=re.S)
    target = f'{index:03d}_{Path(filename).name}'
    (OUT / target).write_text(content, encoding='utf-8')
    files.append(target)
(OUT/'manifest.json').write_text(json.dumps(files, indent=2), encoding='utf-8')
print(f'Prepared {len(files)} schema steps; no patient data copied from backup')
