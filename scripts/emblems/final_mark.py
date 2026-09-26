# OneLyf mark: live Liv glyph at the centre, the seven branch emblems as nodes, joined by a
# mycelium network of tapered hyphae (centre->node, node<->node, faint chords, side branchlets).
import math, random, base64
from set_patch import SET2, disc_svg
def bez(p0,p1,p2,p3,t):
    a=(1-t)**3; b=3*(1-t)**2*t; c=3*(1-t)*t*t; d=t**3
    return (a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1])
def tapered(p0,p1,p2,p3,w0,w1,col,op,n=16,wmid=None):
    pts=[bez(p0,p1,p2,p3,i/n) for i in range(n+1)]; o=[]
    for i in range(n):
        t=(i+.5)/n
        w=w0+(w1-w0)*t if wmid is None else (w0+(wmid-w0)*(t/.5) if t<.5 else wmid+(w1-wmid)*((t-.5)/.5))
        o.append(f'<path d="M{pts[i][0]:.1f} {pts[i][1]:.1f}L{pts[i+1][0]:.1f} {pts[i+1][1]:.1f}" stroke-width="{w:.1f}"/>')
    return f'<g stroke="{col}" stroke-opacity="{op}" stroke-linecap="round" fill="none">'+''.join(o)+'</g>', pts
def perp(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy); return (-dy/L,dx/L),L
def branchlets(pts,rng,col,op,scale,count=2,wbase=1.4):
    o=[];dots=[]
    for _ in range(count):
        i=rng.randint(int(len(pts)*.25),int(len(pts)*.75)); p=pts[i]; q=pts[min(i+1,len(pts)-1)]
        (nx,ny),_=perp(p,q); side=rng.choice((-1,1)); L=scale*rng.uniform(.10,.2)
        dx,dy=q[0]-p[0],q[1]-p[1]; dl=math.hypot(dx,dy) or 1; dx/=dl; dy/=dl
        ang=math.atan2(dy,dx)+side*rng.uniform(.5,1.0)
        e=(p[0]+math.cos(ang)*L,p[1]+math.sin(ang)*L)
        c1=(p[0]+math.cos(ang-side*.3)*L*.4,p[1]+math.sin(ang-side*.3)*L*.4); c2=(e[0]-math.cos(ang+side*.4)*L*.3,e[1]-math.sin(ang+side*.4)*L*.3)
        g,bp=tapered(p,c1,c2,e,wbase,.35,col,op,n=14); o.append(g); dots.append(p)
        if rng.random()<.6:
            j=int(len(bp)*.6); f=bp[j]; a2=ang-side*rng.uniform(.6,1.0); L2=L*.45
            e2=(f[0]+math.cos(a2)*L2,f[1]+math.sin(a2)*L2)
            g2,_=tapered(f,(f[0]+math.cos(a2)*L2*.4,f[1]+math.sin(a2)*L2*.4),e2,e2,wbase*.6,.3,col,op,n=8); o.append(g2)
    return ''.join(o),dots
def hyphae(size,c,pts,r,col,seed=7):
    rng=random.Random(seed); o=[]; dots=[]; R=math.dist((c,c),pts[0]); s=size/512
    for (x,y) in pts:                                   # Liv -> each branch
        (nx,ny),L=perp((c,c),(x,y)); ux,uy=(x-c)/L,(y-c)/L
        a=(c+ux*size*.06,c+uy*size*.06); b=(x-ux*r*1.02,y-uy*r*1.02)
        k=rng.uniform(.07,.13)*R*rng.choice((-1,1))
        g,p=tapered(a,(a[0]+(b[0]-a[0])*.33+nx*k,a[1]+(b[1]-a[1])*.33+ny*k),(a[0]+(b[0]-a[0])*.66-nx*k*.8,a[1]+(b[1]-a[1])*.66-ny*k*.8),b,3.4*s,1.5*s,col,.85)
        o.append(g); bo,bd=branchlets(p,rng,col,.7,R,count=2,wbase=1.5*s); o.append(bo); dots+=bd
    n=len(pts)
    for i in range(n):                                  # neighbour links around the ring
        A,B=pts[i],pts[(i+1)%n]; (nx,ny),L=perp(A,B); ux,uy=(B[0]-A[0])/L,(B[1]-A[1])/L
        mx,my=(A[0]+B[0])/2,(A[1]+B[1])/2; tc=((c-mx),(c-my)); tl=math.hypot(*tc); inward=(tc[0]/tl,tc[1]/tl)
        a=(A[0]+ux*r*1.02,A[1]+uy*r*1.02); b=(B[0]-ux*r*1.02,B[1]-uy*r*1.02); k=rng.uniform(.05,.1)*R
        c1=(a[0]+(b[0]-a[0])*.3+inward[0]*k,a[1]+(b[1]-a[1])*.3+inward[1]*k); c2=(a[0]+(b[0]-a[0])*.7+inward[0]*k*1.4,a[1]+(b[1]-a[1])*.7+inward[1]*k*1.4)
        g,p=tapered(a,c1,c2,b,2.2*s,2.2*s,col,.7,wmid=1.0*s); o.append(g); bo,bd=branchlets(p,rng,col,.55,R*.8,count=1,wbase=1.1*s); o.append(bo); dots+=bd
    for i in range(n):                                  # faint skip-one chords (the wider web)
        A,B=pts[i],pts[(i+2)%n]; (nx,ny),L=perp(A,B); ux,uy=(B[0]-A[0])/L,(B[1]-A[1])/L
        a=(A[0]+ux*r*1.05,A[1]+uy*r*1.05); b=(B[0]-ux*r*1.05,B[1]-uy*r*1.05); k=rng.uniform(-.08,.08)*R
        g,_=tapered(a,(a[0]+(b[0]-a[0])*.35+nx*k,a[1]+(b[1]-a[1])*.35+ny*k),(a[0]+(b[0]-a[0])*.65+nx*k,a[1]+(b[1]-a[1])*.65+ny*k),b,1.0*s,1.0*s,col,.28,wmid=.5*s)
        o.append(g)
    o.append(''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{1.7*s:.2f}" fill="{col}" fill-opacity=".85"/>' for x,y in dots))
    return ''.join(o)
def uri(s): return 'data:image/svg+xml;base64,'+base64.b64encode(s.encode()).decode()
def mark(size,bg,outline,glyph,hy,with_bg=True,S=SET2):
    c=size/2; R=size*.34; r=size*.1; gh=size*.43; gw=gh*549/748; gx=c-gw*274/549; gy=c-gh*443/748
    pts=[(c+R*math.sin(2*math.pi*i/7), c-R*math.cos(2*math.pi*i/7)) for i in range(7)]
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">']
    if with_bg: s.append(f'<rect width="{size}" height="{size}" fill="{bg}"/>')
    s.append(hyphae(size,c,pts,r,hy))
    s.append(f'<image href="{uri(glyph)}" x="{gx:.1f}" y="{gy:.1f}" width="{gw:.1f}" height="{gh:.1f}"/>')
    for (x,y),(name,title,fn,col) in zip(pts,S):
        body,_=fn(col)
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" stroke="{outline}" stroke-width="{size*.007:.2f}"/>')
        s.append(f'<g transform="translate({x:.1f} {y:.1f}) scale({r*.98:.2f})">{body}</g>')
    s.append('</svg>'); return ''.join(s)
