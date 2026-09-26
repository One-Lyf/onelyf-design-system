import math, importlib
import weave, patchweave
weave.render=patchweave.render            # every emblem module below now renders as patch-work
import lyf_emblems, lyf_emblems2
importlib.reload(lyf_emblems); importlib.reload(lyf_emblems2)
from patchweave import render, Strand, cubic, line, join
from lyf_emblems2 import rrect, dollar
def wrk_tools(col):
    d=(.674,-.739); p=(.739,.674)
    hh=Strand(line((-.42,.48),(.25,-.25)),w=1.1)
    wh=Strand(line((.42,.48),(-.23,-.23)),w=1.1)
    hc=(.2,-.2); head=Strand(line((hc[0]-p[0]*.24,hc[1]-p[1]*.24),(hc[0]+p[0]*.2,hc[1]+p[1]*.2)),w=2.1)
    wd=(-.674,-.739); th=math.atan2(wd[1],wd[0]); jc=(-.2+wd[0]*.1,-.2+wd[1]*.1); R=.17
    arc=[(jc[0]+R*math.cos(th+math.radians(a)),jc[1]+R*math.sin(th+math.radians(a))) for a in range(55,306,5)]
    jaw=Strand(arc,w=1.1)
    return render([hh,wh,head,jaw],[],col,order=[0,1,2,3])
def wrk_case(col):
    case=Strand(rrect(0,.16,1.04,.64,.1),closed=True,w=1.0)
    handle=Strand(join(line((-.2,.02),(-.2,-.24)),cubic((-.2,-.24),(-.2,-.36),(-.14,-.38),(0,-.38)),cubic((0,-.38),(.14,-.38),(.2,-.36),(.2,-.24)),line((.2,-.24),(.2,.02))),w=.9)
    strap=Strand(line((-.62,.12),(.62,.12)),w=.8)
    clasp='<rect x="-.07" y=".05" width=".14" height=".14" rx=".02" fill="INK"/>'
    return render([case,handle,strap],[clasp],col,order=[1,0,2])
def gud_kite(col):
    frame=Strand(join(line((0,-.62),(.38,-.16)),line((.38,-.16),(0,.3)),line((0,.3),(-.38,-.16)),line((-.38,-.16),(0,-.62))),closed=True,w=1.0)
    v=Strand(line((0,-.5),(0,.2)),w=.7); h=Strand(line((-.28,-.16),(.28,-.16)),w=.7)
    tail=Strand(join(cubic((0,.3),(-.14,.4),(.14,.46),(.02,.56))),w=.7)
    bow='<path d="M-.09,.39 L.09,.47 L.09,.39 L-.09,.47 Z" fill="INK"/>'
    return render([frame,v,h,tail],[],col,order=[1,2,0,3])
SET=[('FinLyf','Coin pouch',lyf_emblems2.fin_pouch,'#c08a14'),('HomLyf','Crossed-gable hearth',lyf_emblems.hom,'#bf6b49'),
     ('HlthLyf','Twined heart-leaf',lyf_emblems.hlth,'#6f9270'),('GudLyf','Kite',gud_kite,'#5d648f'),
     ('WrkLyf','Crossed tools',wrk_tools,'#b36c42'),('SkoolLyf','Lamp & book',lyf_emblems.skl,'#6f8090'),('Family','Kin rings',lyf_emblems.fam,'#8d6b52')]
ALT=[('WrkLyf','Alt: Briefcase',wrk_case,'#b36c42')]
def disc_svg(fn,col,size,outline='#1c2b21'):
    c=size/2; r=size*.46; body,_=fn(col)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}"><circle cx="{c}" cy="{c}" r="{r}" fill="{col}" stroke="{outline}" stroke-width="{size*.03:.1f}"/>'
            f'<g transform="translate({c} {c}) scale({r:.3f})">{body}</g></svg>')

def wrk_toolbox(col):
    body=Strand(join(line((-.42,-.1),(.42,-.1)),line((.42,-.1),(.56,.04)),line((.56,.04),(.56,.46)),line((.56,.46),(-.56,.46)),line((-.56,.46),(-.56,.04)),line((-.56,.04),(-.42,-.1))),closed=True,w=1.0)
    seam=Strand(line((-.66,.12),(.66,.12)),w=.8)
    handle=Strand(join(line((-.26,-.13),(-.26,-.3)),cubic((-.26,-.3),(-.26,-.4),(-.2,-.42),(-.14,-.42)),line((-.14,-.42),(.14,-.42)),cubic((.14,-.42),(.2,-.42),(.26,-.4),(.26,-.3)),line((.26,-.3),(.26,-.13))),w=.9)
    latches='<rect x="-.31" y=".04" width=".12" height=".16" rx=".03" style="fill:INK"/><rect x=".19" y=".04" width=".12" height=".16" rx=".03" style="fill:INK"/>'
    return render([body,seam,handle],[latches],col,order=[2,0,1])
def waves_braid(col):
    f=lambda sg:(lambda t:(-.62+1.24*t, sg*.2*math.sin(2*math.pi*1.5*t)*(1-.35*abs(2*t-1))))
    A=Strand([f(1)(i/200) for i in range(201)],w=.9); B=Strand([f(-1)(i/200) for i in range(201)],w=.9)
    C=Strand(line((-.5,.42),(.5,.42)),w=.6)
    return render([A,B],[],col)
def waves_curl(col):
    th=[i/160 for i in range(161)]
    curl=[(-.08+ (.34-.26*t)*math.cos(math.pi*.1+2.6*math.pi*t)*1.0, -.02+(.34-.26*t)*math.sin(math.pi*.1+2.6*math.pi*t)*-1.0) for t in th]
    crest=Strand(join(cubic((-.62,.26),(-.4,.26),(-.3,.1),(-.3,-.06)),cubic((-.3,-.06),(-.3,-.3),(-.06,-.44),(.14,-.4)),cubic((.14,-.4),(.36,-.36),(.44,-.16),(.34,-.02)),cubic((.34,-.02),(.26,.08),(.1,.06),(.08,-.06)),cubic((.08,-.06),(.06,-.16),(.16,-.2),(.22,-.14))),w=.9)
    sea=Strand(cubic((-.62,.4),(-.2,.3),(.2,.52),(.62,.34)),w=.8)
    under=Strand(cubic((-.46,.02),(-.2,.5),(.3,.46),(.6,.12)),w=.8)
    return render([crest,under,sea],[],col)
WAVES='#2f7fa8'
SET2=[('FinLyf','Coin pouch',lyf_emblems2.fin_pouch,'#c08a14'),('HomLyf','Crossed-gable hearth',lyf_emblems.hom,'#bf6b49'),
      ('HlthLyf','Twined heart-leaf',lyf_emblems.hlth,'#6f9270'),('GudLyf','Kite',gud_kite,'#5d648f'),
      ('WrkLyf','Toolbox',wrk_toolbox,'#b36c42'),('SkoolLyf','Lamp & book',lyf_emblems.skl,'#6f8090'),('Waves','Braided waveform',waves_braid,WAVES)]
ALT2=[('Waves','Alt: Curling wave',waves_curl,WAVES)]
