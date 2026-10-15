import asyncio, json, math, subprocess, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import edge_tts, imageio_ffmpeg

ROOT=Path(__file__).parent
FF=imageio_ffmpeg.get_ffmpeg_exe()
W,H,FPS=1280,720,24
WHITE='#f6f5ff'; MUTED='#b8b4d6'; CYAN='#56e0d4'; PURPLE='#a477ff'
FONT='C:/Windows/Fonts/arial.ttf'; BOLD='C:/Windows/Fonts/arialbd.ttf'
SCENES=[
 ('مراجعة أذكى للمطالبات','من البيانات إلى قرار أوضح',
  'منصة إكساكتا تجمع بيانات المطالبة، وفحوص الاكتمال، ومساعد الذكاء الاصطناعي، في تجربة واحدة تساعد الفريق على المراجعة واتخاذ القرار.'),
 ('كل عناصر المطالبة، في مكان واحد','مسار واضح للفريق',
  'راجع بيانات المطالبة، والتشخيصات، والإجراءات، والمرفقات. ثم تابع ردود نفيس من داخل المنصة، مع الحفاظ على دور المختص في مراجعة المعلومات.'),
 ('تحقق قبل الإرسال','DRG / MDS',
  'في تبويب دي آر جي، تتحقق المنصة من اكتمال بيانات الحلقة واتساقها، بما يشمل الدخول والخروج، وبيانات حديثي الولادة، والتهوية عند انطباقها، والمرفقات المطلوبة.'),
 ('مساعد يفهم سياق المراجعة','الذكاء الاصطناعي داخل المطالبة',
  'مساعد المطالبات يراجع البيانات المحفوظة ويقدم اقتراحات بالعربية عبر واجهة ذكاء اصطناعي. يعرض اقتراحاته منفصلة عن فحوص القواعد، ولا يعدل المطالبة تلقائيا.'),
 ('من رمز الخطأ إلى خطوة واضحة','شرح أخطاء نفيس',
  'بدلا من الاكتفاء برمز خطأ، يساعد المراجع على فهم المشكلة. مثل خطأ آي بي، صفر صفر صفر ثلاثين: مراجعة الرمز ونظام الترميز المطلوب. وعندما لا يوجد تفسير موثق، يوضح ذلك.'),
 ('ذكاء اصطناعي بدور محدد','API + OpenMed',
  'الربط الحالي يستخدم نموذج كيو وين عبر واجهة برمجية. ويتوفر أوبن ميد محليا لاستخراج مصطلحات إنجليزية عند عدم تهيئة الواجهة الخارجية. النتائج استشارية، وليست إثباتا للتشخيص أو موافقة تأمينية.'),
 ('الخطوة التالية: Grouper معتمد','تجهيز بيانات الحلقة للربط',
  'يمكن تنزيل بيانات إم دي إس المحفوظة تمهيدا للربط مع جروبر معتمد. التصنيف التلقائي لم يفعل بعد، ويحتاج خدمة معتمدة ووثائق تكامل. مساعد الذكاء الاصطناعي لا يحل محل الجروبر.'),
 ('بيانات أوضح. مراجعة أفضل.','ابدأ من مساعد المطالبات',
  'افتح المطالبة، واحفظ بياناتك، ثم اختر مساعد المطالبات وابدأ المراجعة. إكساكتا: أدوات تساعد فريقك، وقرار يبقى بيد المختص.')
]

def shaped(s):return get_display(arabic_reshaper.reshape(s))
def text(d,s,x,y,size=30,color=WHITE,bold=False,align='right'):
 f=ImageFont.truetype(BOLD if bold else FONT,size); s=shaped(s)
 width=d.textlength(s,font=f)
 if align=='right':x-=width
 if align=='center':x-=width/2
 d.text((x,y),s,font=f,fill=color)
def box(d,xy,fill='#211d3b',outline='#3c335a',radius=18):d.rounded_rectangle(xy,radius,fill=fill,outline=outline,width=1)
def pill(d,s,x,y,width=210,color=CYAN):
 box(d,(x,y,x+width,y+38),fill='#183c42',outline='#27575c',radius=19);text(d,s,x+width/2,y+8,20,color,align='center')

yy,xx=np.mgrid[0:H,0:W]
glow=np.exp(-((xx-210)**2+(yy-210)**2)/150000)
bg=np.stack([15+20*glow+yy*0.004,15+9*glow,30+39*glow],axis=2).clip(0,255).astype('uint8')
BG=Image.fromarray(bg)
logo=Image.open(ROOT/'login-logo.png').convert('RGBA');logo.thumbnail((180,56))

def card(index):
 im=BG.copy();d=ImageDraw.Draw(im)
 for x in range(36,W,58):
  for y in range(130,640,58):d.ellipse((x,y,x+1,y+1),fill='#363049')
 box(d,(54,28,266,103),fill='#ffffff',outline='#ffffff',radius=14)
 im.paste(logo,(70,37),logo)
 text(d,'عرض توضيحي • بيانات تجريبية',1220,53,20,MUTED)
 text(d,SCENES[index][1],1215,142,23,CYAN)
 text(d,SCENES[index][0],1215,190,46,WHITE,True)
 d.line((970,258,1214,258),fill=PURPLE,width=4)
 if index==0:
  for j,(num,label,sub) in enumerate([('01','بيانات المطالبة','تنظيم وتوثيق'),('02','فحوص الاتساق','قبل الإرسال'),('03','مساعد المراجعة','شرح واقتراحات')]):
   x=850-j*395;box(d,(x,320,x+350,548));text(d,num,x+30,347,32,PURPLE,True,'left');text(d,label,x+320,407,31,WHITE,True);text(d,sub,x+320,468,23,MUTED)
 elif index==1:
  for j,(a,b) in enumerate([('بيانات المطالبة','الحالة والخدمات'),('البيانات السريرية','التشخيصات والإجراءات'),('مرفقات الحالة','PDF / JPEG'),('ردود نفيس','متابعة الحالة والأخطاء')]):
   x=928-j*291;box(d,(x,335,x+265,535));text(d,f'0{j+1}',x+230,357,27,CYAN,True);text(d,a,x+132,418,24,WHITE,True,'center');text(d,b,x+132,475,20,MUTED,False,'center')
 elif index==2:
  box(d,(70,295,1210,579));pill(d,'فحوص اكتمال واتساق',95,314,240)
  labels=['الدخول والخروج','التشخيص الرئيسي','وزن الولادة عند انطباقه','ساعات التهوية','حالة الخروج','المرفقات المطلوبة']
  for j,label in enumerate(labels):
   col=j%3;row=j//3;x=855-col*375;y=382+row*90
   box(d,(x,y,x+326,y+64),fill='#30284d');d.ellipse((x+16,y+20,x+38,y+42),fill=CYAN);text(d,label,x+309,y+19,22)
 elif index==3:
  box(d,(70,305,560,565));text(d,'فحوص القواعد',526,330,29,WHITE,True)
  for j,s in enumerate(['اكتمال البيانات','اتساق بيانات الحلقة','تفسير الأخطاء الموثقة']):text(d,s,520,395+j*48,25,CYAN)
  box(d,(596,305,1210,565),fill='#32204c',outline='#925bdd');pill(d,'اقتراحات تحتاج مراجعة',622,323,260)
  text(d,'راجع توثيق الحالة',1170,393,31,WHITE,True);text(d,'أسئلة تساعد المختص على استكمال المعلومات',1170,453,23,MUTED)
  text(d,'لا يحفظ تعديلات أو يرسل المطالبة تلقائيًا',1170,508,22,CYAN)
 elif index==4:
  box(d,(72,320,430,568),fill='#382044',outline='#8d4b7b');text(d,'IB-00030',250,370,49,'#ffb7d9',True,'center');text(d,'مثال لخطأ نفيس',250,461,24,MUTED,False,'center')
  box(d,(463,320,1210,568));text(d,'راجع الرمز ونظام الترميز المطلوب',1170,352,32,WHITE,True)
  text(d,'في بند DRG: استخدم النظام المحدد في المواصفة',1170,410,25,MUTED)
  text(d,'http://nphies.sa/terminology/CodeSystem/drg',835,465,23,CYAN,False,'center')
  text(d,'الرمز غير الموثق يُعرض بوضوح دون تخمين',1170,518,22,MUTED)
 elif index==5:
  for x,title,sub,tag in [(660,'Qwen3-8B','مراجعة واقتراحات بالعربية','الربط الحالي عبر API'),(70,'OpenMed','استخراج مصطلحات إنجليزية','محلي عند عدم تهيئة API')]:
   box(d,(x,310,x+550,568));text(d,title,x+275,345,40,WHITE,True,'center');text(d,sub,x+275,415,26,MUTED,False,'center');pill(d,tag,x+100,486,350)
 elif index==6:
  for j,(a,b) in enumerate([('MDS','بيانات الحلقة المحفوظة'),('JSON','تصدير بصيغة المنصة'),('Grouper','بانتظار الربط المعتمد')]):
   x=858-j*394;box(d,(x,333,x+350,533),outline='#4c4665' if j<2 else '#b48c50');text(d,a,x+175,362,40,CYAN if j<2 else '#f3c77f',True,'center');text(d,b,x+175,446,25,WHITE,False,'center')
  text(d,'التصنيف التلقائي غير مفعّل حاليًا',640,560,24,'#f3c77f',True,'center')
 else:
  box(d,(190,316,1090,511),fill='#30224e',outline='#9b72dd')
  text(d,'المطالبة  ←  مساعد المطالبات  ←  مراجعة',640,359,37,WHITE,True,'center')
  text(d,'aimedical.xactasolutions.tech',640,438,31,CYAN,False,'center')
  text(d,'المراجعة استشارية • قبول المطالبة تحدده الجهات المختصة',640,558,23,MUTED,False,'center')
 text(d,'XACTA SOLUTIONS',60,663,17,MUTED,False,'left')
 text(d,f'{index+1:02d} / {len(SCENES):02d}',1220,663,19,MUTED)
 return im

async def voices():
 for i,(_,_,narration) in enumerate(SCENES):
  mp3=ROOT/f'voice-{i}.mp3'
  if not mp3.exists():await edge_tts.Communicate(narration,'ar-SA-HamedNeural',rate='+3%').save(str(mp3))
  subprocess.run([FF,'-y','-v','error','-i',str(mp3),'-ar','48000','-ac','1',str(ROOT/f'voice-{i}.wav')],check=True)
  print(f'Voice {i+1}/8 ready',flush=True)

def timestamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def render():
 audio=[];durations=[];srt=[];time=0;captions=[]
 for i,(_,_,narration) in enumerate(SCENES):
  with wave.open(str(ROOT/f'voice-{i}.wav'),'rb') as w:a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
  dur=math.ceil((len(a)/48000+1.4)*FPS)/FPS;durations.append(dur)
  padded=np.zeros(round(dur*48000),np.float32);padded[24000:24000+len(a)]=a;audio.append(padded)
  # Short subtitle chunks for reusable, readable subtitle tracks.
  words=narration.split();chunks=[' '.join(words[j:j+9]) for j in range(0,len(words),9)]
  captions.append((chunks,len(a)/48000))
  for j,s in enumerate(chunks):
   start=time+.5+j*(len(a)/48000)/len(chunks);end=time+.5+(j+1)*(len(a)/48000)/len(chunks)
   srt.append(f'{len(srt)+1}\n{timestamp(start)} --> {timestamp(end)}\n{s}\n')
  time+=dur
 track=np.concatenate(audio);t=np.arange(len(track))/48000
 music=np.zeros_like(track)
 for i,notes in enumerate([(164.81,246.94,329.63),(130.81,196,261.63),(146.83,220,293.66),(123.47,185,246.94)]):
  phase=np.mod(t,32);env=np.maximum(0,1-np.abs(phase-(i*8+4))/5)
  for freq in notes:music+=.004*env*np.sin(2*np.pi*freq*t)
 mix=np.clip(track*.92+music,-.98,.98)
 with wave.open(str(ROOT/'narration-mix.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes((mix*32767).astype(np.int16).tobytes())
 (ROOT/'subtitles-ar.srt').write_text('\n'.join(srt),encoding='utf-8')
 (ROOT/'storyboard.json').write_text(json.dumps([{'title':a,'subtitle':b,'narration':c,'duration':durations[i]} for i,(a,b,c) in enumerate(SCENES)],ensure_ascii=False,indent=2),encoding='utf-8')
 cards=[card(i) for i in range(len(SCENES))]
 for i,im in enumerate(cards):im.save(ROOT/f'scene-{i+1}.png')
 sheet=Image.new('RGB',(1280,720))
 for i,im in enumerate(cards):sheet.paste(im.resize((320,360//1)),((i%4)*320,(i//4)*360))
 # Use undistorted thumbnail tiles with letterboxing.
 sheet=Image.new('RGB',(1280,400),'#101020')
 for i,im in enumerate(cards):sheet.paste(im.resize((320,180)),((i%4)*320,(i//4)*200))
 sheet.save(ROOT/'contact-sheet.jpg')
 output=ROOT/'XACTA-AI-Platform-Arabic.mp4'
 cmd=[FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(ROOT/'narration-mix.wav'),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(output)]
 with open(ROOT/'render.log','w') as log:
  proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
  elapsed=0
  for i,(im,dur) in enumerate(zip(cards,durations)):
   for n in range(round(dur*FPS)):
    sec=n/FPS;frame=im.copy()
    if sec<1.15:
     phase=max(0,min(1,(sec-.3)/.85));ease=1-(1-phase)**3
     frame.paste(BG.crop((0,285,W,632)),(0,285))
     region=im.crop((0,285,W,608))
     region=Image.blend(BG.crop((0,285,W,608)),region,ease)
     frame.paste(region,(0,285+round(24*(1-ease))))
    d=ImageDraw.Draw(frame)
    chunks,voice_duration=captions[i]
    if .5<=sec<voice_duration+.5:
     caption=chunks[min(len(chunks)-1,int((sec-.5)/voice_duration*len(chunks)))];font=ImageFont.truetype(FONT,22)
     while d.textlength(shaped(caption),font=font)>1140:
      font=ImageFont.truetype(FONT,font.size-1)
     box(d,(53,605,1227,650),fill='#0b0b1a',outline='#272237',radius=10)
     text(d,caption,640,615,font.size,WHITE,False,'center')
    # A subtle luminous pulse, scene progress and soft dip transitions.
    px=60+int((W-120)*sec/dur);d.rounded_rectangle((60,H-14,px+1,H-10),2,fill=CYAN)
    alpha=min(1,sec/.35,(dur-sec)/.35)
    if alpha<1:frame=Image.blend(BG,frame,max(0,alpha))
    proc.stdin.write(frame.tobytes())
   elapsed+=dur;print(f'Rendered scene {i+1}/8 ({elapsed:.1f}s)',flush=True)
  proc.stdin.close();ret=proc.wait()
 if ret:raise RuntimeError((ROOT/'render.log').read_text())
 print(json.dumps({'output':str(output),'duration_seconds':sum(durations),'resolution':'1920x1080','fps':FPS,'bytes':output.stat().st_size}),flush=True)

if __name__=='__main__':
 asyncio.run(voices());render()
