import sys,json,numpy as np
from PIL import Image
FPS=149/6
def energy(name):
    fr=json.load(open(f'fr_{name}.json')); n=len(fr); prev=None; out=[]
    for i in range(n):
        im=np.asarray(Image.open(f'fr_{name}/{i+1:04d}.jpg').convert('L').resize((160,90)),dtype=np.float32)
        f=fr[i]
        if prev is None or f is None: prev=im; out.append((i/FPS,0,0,0)); continue
        d=np.abs(im-prev); prev=im
        P=f['img']; shx=(P[11][0]+P[12][0])/2*160; shy=(P[11][1]+P[12][1])/2*90; hy=(P[23][1]+P[24][1])/2*90; sw=abs(P[11][0]-P[12][0])*160+1
        T=max(8,hy-shy)
        x0=int(max(0,shx-1.9*sw)); x1=int(min(160,shx+1.9*sw)); y0=int(max(0,shy-0.9*T)); y1=int(min(90,hy+0.2*T))
        roi=d[y0:y1,x0:x1]; roi=roi*(roi>12)
        # side bands (arms out) vs centre
        cx0=int(shx-0.6*sw); cx1=int(shx+0.6*sw)
        tot=roi.sum()/ (sw*T)
        side=(d[y0:y1,x0:max(x0,cx0)].sum()+d[y0:y1,min(x1,cx1):x1].sum())/(sw*T)
        lr=d[int(hy):min(90,int(hy+1.2*T)),x0:x1]; low=(lr*(lr>12)).sum()/(sw*T)
        out.append((i/FPS,float(tot),float(side),float(low)))
    return out
if __name__=='__main__':
    name=sys.argv[1]; a,b=float(sys.argv[2]),float(sys.argv[3])
    e=energy(name); json.dump(e,open(f'en_{name}.json','w'))
    arr=np.array(e); m=(arr[:,0]>=a)&(arr[:,0]<=b)
    print(name,'tot mean %.2f p90 %.2f max %.2f | low mean %.2f max %.2f'%(arr[m,1].mean(),np.percentile(arr[m,1],90),arr[m,1].max(),arr[m,3].mean(),arr[m,3].max()))
