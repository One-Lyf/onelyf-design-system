# Woven emblem system: every Lyf emblem is drawn in the crest's grammar -- interlaced bands
# that go over/under alternately, root forks at open ends, flame/seed/leaf fills.
import math
def tint(h,k):
    r,g,b=(int(h[i:i+2],16) for i in (1,3,5)); f=lambda v:round(v+(255-v)*k)
    return '#%02x%02x%02x'%(f(r),f(g),f(b))
def cubic(p0,p1,p2,p3,n=60):
    out=[]
    for i in range(n+1):
        t=i/n; a=(1-t)**3; b=3*(1-t)**2*t; c=3*(1-t)*t*t; d=t**3
        out.append((a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]))
    return out
def line(p,q,n=40): return [(p[0]+(q[0]-p[0])*i/n, p[1]+(q[1]-p[1])*i/n) for i in range(n+1)]
def join(*parts):
    pts=[]
    for p in parts: pts+= p if not pts else p[1:]
    return pts
def param(f,n=400,closed=True):
    pts=[f(i/n) for i in range(n+(0 if closed else 1))]; return pts
class Strand:
    def __init__(s,pts,closed=False,w=1.0,roots=False): s.p=pts; s.closed=closed; s.w=w; s.roots=roots
def seg_x(a,b,c,d):
    den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0])
    if abs(den)<1e-12: return None
    t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den
    u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den
    if 0<=t<1 and 0<=u<1: return t,u
    return None
def segs(s):
    n=len(s.p); m=n if s.closed else n-1
    return [(i,s.p[i],s.p[(i+1)%n]) for i in range(m)]
def crossings(strands):
    X=[]
    for ai,A in enumerate(strands):
        for bi in range(ai,len(strands)):
            B=strands[bi]; SA=segs(A); SB=segs(B)
            for i,a0,a1 in SA:
                for j,b0,b1 in SB:
                    if ai==bi:
                        n=len(A.p)
                        if j<=i+3: continue
                        if A.closed and (i+n-j)<=3: continue
                    r=seg_x(a0,a1,b0,b1)
                    if r: X.append({'a':ai,'ia':i+r[0],'b':bi,'ib':j+r[1],'pt':(a0[0]+(a1[0]-a0[0])*r[0],a0[1]+(a1[1]-a0[1])*r[0])})
    return X
def assign(strands,X,order=None,start_over=True):
    for x in X: x['over']=None   # 'a' or 'b'
    for si in (order or range(len(strands))):
        ev=[]
        for x in X:
            if x['a']==si: ev.append((x['ia'],x,'a'))
            if x['b']==si: ev.append((x['ib'],x,'b'))
        ev.sort(key=lambda e:e[0]); flag=start_over
        for _,x,side in ev:
            if x['over'] is None: x['over']=side if flag else ('b' if side=='a' else 'a')
            flag = not (x['over']==side)
    return X
import re
_LEAD0=re.compile(r'(?<![0-9])0\.')
def _rdp(pts,eps):
    if len(pts)<3: return pts
    (x0,y0),(x1,y1)=pts[0],pts[-1]; dx,dy=x1-x0,y1-y0; L=math.hypot(dx,dy)
    if L<1e-9:   # closed loop (start == end): split at the farthest point, simplify each half
        k=max(range(1,len(pts)-1),key=lambda j:math.dist(pts[0],pts[j]))
        return _rdp(pts[:k+1],eps)[:-1]+_rdp(pts[k:],eps)
    i,dm=0,-1
    for k in range(1,len(pts)-1):
        d=abs(dy*pts[k][0]-dx*pts[k][1]+x1*y0-y1*x0)/L
        if d>dm: i,dm=k,d
    if dm<=eps: return [pts[0],pts[-1]]
    return _rdp(pts[:i+1],eps)[:-1]+_rdp(pts[i:],eps)
def dpath(pts,closed=False,eps=.0015):
    # Unit-space paths: 3 decimals is sub-pixel at any emblem size; RDP drops redundant samples.
    pts=_rdp(list(pts),eps)
    s='M'+' L'.join(_LEAD0.sub('.',f'{x:.3f},{y:.3f}') for x,y in pts); return s+(' Z' if closed else '')
def window(s,idx,half):
    n=len(s.p); i0=int(idx); out=[]; L=0
    # walk back
    j=i0; back=[s.p[j]]
    while L<half:
        k=j-1
        if k<0:
            if not s.closed: break
            k=n-1
        L+=math.dist(s.p[j],s.p[k]); j=k; back.append(s.p[j])
    L=0; j=i0; fwd=[]
    while L<half:
        k=j+1
        if k>=n:
            if not s.closed: break
            k=0
        L+=math.dist(s.p[j],s.p[k]); j=k; fwd.append(s.p[j])
    return list(reversed(back))+fwd
def render(strands,fills,col,W=.085,G=.045,order=None,start_over=True,ink=None):
    e=ink or tint(col,.8); X=assign(strands,crossings(strands),order,start_over); o=[]
    def band(pts,closed,w,cap='round'):
        return (f'<path d="{dpath(pts,closed)}" fill="none" stroke="{col}" stroke-width="{(w*W+2*G):.4f}" stroke-linecap="{cap}" stroke-linejoin="round"/>'
                f'<path d="{dpath(pts,closed)}" fill="none" stroke="{e}" stroke-width="{w*W:.4f}" stroke-linecap="{cap}" stroke-linejoin="round"/>')
    for s in strands:
        o.append(band(s.p,s.closed,s.w))
        if s.roots:
            for end,nb in ((s.p[0],s.p[1]),(s.p[-1],s.p[-2])) if s.roots=='both' else ((s.p[0],s.p[1]),):
                dx,dy=end[0]-nb[0],end[1]-nb[1]; L=math.hypot(dx,dy); dx/=L; dy/=L
                for sgn in (-1,1):
                    a=math.atan2(dy,dx)+sgn*.55; q=(end[0]+math.cos(a)*.12,end[1]+math.sin(a)*.12)
                    mid=(end[0]+dx*.05,end[1]+dy*.05)
                    o.append(f'<path d="M{end[0]:.3f},{end[1]:.3f} Q{mid[0]:.3f},{mid[1]:.3f} {q[0]:.3f},{q[1]:.3f}" fill="none" stroke="{e}" stroke-width="{W*.55:.4f}" stroke-linecap="round"/>')
    for x in X:
        si=x['a'] if x['over']=='a' else x['b']; idx=x['ia'] if x['over']=='a' else x['ib']; s=strands[si]
        hw=(W+2*G)*1.25
        o.append(f'<path d="{dpath(window(s,idx,hw))}" fill="none" stroke="{col}" stroke-width="{(s.w*W+2*G):.4f}" stroke-linecap="butt"/>')
        o.append(f'<path d="{dpath(window(s,idx,hw+.03))}" fill="none" stroke="{e}" stroke-width="{s.w*W:.4f}" stroke-linecap="butt" stroke-linejoin="round"/>')
    for f in fills: o.append(f.replace('INK',e).replace('BG',col))
    return ''.join(o), len(X)
