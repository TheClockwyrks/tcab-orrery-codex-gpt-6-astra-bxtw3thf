"""One-time asset authoring; never invoked by the application build."""
import json, math, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]; TMP=pathlib.Path('/tmp/orrery-art');TMP.mkdir(exist_ok=True)
def run(*args):
 r=subprocess.run(list(map(str,args)),capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr)
def save(path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data))
def sprite(path,w,h,ops,sheet=False):
 dest=ROOT/'assets'/path;dest.parent.mkdir(parents=True,exist_ok=True);log=TMP/(path.replace('/','_')+'.json');save(log,ops)
 run('draw-sheet' if sheet else 'draw','render','--actions',log,'--out',dest,'--width',w,'--height',h,'--no-layers')
def circ(x,y,r,c,fill=True):return dict(op='fill_circle' if fill else 'stroke_circle',cx=round(x),cy=round(y),r=round(r),color=c)
def line(x,y,a,b,c):return dict(op='line',x0=round(x),y0=round(y),x1=round(a),y1=round(b),color=c)
gold='#c7a76aff';pale='#f8e1a1ff';blue='#83c9d6ff';dark='#172c39ff'
names=['dust','nebula','comet','nova','meteor','mercury','saturn','jupiter','mars','venus','luna','sol','umbra','lumen','aether']
colors=['#a9a0a0','#b597f1','#83e0ed','#ff9764','#c8a580','#b4d5ce','#c8ac7c','#e4b688','#d98778','#e9c894','#c5e4ef','#ffe09a','#8f79b7','#f2eee0','#9df6d7']
for i,(name,c) in enumerate(zip(names,colors)):
 ops=[]
 # Cut-glass bodies with a shaded rim, luminous facets, and unique inlays.
 radius=13 if i<6 else 15
 for r in range(radius,0,-1):
  f=.35+.65*(1-r/(radius+3));rgb=[int(int(c[j:j+2],16)*f) for j in (1,3,5)];ops.append(circ(22,22,r,'#'+''.join(f'{v:02x}' for v in rgb)+'ff'))
 ops+=[circ(22,22,radius,c+'ff',False),circ(18,17,3,'#ffffffa0'),line(13,28,25,11,c+'90')]
 if i==0:
  ops=[circ(22+math.cos(k*2.4)*((k%3)*4+3),22+math.sin(k*2.4)*((k%3)*4+3),1+(k%2),c+'ff') for k in range(16)]
 elif i==1:
  ops += [circ(22+math.cos(k)*10,22+math.sin(k)*7,5,c+'50',False) for k in range(6)]
 elif i==2:ops += [line(9+k,9,19+k,20,c+'aa') for k in range(5)]
 elif i==3 or i==11:
  for k in range(8):
   a=k*math.pi/4;ops.append(line(22+math.cos(a)*16,22+math.sin(a)*16,22+math.cos(a)*20,22+math.sin(a)*20,c+'ff'))
 elif i==4:ops += [circ(26,27,4,'#57483eff'),circ(19,24,2,'#57483eff')]
 elif i==5:ops += [line(13,13,31,31,pale),line(13,31,31,13,pale)]
 elif i==12:ops += [circ(25,19,11,'#111b2eff'),circ(22,22,18,c+'80',False)]
 elif i==13:ops += [line(22,3,22,41,pale),line(3,22,41,22,pale)]
 elif i==14:
  for k in range(4):
   a=k*math.pi/2;ops += [line(22+math.cos(a)*20,22+math.sin(a)*20,22+math.cos(a+math.pi/2)*20,22+math.sin(a+math.pi/2)*20,c+'ff')]
 if 6<=i<=11:
  for k in range(i-5):ops.append(circ(15+k*3,30,1,pale))
  if i==6:ops += [line(3,29,40,15,gold),line(3,30,40,16,pale)]
  if i==7:ops += [line(10,21,34,21,c+'ff'),line(11,25,33,25,c+'ff')]
  if i==10:ops += [circ(26,18,8,'#e6f4f3ff')]
 sprite('sprites/motes/'+name+'.png',44,44,ops)
for name in ['plain','triune']:
 ops=[line(0,8,47,8,pale),line(0,9,47,9,'#4b7885ff')]
 if name=='triune':ops += [line(0,y,47,y,gold) for y in (4,5,11,12)]
 sprite('sprites/filaments/'+name+'.png',48,16,ops)
sigils=['bind','manifold','triune','sunder','wane','mirror','ascend','conjoin','eclipse','confluence','dispersion','void']
for i,name in enumerate(sigils):
 ops=[circ(24,24,20,'#bb9c6860',False),circ(24,24,17,'#bb9c6830',False)]
 n=[2,3,3,2,1,2,3,3,4,4,4,6][i]
 for k in range(n):
  a=k*math.tau/n-math.pi/2;x=24+math.cos(a)*12;y=24+math.sin(a)*12
  ops += [line(24,24,x,y,gold),circ(x,y,3,pale,False)]
 if name in ['bind','triune','manifold']:ops += [circ(24,24,4,pale,False)]
 elif name=='sunder':ops += [line(17,20,29,28,blue),line(19,20,31,28,blue)]
 elif name=='wane':ops += [line(14,29,34,29,blue),line(18,33,30,33,blue)]
 elif name=='mirror':ops += [line(22,13,22,35,blue),line(26,13,26,35,blue)]
 elif name=='ascend':ops += [line(16,24,24,16,blue),line(24,16,32,24,blue)]
 elif name=='conjoin':ops += [circ(24,24,6,blue,False)]
 elif name=='eclipse':ops += [circ(24,24,7,blue),circ(27,22,6,dark)]
 elif name=='confluence':ops += [circ(24,24,5,blue)]
 elif name=='dispersion':ops += [circ(24,24,6,blue,False),circ(24,24,2,pale)]
 elif name=='void':ops += [circ(24,24,9,dark),circ(24,24,8,blue,False),circ(24,24,3,gold,False)]
 sprite('sprites/sigils/'+name+'.png',48,48,ops)
ins=['grab','drop','rotate-cw','rotate-ccw','pivot-cw','pivot-ccw','extend','retract','advance','recede']
for i,name in enumerate(ins):
 if i<2:
  gap=2 if i==0 else 6;ops=[line(5,5,5,19,pale),line(5,5,12-gap,5,pale),line(5,19,12-gap,19,pale),line(19,5,19,19,pale),line(12+gap,5,19,5,pale),line(12+gap,19,19,19,pale),circ(12,12,2,blue)]
 elif i<6:
  ops=[]
  for k in range(15):
   a=(k/15*1.5+.25)*math.pi;ops.append(circ(12+math.cos(a)*7,12+math.sin(a)*7,1,pale))
  x=19 if i%2==0 else 5;ops += [line(x,5,x,11,blue),line(x,5,x-5 if i%2==0 else x+5,5,blue)]
  if i>=4:ops.append(circ(12,12,2,blue))
 else:
  d=1 if i%2==0 else -1;ops=[line(4,12,20,12,pale),line(12+d*8,12,12+d*3,7,pale),line(12+d*8,12,12+d*3,17,pale)]
  if i>=8:ops += [line(4,20,20,20,blue),line(4,3,20,3,blue)]
 sprite('sprites/instructions/'+name+'.png',24,24,ops)
for name,size in [('hub-arm',40),('hub-piston',40),('wheel-hub',48),('fixture-mount',48),('gripper-open',32),('gripper-closed',32)]:
 c=size/2;ops=[]
 if name.startswith('gripper'):
  gap=5 if name.endswith('open') else 1
  ops=[line(c-9,c-9,c+7,c-9,gold),line(c-9,c+9,c+7,c+9,gold),line(c-9,c-9,c-9,c+9,pale),line(c+7,c-9,c+11,c-gap,pale),line(c+7,c+9,c+11,c+gap,pale),circ(c-9,c,3,blue)]
 else:
  ops=[circ(c,c,c-3,'#102332ff'),circ(c,c,c-4,gold,False),circ(c,c,c-7,'#66716aff',False),circ(c,c,8,gold),circ(c,c,5,'#253c49ff'),circ(c,c,2,pale)]
  for k in range(6):
   a=k*math.pi/3;ops.append(circ(c+math.cos(a)*(c-6),c+math.sin(a)*(c-6),1,pale))
  if name=='hub-piston':ops += [line(c-10,c-5,c+10,c-5,blue),line(c-10,c+5,c+10,c+5,blue)]
 sprite('sprites/parts/'+name+'.png',size,size,ops)
for name in ['rise','set']:
 for f in range(6):
  ops=[circ(24,24,21,'#517e8d80' if name=='rise' else '#c9a87080',False),circ(24,24,17,'#688b9250',False)]
  for k in range(3):
   a=(k+f/6)*math.tau/3;x=24+math.cos(a)*18;y=24+math.sin(a)*18;b=a+(.8 if name=='rise' else -.8)
   ops += [line(x,y,24+math.cos(b)*10,24+math.sin(b)*10,blue if name=='rise' else pale),circ(x,y,2,pale)]
  sprite(f'sprites/apertures/{name}/{f}.png',48,48,ops,True)
for i,name in enumerate(['place','erase','start','halt','constellation','complete']):
 path=ROOT/'assets/audio'/f'{name}.wav';path.parent.mkdir(exist_ok=True)
 cfg=TMP/f'{name}.config.json';save(cfg,dict(sample_rate=22050,channels='stereo',max_duration_ms=2500,seed=7,actions=str(TMP/f'{name}.json'),preview=str(TMP/f'{name}.png'),wav=str(path)))
 run('sfx-synth','--config',cfg,'init')
 notes=([740,1110] if i==0 else [480,310] if i==1 else [220,330,440,660] if i==2 else [180,171,125] if i==3 else [660,880,1320] if i==4 else [440,554,660,880,1320])
 for j,freq in enumerate(notes):
  run('sfx-synth','--config',cfg,'add-voice','--name',f'v{j}','--wave','sine','--freq',freq,'--gain','-18','--start',j*(25 if i<2 else 85),'--dur',100 if i<2 else 420)
  run('sfx-synth','--config',cfg,'set-envelope','--voice',f'v{j}','--env','pluck')
 run('sfx-synth','--config',cfg,'render')
cfg=TMP/'music.config.json';save(cfg,dict(sample_rate=22050,channels='stereo',max_duration_ms=34000,seed=13,actions=str(TMP/'music.json'),preview=str(TMP/'music.png'),wav=str(ROOT/'assets/audio/music.wav'),mid=str(ROOT/'assets/audio/music.mid')))
run('music','--config',cfg,'init');run('music','--config',cfg,'set-tempo','--bpm',60)
for track,instrument in [('glass','sine'),('air','triangle')]:
 run('music','--config',cfg,'define-track','--name',track,'--instrument',instrument)
 run('music','--config',cfg,'set-track-fx','--track',track,'--gain','-25','--env','swell')
for i in range(32):
 run('music','--config',cfg,'add-note','--track','glass','--pitch',[62,69,74,76,65,72,77,81][i%8],'--t',i,'--dur',1.8,'--velocity',55)
 if i%4==0:run('music','--config',cfg,'add-note','--track','air','--pitch',[38,41,36,43][i//8],'--t',i,'--dur',3.8,'--velocity',42)
run('music','--config',cfg,'render')
for name,color,count in [('deliver','#9cebdc',35),('fault','#f58c76',50),('complete','#ffe0a0',120)]:
 cfg=TMP/(name+'.particle.json');save(cfg,dict(width=240,height=240,duration_ms=2200,fps=30,seed=19,actions=str(TMP/(name+'.ops.json')),preview=str(TMP/(name+'.gif')),system=str(ROOT/'assets/particles'/f'{name}.json')))
 (ROOT/'assets/particles').mkdir(exist_ok=True)
 run('particle-2d','--config',cfg,'init');run('particle-2d','--config',cfg,'add-emitter','--name','sparks','--shape','point','--x',120,'--y',120,'--burst',count,'--lifetime',1600,'--lifetime-spread',500,'--speed',65,'--speed-spread',30,'--cone-angle',180)
 run('particle-2d','--config',cfg,'set-particle','--emitter','sparks','--size-from',3,'--size-to',0,'--opacity-from',1,'--opacity-to',0,'--color-gradient',color+'@0,#526b90@1')
 run('particle-2d','--config',cfg,'set-timeline','--loop','false');run('particle-2d','--config',cfg,'render')
print('Assets complete')
