"""Remove exactly the single synthetic verification patient left by a failed DELETE check."""
import re
import subprocess
def query(sql):
    return subprocess.check_output(['sudo','-u','postgres','psql','-p','5433','-X','-At','-v','ON_ERROR_STOP=1',
                                    '-d','nafes_healthcare','-c',sql],text=True).strip()
ids=query("SELECT patient_id FROM public.patients WHERE name='Synthetic Deployment Verification' AND identifier LIKE 'DEPLOY-%'").splitlines()
assert len(ids)==1 and re.fullmatch(r'[0-9a-f-]{36}',ids[0]), 'Expected exactly one uniquely identified synthetic record'
query(f"DELETE FROM public.patients WHERE patient_id='{ids[0]}' AND name='Synthetic Deployment Verification'")
print('Removed the single temporary deployment verification patient')
