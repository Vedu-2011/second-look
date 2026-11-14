"""Verify the actual rendered file, not just the edit settings."""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'video/out';WORK=ROOT/'video/work'
FF='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';PROBE='/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
def main():
 target=OUT/'second-look-demo.mp4';manifest=json.loads((OUT/'render-manifest.json').read_text())
 assert not manifest['externalCaptionAlignmentNeedsReview'],'Supplied voiceover needs caption realignment before sync can be certified'
 probe=json.loads(subprocess.check_output([PROBE,'-v','error','-show_streams','-show_format','-of','json',str(target)],text=True))
 v=next(s for s in probe['streams']if s['codec_type']=='video');a=next(s for s in probe['streams']if s['codec_type']=='audio')
 seconds=float(probe['format']['duration'])
 assert 150<=seconds<=165 and seconds<179
 assert(v['codec_name'],v['width'],v['height'],v['avg_frame_rate'])==('h264',1920,1080,'30/1')
 assert a['codec_name']=='aac'and int(a['sample_rate'])==48000
 assert abs(float(a['duration'])-float(v['duration']))<.1
 n=json.loads((WORK/'narration.json').read_text())
 text=' '.join(s['voiceover']for s in n['sections']).split()
 srt=(OUT/'captions.srt').read_text();parts=[]
 for block in srt.strip().split('\n\n'):parts.extend(' '.join(block.splitlines()[2:]).split())
 assert parts==text,'Captions must preserve every script word, in order'
 captions=[]
 for line in(WORK/'captions.ass').read_text().splitlines():
  if line.startswith('Dialogue:'):
   f=line.split(',',9)
   def secs(t):
    h,m,s=t.split(':');return int(h)*3600+int(m)*60+float(s)
   captions.append((secs(f[1]),secs(f[2])))
 assert len(captions)==sum(len(s['captions']) for s in n['sections']) and all(0<=x<y<=seconds for x,y in captions)
 assert all(captions[i][1]<=captions[i+1][0]+.011 for i in range(len(captions)-1))
 # Decode every frame/sample, then measure the encoded audio (not the input narration).
 subprocess.run([FF,'-v','error','-i',str(target),'-f','null','-'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 loud=subprocess.run([FF,'-hide_banner','-i',str(target),'-vn','-af','loudnorm=print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
 data=json.JSONDecoder().raw_decode(loud[loud.rfind('{'):])[0];assert -20<float(data['input_i'])<-12 and float(data['input_tp'])<-.5
 end=WORK/'encoded-end-card.png'
 subprocess.run([FF,'-y','-v','error','-ss',str(seconds-4),'-i',str(target),'-frames:v','1',str(end)],check=True)
 qr=json.loads(subprocess.check_output(['node',str(ROOT/'video/tools/qr-check.mjs'),str(end)],text=True))
 assert'https://getsecondlook.vercel.app'in qr,'QR must scan from the actual encoded end card'
 raw=ROOT/'video/raw';inputs=[]
 for name in [manifest['bottleSource'],'shot1-pour-take2.mov','shot2-single-pill-advil.mp4']:
  p=raw/name;h=hashlib.file_digest(p.open('rb'),'sha256').hexdigest();inputs.append({'file':name,'bytes':p.stat().st_size,'sha256':h})
 report={'format':{'codec':v['codec_name'],'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'audio':a['codec_name'],'sampleRate':a['sample_rate']},'duration':seconds,'audioVideoDurationDelta':abs(float(a['duration'])-float(v['duration'])),'captionCount':len(captions),'verbatimCaptions':True,'captionMethod':'Each caption is timed to its independently generated audio chunk; same tempo and section delays applied. No ASR timing estimate for this macOS narration.','fullDecode':'PASS','loudnessLUFS':float(data['input_i']),'truePeakDbFS':float(data['input_tp']),'qrDecoded':qr,'sourceInputs':inputs,'videoSha256':hashlib.file_digest(target.open('rb'),'sha256').hexdigest(),'status':manifest['status'],'remaining':manifest['remaining'],'privacyReview':'Only selected ranges used: no faces/notifications observed. Phone status/Safari bars cropped; pour crop excludes monitor. Source audio removed. Fictional demo label.','notUploaded':True,'paidAiCalls':0}
 (OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
