"""Voice-master edit: continuous original narration, real bottle/flip, local output only."""
import argparse
import concurrent.futures
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from build import ROOT, WORK, OUT, RAW, FF, PROBE, run, duration, concat

V2 = WORK / 'v2'
RENDER_VERSION = 1

def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true', help='Copy local v2 deliverables into the home project; no upload')
    opt = parser.parse_args()
    cfg = json.loads((ROOT / 'video/edit-v2.json').read_text())
    fps, total = cfg['fps'], cfg['duration']
    voice = RAW / cfg['audio']
    assert duration(voice) <= total and total - duration(voice) < .2
    review = json.loads((V2 / 'captions-reviewed.json').read_text())
    assert review['audioMaster'] == cfg['audio'] and review['audioTimeScale'] == 1
    assert review['audioMasterSha256'] == digest(voice), 'Recording changed; transcribe and review captions again'
    # A single continuous source. No cut, tempo change, silence removal or synthesized voice.
    audio = V2 / 'voice-clean.wav'
    run([FF, '-y', '-v', 'error', '-i', str(voice), '-vn', '-af',
         f'highpass=f=60,afftdn=nr=4:nf=-45,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad,atrim=end_sample={round(total*48000)},asetpts=N/SR/TB',
         '-c:a', 'pcm_s16le', '-map_metadata', '-1', str(audio)])
    cursor = 0
    jobs = []
    for clip in cfg['clips']:
        a, b = [round(t * fps) for t in clip['out']]
        assert a == cursor and b > a, f'Gap or invalid clip: {clip["name"]}'
        cursor = b
        job = {**clip, 'frames': b-a, 'startFrame': a, 'endFrame': b}
        if 'in' in job:
            take = job['in'][1] - job['in'][0]
            seconds = job['frames'] / fps
            assert job['in'][1] <= duration(ROOT / 'video' / job['source'])
            if job['mode'] == 'wait':
                speed = take / seconds
                assert 2 <= speed <= 4, f'Wait speed outside 2–4x: {speed}'
            else:
                assert job['mode'] == 'normal' and take <= seconds + 1/fps
                speed = 1
            job['playbackSpeed'] = speed
            job['holdSeconds'] = max(0, seconds - take / speed)
        jobs.append(job)
    assert cursor == round(total * fps)

    def render(job):
        source = ROOT / 'video' / job['source']
        background = (V2 / (job['bg'] + '.png') if job.get('bg') in ['bottle', 'flip']
                      else WORK / (job['bg'] + '.png')) if job.get('bg') else None
        signature = hashlib.sha256(json.dumps({
            'version': RENDER_VERSION, 'job': job,
            'inputs': [(str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in [source, background] if p],
        }, sort_keys=True).encode()).hexdigest()
        target = V2 / (job['name'] + '.mp4')
        cache = target.with_suffix('.sha256')
        if target.exists() and cache.exists() and cache.read_text() == signature:
            return target
        still = source.suffix == '.png'
        command = [FF, '-y', '-v', 'error', '-threads', '2']
        if background:
            command += ['-loop', '1', '-i', str(background)]
        if still:
            command += ['-loop', '1', '-i', str(source)]
        else:
            command += ['-ss', str(job['in'][0]), '-i', str(source)]
        chain = f'[{1 if background else 0}:v]'
        if not still:
            take = job['in'][1] - job['in'][0]
            chain += f'trim=duration={take},setpts=(PTS-STARTPTS)/{job["playbackSpeed"]},'
        if job.get('crop'):
            chain += 'crop=' + job['crop'] + ','
        if background:
            chain += ('scale=-2:820,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=180[fg];'
                      '[0:v]setsar=1[bg];[bg][fg]overlay=x=1285-overlay_w/2:y=80:shortest=1')
        else:
            chain += 'scale=1920:1080,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=180'
        chain += ',format=yuv420p[v]'
        command += ['-filter_complex', chain, '-filter_complex_threads', '1', '-map', '[v]', '-an',
                    '-frames:v', str(job['frames']), '-r', str(fps), '-c:v', 'libx264', '-preset', 'veryfast',
                    '-crf', '20', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', str(target)]
        try:
            run(command)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(exc.stderr.decode()[-3000:]) from exc
        cache.write_text(signature)
        print('Rendered ' + job['name'], flush=True)
        return target

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        parts = list(pool.map(render, jobs))
    concat(parts, V2 / 'picture.mp4')
    final = OUT / 'second-look-demo-v2.mp4'
    run([FF, '-y', '-v', 'error', '-i', str(V2 / 'picture.mp4'), '-i', str(audio),
         '-vf', 'subtitles=video/work/v2/captions.ass', '-map', '0:v', '-map', '1:a',
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-threads', '4',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-pix_fmt', 'yuv420p', '-r', str(fps),
         '-map_metadata', '-1', '-movflags', '+faststart', '-t', str(total), str(final)])
    run([FF, '-y', '-v', 'error', '-i', str(final), '-vf',
         "select='eq(n,120)+eq(n,600)+eq(n,1710)+eq(n,2370)+eq(n,3900)+eq(n,4620)',scale=640:360,tile=3x2",
         '-frames:v', '1', str(OUT / 'contact-sheet-v2.png')])
    inputs = sorted({clip['source'] for clip in jobs} | {'raw/' + cfg['audio']})
    manifest = {
        'status': 'FINAL LOCAL CUT — no media upload', 'duration': duration(final),
        'format': '1920x1080 30fps H264 AAC', 'audioMaster': cfg['audio'],
        'voice': 'Vedhanth original continuous recording', 'audioTimeScale': 1,
        'audioCleanup': '60Hz highpass, gentle 4dB afftdn, -16 LUFS normalization; no music or source camera audio',
        'audioPaddingSeconds': total - duration(voice), 'bottleSource': cfg['bottle'],
        'placeholder': False, 'captionCount': len(review['cues']), 'captionMethod': review['method'],
        'closingUrlDecision': 'User approved unchanged spoken secondlook.vercel.app; working getsecondlook.vercel.app on end card and QR.',
        'editJobs': jobs,
        'inputs': [{'file': name, 'sha256': digest(ROOT / 'video' / name)} for name in inputs],
        'sources': json.loads((WORK / 'production-captures.json').read_text()),
        'historicalEvidence': 'Research is the frozen first-version NIH test; softgel limitation is explicitly labelled earlier recorded evidence.',
        'paidAiCalls': 0, 'uploaded': False,
    }
    (OUT / 'render-manifest-v2.json').write_text(json.dumps(manifest, indent=2) + '\n')
    if opt.publish:
        dest = Path('/Users/mellamputi_vedhanth/Hackathons/DSH Hacks/video/out')
        dest.mkdir(parents=True, exist_ok=True)
        for name in ['second-look-demo-v2.mp4', 'contact-sheet-v2.png', 'captions-v2.srt', 'render-manifest-v2.json', 'verification-v2.json']:
            source = OUT / name
            if source.exists():
                shutil.copy2(source, dest / name)
    print(json.dumps({'output': str(final), 'duration': manifest['duration'], 'captions': len(review['cues'])}))

if __name__ == '__main__':
    main()
