"""Video composed from genuine platform screenshots captured through the UI."""
import importlib.util,asyncio,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('english',ROOT.parent/'xacta-ai-english-20261013/create_video.py')
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
e.ROOT=ROOT;v=e.v;v.ROOT=ROOT
v.SCENES=[
 ('Your workspace at a glance','Healthcare dashboard','This is the Xacta platform, shown through actual screenshots from the demonstration environment. The dashboard brings operational activity and claim metrics into one view.'),
 ('Follow the claims workflow','Claim submissions','The claims workspace brings statuses, claim types, and financial summaries together. The figures and approval statuses shown belong to saved demonstration records, not a new approval test.'),
 ('Review the episode details','Claim information','Open a claim to review its type, dates, encounter details, and financial information. Clinical information, service items, responses, and review tools are organized into tabs.'),
 ('Prepare the DRG inputs','DRG and minimum data set','The DRG workspace holds episode information, classification metadata, and conditional fields. An approved grouper connection is still required for automatic Saudi DRG assignment.'),
 ('Choose the review you need','Claims review assistant','Inside the claim, choose guided claim review or experimental clinical documentation review. Save the information first so the assistant reviews the current saved record.'),
 ('Make missing information visible','Completeness findings','The review displays missing fields and consistency questions with field references. These findings support preparation and review; they do not guarantee acceptance or clinical coding accuracy.'),
 ('See the evidence behind a finding','Local clinical documentation review','Here is an actual local review result. The source note says, no systemic disease. The assistant flags the context for review rather than treating the extracted phrase as a confirmed diagnosis.'),
 ('Evidence supports your team','Human review remains essential','Review the source, resolve questions, and keep the final decision with your team. Xacta combines structured claim checks with advisory assistance, without automatically changing the claim.')
]
region=json.loads((ROOT/'audit-region.json').read_text())
SOURCES=[('dashboard.jpg',(0,80,875,800)),('claims.jpg',(0,80,875,800)),('details.jpg',(0,110,875,800)),('drg-full.jpg',(30,1170,850,1860)),('assistant.jpg',(30,260,850,670)),('audit-full.jpg',(35,660,850,1250)),('audit-full.jpg',(40,int(region['y'])-15,845,int(region['y'])+310)),('assistant.jpg',(30,260,850,670))]
NOTES=[['Operational overview','Saved demonstration data'],['Track claim status','Review service categories'],['Episode and dates','Clinical and financial context'],['Structured fields','Grouper connection pending'],['Select the review mode','Advisory assistance'],['Field-level questions','Human resolution required'],['English notes • experimental','Original evidence shown'],['Save • Review • Verify','aimedical.xactasolutions.tech']]
def card(index):
 im=v.BG.copy();d=ImageDraw.Draw(im)
 v.box(d,(40,20,252,95),fill='#ffffff',outline='#ffffff',radius=14);im.paste(v.logo,(56,29),v.logo)
 v.text(d,'ACTUAL PLATFORM SCREENSHOTS | DEMO DATA',1230,42,19,v.MUTED)
 v.box(d,(35,116,906,590),fill='#ffffff',outline='#61517c',radius=14)
 name,crop=SOURCES[index];shot=Image.open(ROOT/name).convert('RGB').crop(crop)
 shot=ImageOps.contain(shot,(845,450),Image.Resampling.LANCZOS)
 im.paste(shot,(470-shot.width//2,353-shot.height//2))
 v.text(d,f'0{index+1}',940,140,38,v.CYAN,True,'left')
 # Manually wrap English headings to preserve readable screenshot space.
 words=v.SCENES[index][0].split();lines=[];line=''
 for word in words:
  if len(line+' '+word)>19:lines.append(line);line=word
  else:line=(line+' '+word).strip()
 if line:lines.append(line)
 for j,line in enumerate(lines):v.text(d,line,940,212+j*42,30,v.WHITE,True,'left')
 for j,note in enumerate(NOTES[index]):
  # The website is shown in the footer at a readable size.
  if note.startswith('aimedical'):continue
  words=note.split();a='';ls=[]
  for word in words:
   if len(a+' '+word)>25:ls.append(a);a=word
   else:a=(a+' '+word).strip()
  if a:ls.append(a)
  for k,s in enumerate(ls):v.text(d,s,940,385+j*80+k*25,18,v.CYAN if j==0 else v.MUTED,False,'left')
 v.text(d,'aimedical.xactasolutions.tech',60,665,18,v.MUTED,False,'left')
 v.text(d,f'{index+1:02d} / 08',1220,665,19,v.MUTED)
 return im
v.card=card
if __name__=='__main__':
 asyncio.run(e.voices());v.render()
 (ROOT/'XACTA-AI-Platform-Arabic.mp4').replace(ROOT/'XACTA-Platform-Screenshots-English.mp4')
 (ROOT/'subtitles-ar.srt').replace(ROOT/'subtitles-en.srt')
