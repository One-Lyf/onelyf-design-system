import math
from weave import *
TAU=2*math.pi
def rot(pts,deg,cx=0,cy=0):
    a=math.radians(deg); c,s=math.cos(a),math.sin(a)
    return [(cx+(x-cx)*c-(y-cy)*s, cy+(x-cx)*s+(y-cy)*c) for x,y in pts]
def rrect(cx,cy,w,h,rad,n=12):
    pts=[]
    for (qx,qy,a0) in [(w/2-rad,-h/2+rad,-90),(w/2-rad,h/2-rad,0),(-w/2+rad,h/2-rad,90),(-w/2+rad,-h/2+rad,180)]:
        for i in range(n+1):
            a=math.radians(a0+90*i/n); pts.append((cx+qx+rad*math.cos(a),cy+qy+rad*math.sin(a)))
    return pts
def poly(pts): return 'M'+' L'.join(f'{x:.3f},{y:.3f}' for x,y in pts)+' Z'
DOLLAR='<path d="M.1,{y0} C.05,{y1} -.12,{y1} -.11,{y2} C-.1,{y3} .11,{y4} .11,{y5} C.11,{y6} -.07,{y6} -.12,{y7}" stroke="{c}" stroke-width=".055" fill="none" stroke-linecap="round"/><path d="M0,{t} L0,{b}" stroke="{c}" stroke-width=".055" stroke-linecap="round"/>'
def dollar(cy,c,s=1,cx=0):
    f=lambda v:f'{cy+v*s:.3f}'
    return f'<g transform="translate({cx} 0)">'+DOLLAR.format(y0=f(-.12),y1=f(-.17),y2=f(-.06),y3=f(.01),y4=f(-.02),y5=f(.07),y6=f(.17),y7=f(.12),t=f(-.22),b=f(.22),c=c).replace('M.1,',f'M{.1*s:.3f},').replace('.11,',f'{.11*s:.3f},')+'</g>'
# ---- FinLyf ----
def fin_pouch(col):
    body=Strand(join(cubic((-.13,-.2),(-.4,-.08),(-.52,.16),(-.46,.34)),cubic((-.46,.34),(-.4,.52),(-.18,.56),(0,.56)),cubic((0,.56),(.18,.56),(.4,.52),(.46,.34)),cubic((.46,.34),(.52,.16),(.4,-.08),(.13,-.2))),w=.9)
    ruff=Strand(join(cubic((-.13,-.2),(-.32,-.32),(-.28,-.52),(-.12,-.45)),cubic((-.12,-.45),(-.05,-.52),(.05,-.52),(.12,-.45)),cubic((.12,-.45),(.28,-.52),(.32,-.32),(.13,-.2))),w=.9)
    tie=Strand(join(cubic((-.3,-.3),(-.1,-.16),(.1,-.16),(.3,-.3))),w=.75)
    tail1=Strand(cubic((.02,-.2),(.14,-.12),(.2,-.04),(.3,.02)),w=.6)
    return render([body,ruff,tie,tail1],[dollar(.26,'INK',1.1)],col,order=[2,0,1,3])
def fin_stack(col):
    fills=[]
    for y in (.44,.3,.16,.02):
        fills.append(f'<path d="M-.14,{y-.06:.2f} L-.14,{y+.02:.2f} A.34,.1 0 0 0 .54,{y+.02:.2f} L.54,{y-.06:.2f} Z" fill="INK"/>')
        fills.append(f'<ellipse cx=".2" cy="{y-.06:.2f}" rx=".34" ry=".1" fill="INK" stroke="BG" stroke-width=".035"/>')
    fills.append('<circle cx="-.2" cy="-.22" r=".3" fill="INK" stroke="BG" stroke-width=".045"/><circle cx="-.2" cy="-.22" r=".23" fill="none" stroke="BG" stroke-width=".028"/>'+dollar(-.22,'BG',.85,-.2))
    return render([],fills,col)
def fin_env(col):
    env=Strand(rrect(0,.16,1.0,.6,.06),closed=True,w=.9)
    flap=Strand(join(line((-.5,-.12),(0,.22)),line((0,.22),(.5,-.12))),w=.8)
    bl=Strand(line((-.48,.44),(-.08,.12)),w=.7); br=Strand(line((.48,.44),(.08,.12)),w=.7)
    coin=f'<circle cx="0" cy="-.26" r=".25" fill="INK"/><circle cx="0" cy="-.26" r=".19" fill="none" stroke="BG" stroke-width=".03"/>'+dollar(-.26,'BG',.72)
    body,n=render([env,flap,bl,br],[],col,order=[1,2,3,0])
    return body+coin.replace('INK',tint(col,.8)).replace('BG',col),n
# ---- GudLyf ----
def gud_kite(col):
    frame=Strand(join(line((0,-.62),(.3,-.24)),line((.3,-.24),(0,.16)),line((0,.16),(-.3,-.24)),line((-.3,-.24),(0,-.62))),closed=True,w=.9)
    v=Strand(line((0,-.52),(0,.07)),w=.6); h=Strand(line((-.21,-.24),(.21,-.24)),w=.6)
    tail=Strand(join(cubic((0,.16),(-.14,.26),(.14,.32),(0,.42)),cubic((0,.42),(-.14,.52),(.1,.58),(.04,.64))),w=.6)
    bows=''.join(f'<path d="M{x-.08:.3f},{y-.05:.3f} L{x+.08:.3f},{y+.05:.3f} L{x+.08:.3f},{y-.05:.3f} L{x-.08:.3f},{y+.05:.3f} Z" fill="INK"/>' for x,y in [(0,.29),(0,.51)])
    return render([frame,v,h,tail],[bows],col,order=[1,2,0,3])
def gud_dice(col):
    d1=Strand(rot(rrect(-.14,-.1,.56,.56,.1),-16,-.14,-.1),closed=True,w=.9)
    d2=Strand(rot(rrect(.16,.16,.5,.5,.09),14,.16,.16),closed=True,w=.9)
    p2=''.join(f'<circle cx="{x:.3f}" cy="{y:.3f}" r=".052" fill="INK"/>' for x,y in rot([(.04,.04),(.16,.16),(.28,.28)],14,.16,.16))
    p1=''.join(f'<circle cx="{x:.3f}" cy="{y:.3f}" r=".055" fill="INK"/>' for x,y in rot([(-.28,-.24),(-.0,-.24),(-.28,.04)],-16,-.14,-.1))
    return render([d1,d2],[p1,p2],col)
def gud_meeple(col):
    m='<circle cx="0" cy="-.36" r=".16" fill="INK"/><path d="M-.1,-.2 C-.22,-.18 -.46,-.14 -.5,-.04 C-.52,.05 -.36,.07 -.26,.07 L-.34,.44 Q-.34,.5 -.28,.5 L-.08,.5 Q-.04,.5 -.02,.44 L0,.32 L.02,.44 Q.04,.5 .08,.5 L.28,.5 Q.34,.5 .34,.44 L.26,.07 C.36,.07 .52,.05 .5,-.04 C.46,-.14 .22,-.18 .1,-.2 Z" fill="INK"/>'
    return render([],[m],col)
# ---- WrkLyf ----
def wrk_skep(col):
    rows=[(.36,.52),(.17,.47),(-.02,.39),(-.2,.28),(-.35,.14)]
    S=[Strand(rrect(0,y,w*2,.19,.09),closed=True,w=.75) for y,w in rows]
    door='<path d="M-.13,.46 L-.13,.34 A.13,.13 0 0 1 .13,.34 L.13,.46 Z" fill="#1c2b21" fill-opacity=".55"/>'
    bee='<ellipse cx=".38" cy="-.42" rx=".08" ry=".05" fill="INK"/><ellipse cx=".34" cy="-.5" rx=".05" ry=".035" fill="INK" fill-opacity=".7"/><ellipse cx=".42" cy="-.5" rx=".05" ry=".035" fill="INK" fill-opacity=".7"/>'
    b,n=render(S,[],col)
    return b+door+bee.replace('INK',tint(col,.8)),n
def wrk_tools(col):
    hh=Strand(line((-.4,.46),(.2,-.22)),w=1.1); wh=Strand(line((.4,.46),(-.2,-.2)),w=1.1)
    head=poly(rot([(.02,-.42),(.44,-.42),(.44,-.24),(.02,-.24)],41.5,.22,-.26))
    dx,dy=-.6,-.66; L=math.hypot(dx,dy); ang=math.degrees(math.atan2(dy,dx))
    cx,cy=-.2+dx/L*.1,-.2+dy/L*.1
    wr=f'<g transform="translate({cx:.3f} {cy:.3f}) rotate({ang:.1f})"><circle r=".2" fill="INK"/><rect x="0" y="-.075" width=".26" height=".15" fill="BG"/></g>'
    return render([hh,wh],[f'<path d="{head}" fill="INK"/>',wr],col)
def wrk_anvil(col):
    anvil='<path d="M-.5,-.1 L.34,-.1 Q.5,-.1 .54,-.18 L.54,-.02 Q.5,.08 .3,.1 L.18,.1 Q.12,.2 .22,.3 L.3,.3 L.3,.42 L-.3,.42 L-.3,.3 L-.22,.3 Q-.12,.2 -.18,.1 L-.3,.1 Q-.48,.04 -.5,-.1 Z" fill="INK"/>'
    spark='<path d="M0,-.58 Q.03,-.4 .18,-.36 Q.03,-.32 0,-.16 Q-.03,-.32 -.18,-.36 Q-.03,-.4 0,-.58 Z" fill="INK"/><circle cx="-.3" cy="-.3" r=".035" fill="INK"/><circle cx=".3" cy="-.24" r=".03" fill="INK"/>'
    return render([],[anvil,spark],col)
SETS=[('FinLyf','#c08a14',[('A · Coin pouch',fin_pouch),('B · Coin stack',fin_stack),('C · Stash envelope',fin_env)]),
      ('GudLyf','#5d648f',[('A · Kite',gud_kite),('B · Linked dice',gud_dice),('C · Game-night meeple',gud_meeple)]),
      ('WrkLyf','#b36c42',[('A · Woven skep hive',wrk_skep),('B · Crossed tools',wrk_tools),('C · Anvil & spark',wrk_anvil)])]
def disc_svg(fn,col,size,outline='#1c2b21'):
    c=size/2; r=size*.46; body,_=fn(col)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}"><circle cx="{c}" cy="{c}" r="{r}" fill="{col}" stroke="{outline}" stroke-width="{size*.03:.1f}"/>'
            f'<g transform="translate({c} {c}) scale({r:.3f})">{body}</g></svg>')
