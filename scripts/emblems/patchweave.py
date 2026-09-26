# Woven bands rendered as EMBROIDERED PATCH work: each band = dark edge thread + satin stitches
# (a dash pattern across the band = stitches perpendicular to the path), crossings keep the
# over/under weave, fills get a satin pattern + running-stitch outline, and the disc gets a
# stitched border and a faint twill ground.
import math, itertools
import weave
from weave import tint, Strand, cubic, line, join, param, crossings, assign, dpath, window
_n=itertools.count()
def shade(h,k):
    r,g,b=(int(h[i:i+2],16) for i in (1,3,5)); return '#%02x%02x%02x'%(round(r*k),round(g*k),round(b*k))
def render(strands,fills,col,W=.095,G=.04,order=None,start_over=True,border=True):
    k=next(_n); thread=tint(col,.84); under=tint(col,.55); edge=shade(col,.5)
    X=assign(strands,crossings(strands),order,start_over); o=[]
    o.append(f'<defs><pattern id="sat{k}" patternUnits="userSpaceOnUse" width=".026" height=".026" patternTransform="rotate(35)"><rect width=".026" height=".026" fill="{under}"/><rect width=".017" height=".026" fill="{thread}"/></pattern>'
             f'<pattern id="tw{k}" patternUnits="userSpaceOnUse" width=".05" height=".05" patternTransform="rotate(-45)"><rect width=".05" height=".05" fill="none"/><rect width=".012" height=".05" fill="#000" fill-opacity=".07"/></pattern></defs>')
    if border:
        o.append(f'<circle r=".99" fill="url(#tw{k})"/>')
        o.append(f'<circle r=".86" fill="none" stroke="{tint(col,.72)}" stroke-width=".03" stroke-dasharray=".06 .035" stroke-linecap="round"/>')
    def band(pts,closed,w,cap='round',halo=True,ext=0):
        d=dpath(pts,closed); bw=w*W
        s=''
        if halo: s+=f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{bw+2*G:.4f}" stroke-linecap="{cap}" stroke-linejoin="round"/>'
        s+=(f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="{bw+.026:.4f}" stroke-linecap="{cap}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{under}" stroke-width="{bw:.4f}" stroke-linecap="{cap}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{thread}" stroke-width="{bw:.4f}" stroke-dasharray=".016 .008" stroke-linecap="butt" stroke-linejoin="round"/>')
        return s
    for s_ in strands:
        o.append(band(s_.p,s_.closed,s_.w))
        if s_.roots:
            for end,nb in ((s_.p[0],s_.p[1]),(s_.p[-1],s_.p[-2])) if s_.roots=='both' else ((s_.p[0],s_.p[1]),):
                dx,dy=end[0]-nb[0],end[1]-nb[1]; L=math.hypot(dx,dy); dx/=L; dy/=L
                for sgn in (-1,1):
                    a=math.atan2(dy,dx)+sgn*.55; q=(end[0]+math.cos(a)*.12,end[1]+math.sin(a)*.12); mid=(end[0]+dx*.05,end[1]+dy*.05)
                    o.append(f'<path d="M{end[0]:.3f},{end[1]:.3f} Q{mid[0]:.3f},{mid[1]:.3f} {q[0]:.3f},{q[1]:.3f}" fill="none" stroke="{thread}" stroke-width="{W*.55:.4f}" stroke-linecap="round"/>')
    for x in X:
        si=x['a'] if x['over']=='a' else x['b']; idx=x['ia'] if x['over']=='a' else x['ib']; s_=strands[si]
        hw=(W+2*G)*1.25
        o.append(f'<path d="{dpath(window(s_,idx,hw))}" fill="none" stroke="{col}" stroke-width="{(s_.w*W+2*G):.4f}" stroke-linecap="butt"/>')
        o.append(band(window(s_,idx,hw+.03),False,s_.w,cap='butt',halo=False))
    for f in fills:
        f=f.replace('fill="INK"',f'fill="url(#sat{k})" stroke="{edge}" stroke-width=".022" stroke-dasharray=".035 .02"')
        o.append(f.replace('INK',thread).replace('BG',col))
    return ''.join(o), len(X)
