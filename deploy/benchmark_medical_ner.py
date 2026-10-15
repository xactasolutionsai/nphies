"""Small synthetic smoke benchmark; not clinical validation. No patient data."""
import json, time, gc
from pathlib import Path
import torch
from huggingface_hub import snapshot_download
from transformers import pipeline
torch.set_num_threads(2)
cases = [
 ('Discharge diagnosis: pneumonia. Treated with amoxicillin.', ['pneumonia']),
 ('Primary diagnosis: acute myocardial infarction. Secondary: type 2 diabetes mellitus.', ['acute myocardial infarction', 'type 2 diabetes mellitus']),
 ('No evidence of pneumonia. Family history of diabetes.', ['pneumonia', 'diabetes']),
 ('Differential diagnosis: pulmonary embolism versus pneumonia.', ['pulmonary embolism', 'pneumonia']),
 ('Patient feels well. No active medical complaints.', []),
]
candidate = snapshot_download('genzeonplatform/healthcare-brain-diagnosis-icd-ner', revision='c204b8af18f79253a8b93ee90402595449b1593f', local_dir='/var/tmp/nafes-ner-candidate', allow_patterns=['*.json','*.txt','*.safetensors','README.md'])
report = []
for name, path in [('candidate', candidate), ('current', '/opt/nafes/current/backend/openmed/openmed-models/diseases')]:
 start=time.monotonic()
 nlp=pipeline('token-classification',model=path,tokenizer=path,aggregation_strategy='simple',device=-1,trust_remote_code=False)
 rows=[]
 for text, expected in cases:
  entities=[{'text':text[int(e['start']):int(e['end'])], 'label':e['entity_group'], 'score':round(float(e['score']),3)} for e in nlp(text)]
  hits=sum(any(term.lower() in e['text'].lower() for e in entities) for term in expected)
  rows.append({'text':text,'expected_mentions':expected,'exact_mention_hits':hits,'entities':entities})
 report.append({'model':name,'elapsed_seconds':round(time.monotonic()-start,2),'cases':rows})
 del nlp;gc.collect()
Path('/var/tmp/nafes-ner-benchmark.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
