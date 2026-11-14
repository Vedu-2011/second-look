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
 # Reviewed phrase boundaries preserve every ASR word while avoiding cut-off clauses.
 phrases = """When your refill comes, do you check every pill?
Most people don't.
They pour them out and trust the bottle.
But US pharmacies make an estimated 51.5 million dispensing errors a year.
And when a refill just looks different, people stop taking it
34% higher odds after a color change
and 66% after a shape change.
This is Second Look.
Snap your label, pour out your pills, take one photo.
In about 10 seconds, it checks every pill against the official FDA record
for the medicine on your label.
Here is a metformin refill. 10 pills.
One of them is amoxicillin, an antibiotic that looks almost the same.
White, oval, about the same size.
Would you notice?
Second Look reads the letters on every pill
and checks them against every FDA-listed version of metformin 1,000 mg.
The others say G 12.
This one says 93, and no metformin has that.
So it's red.
Don't take any pills from this bottle. Call your pharmacy.
Want to know what it is?
Flip just that pill and snap again.
It only reads that one pill again.
93 on one side, 2263 on the other.
That's amoxicillin, 500 mg.
Not every different looking pill is a mistake.
This label says Advil, but the pill is a store brand.
Second Look shows it's the same medicine from a different company,
so you don't stop taking it for no reason.
The rule I built it on. AI reads, code decides.
Claude only reads what's printed on each pill, and its color and shape.
Plain code compares that with real FDA and national library of medicine records
and makes the call.
If the AI isn't sure, it reads again,
and if it still can't tell, the app says so instead of guessing.
It only shows green when it has read every pill,
and it never saves your photos.
I tested the first version of the pill reader
on 150 NIH pill photos it had never seen.
When I gave an answer, it was right 83 out of 88 times.
Testing also caught a real safety bug.
I fixed it and published the before and after,
and I'm honest about limits.
Shiny, see-through soft gels are hard to read.
Second Look, a 10 second second look.
Before you take it, try it at secondlook.vercel.app.""".splitlines()
 expanded=[]
 for word in words:
  for part in word['text'].split():expanded.append({**word,'text':part})
 assert ' '.join(phrases).split()==[w['text'] for w in expanded], 'Reviewed phrase text must exactly preserve the corrected ASR transcript'
 clean=[];cursor=0
 for phrase in phrases:
  count=len(phrase.split());matched=expanded[cursor:cursor+count];cursor+=count
  clean.append({'start':matched[0]['start'],'end':matched[-1]['end'],'text':phrase})
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
