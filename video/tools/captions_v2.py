"""Line captions from the actual local ASR words, never from the old synthetic narration."""
import json,re,textwrap
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'video/work/v2';OUT=ROOT/'video/out'
def main():
 source=json.loads((WORK/'voice-transcript.json').read_text());words=[];changes=[]
 for segment in source['transcription']:
  buf=None
  for token in segment['tokens']:
   raw=token['text']
   if raw.startswith('[_'):continue
   a=token['offsets']['from']/1000;b=token['offsets']['to']/1000
   if raw[:1].isspace()or buf is None:
    if buf:words.append(buf)
    buf={'text':raw.strip(),'start':a,'end':max(a+.01,b)}
   else:buf['text']+=raw;buf['end']=max(buf['end'],b)
  if buf:words.append(buf)
 for w in words:
  before=w['text'];after=before
  after=re.sub(r'\bClod\b','Claude',after)
  if 118<w['start']<125:after=re.sub(r'\bgreed\b','green',after)
  if 132<w['start']<138:after=re.sub(r'\bread\b','right',after)
  after=after.replace('secondlook.resell.app','secondlook.vercel.app')
  after=after.replace('G12','G 12').replace('1000','1,000')
  if after!=before:changes.append({'time':w['start'],'asr':before,'caption':after,'reason':'spelling/entity or homophone correction, checked against the second local ASR pass and context'})
  w['text']=after
 cues=[];group=[]
 def flush():
  if group:cues.append({'start':group[0]['start'],'end':group[-1]['end'],'text':' '.join(w['text']for w in group)});group.clear()
 for word in words:
  if group and (len(' '.join(w['text']for w in group))+len(word['text'])>85 or word['end']-group[0]['start']>4.6):flush()
  group.append(word)
  if word['text'].endswith(('.', '?','!')) and len(group)>=3:flush()
 flush()
 # Keep tiny trailing fragments with the preceding phrase where that remains readable.
 clean=[]
 for cue in cues:
  if clean and len(cue['text'].split())<3 and len(clean[-1]['text'])+len(cue['text'])<105 and cue['end']-clean[-1]['start']<6.2:
   clean[-1]['text']+=' '+cue['text'];clean[-1]['end']=cue['end']
  else:clean.append(cue)
 for i,cue in enumerate(clean):
  cue['end']=min(cue['end']+.08,clean[i+1]['start']-.01 if i+1<len(clean)else 157.4)
  assert cue['start']<cue['end']
 def ts(t,ass=False):
  n=round(t*(100 if ass else 1000));unit=100 if ass else 1000
  return f'{n//(3600*unit):01d}:{n//(60*unit)%60:02d}:{n//unit%60:02d}.{n%unit:02d}'if ass else f'{n//3600000:02d}:{n//60000%60:02d}:{n//1000%60:02d},{n%1000:03d}'
 srt=''.join(f'{i+1}\n{ts(c["start"])} --> {ts(c["end"])}\n{c["text"]}\n\n'for i,c in enumerate(clean))
 (OUT/'captions-v2.srt').write_text(srt)
 header='''[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,52,&H00FFFFFF,&H00FFFFFF,&H201D1D1F,&H201D1D1F,0,0,0,0,100,100,0,0,3,12,0,2,130,130,38,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'''
 lines=[]
 for c in clean:
  text=r'\N'.join(textwrap.wrap(c['text'],width=63,break_long_words=False))
  lines.append(f'Dialogue: 0,{ts(c["start"],True)},{ts(c["end"],True)},Default,,0,0,0,,{text}\n')
 (WORK/'captions.ass').write_text(header+''.join(lines))
 report={'method':'local whisper.cpp small.en full-token timestamps; cross-checked medium.en-q5_0 and three focused excerpts','corrections':changes,'audioMaster':'voiceover-vedhanth.m4a','audioTimeScale':1,'cues':clean,'transcript':' '.join(w['text']for w in words),'notes':['Full medium pass hallucinated and then you are done; the small pass and focused intro pass agree it is absent, so excluded.','Both main passes and focused research pass say When I gave an answer; retained I rather than imposing script it.','All passes omit get in the spoken closing URL; exact spoken address retained in captions, correct working URL and QR on end card.']}
 (WORK/'captions-reviewed.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'cues':len(clean),'corrections':changes,'transcript':report['transcript']},indent=2))
if __name__=='__main__':main()
