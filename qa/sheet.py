import sys,json
from PIL import Image, ImageDraw
name,t0,t1,step=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4]); FPS=149/6
ev=json.load(open(f'ev_{name}.json')) if len(sys.argv)>5 else []
ts=[]; t=t0
while t<t1: ts.append(t); t+=step
cols=8; rows=(len(ts)+cols-1)//cols; W=Image.new('RGB',(cols*200,rows*225))
fr=json.load(open(f'fr_{name}.json'))
conn=[(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28)]
for k,t in enumerate(ts):
    i=int(t*FPS); im=Image.open(f'fr_{name}/{i+1:04d}.jpg').convert('RGB'); d=ImageDraw.Draw(im); f=fr[i] if i<len(fr) else None
    if f:
        P=[(q[0]*640,q[1]*360) for q in f['img']]
        for a,b in conn: d.line([P[a],P[b]],fill=(0,255,0),width=2)
    im=im.crop((120,0,520,360)).resize((200,180)); d=ImageDraw.Draw(im); d.rectangle([0,0,44,12],fill=(0,0,0)); d.text((2,0),f'{t:.1f}',fill=(255,255,0))
    for e in ev:
        if abs(e[0]-t)<step/2: d.text((2,166),e[1][:5]+e[2],fill=(255,80,80))
    W.paste(im,((k%cols)*200,(k//cols)*225))
W.save(f'sh_{name}_{t0}.png')
