"""Free local rendering. Demonstration scenes, general capability names."""
import importlib.util, asyncio, subprocess
from pathlib import Path
import edge_tts
from PIL import ImageDraw
ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('base_video',ROOT.parent/'xacta-ai-20261013/create_video.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
v.ROOT=ROOT
v.SCENES=[
 ('Smarter claims review','XACTA | Claims intelligence','Bring claim information, validation checks, and assisted review into one workspace. Xacta helps your team find questions worth reviewing before submission.'),
 ('One claim. A clearer picture.','Connected workflow','Review diagnoses, procedures, supporting information, attachments, and payer responses. Save your changes, then launch the assistant from the claim.'),
 ('Check completeness first','Rules-based validation','Check episode information, admission and discharge dates, and applicable newborn and ventilation fields. Review attachment requirements and follow the findings back to the relevant fields.'),
 ('Turn error codes into actions','NPHIES error guidance','The assistant explains documented NPHIES errors and helps reviewers identify the next check. When an error has no documented explanation, it says so rather than inventing an answer.'),
 ('Clinical documentation review','Experimental | English notes','Local medical entity extraction highlights terms in saved English notes. The review compares them with diagnosis descriptions and shows the original source text for human assessment.'),
 ('Evidence before assumptions','Human review stays in control','A mention is not a diagnosis. Basic context checks flag phrases involving negation, uncertainty, and history. Text differences are review questions, never automatic coding instructions.'),
 ('Prepared for the next connection','Grouper integration readiness','Export saved episode inputs to prepare for an approved grouper integration. Automatic Saudi DRG assignment is not connected. The assistant does not replace a certified grouper.'),
 ('Clearer evidence. Better review.','Explore XACTA','Open a claim, save the information, and select the review mode. Use guided explanations or experimental local documentation review. Every final coding and submission decision remains with your team.')
]
CARDS=[
 [('Organize','Claim information'),('Validate','Completeness checks'),('Review','Assisted findings')],
 [('Clinical','Diagnoses and procedures'),('Documents','Attachments and notes'),('Responses','NPHIES messages')],
 [('Episode','Dates and discharge'),('Conditional fields','Newborn and ventilation'),('Attachments','Required documents')],
 [('Explain','Documented error guidance'),('Locate','Review the affected field'),('Verify','Unknown codes stay unknown')],
 [('Extract','English clinical terms'),('Compare','Diagnosis descriptions'),('Trace','Saved note and source')],
 [('Context','Negation and uncertainty'),('Questions','No automatic diagnoses'),('Control','No automatic claim changes')],
 [('MDS inputs','Saved episode data'),('JSON export','Platform integration format'),('Approved grouper','Connection required')],
 [('Save','Keep claim data current'),('Choose','Select a review mode'),('Review','Assess the evidence')]
]
def card(index):
 im=v.BG.copy();d=ImageDraw.Draw(im)
 v.box(d,(54,28,266,103),fill='#ffffff',outline='#ffffff',radius=14);im.paste(v.logo,(70,37),v.logo)
 v.text(d,'PRODUCT WALKTHROUGH | DEMO DATA',1210,54,18,v.MUTED)
 v.text(d,v.SCENES[index][1].upper(),70,149,23,v.CYAN,align='left')
 v.text(d,v.SCENES[index][0],70,194,43,v.WHITE,True,'left')
 d.line((70,264,345,264),fill=v.PURPLE,width=4)
 for j,(title,sub) in enumerate(CARDS[index]):
  x=70+j*390;v.box(d,(x,325,x+360,526),outline='#514365')
  v.text(d,f'0{j+1}',x+26,346,25,v.CYAN,True,'left')
  v.text(d,title,x+180,405,27,v.WHITE,True,'center')
  v.text(d,sub,x+180,469,19,v.MUTED,False,'center')
 foot='Advisory support | Human review required'
 if index==4:foot='Saved English text only | No attachment reading or code assignment'
 if index==5:foot='Basic context heuristics are incomplete | Not clinical validation'
 if index==6:foot='Automatic AR-DRG grouping is not connected'
 if index==7:foot='aimedical.xactasolutions.tech'
 v.text(d,foot,640,559,21,v.CYAN,False,'center')
 v.text(d,'XACTA SOLUTIONS',60,663,17,v.MUTED,False,'left')
 v.text(d,f'{index+1:02d} / 08',1220,663,19,v.MUTED)
 return im
v.card=card
async def voices():
 for i,(_,_,narration) in enumerate(v.SCENES):
  mp3=ROOT/f'voice-{i}.mp3'
  if not mp3.exists():await edge_tts.Communicate(narration,'en-US-GuyNeural',rate='+0%').save(str(mp3))
  subprocess.run([v.FF,'-y','-v','error','-i',str(mp3),'-ar','48000','-ac','1',str(ROOT/f'voice-{i}.wav')],check=True)
  print(f'English voice {i+1}/8 ready',flush=True)
if __name__=='__main__':
 asyncio.run(voices());v.render()
 (ROOT/'XACTA-AI-Platform-Arabic.mp4').replace(ROOT/'XACTA-AI-Platform-English.mp4')
 (ROOT/'subtitles-ar.srt').replace(ROOT/'subtitles-en.srt')
