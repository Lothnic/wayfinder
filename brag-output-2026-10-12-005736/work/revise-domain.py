"""Composite the reviewed domain revision onto the existing video frames."""
from pathlib import Path
import subprocess

work = Path(__file__).resolve().parent
out = work / 'domain-frames'
out.mkdir(exist_ok=True)
# The reviewed browser captures contain the new domain. Replace the footer
# throughout the product scenes and animate only the new URL on the end card.
# The empty end-card grid crop has the same 32px grid phase as the URL region.
filters = (
    '[1:v]crop=450:36:80:1020[footer];'
    '[0:v][footer]overlay=80:1020:enable=lt(t\\,18)[main];'
    '[2:v]split=2[gridSource][urlSource];'
    '[gridSource]crop=550:130:690:184[grid];'
    '[main][grid]overlay=690:600:enable=gte(t\\,18)[clean];'
    '[urlSource]crop=377:81:775:619,format=rgba,'
    'colorkey=0xe9f7fe:0.001:0,colorkey=0xd5ebf7:0.001:0,'
    "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':"
    "a='alpha(X,Y)*(1-pow(1-clip((T-18)/0.35,0,1),3))'[url];"
    "[clean][url]overlay=x=775:y='619+14*pow(1-clip((t-18)/0.35,0,1),3)':"
    'enable=gte(t\\,18),format=rgb24[video]'
)
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', '30', '-i', str(work/'frames/f%04d.png'),
    '-loop', '1', '-framerate', '30', '-i', str(work/'scout-1.00.png'),
    '-loop', '1', '-framerate', '30', '-i', str(work/'scout-20.00.png'),
    '-filter_complex_threads', '1', '-filter_complex', filters,
    '-map', '[video]', '-frames:v', '660', '-start_number', '0',
    str(out/'f%04d.png'),
], check=True)
# Preserve the settled original poster with the same footer-only replacement.
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-i', str(work/'frames/f0000.png'), '-i', str(work/'scout-1.00.png'),
    '-filter_complex_threads', '1', '-filter_complex',
    '[1:v]crop=450:36:80:1020[footer];[0:v][footer]overlay=80:1020',
    '-frames:v', '1', str(work/'poster.png'),
], check=True)
(out/'f0000.png').write_bytes((work/'poster.png').read_bytes())
for frame in out.glob('f*.png'):
    frame.replace(work/'frames'/frame.name)
print('Revised all 660 frames and the settled poster.')
