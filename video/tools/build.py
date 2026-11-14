"""Deterministic 1080p demo edit. Raw footage/output never enter git. No network or AI calls."""
import argparse,concurrent.futures,hashlib,json,math,shutil,subprocess,textwrap
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'video/work';OUT=ROOT/'video/out';RAW=ROOT/'video/raw'
FF='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';PROBE='/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
def run(args):
 subprocess.run(args,check=True,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(p):return float(subprocess.check_output([PROBE,'-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)],text=True))
def concat(paths,target,audio=False):
 listing=WORK/(target.stem+'-inputs.txt');listing.write_text(''.join("file '"+str(p).replace("'","'\\''")+"'\n" for p in paths))
 run([FF,'-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-map_metadata','-1',*(['-c:a','pcm_s16be']if audio else ['-c','copy']),str(target)])
def stamp(t):
 cs=round(t*100);return f'{cs//360000}:{cs//6000%60:02d}:{cs//100%60:02d}.{cs%100:02d}'
def main():
 args=argparse.ArgumentParser();args.add_argument('--bottle');args.add_argument('--publish',action='store_true');opt=args.parse_args()
 cfg=json.loads((ROOT/'video/edit.json').read_text());n=json.loads((WORK/'narration.json').read_text())
 bottle=opt.bottle or (cfg['replacement_file']if cfg['auto_use_replacement']and(RAW/cfg['replacement_file']).exists()else cfg['bottle_file'])
 placeholder='messedup'in bottle;tempo=cfg['voice_tempo'];fps=cfg['fps']
 sections=[];cursor=0;captions=[];audio=[]
 for s in n['sections']:
  total=math.ceil(max(cfg['minimum_section_seconds'][s['id']],s['duration']/tempo+1)*fps)/fps
  section={**s,'start':cursor,'duration':total,'end':cursor+total};sections.append(section)
  for c in s['captions']:
   a=cursor+.4+(c['start']-s['start'])/tempo;b=cursor+.4+(c['end']-s['start'])/tempo
   captions.append({'start':a,'end':b,'text':c['text']})
  listing=WORK/f'audio-section-{s["id"]}.txt';listing.write_text(''.join("file '"+c['audio']+"'\n" for c in s['captions']))
  target=WORK/f'audio-section-{s["id"]}.wav'
  run([FF,'-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-af',f'asetpts=N/SR/TB,atempo={tempo},aresample=48000,adelay=400:all=1,apad,atrim=end_sample={round(total*48000)},asetpts=N/SR/TB','-c:a','pcm_s16le','-map_metadata','-1',str(target)]);audio.append(target);cursor+=total
 if not 150<=cursor<=165:raise ValueError(f'Edit duration{cursor:.2f}s outside requested150–165s')
 concat(audio,OUT/'voiceover.aiff',audio=True)
 external=(RAW/'voiceover.mp3').exists()
 if external:
  # Explicitly a draft until its caption alignment has been reviewed against the supplied recording.
  if duration(RAW/'voiceover.mp3')>cursor:raise ValueError('Supplied voiceover exceeds edit; retime the sections, never truncate narration.')
  run([FF,'-y','-v','error','-i',str(RAW/'voiceover.mp3'),'-af',f'aresample=48000,apad,atrim=duration={cursor}','-c:a','pcm_s16be','-map_metadata','-1',str(OUT/'voiceover.aiff')])
 header='''[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,52,&H00FFFFFF,&H00FFFFFF,&H201D1D1F,&H201D1D1F,0,0,0,0,100,100,0,0,3,12,0,2,130,130,38,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'''
 lines=[]
 for c in captions:
  wrapped=r'\N'.join(textwrap.wrap(c['text'],width=62,break_long_words=False))
  lines.append(f'Dialogue: 0,{stamp(c["start"])},{stamp(c["end"])},Default,,0,0,0,,{wrapped}\n')
 (WORK/'captions.ass').write_text(header+''.join(lines))
 def srtstamp(t):
  ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
 (OUT/'captions.srt').write_text(''.join(f'{i+1}\n{srtstamp(c["start"])} --> {srtstamp(c["end"])}\n{c["text"]}\n\n'for i,c in enumerate(captions)))
 jobs=[]
 def add(name,source,seconds,start=0,end=None,bg=None,crop=None,hold=False):
  jobs.append({'name':name,'source':str(source),'duration':seconds,'start':start,'end':end,'bg':bg,'crop':crop,'hold':hold})
 add('pour',RAW/cfg['pour_file'],sections[0]['duration'],*cfg['pour_range'],crop='1440:810:240:270')
 stats=sections[1]['duration'];split=.4
 for c in n['sections'][1]['captions']:
  split+=c['seconds']/tempo
  if c['text'].endswith('year.'):break
 add('stats1',WORK/'stats1.png',round(split*fps)/fps);add('stats2',WORK/'stats2.png',stats-round(split*fps)/fps)
 add('home',WORK/'home.webm',sections[2]['duration'],max(0,duration(WORK/'home.webm')-5),hold=True)
 weights=[3,3,6,4,6,8];remaining=sections[3]['duration'];ranges=cfg['bottle_ranges']
 # A replacement can be selected with one config line/--bottle. Its edit points must be reviewed before upload.
 for i,(a,b)in enumerate(ranges):
  d=remaining if i==5 else round(sections[3]['duration']*weights[i]/30*fps)/fps;remaining-=d
  if b>duration(RAW/bottle):raise ValueError('Replacement take is shorter than configured edit points; update video/edit.json.')
  crop='1206:2220:0:150'if i<4 else '1206:1550:0:700'if i==4 else '1206:1650:0:350'
  if i==5:add(f'bottle-{i}',RAW/bottle,d,a+.8,a+.84,bg='bottle',crop=crop,hold=True)
  else:add(f'bottle-{i}',RAW/bottle,d,a,b,bg='bottle',crop=crop)
 add('flip',WORK/'flip-proof.png',sections[4]['duration'])
 weights=[3,3,6,4];remaining=sections[5]['duration']
 for i,(a,b)in enumerate(cfg['advil_ranges']):
  d=remaining if i==3 else round(sections[5]['duration']*weights[i]/16*fps)/fps;remaining-=d
  crop='1206:2220:0:150'if i<2 else '1206:1600:0:700'
  add(f'advil-{i}',RAW/'shot2-single-pill-advil.mp4',d,a,b,bg='same',crop=crop)
 method=sections[6]['duration'];add('diagram',WORK/'diagram.png',round(method*.68*fps)/fps);add('sources',WORK/'sources.webm',method-round(method*.68*fps)/fps,max(0,duration(WORK/'sources.webm')-5),hold=True)
 research=sections[7]['duration'];add('research',WORK/'research-proof.png',round(research*.53*fps)/fps);add('safety',WORK/'safety-detail.png',round(research*.23*fps)/fps);add('limit',WORK/'softgel-limit.png',research-round(research*.53*fps)/fps-round(research*.23*fps)/fps)
 add('end',WORK/'end.png',sections[8]['duration'])
 def render(j):
  source=Path(j['source']);target=WORK/(j['name']+'.mp4');sig=hashlib.sha256((json.dumps(j,sort_keys=True)+str(source.stat().st_mtime_ns)).encode()).hexdigest();cache=target.with_suffix('.sha256')
  if target.exists()and cache.exists()and cache.read_text()==sig:return target
  still=source.suffix=='.png';seconds=j['duration'];cmd=[FF,'-y','-v','error','-threads','2']
  if j['bg']:cmd+=['-loop','1','-i',str(WORK/(j['bg']+'.png'))]
  if still:cmd+=['-loop','1','-i',str(source)]
  else:cmd+=['-ss',str(j['start']),'-i',str(source)]
  idx=1 if j['bg']else 0;chain=f'[{idx}:v]'
  if not still:
   take=(j['end']-j['start'])if j['end']is not None else min(5,seconds)
   chain+=f'trim=duration={take},setpts=PTS-STARTPTS,'
   if not j['hold']:chain+=f'setpts={seconds/take}*PTS,'
  if j['crop']:chain+='crop='+j['crop']+','
  if j['bg']:
   chain+='scale=-2:820,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=180[fg];[0:v]setsar=1[bg];[bg][fg]overlay=x=1285-overlay_w/2:y=80:shortest=1'
  else:chain+='scale=1920:1080,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=180'
  chain+=',format=yuv420p[v]'
  cmd+=['-filter_complex',chain,'-filter_complex_threads','1','-map','[v]','-an','-t',f'{seconds:.6f}','-r','30','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-map_metadata','-1',str(target)]
  try:run(cmd)
  except subprocess.CalledProcessError as e:raise RuntimeError(e.stderr.decode()[-2000:])from e
  cache.write_text(sig);return target
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:parts=list(pool.map(render,jobs))
 concat(parts,WORK/'picture.mp4')
 final=OUT/'second-look-demo.mp4'
 run([FF,'-y','-v','error','-i',str(WORK/'picture.mp4'),'-i',str(OUT/'voiceover.aiff'),'-vf','subtitles=video/work/captions.ass','-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4','-c:a','aac','-b:a','192k','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','48000','-pix_fmt','yuv420p','-r','30','-map_metadata','-1','-movflags','+faststart','-t',str(cursor),str(final)])
 run([FF,'-y','-v','error','-i',str(final),'-vf',"select='eq(n,120)+eq(n,600)+eq(n,1800)+eq(n,2400)+eq(n,3900)+eq(n,4650)',scale=640:360,tile=3x2",'-frames:v','1',str(OUT/'contact-sheet.png')])
 manifest={'status':'DRAFT: replace bottle take before upload'if placeholder else 'REVIEW: replacement footage needs timing/claim check','duration':duration(final),'format':'1920x1080 30fps H264 AAC','bottleSource':bottle,'placeholder':placeholder,'voice':'provided ElevenLabs mp3'if external else 'macOS Samantha168, pitch-preserving0.90tempo','externalCaptionAlignmentNeedsReview':external,'captionCount':len(captions),'scriptSha256':n['scriptSha256'],'sections':sections,'editJobs':jobs,'sources':json.loads((WORK/'production-captures.json').read_text()),'remaining':['Replace placeholder (pill4) with good bottle+flip take matching narration pill5.','Review replacement ranges in video/edit.json.','Replace previously-recorded flip card with the actual new flip sequence if supplied.'],'paidAiCalls':0,'uploaded':False}
 (OUT/'render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (OUT/'README.txt').write_text(manifest['status']+'\nNo upload performed.\nCurrent bottle footage has no flip; the after-flip card is a genuine, labelled older result.\nSee render-manifest.json for sources and edit timing.\n')
 if opt.publish:
  dest=Path('/Users/mellamputi_vedhanth/Hackathons/DSH Hacks/video/out');dest.mkdir(parents=True,exist_ok=True)
  for f in OUT.iterdir():
   if f.is_file():shutil.copy2(f,dest/f.name)
 print(json.dumps({'output':str(final),'duration':manifest['duration'],'status':manifest['status'],'captions':len(captions)}))
if __name__=='__main__':main()
