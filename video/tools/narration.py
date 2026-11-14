"""Verbatim script captions + local macOS voice. Outputs stay git-ignored."""
import concurrent.futures, hashlib, json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'video/work'; OUT=ROOT/'video/out'
def probe(path):
 return float(subprocess.check_output(['/opt/homebrew/opt/ffmpeg-full/bin/ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)],text=True))
def chunks(text):
 result=[]
 for sentence in re.findall(r'[^.!?]+[.!?]+|[^.!?]+$',text):
  words=sentence.strip().split()
  while words:
   n=min(11,len(words))
   if len(words)>n:
    ends=[i+1 for i,w in enumerate(words[:n]) if i>=5 and w.endswith((',',':',';'))]
    if ends:n=ends[-1]
   result.append(' '.join(words[:n]));words=words[n:]
 return result

def main():
 WORK.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
 source=WORK/'script-source.md'
 rows=[s.split('|')[1:-1] for s in source.read_text().splitlines() if s.startswith('| ') and re.match(r'\d',s.split('|')[1].strip())]
 sections=[];jobs=[]
 for i,r in enumerate(rows):
  text=r[2].strip();parts=chunks(text)
  assert ' '.join(parts).split()==text.split()
  section={'id':i,'scriptTime':r[0].strip(),'voiceover':text,'captions':[]}
  for part in parts:
   idx=len(jobs);audio=WORK/f'voice-{idx:03d}.aiff';txt=WORK/f'voice-{idx:03d}.txt';txt.write_text(part)
   item={'id':idx,'text':part,'audio':str(audio)};section['captions'].append(item);jobs.append(item)
  sections.append(section)
 def speak(item):
  audio=Path(item['audio']);sig=hashlib.sha256(('Samantha|168|'+item['text']).encode()).hexdigest();stamp=audio.with_suffix('.sha256')
  if not audio.exists() or not stamp.exists() or stamp.read_text()!=sig:
   subprocess.run(['say','-v','Samantha','-r','168','-f',str(audio.with_suffix('.txt')),'-o',str(audio)],check=True)
   stamp.write_text(sig)
  item['seconds']=probe(audio)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(speak,jobs))
 cursor=0
 for section in sections:
  section['start']=cursor
  for item in section['captions']:
   item['start']=cursor;cursor+=item['seconds'];item['end']=cursor
  section['end']=cursor;section['duration']=cursor-section['start']
 manifest={'voice':'Samantha','rate':168,'scriptSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':cursor,'wordCount':sum(len(s['voiceover'].split()) for s in sections),'sections':sections}
 (WORK/'narration.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({'duration':cursor,'captions':len(jobs),'sections':[(s['id'],round(s['duration'],2)) for s in sections]}))
if __name__=='__main__':main()
