# Woven wordmark lockups: the woven mark beside (horizontal) or above (stacked) "OneLyf" in satin
# and the tagline, with two French knots between. Fraunces is outlined into paths here (fontTools,
# from fonts/fraunces-latin.woff2), so the SVGs need no font to render.
#   light: goldDeep satin word, ink tagline, the day (crest) mark
#   dark:  gold satin word, parchment tagline, the night (live) mark
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from woven_mark import woven_mark, knots, LIGHT, DARK, GROUNDS, shade, tint, f1

HERE = os.path.dirname(os.path.abspath(__file__))
TAGLINE = 'Many Spaces, Woven Together'   # ONELYF_TAGLINE in src/components/SpaceEmblem.tsx
_FONTS = {}

def _font(wght):
    if wght not in _FONTS:
        f = TTFont(os.path.join(HERE, 'fonts', 'fraunces-latin.woff2'))
        axes = {a.axisTag: a for a in f['fvar'].axes}
        loc = {'wght': wght}
        if 'opsz' in axes: loc['opsz'] = min(axes['opsz'].maxValue, 72)
        for tag, a in axes.items(): loc.setdefault(tag, a.defaultValue)
        _FONTS[wght] = instantiateVariableFont(f, loc)
    return _FONTS[wght]

def text_path(text, size, x, y, wght=400, tracking=0.0):
    """Outline `text` at `size` px with its baseline at y, starting at x. Returns (d, width)."""
    font = _font(wght); gs = font.getGlyphSet(); cmap = font.getBestCmap(); k = size / font['head'].unitsPerEm
    pen = SVGPathPen(gs, lambda v: f1(v)); cx = 0.0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None: continue
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x + cx, y)))
        cx += gs[g].width * k + tracking
    return pen.getCommands(), cx - tracking

def _satin(pid, T, st=3.0):
    return (f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="{st}" height="{st}" patternTransform="rotate(72)">'
            f'<rect width="{st}" height="{st}" fill="{T["mid"]}"/><rect width="{st * .56:.2f}" height="{st}" fill="{T["hi"]}"/>'
            f'<rect x="{st * .82:.2f}" width="{st * .18:.2f}" height="{st}" fill="{T["dark"]}" fill-opacity=".6"/></pattern>')

def lockup(ground, layout):
    g = GROUNDS[ground]; word_t = g['glyph'] if ground == 'dark' else {'dark': shade(LIGHT['goldDeep'], .6), 'mid': LIGHT['goldDeep'], 'hi': tint(LIGHT['goldDeep'], .3)}
    tag_col = DARK['ink'] if ground == 'dark' else LIGHT['ink']
    m = woven_mark(ground); inner = m[m.index('>') + 1:m.rindex('</svg>')]
    if layout == 'horizontal':
        W, H, ms, mx, my = 1440, 512, 512, 0, 0
        ws, ts = 188, 56; wx = ms + 56; wy = 262; ty = 404; ky = 338
        wd, ww = text_path('OneLyf', ws, wx, wy, 600, -3)
        td, tw = text_path(TAGLINE, ts, wx, ty, 400)
        W = int(max(wx + ww, wx + tw) + 24); kx = wx + 10
    else:
        ws, ts = 150, 46; ms = 512
        _, ww = text_path('OneLyf', ws, 0, 0, 600, -2); _, tw = text_path(TAGLINE, ts, 0, 0, 400)
        W = int(max(ms, ww, tw) + 48); H = 870; mx = (W - ms) / 2; my = 0
        wx = (W - ww) / 2; wy = 672; tx = (W - tw) / 2; ty = 830; ky = 748
        wd, _ = text_path('OneLyf', ws, wx, wy, 600, -2); td, _ = text_path(TAGLINE, ts, tx, ty, 400)
        kx = W / 2 - 9
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs>{_satin("wsat", word_t)}</defs>',
         f'<svg x="{f1(mx)}" y="{my}" width="{ms}" height="{ms}" viewBox="0 0 512 512">{inner}</svg>',
         f'<path d="{wd}" fill="{g["shadow"]}" fill-opacity=".45" transform="translate(2.5 3.5)"/>',
         f'<path d="{wd}" fill="url(#wsat)" stroke="{word_t["dark"]}" stroke-width="2" paint-order="stroke" stroke-linejoin="round"/>',
         knots([(kx, ky), (kx + 18, ky)], 4.4, g['cord'], g['shadow'], 'kwl'),
         f'<path d="{td}" fill="{tag_col}"/>', '</svg>']
    return ''.join(o)
