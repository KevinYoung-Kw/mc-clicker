"""Original MC Clicker scores and instruments. Run with uv --with numpy.

Every score has its own melody, harmony, meter, orchestration and arrangement.
No sampled recordings or third-party musical material. MP3 conversion: ffmpeg.
"""
from pathlib import Path
import subprocess
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'records'
OUT.mkdir(parents=True, exist_ok=True)
SR = 24000
# Each pair is an independent 8-bar melody, not a transposed shared motif.
SCORES = {
 'meadow': (92, 4, 32, [60, 65, 57, 67], 'plucked',
   [[72,76,79,76],[74,77,81,79],[76,79,84,83],[79,76,74,72],[77,81,79,76],[74,72,69,72],[76,74,72,67],[69,72,74,72]],
   [[84,83,79,76],[81,79,77,74],[79,76,74,72],[77,76,72,69],[74,77,81,84],[83,79,76,74],[77,74,71,67],[72,76,79,72]]),
 'cavern': (66, 3, 32, [45, 41, 48, 43], 'stone',
   [[69,0,64],[65,0,60],[67,72,0],[62,0,59],[64,69,0],[60,65,64],[67,0,60],[62,59,0]],
   [[76,0,72],[77,74,0],[72,0,67],[71,0,62],[69,64,67],[65,0,69],[72,71,67],[64,0,57]]),
 'copper': (114, 4, 32, [50, 55, 48, 57], 'metal',
   [[74,69,72,74,77,74],[79,74,77,79,81,77],[72,67,70,72,76,79],[81,76,79,76,73,69],[77,74,69,72,74,77],[79,77,74,70,74,79],[76,72,67,70,72,76],[73,76,81,79,76,74]],
   [[86,81,84,81,77,74],[82,79,86,82,79,77],[84,79,76,79,84,88],[85,81,79,76,73,69],[81,77,74,77,81,86],[86,82,79,77,74,70],[88,84,79,76,72,67],[81,79,76,73,69,74]]),
 'rain': (72, 4, 24, [53, 50, 58, 48], 'soft',
   [[77,81,79],[76,74,69],[74,77,81],[79,76,72],[81,84,79],[77,76,74],[77,74,70],[76,72,67]],
   [[84,88,86],[81,79,77],[82,81,77],[79,76,74],[81,79,77],[76,74,72],[77,74,70],[72,0,0]]),
 'nether': (96, 4, 32, [40, 41, 43, 38], 'reed',
   [[64,65,64,59],[65,69,68,65],[67,71,70,67],[62,65,64,62],[59,64,65,67],[68,65,60,65],[67,70,71,67],[65,62,58,59]],
   [[76,77,76,71],[77,80,81,77],[79,82,83,79],[74,77,76,70],[71,76,77,79],[80,77,72,68],[79,76,71,67],[74,70,65,64]]),
 'end': (60, 5, 20, [48, 56, 51, 58], 'crystal',
   [[79,0,86,0,83],[80,87,0,84,0],[82,0,89,86,0],[84,0,91,0,86],[86,83,0,79,0],[87,84,80,0,0],[89,86,0,82,0],[91,86,84,0,0]],
   [[91,0,86,83,79],[92,87,0,84,80],[94,0,89,86,82],[96,91,0,86,84],[86,83,79,0,74],[87,84,80,0,75],[89,86,82,77,0],[79,0,0,0,0]]),
}

def voice(pitch, duration, kind, rng):
    t = np.arange(max(1, int((duration + .35) * SR))) / SR
    f = 440 * 2 ** ((pitch - 69) / 12)
    attack = 1 - np.exp(-t * (45 if kind in ('soft','pad') else 450))
    if kind == 'plucked':
        v = sum(np.sin(2*np.pi*f*h*t) * np.exp(-t*(2+h)*1.5) / h**1.5 for h in (1,2,3,4))
    elif kind in ('stone','crystal','metal'):
        ratios = {'stone':[1,2.71,4.13], 'crystal':[1,2,3.98,5.02], 'metal':[1,2.36,3.72,5.16]}[kind]
        v = sum(np.sin(2*np.pi*f*h*t)*np.exp(-t*(1.7+i)*(.6 if kind=='crystal' else 1.4))/(i+1)**1.7 for i,h in enumerate(ratios))
    elif kind == 'reed':
        v = (np.sin(2*np.pi*f*t)+.22*np.sin(6*np.pi*f*t)+.08*np.sin(10*np.pi*f*t))*np.exp(-t*2)
    elif kind == 'flute':
        v = (np.sin(2*np.pi*f*t+.016*np.sin(t*31))+.14*np.sin(4*np.pi*f*t))*np.exp(-t*1.25)
    elif kind == 'pad':
        v = (np.sin(2*np.pi*f*.999*t)+np.sin(2*np.pi*f*1.001*t))*.4
    else:
        v = (np.sin(2*np.pi*f*t)+.16*np.sin(4*np.pi*f*t))*np.exp(-t*2.8)
    release = np.clip((duration + .25 - t)/.3, 0, 1)
    return v * attack * release

for index, (name, (bpm, meter, bars, roots, timbre, a, b)) in enumerate(SCORES.items()):
    rng = np.random.default_rng(8600+index)
    beat = 60 / bpm
    duration = bars * meter * beat + 2
    mix = np.zeros((int(duration*SR), 2), dtype=np.float64)
    def put(pitch, at, length, kind, amp=.14, pan=0):
        if pitch <= 0: return
        v = voice(pitch, length, kind, rng) * amp
        start = int(at*SR); end = min(len(mix), start+len(v)); v=v[:end-start]
        mix[start:end,0] += v*np.sqrt((1-pan)/2)
        mix[start:end,1] += v*np.sqrt((1+pan)/2)
    def drum(at, metal=False):
        t=np.arange(int(.15*SR))/SR
        v=(rng.uniform(-1,1,len(t))*.2*np.exp(-t*60) + np.sin(2*np.pi*(90*t-70*t*t))*np.exp(-t*30))*.055
        if metal: v=rng.uniform(-1,1,len(t))*.014*np.exp(-t*75)
        start=int(at*SR); mix[start:start+len(v)] += v[:,None]
    for bar in range(bars):
        at=bar*meter*beat; root=roots[(bar//2)%4]
        middle = bars//2 <= bar < bars-4
        phrase=(b if middle else a)[bar%8]
        # Intro/outro and middle voice are deliberately arranged, not endless loops.
        loud=.7 if bar<4 or bar>=bars-4 else 1
        third=4 if name in ('meadow','rain','end') else 3
        if name=='nether' and (bar//2)%4==1: third=4
        put(root-12,at,meter*beat*.88,'soft',.13*loud,-.15)
        for degree in (0,third,7):
            put(root+degree,at,meter*beat*.9,'pad' if name in ('rain','end','cavern') else 'soft',.025*loud,(degree-3)*.05)
        if name=='copper':
            offsets=[0,.75,1.5,2,2.75,3.5]
        elif name=='rain': offsets=[0,1.5,2.5]
        else: offsets=list(range(len(phrase)))
        for j,(note,offset) in enumerate(zip(phrase,offsets)):
            if bar==bars-1 and j>1: continue
            put(note,at+offset*beat,beat*(1.7 if name in ('rain','end','cavern') else .65),timbre,.15*loud,(-.3 if j%2 else .3))
        if name in ('meadow','rain') and middle:
            put(root+24,at+beat*.5,beat*2.4,'flute',.065,.2)
        if name in ('meadow','copper','nether'):
            for j in range(meter):
                if bar>=2 and bar<bars-2: drum(at+j*beat,metal=j%2==1)
                if name=='copper' or (name=='meadow' and bar>=8):
                    put(root+[0,7,third+12,7][j%4],at+(j+.5)*beat,beat*.4,'plucked',.05,-.3)
    # Room echoes are applied once, with distinct spacing for each atmosphere.
    dry=mix.copy()
    for delay,wet in ((.19+index*.021,.14),(.37+index*.025,.08),(.61+index*.013,.045)):
        shift=int(delay*SR); mix[shift:] += dry[:-shift,::-1]*wet
    if name=='rain':
        noise=rng.normal(0,.002,len(mix)); mix += noise[:,None]
    fade=min(int(2*SR),len(mix)//4)
    mix[:fade] *= np.linspace(0,1,fade)[:,None]
    mix[-fade:] *= np.linspace(1,0,fade)[:,None]
    mix *= .8/max(.8,float(np.max(np.abs(mix))))
    wav=OUT/(name+'.wav')
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((mix*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af','loudnorm=I=-20:TP=-2:LRA=9','-ar','44100','-b:a','112k',str(OUT/(name+'.mp3'))],check=True)
    wav.unlink()
    print(f'{name}: {duration:.2f}s',flush=True)

(OUT/'CREDITS.txt').write_text('''MC Clicker original record collection
Music: original scores and synthesis authored for this project with GPT-6 Astra.
Reproducible source: scripts/compose-records.py (six independently written scores).
No third-party recordings, melodies or official Minecraft audio used.
Cover artwork: original pixel SVG compositions in src/record-art.js.
Interaction sounds: original procedural wood/stone/metal/noise synthesis in src/game-audio.js.
Audio assets and original scores in this collection are released under CC0 1.0.
''')
