"""Actual-file QA for v2: full decode, words/timing, unscaled voice, loudness and encoded QR."""
import array
import hashlib
import json
import math
import subprocess
from build import ROOT, WORK, OUT, RAW, FF, PROBE, run

V2 = WORK / 'v2'

def envelope(path):
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', '4000', '-f', 'f32le', '-'])
    samples = array.array('f', raw)
    # 20ms RMS envelope; compare timing rather than the cleaned signal's absolute gain.
    return [math.sqrt(sum(x*x for x in samples[i:i+80]) / 80) for i in range(0, len(samples)-79, 80)]

def correlation(a, b):
    n = min(len(a), len(b)); a = a[:n]; b = b[:n]
    ma = sum(a)/n; mb = sum(b)/n
    return sum((x-ma)*(y-mb) for x,y in zip(a,b)) / math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))

def main():
    target = OUT / 'second-look-demo-v2.mp4'
    manifest = json.loads((OUT / 'render-manifest-v2.json').read_text())
    reviewed = json.loads((V2 / 'captions-reviewed.json').read_text())
    probe = json.loads(subprocess.check_output([PROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(target)], text=True))
    v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    seconds = float(probe['format']['duration'])
    assert seconds == 158 and seconds <= 179
    assert (v['codec_name'], v['width'], v['height'], v['avg_frame_rate'], int(v['nb_frames'])) == ('h264', 1920, 1080, '30/1', 4740)
    assert a['codec_name'] == 'aac' and int(a['sample_rate']) == 48000
    delta = abs(float(v['duration']) - float(a['duration']))
    assert delta < .05
    blocks = (OUT / 'captions-v2.srt').read_text().strip().split('\n\n')
    words = ' '.join(' '.join(b.splitlines()[2:]) for b in blocks).split()
    assert words == reviewed['transcript'].split(), 'Captions must preserve the actual reviewed recording words'
    assert len(blocks) == len(reviewed['cues']) == manifest['captionCount']
    intervals = []
    for line in (V2 / 'captions.ass').read_text().splitlines():
        if not line.startswith('Dialogue:'):
            continue
        fields = line.split(',', 9)
        def stamp(s):
            h,m,ss = s.split(':'); return int(h)*3600 + int(m)*60 + float(ss)
        start, end = stamp(fields[1]), stamp(fields[2])
        assert 0 <= start < end <= seconds
        assert len(fields[9].split(r'\N')) <= 2
        intervals.append([start, end])
    assert len(intervals) == len(blocks)
    assert all(intervals[i][1] <= intervals[i+1][0]+.011 for i in range(len(intervals)-1))
    assert manifest['audioTimeScale'] == 1 and 0 <= manifest['audioPaddingSeconds'] < .2
    assert not manifest['placeholder'] and manifest['bottleSource'] == 'shot3-bottle-check.mov'
    for job in manifest['editJobs']:
        if job.get('mode') == 'normal':
            assert job['playbackSpeed'] == 1
        elif job.get('mode') == 'wait':
            assert 2 <= job['playbackSpeed'] <= 4
        assert 'messedup' not in job['source'] and 'flip-proof' not in job['source']
    run([FF, '-v', 'error', '-i', str(target), '-f', 'null', '-'])
    result = subprocess.run([FF, '-hide_banner', '-i', str(target), '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    stderr = result.stderr
    loudness = json.JSONDecoder().raw_decode(stderr[stderr.rfind('{'):])[0]
    assert -17 <= float(loudness['input_i']) <= -15
    assert float(loudness['input_tp']) < -.5
    original = envelope(RAW / manifest['audioMaster']); encoded = envelope(target)
    values = {lag: correlation(original[max(0,-lag):], encoded[max(0,lag):]) for lag in range(-15,16)}
    lag = max(values, key=values.get)
    assert abs(lag) <= 2 and values[lag] > .94, f'Voice timing/content drift: {lag*20}ms, correlation {values[lag]}'
    # Check beginning/middle/end independently to catch drift that a global score could hide.
    windows = []
    for start in [0, 50, 100, 130]:
        x = original[start*50:(start+25)*50]
        ys = encoded[start*50+max(0,lag):(start+25)*50+max(0,lag)]
        x = x[max(0,-lag):]
        score = correlation(x, ys)
        assert score > .9, f'Audio envelope differs at {start}s: {score}'
        windows.append({'fromSeconds': start, 'durationSeconds': 25, 'correlationAtMeasuredLag': score, 'lagMs': lag*20})
    end = V2 / 'encoded-end-card.png'
    run([FF, '-y', '-v', 'error', '-ss', '154', '-i', str(target), '-frames:v', '1', str(end)])
    qr = json.loads(subprocess.check_output(['node', str(ROOT / 'video/tools/qr-check.mjs'), str(end)], text=True))
    assert 'https://getsecondlook.vercel.app' in qr
    # Produce all 158 one-second samples, paged so every second can be visually inspected.
    for page in range(4):
        start = page*40; count = min(40, math.ceil(seconds)-start)
        run([FF, '-y', '-v', 'error', '-ss', str(start), '-i', str(target), '-vf',
             f"fps=1,scale=384:216,drawtext=text='%{{eif\\:t+{start}\\:d}}s':fontcolor=white:fontsize=20:box=1:boxcolor=black:boxborderw=4:x=8:y=8,tile=5x8:nb_frames={count}",
             '-frames:v', '1', str(V2 / f'timeline-{page+1}.png')])
    for item in manifest['inputs']:
        path = ROOT / 'video' / item['file']
        with path.open('rb') as stream:
            assert item['sha256'] == hashlib.file_digest(stream, 'sha256').hexdigest()
    with target.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    report = {
        'status': 'PASS', 'duration': seconds, 'bytes': target.stat().st_size, 'videoSha256': checksum,
        'format': {'video': v['codec_name'], 'width': v['width'], 'height': v['height'], 'fps': v['avg_frame_rate'], 'audio': a['codec_name'], 'sampleRate': a['sample_rate']},
        'frameCount': int(v['nb_frames']), 'fullDecode': 'PASS', 'audioVideoDurationDelta': delta,
        'captionCount': len(blocks), 'captionWordsMatchReviewedActualRecording': True,
        'captionMethod': reviewed['method'], 'captionTiming': 'ASR token timing plus manually reviewed phrase boundaries; not frame-exact forced alignment.',
        'voiceMasterUnscaled': True, 'voiceEnvelopeCorrelation': values[lag], 'voiceBestLagMs': lag*20, 'voiceWindowChecks': windows,
        'loudnessLUFS': float(loudness['input_i']), 'truePeakDbFS': float(loudness['input_tp']), 'qrDecoded': qr,
        'closingUrlDecision': manifest['closingUrlDecision'],
        'sourcesVerifiedAgainstRenderHashes': True,
        'reviewAssets': ['video/work/v2/timeline-1.png', 'video/work/v2/timeline-2.png', 'video/work/v2/timeline-3.png', 'video/work/v2/timeline-4.png'],
        'notUploaded': True, 'paidAiCalls': 0,
    }
    (OUT / 'verification-v2.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
