# Writes the WOVEN cut of the OneLyf mark into src/assets/ (woven_mark.py, lockup.py):
#   python3 scripts/emblems/build.py
# then rasterise with export_png.mjs. The branch emblems (src/assets/emblems/*.svg) and the flat
# marks (src/assets/onelyf-{mark-light,mark-dark,app-icon}.svg) are PERSISTENT assets, saved as
# shipped (owner, 2026-09-26): this script never rewrites them. set_patch.py / final_mark.py stay
# as the record of how they were drawn; to change one, edit the SVG itself or regenerate it on
# purpose and review the diff. Accents must match src/tokens.ts (src/emblems.test.ts checks).
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
sys.path.insert(0,HERE); os.chdir(HERE)
from woven_mark import woven_mark, woven_app_icon, favicon, og_card
from lockup import lockup
A=os.path.join(ROOT,'src','assets')
open(os.path.join(A,'onelyf-mark-woven-dark.svg'),'w').write(woven_mark('dark'))
open(os.path.join(A,'onelyf-mark-woven-light.svg'),'w').write(woven_mark('light'))
open(os.path.join(A,'onelyf-app-icon-woven.svg'),'w').write(woven_app_icon())
open(os.path.join(A,'onelyf-favicon.svg'),'w').write(favicon())
open(os.path.join(HERE,'og-card.svg'),'w').write(og_card())
L=os.path.join(A,'lockups'); os.makedirs(L,exist_ok=True)
for lay in ('horizontal','stacked'):
    for gr in ('light','dark'):
        open(os.path.join(L,f'onelyf-lockup-{lay}-{gr}.svg'),'w').write(lockup(gr,lay))
print('wrote 4 woven marks + 4 lockups (+ og-card.svg source); emblems and flat marks untouched')
