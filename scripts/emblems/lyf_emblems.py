import math
from weave import *
TAU=2*math.pi
def fin(col):
    A=Strand(param(lambda t:((.44+.06*math.sin(6*TAU*t))*math.sin(TAU*t),-(.44+.06*math.sin(6*TAU*t))*math.cos(TAU*t))),closed=True,w=.8)
    B=Strand(param(lambda t:((.44-.06*math.sin(6*TAU*t))*math.sin(TAU*t),-(.44-.06*math.sin(6*TAU*t))*math.cos(TAU*t))),closed=True,w=.8)
    fills=['<path d="M0,-.01 C.11,.07 .12,.23 0,.27 C-.12,.23 -.11,.07 0,-.01 Z" fill="INK"/>',
           '<path d="M0,.02 L0,-.13" stroke="INK" stroke-width=".05" stroke-linecap="round" fill="none"/>',
           '<path d="M0,-.1 C-.05,-.22 -.17,-.25 -.24,-.2 C-.18,-.1 -.07,-.08 0,-.1 Z" fill="INK"/>',
           '<path d="M0,-.13 C.05,-.25 .17,-.28 .24,-.23 C.18,-.13 .07,-.11 0,-.13 Z" fill="INK"/>',
           '<path d="M0,.06 C.04,.1 .05,.17 0,.2" stroke="BG" stroke-width=".025" fill="none" stroke-linecap="round"/>']
    return render([A,B],fills,col)
def hom(col):
    A=Strand(join(line((-.42,.46),(-.42,.02)),line((-.42,.02),(.24,-.56))),roots=True)
    B=Strand(join(line((.42,.46),(.42,.02)),line((.42,.02),(-.24,-.56))),roots=True)
    C=Strand(line((-.58,.34),(.58,.34)),w=.8)
    fills=['<path d="M0,-.24 C.11,-.1 .22,.04 .14,.19 C.09,.27 -.09,.27 -.14,.19 C-.22,.04 -.11,-.1 0,-.24 Z" fill="INK"/>',
           '<path d="M.01,-.04 C.06,.04 .1,.12 .06,.19 C.03,.23 -.03,.23 -.06,.19 C-.1,.12 -.05,.04 .01,-.04 Z" fill="BG"/>']
    return render([A,C,B],fills,col,order=[0,1,2])
def hlth(col):
    def stem(sign):
        pts=[(sign*.1*math.cos(3*math.pi*u), .56-.58*u) for u in [i/120 for i in range(121)]]
        end=pts[-1]; lobe=join(cubic(end,(sign*-.3,-.1),(sign*-.56,-.3),(sign*-.42,-.5)),cubic((sign*-.42,-.5),(sign*-.3,-.64),(sign*-.06,-.58),(sign*.03,-.36)),cubic((sign*.03,-.36),(sign*.06,-.3),(sign*.1,-.27),(sign*.13,-.26),20))
        return Strand(join(pts,lobe),roots=True)
    A=stem(-1); B=stem(1)
    # stem(-1) starts at x=-.1 and lobes to the LEFT? sign*-.3 with sign=-1 -> +.3; flip mapping so A's lobe is left
    fills=[]
    return render([A,B],fills,col)
def gud(col):
    K=Strand(param(lambda t:((.34+.21*math.cos(5*t*2*TAU/2))*math.sin(2*TAU*t),-(.34+.21*math.cos(5*t*2*TAU/2))*math.cos(2*TAU*t)),n=600),closed=True,w=.85)
    fills=['<path d="M0,-.13 Q.02,-.02 .13,0 Q.02,.02 0,.13 Q-.02,.02 -.13,0 Q-.02,-.02 0,-.13 Z" fill="INK"/>']
    return render([K],fills,col)
def wrk(col):
    V=[Strand(line((x,-.5),(x,.5)),w=1.3) for x in (-.3,0,.3)]
    H=[Strand(line((-.5,y),(.5,y)),w=1.3) for y in (-.3,0,.3)]
    S=V+H  # indices 0..2 vertical, 3..5 horizontal
    fills=[]
    return render(S,fills,col,order=[0,3,4,5,1,2],G=.04)
def skl(col):
    L=Strand(join(cubic((-.58,-.02),(-.38,-.1),(-.16,-.08),(-.03,.04)),line((-.03,.04),(-.03,.44)),cubic((-.03,.44),(-.16,.34),(-.38,.34),(-.58,.38)),line((-.58,.38),(-.58,-.02))),closed=True,w=.8)
    R=Strand(join(cubic((.58,-.02),(.38,-.1),(.16,-.08),(.03,.04)),line((.03,.04),(.03,.44)),cubic((.03,.44),(.16,.34),(.38,.34),(.58,.38)),line((.58,.38),(.58,-.02))),closed=True,w=.8)
    rib=Strand(join(line((.12,.02),(.12,.34)),line((.12,.34),(.2,.58))),w=.6)
    fills=['<path d="M0,-.58 C.07,-.46 .15,-.38 .12,-.26 C.1,-.18 .05,-.14 0,-.14 C-.05,-.14 -.1,-.18 -.12,-.26 C-.15,-.38 -.07,-.46 0,-.58 Z" fill="INK"/>',
           '<path d="M0,-.38 C.03,-.32 .06,-.27 .04,-.22 C.03,-.19 -.03,-.19 -.04,-.22 C-.06,-.27 -.03,-.32 0,-.38 Z" fill="BG"/>',
           '<path d="M-.48,.1 C-.34,.06 -.2,.08 -.12,.13 M-.48,.21 C-.34,.17 -.2,.19 -.12,.24 M.48,.1 C.34,.06 .24,.08 .2,.1 M.48,.21 C.34,.17 .26,.19 .2,.21" stroke="INK" stroke-width=".03" fill="none" stroke-linecap="round" stroke-opacity=".8"/>']
    return render([L,R,rib],fills,col,order=[2,0,1])
def fam(col):
    C1=Strand(param(lambda t:(-.19+.3*math.cos(TAU*t),-.1+.3*math.sin(TAU*t))),closed=True,w=.8)
    C2=Strand(param(lambda t:(.19+.3*math.cos(TAU*t),-.1+.3*math.sin(TAU*t))),closed=True,w=.8)
    C3=Strand(param(lambda t:(.23*math.cos(TAU*t),.2+.23*math.sin(TAU*t))),closed=True,w=.8)
    return render([C1,C2,C3],[],col)
BRANCH=[('FinLyf','Seed torc',fin,'#c08a14'),('HomLyf','Crossed-gable hearth',hom,'#bf6b49'),('HlthLyf','Twined heart-leaf',hlth,'#6f9270'),
        ('GudLyf','Star knot',gud,'#5d648f'),('WrkLyf','Loom weave',wrk,'#b36c42'),('SkoolLyf','Lamp & book',skl,'#6f8090'),('Family','Kin rings',fam,'#8d6b52')]
def disc_svg(fn,col,size,outline='#1c2b21'):
    c=size/2; r=size*.46; body,_=fn(col)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}"><circle cx="{c}" cy="{c}" r="{r}" fill="{col}" stroke="{outline}" stroke-width="{size*.03:.1f}"/>'
            f'<g transform="translate({c} {c}) scale({r:.3f})">{body}</g></svg>')
