from pathlib import Path
import subprocess, json, hashlib
work=Path(__file__).resolve().parent
out=work.parent
frames=list((work/'frames').glob('f*.png'))
assert len(frames)==660, f"Expected 660 frames, got {len(frames)}"
assert hashlib.sha256((work/'poster.png').read_bytes()).digest()==hashlib.sha256((work/'frames/f0000.png').read_bytes()).digest()
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','warning','-framerate','30','-i',str(work/'frames/f%04d.png'),'-i',str(work/'brag-audio.wav'),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t','22','-metadata','title=Wayfinder — from a future to a first step',str(out/'brag.mp4')],check=True)
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(work/'poster.png'),'-frames:v','1','-q:v','2',str(out/'brag.jpg')],check=True)
r=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels','-of','json',str(out/'brag.mp4')],capture_output=True,text=True,check=True)
d=json.loads(r.stdout)
assert float(d['format']['duration'])==22.0
v=next(x for x in d['streams'] if x['codec_name']=='h264')
assert (v['width'],v['height'],v['r_frame_rate'],v['nb_frames'])==(1920,1080,'30/1','660')
assert any(x['codec_name']=='aac' and x['channels']==2 for x in d['streams'])
(work/'video-validation.json').write_text(json.dumps(d,indent=2))
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(out/'brag.mp4'),'-frames:v','1',str(work/'first-frame.png')],check=True)
print(json.dumps(d,indent=2))
print('Poster replaces frame 0; 22 seconds; 660 frames; H.264 + stereo AAC; fast-start enabled.')
