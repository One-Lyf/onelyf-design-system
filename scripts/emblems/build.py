# Regenerates the branch emblems and the OneLyf mark into src/assets/.
#   python3 scripts/emblems/build.py
# Emblems: woven bands (auto over/under crossings, weave.py) rendered as embroidered patches
# (patchweave.py). Mark: the live Liv glyph at the centre, the seven branches as nodes, joined by
# mycelium hyphae (final_mark.py). Accents must match src/tokens.ts `spaces` (checked by
# src/emblems.test.ts); edit SET2 in set_patch.py when a token accent changes.
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
sys.path.insert(0,HERE); os.chdir(HERE)
from set_patch import SET2, disc_svg
from final_mark import mark
KEYS={'FinLyf':'finlyf','HomLyf':'homlyf','HlthLyf':'hlthlyf','GudLyf':'gudlyf','WrkLyf':'wrklyf','SkoolLyf':'skoollyf','Waves':'waves'}
out=os.path.join(ROOT,'src','assets','emblems'); os.makedirs(out,exist_ok=True)
for name,title,fn,col in SET2:
    open(os.path.join(out,f'{KEYS[name]}.svg'),'w').write(disc_svg(fn,col,256))
live=open(os.path.join(ROOT,'src','assets','glyph-live.svg')).read()
lit=live.replace('fill="#724213"','fill="#c9964a"')   # the bronze reads too dark on night grounds
A=os.path.join(ROOT,'src','assets')
open(os.path.join(A,'onelyf-mark-light.svg'),'w').write(mark(512,None,'#1c2b21',live,'#a97b0c',with_bg=False))
open(os.path.join(A,'onelyf-mark-dark.svg'),'w').write(mark(512,None,'#e8e4d6',lit,'#d8a83c',with_bg=False))
open(os.path.join(A,'onelyf-app-icon.svg'),'w').write(mark(512,'#171b16','#e8e4d6',lit,'#d8a83c'))
print('wrote', len(SET2), 'emblems + 3 marks')
