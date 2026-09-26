# Regenerates the branch emblems and the OneLyf mark into src/assets/.
#   python3 scripts/emblems/build.py          everything
#   python3 scripts/emblems/build.py woven    only the woven cut (leaves the flat canon untouched)
# Emblems: woven bands (auto over/under crossings, weave.py) rendered as embroidered patches
# (patchweave.py). Mark: the live Liv glyph at the centre, the seven branches as nodes, joined by
# mycelium hyphae (final_mark.py). Accents must match src/tokens.ts `spaces` (checked by
# src/emblems.test.ts); edit SET2 in set_patch.py when a token accent changes.
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
sys.path.insert(0,HERE); os.chdir(HERE)
from set_patch import SET2, disc_svg
from final_mark import mark
from woven_mark import woven_mark, woven_app_icon, favicon, og_card
KEYS={'FinLyf':'finlyf','HomLyf':'homlyf','HlthLyf':'hlthlyf','GudLyf':'gudlyf','WrkLyf':'wrklyf','SkoolLyf':'skoollyf','Waves':'waves'}
A=os.path.join(ROOT,'src','assets')
FLAT='woven' not in sys.argv[1:]
out=os.path.join(ROOT,'src','assets','emblems'); os.makedirs(out,exist_ok=True)
for name,title,fn,col in (SET2 if FLAT else []):
    open(os.path.join(out,f'{KEYS[name]}.svg'),'w').write(disc_svg(fn,col,256))
if FLAT:
    live=open(os.path.join(ROOT,'src','assets','glyph-live.svg')).read()
    lit=live.replace('fill="#724213"','fill="#c9964a"')   # the bronze reads too dark on night grounds
    open(os.path.join(A,'onelyf-mark-light.svg'),'w').write(mark(512,None,'#1c2b21',live,'#8a630e',with_bg=False))
    open(os.path.join(A,'onelyf-mark-dark.svg'),'w').write(mark(512,None,'#e8e4d6',lit,'#d8a83c',with_bg=False))
    open(os.path.join(A,'onelyf-app-icon.svg'),'w').write(mark(512,'#171b16','#e8e4d6',lit,'#d8a83c'))
# The woven cut (woven_mark.py): marks on round linen patches, the app icon (glyph in a couched
# cord ring), the small-cut favicon, and the social card's source. PNGs come from export_png.mjs.
open(os.path.join(A,'onelyf-mark-woven-dark.svg'),'w').write(woven_mark('dark'))
open(os.path.join(A,'onelyf-mark-woven-light.svg'),'w').write(woven_mark('light'))
open(os.path.join(A,'onelyf-app-icon-woven.svg'),'w').write(woven_app_icon())
open(os.path.join(A,'onelyf-favicon.svg'),'w').write(favicon())
open(os.path.join(HERE,'og-card.svg'),'w').write(og_card())
print('wrote', (f'{len(SET2)} emblems + 3 flat marks + ' if FLAT else '') + '4 woven marks (+ og-card.svg source)')
