# Vibe University: a collegiate patch in the OneLyf woven grammar (woven_mark.py): a SkoolLyf
# blue-gray twill patch, a merrowed gold edge, the lamp & book emblem at the centre and
# "Vibe University" in satin on an arc.
# Shipped (2026-09-26): E, the VU meter (Vibe U = VU): vu_meter(), meter_icon(), meter_favicon().
# The other compositions (seal, crest, varsity, vibe seal, vibrating varsity, wave edge) stay as
# drafts. brand-mark lint allow list: #656b70 #52585e (linen tints of the shaded SkoolLyf ground,
# tint-of-a-shade so off the token lines) and #c0463a (LIGHT danger token, the meter's red zone).
# Run: python3 scripts/emblems/vibe_u_patch.py  (writes src/assets/products/vibe-u/)
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from woven_mark import (linen_defs, linen_cloth, running, cord, knots, emblem_body, circle_d,
                        LIGHT, DARK, tint, shade, mix, thread, f1)
from lockup import _font
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

SKOOL = '#6f8090'                                   # tokens.ts branch skoollyf accent
GOLD = thread(DARK['gold'], .55, .45)               # gold thread, as the night mark
CREAM = {'dark': shade(LIGHT['bg'], .35), 'mid': LIGHT['bg'], 'hi': LIGHT['surfaceHi']}
NAVY = shade(SKOOL, .55)                            # the deep blue-gray felt / twill shadow
SHADOW = shade(DARK['bg'], .7)

def _glyphs(text, wght):
    font = _font(wght); gs = font.getGlyphSet(); cmap = font.getBestCmap(); k1 = 1 / font['head'].unitsPerEm
    return font, gs, [(cmap[ord(ch)], gs[cmap[ord(ch)]].width * k1) for ch in text if ord(ch) in cmap]

def text_arc(text, size, cx, cy, r, wght=700, bottom=False, track=0.0):
    """Outline text on a circle: over the top reading clockwise (letters stand outward), or under
    the bottom reading left to right (letters stand inward). r is the baseline radius."""
    font, gs, gl = _glyphs(text, wght); k = size / font['head'].unitsPerEm
    adv = [w * size + track for _, w in gl]; total = sum(adv) - track
    if bottom: r = r                                 # baseline outside the cap line on the bottom arc
    pen = SVGPathPen(gs, lambda v: f1(v)); a = -total / 2 / r
    for (g, w), A in zip(gl, adv):
        th = a + w * size / 2 / r; hw = w * size / 2
        if not bottom:
            px, py = cx + r * math.sin(th), cy - r * math.cos(th); c, s = math.cos(th), math.sin(th)
            m = (k * c, k * s, k * s, -k * c, px - hw * c, py - hw * s)
        else:
            px, py = cx + r * math.sin(th), cy + r * math.cos(th); c, s = math.cos(th), math.sin(th)
            m = (k * c, -k * s, -k * s, -k * c, px - hw * c, py + hw * s)
        gs[g].draw(TransformPen(pen, m)); a += A / r
    return pen.getCommands()

def text_line(text, size, cx, y, wght=700, track=0.0):
    font, gs, gl = _glyphs(text, wght); k = size / font['head'].unitsPerEm
    total = sum(w * size + track for _, w in gl) - track; x = cx - total / 2
    pen = SVGPathPen(gs, lambda v: f1(v))
    for g, w in gl:
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, y))); x += w * size + track
    return pen.getCommands()

def satin_defs(pid, T, st=2.6, ang=72):
    return (f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="{st}" height="{st}" patternTransform="rotate({ang})">'
            f'<rect width="{st}" height="{st}" fill="{T["mid"]}"/><rect width="{st * .56:.2f}" height="{st}" fill="{T["hi"]}"/>'
            f'<rect x="{st * .82:.2f}" width="{st * .18:.2f}" height="{st}" fill="{T["dark"]}" fill-opacity=".6"/></pattern>')

def satin_text(d, pid, T, s=1.0, edge=1.6):
    return (f'<path d="{d}" fill="{SHADOW}" fill-opacity=".5" transform="translate({1.4 * s:.1f} {2 * s:.1f})"/>'
            f'<path d="{d}" fill="url(#{pid})" stroke="{T["dark"]}" stroke-width="{edge * s:.1f}" paint-order="stroke" stroke-linejoin="round"/>')

def merrow(d, w, T, s=1.0):
    """The overlocked patch edge: a dense whip stitch wrapping the border, as radial ticks."""
    return (f'<g fill="none"><path d="{d}" stroke="{SHADOW}" stroke-opacity=".55" stroke-width="{w * 1.1:.1f}" transform="translate({1.5 * s:.1f} {2.5 * s:.1f})"/>'
            f'<path d="{d}" stroke="{T["dark"]}" stroke-width="{w:.1f}"/>'
            f'<path d="{d}" stroke="{T["mid"]}" stroke-width="{w * .86:.1f}" stroke-dasharray="{1.5 * s:.1f} {.9 * s:.1f}"/>'
            f'<path d="{d}" stroke="{T["hi"]}" stroke-opacity=".7" stroke-width="{w * .3:.1f}" stroke-dasharray="{.8 * s:.1f} {1.6 * s:.1f}" transform="translate({-.4 * s:.1f} {-.6 * s:.1f})"/></g>')

def cloth(pid, shape, base, W, H, seed=31, spread=.07):
    return linen_defs(pid, base, seed, spread, .3), linen_cloth(pid, shape, base, seed, W, H, spread)

import re as _re
def book(ring=False):
    b = emblem_body("skoollyf")
    return b if ring else _re.sub(r'<circle r="\.86"[^>]*/>', '', b)

def emblem(cx, cy, r, ring=True):
    """The shipped SkoolLyf lamp & book, minus its own disc (the patch is the disc)."""
    return f'<g transform="translate({f1(cx)} {f1(cy)}) scale({r:.2f})">{book(ring)}</g>'

def star(cx, cy, r, T, sid):
    pts = ' '.join(f'{f1(cx + (r if i % 2 == 0 else r * .42) * math.sin(math.pi * i / 5))},{f1(cy - (r if i % 2 == 0 else r * .42) * math.cos(math.pi * i / 5))}' for i in range(10))
    return (f'<polygon points="{pts}" fill="{SHADOW}" fill-opacity=".5" transform="translate(1 1.6)"/>'
            f'<polygon points="{pts}" fill="url(#{sid})" stroke="{T["dark"]}" stroke-width="1" stroke-linejoin="round"/>')

# ---- A: the seal. Round patch, arched name, lamp & book, "Est. 2026" ----
def seal(size=512, name='Vibe University', foot='Est. 2026'):
    c = size / 2; s = size / 512; R = size * .47
    ld, lc = cloth('sa', f'<circle cx="{c}" cy="{c}" r="{f1(R)}" fill="FILL"/>', SKOOL, size, size)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{ld}'
         f'<clipPath id="sac"><circle cx="{c}" cy="{c}" r="{f1(R)}"/></clipPath>{satin_defs("sat", CREAM)}{satin_defs("sag", GOLD, 2.2, 30)}</defs>']
    o.append(f'<circle cx="{f1(c + 3 * s)}" cy="{f1(c + 5 * s)}" r="{f1(R)}" fill="{SHADOW}" fill-opacity=".45"/>')
    o.append(lc)
    o.append(f'<circle cx="{c}" cy="{c}" r="{f1(size * .3)}" fill="{NAVY}" fill-opacity=".38"/>')    # inner felt disc
    o.append(running(circle_d(c, c, size * .3), 2.2 * s, GOLD['mid'], SHADOW, st=6 * s, gap=4 * s))
    o.append(running(circle_d(c, c, size * .415), 1.8 * s, CREAM['mid'], SHADOW, st=5 * s, gap=4 * s, op=.8))
    o.append(satin_text(text_arc(name, size * .084, c, c, size * .325, 700, track=size * .004), 'sat', CREAM, s))
    o.append(satin_text(text_arc(foot, size * .066, c, c, size * .35, 600, bottom=True, track=size * .004), 'sat', CREAM, s))
    for side in (-1, 1):
        a = side * 1.62
        o.append(star(c + size * .352 * math.sin(a), c - size * .352 * math.cos(a) + size * .012, size * .026, GOLD, 'sag'))
    o.append(emblem(c, c + size * .01, size * .27))
    o.append(merrow(circle_d(c, c, R - 6 * s), 12 * s, GOLD, s))
    o.append('</svg>'); return ''.join(o)

# ---- B: the crest. Shield patch, lamp & book, "Vibe U" on a banner across the foot ----
def shield_d(cx, top, w, h):
    x0, x1 = cx - w / 2, cx + w / 2; sh = top + h * .5
    return (f'M{f1(x0)} {f1(top)}H{f1(x1)}V{f1(sh)}C{f1(x1)} {f1(top + h * .78)} {f1(cx + w * .2)} {f1(top + h * .92)} {f1(cx)} {f1(top + h)}'
            f'C{f1(cx - w * .2)} {f1(top + h * .92)} {f1(x0)} {f1(top + h * .78)} {f1(x0)} {f1(sh)}Z')

def crest(size=512, word='Vibe U'):
    s = size / 512; c = size / 2; top = size * .05; w = size * .74; h = size * .86
    sd = shield_d(c, top, w, h); ld, lc = cloth('sb', f'<path d="{sd}" fill="FILL"/>', SKOOL, size, size)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{ld}<clipPath id="sbc"><path d="{sd}"/></clipPath>'
         f'{satin_defs("sbt", CREAM)}{satin_defs("sbg", GOLD, 2.2, 30)}</defs>']
    o.append(f'<path d="{sd}" fill="{SHADOW}" fill-opacity=".45" transform="translate({3 * s:.1f} {5 * s:.1f})"/>')
    o.append(lc)
    inner = shield_d(c, top + size * .045, w - size * .09, h - size * .085)
    o.append(running(inner, 1.8 * s, CREAM['mid'], SHADOW, st=5 * s, gap=4 * s, op=.8))
    o.append(emblem(c, top + h * .36, size * .25))
    # banner: a cream satin band with folded tails, "Vibe U" in navy
    by = top + h * .66; bh = size * .13; bw = size * .62; bx = c - bw / 2
    tail = size * .07
    for side in (-1, 1):
        ex = c + side * bw / 2; tx = ex + side * tail
        o.append(f'<path d="M{f1(ex)} {f1(by + bh * .25)}L{f1(tx)} {f1(by + bh * .25)}L{f1(tx - side * tail * .45)} {f1(by + bh * .75)}L{f1(tx)} {f1(by + bh * 1.25)}L{f1(ex)} {f1(by + bh * 1.25)}Z" '
                 f'fill="{GOLD["mid"]}" stroke="{GOLD["dark"]}" stroke-width="{1.4 * s:.1f}" stroke-linejoin="round"/>')
    band = f'M{f1(bx)} {f1(by)}Q{f1(c)} {f1(by - bh * .35)} {f1(bx + bw)} {f1(by)}V{f1(by + bh)}Q{f1(c)} {f1(by + bh * .65)} {f1(bx)} {f1(by + bh)}Z'
    o.append(f'<path d="{band}" fill="{SHADOW}" fill-opacity=".45" transform="translate({2 * s:.1f} {3 * s:.1f})"/>')
    o.append(f'<path d="{band}" fill="url(#sbt)" stroke="{shade(CREAM["dark"], .4)}" stroke-width="{1.6 * s:.1f}"/>')
    o.append(f'<path d="{text_line(word, size * .1, c, by + bh * .72, 800, size * .004)}" fill="{NAVY}"/>')
    o.append(merrow(sd, 12 * s, GOLD, s))
    o.append('</svg>'); return ''.join(o)

# ---- C: the varsity letter. Chenille "VU" on a round felt patch ----
def chenille_defs(pid, base, st=4.0):
    """Terry loops: a staggered grid of little lit loops."""
    return (f'<radialGradient id="{pid}l" fx=".35" fy=".3"><stop offset="0" stop-color="{tint(base, .5)}"/><stop offset=".6" stop-color="{base}"/><stop offset="1" stop-color="{shade(base, .5)}"/></radialGradient>'
            f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="{st}" height="{st * .87:.2f}">'
            f'<rect width="{st}" height="{st * .87:.2f}" fill="{shade(base, .2)}"/>'
            f'<circle cx="{st * .25}" cy="{st * .22:.2f}" r="{st * .3:.2f}" fill="url(#{pid}l)"/><circle cx="{st * .75}" cy="{st * .65:.2f}" r="{st * .3:.2f}" fill="url(#{pid}l)"/></pattern>')

def varsity(size=512, word='VU', ring='Vibe University', full_bleed=False):
    s = size / 512; c = size / 2; R = size * .47
    base = 'sc'; shape = (f'<rect width="{size}" height="{size}" fill="FILL"/>' if full_bleed else f'<circle cx="{c}" cy="{c}" r="{f1(R)}" fill="FILL"/>')
    ld, lc = cloth(base, shape, NAVY, size, size, 41, .06); clip = shape.replace(' fill="FILL"', '')
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{ld}'
         f'<clipPath id="scc">{clip}</clipPath>'
         f'{chenille_defs("chn", SKOOL, 4.2 * s)}{satin_defs("scg", GOLD, 2.2, 30)}{satin_defs("sct", CREAM)}</defs>']
    if not full_bleed: o.append(f'<circle cx="{f1(c + 3 * s)}" cy="{f1(c + 5 * s)}" r="{f1(R)}" fill="{SHADOW}" fill-opacity=".45"/>')
    o.append(lc)
    k = .8 if full_bleed else 1.0                    # the icon keeps inside the maskable safe zone
    fs = size * .42 * k; ty = c + fs * .34 + (0 if not ring else size * .02 * k)
    d = text_line(word, fs, c, ty, 900, size * .012 * k)
    # layered felt: gold felt outline, cream felt, then the chenille face
    o.append(f'<path d="{d}" fill="{SHADOW}" fill-opacity=".5" stroke="{SHADOW}" stroke-opacity=".5" stroke-width="{26 * s * k:.1f}" stroke-linejoin="round" transform="translate({3 * s:.1f} {5 * s:.1f})"/>')
    o.append(f'<path d="{d}" fill="url(#scg)" stroke="url(#scg)" stroke-width="{26 * s * k:.1f}" stroke-linejoin="round"/>')
    o.append(f'<path d="{d}" fill="none" stroke="{GOLD["dark"]}" stroke-width="{1.6 * s:.1f}" stroke-linejoin="round" stroke-dasharray="{3 * s:.1f} {1.4 * s:.1f}" transform="translate(0 0)" opacity="0"/>')
    o.append(f'<path d="{d}" fill="url(#sct)" stroke="url(#sct)" stroke-width="{13 * s * k:.1f}" stroke-linejoin="round"/>')
    o.append(f'<path d="{d}" fill="url(#chn)"/>')
    o.append(f'<path d="{d}" fill="none" stroke="{shade(SKOOL, .5)}" stroke-width="{1.2 * s:.1f}" stroke-dasharray="{2.4 * s:.1f} {1.4 * s:.1f}"/>')
    if ring:
        o.append(satin_text(text_arc(ring, size * .07 * k, c, c, size * .37 * k, 700, track=size * .006), 'sct', CREAM, s))
        o.append(knots([(c - size * .36 * k, c + size * .12 * k), (c + size * .36 * k, c + size * .12 * k)], 4.4 * s, GOLD, SHADOW, 'kvc'))
    if full_bleed:
        o.append(running(circle_d(c, c, size * .44), 2.4 * s, GOLD['mid'], SHADOW, st=7 * s, gap=5 * s, op=.85))
    else:
        o.append(merrow(circle_d(c, c, R - 6 * s), 12 * s, GOLD, s))
    o.append('</svg>'); return ''.join(o)

# ---- app icon + favicon cuts ----
def seal_icon(size=512):
    """Full-bleed navy linen with the seal inside the maskable safe zone (80%)."""
    s = size / 512; c = size / 2; m = seal(512); inner = m[m.index('>') + 1:m.rindex('</svg>')]
    ld, lc = cloth('si', f'<rect width="{size}" height="{size}" fill="FILL"/>', shade(SKOOL, .62), size, size, 51, .05)
    k = size * .86; off = (size - k) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{ld}<clipPath id="sic"><rect width="{size}" height="{size}"/></clipPath></defs>{lc}'
            f'<svg x="{f1(off)}" y="{f1(off)}" width="{f1(k)}" height="{f1(k)}" viewBox="0 0 512 512">{inner}</svg></svg>')

def favicon(size=64, word='VU'):
    """Small cut: flat felt, no texture, no ring text."""
    c = size / 2; d = text_line(word, size * .5, c, c + size * .17, 900, -size * .03)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}" rx="{f1(size * .22)}" fill="{NAVY}"/>'
            f'<rect x="{f1(size * .05)}" y="{f1(size * .05)}" width="{f1(size * .9)}" height="{f1(size * .9)}" rx="{f1(size * .18)}" fill="none" stroke="{DARK["gold"]}" stroke-width="{f1(size * .045)}"/>'
            f'<path d="{d}" fill="{DARK["gold"]}" stroke="{DARK["gold"]}" stroke-width="{f1(size * .06)}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="{LIGHT["bg"]}"/></svg>')

# ---- round 2: play on the vibe / wave ----
def wavy_circle(cx, cy, R, amp, n, steps=720):
    pts = []
    for i in range(steps + 1):
        t = 2 * math.pi * i / steps; r = R + amp * math.sin(n * t)
        pts.append(f'{f1(cx + r * math.sin(t))} {f1(cy - r * math.cos(t))}')
    return 'M' + 'L'.join(pts) + 'Z'

def arc_d(cx, cy, r, a0, a1):
    x0, y0 = cx + r * math.sin(a0), cy - r * math.cos(a0); x1, y1 = cx + r * math.sin(a1), cy - r * math.cos(a1)
    return f'M{f1(x0)} {f1(y0)}A{f1(r)} {f1(r)} 0 0 1 {f1(x1)} {f1(y1)}'

def sine_d(x0, x1, y, amp, waves, steps=160, env=True):
    pts = []
    for i in range(steps + 1):
        u = i / steps; e = math.sin(math.pi * u) if env else 1
        pts.append(f'{f1(x0 + (x1 - x0) * u)} {f1(y - amp * e * math.sin(2 * math.pi * waves * u))}')
    return 'M' + 'L'.join(pts)

TIE = shade(SKOOL, .7)

def patch_base(pid, size, shape_d, base=SKOOL, seed=31):
    ld, lc = cloth(pid, f'<path d="{shape_d}" fill="FILL"/>', base, size, size, seed)
    head = f'<defs>{ld}<clipPath id="{pid}c"><path d="{shape_d}"/></clipPath>{satin_defs(pid + "t", CREAM)}{satin_defs(pid + "g", GOLD, 2.2, 30)}</defs>'
    return head, f'<path d="{shape_d}" fill="{SHADOW}" fill-opacity=".45" transform="translate(3 5)"/>' + lc

# D: the vibe seal. The book sends vibes up where the flame was; the inner ring is a sine.
def vibe_seal(size=512):
    c = size / 2; R = size * .47; disc = circle_d(c, c, R)
    head, body = patch_base('vd', size, disc)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{head}{body}']
    o.append(f'<path d="{wavy_circle(c, c, size * .255, size * .01, 16)}" fill="{NAVY}" fill-opacity=".38"/>')
    o.append(cord(wavy_circle(c, c, size * .255, size * .01, 16), 3.2, GOLD, TIE, SHADOW))
    o.append(satin_text(text_arc('Vibe University', size * .084, c, c, size * .325, 700, track=size * .004), 'vdt', CREAM))
    o.append(satin_text(text_arc('Est. 2026', size * .066, c, c, size * .35, 600, bottom=True, track=size * .004), 'vdt', CREAM))
    for side in (-1, 1):
        o.append(star(c + side * size * .352, c + size * .012, size * .026, GOLD, 'vdg'))
    # the book, low; vibes rising off its pages
    by = c + size * .07
    o.append(f'<g transform="translate({f1(c)} {f1(by)}) scale({size * .27:.2f}) translate(0 -.2)"><clipPath id="vdb"><rect x="-1" y="-.1" width="2" height="1.2"/></clipPath><g clip-path="url(#vdb)">{book()}</g></g>')
    for i, r in enumerate((.06, .1, .14)):
        o.append(cord(arc_d(c, by - size * .06, size * r, -.8, .8), 4.2 - i * .7, GOLD, TIE, SHADOW))
    o.append(merrow(disc, 12, GOLD))
    o.append('</svg>'); return ''.join(o)

# E: the VU meter. Vibe U = VU: the patch is a VU meter face with the needle in the gold.
def vu_meter(size=512):
    c = size / 2; R = size * .47; disc = circle_d(c, c, R)
    head, body = patch_base('ve', size, disc, NAVY, 41)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{head}{body}']
    pc = (c, c + size * .15); fr = size * .3; A = .95   # pivot, face radius, half sweep
    lx, ly = pc[0] - fr * math.sin(A), pc[1] - fr * math.cos(A); rx = pc[0] + fr * math.sin(A); base = pc[1] + size * .035
    face = f'M{f1(lx)} {f1(ly)}A{f1(fr)} {f1(fr)} 0 0 1 {f1(rx)} {f1(ly)}L{f1(rx)} {f1(base)}H{f1(lx)}Z'
    o.append(f'<path d="{face}" fill="{SHADOW}" fill-opacity=".5" transform="translate(2 3)"/><path d="{face}" fill="url(#vet)" stroke="{CREAM["dark"]}" stroke-width="2" stroke-linejoin="round"/>')
    o.append(running(face, 1.6, GOLD['dark'], SHADOW, st=4, gap=3, op=.6))
    a0, a1, hot, rs = -.72, .72, .36, fr * .78
    o.append(f'<path d="{arc_d(*pc, rs, a0, hot)}" fill="none" stroke="{NAVY}" stroke-width="3"/>')
    o.append(f'<path d="{arc_d(*pc, rs, hot, a1)}" fill="none" stroke="{LIGHT["danger"]}" stroke-width="7"/>')
    for i in range(11):
        a = a0 + (a1 - a0) * i / 10; L = .13 if i % 5 == 0 else .08; col = LIGHT['danger'] if a > hot + .01 else NAVY
        x0, y0 = pc[0] + rs * math.sin(a), pc[1] - rs * math.cos(a); x1, y1 = pc[0] + fr * (.78 + L) * math.sin(a), pc[1] - fr * (.78 + L) * math.cos(a)
        o.append(f'<path d="M{f1(x0)} {f1(y0)}L{f1(x1)} {f1(y1)}" stroke="{col}" stroke-width="3" stroke-linecap="round"/>')
    o.append(f'<path d="{text_line("VU", size * .07, c, pc[1] - fr * .3, 800, 2)}" fill="{NAVY}"/>')
    na = .5; nx, ny = pc[0] + fr * .93 * math.sin(na), pc[1] - fr * .93 * math.cos(na)
    o.append(cord(f'M{f1(pc[0])} {f1(pc[1])}L{f1(nx)} {f1(ny)}', 4.4, GOLD, TIE, SHADOW, ties=False))
    o.append(knots([pc], 9, GOLD, SHADOW, 'kve'))
    o.append(satin_text(text_arc('Vibe University', size * .084, c, c, size * .36, 700, track=size * .004), 'vet', CREAM))
    o.append(satin_text(text_arc('Est. 2026', size * .056, c, c, size * .39, 600, bottom=True, track=size * .004), 'vet', CREAM))
    o.append(merrow(disc, 12, GOLD))
    o.append('</svg>'); return ''.join(o)

# F: varsity VU, vibrating: echo outlines either side and a stitched wave through the letters.
def vibe_varsity(size=512):
    c = size / 2; R = size * .47; disc = circle_d(c, c, R)
    head, body = patch_base('vf', size, disc, NAVY, 41)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{chenille_defs("vfk", SKOOL, 4.2)}</defs>{head}{body}']
    fs = size * .4; d = text_line('VU', fs, c, c + fs * .36, 900, size * .012)
    for i, dx in enumerate((22, 40)):
        for side in (-1, 1):
            o.append(f'<path d="{d}" fill="none" stroke="{GOLD["mid"]}" stroke-opacity="{.7 - i * .3:.2f}" stroke-width="2.2" stroke-dasharray="6 4" transform="translate({side * dx} 0)"/>')
    o.append(f'<path d="{d}" fill="{SHADOW}" fill-opacity=".5" stroke="{SHADOW}" stroke-opacity=".5" stroke-width="26" stroke-linejoin="round" transform="translate(3 5)"/>')
    o.append(f'<path d="{d}" fill="url(#vfg)" stroke="url(#vfg)" stroke-width="26" stroke-linejoin="round"/>')
    o.append(f'<path d="{d}" fill="url(#vft)" stroke="url(#vft)" stroke-width="13" stroke-linejoin="round"/><path d="{d}" fill="url(#vfk)"/>')
    o.append(cord(sine_d(c - size * .4, c + size * .4, c + size * .05, size * .06, 3.5), 5, GOLD, TIE, SHADOW))
    o.append(satin_text(text_arc('Vibe University', size * .07, c, c, size * .37, 700, track=size * .006), 'vft', CREAM))
    o.append(satin_text(text_arc('Est. 2026', size * .056, c, c, size * .39, 600, bottom=True, track=size * .004), 'vft', CREAM))
    o.append(merrow(disc, 12, GOLD))
    o.append('</svg>'); return ''.join(o)

# G: the wave-edged patch. The patch outline itself is a sine, like a sound rosette.
def wave_edge(size=512):
    c = size / 2; edge = wavy_circle(c, c, size * .45, size * .018, 24)
    head, body = patch_base('vg', size, edge)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{head}{body}']
    o.append(running(wavy_circle(c, c, size * .39, size * .012, 24), 1.8, CREAM['mid'], SHADOW, st=5, gap=4, op=.8))
    o.append(satin_text(text_arc('Vibe University', size * .08, c, c, size * .3, 700, track=size * .004), 'vgt', CREAM))
    o.append(emblem(c, c + size * .0, size * .22, ring=False))
    o.append(cord(sine_d(c - size * .28, c + size * .28, c + size * .21, size * .05, 3), 4.4, GOLD, TIE, SHADOW))
    o.append(merrow(edge, 12, GOLD))
    o.append('</svg>'); return ''.join(o)

# ---- E cuts: the app icon (meter only, full bleed, in the maskable safe zone) and the favicon ----
def meter(o, size, c, cy, fr, sid, needle=.5, fine=True):
    pc = (c, cy); A = .95
    lx, ly = pc[0] - fr * math.sin(A), pc[1] - fr * math.cos(A); rx = pc[0] + fr * math.sin(A); base = pc[1] + fr * .12
    face = f'M{f1(lx)} {f1(ly)}A{f1(fr)} {f1(fr)} 0 0 1 {f1(rx)} {f1(ly)}L{f1(rx)} {f1(base)}H{f1(lx)}Z'
    s = fr / (512 * .3)
    o.append(f'<path d="{face}" fill="{SHADOW}" fill-opacity=".5" transform="translate({2 * s:.1f} {3 * s:.1f})"/><path d="{face}" fill="url(#{sid})" stroke="{CREAM["dark"]}" stroke-width="{2 * s:.1f}" stroke-linejoin="round"/>')
    if fine: o.append(running(face, 1.6 * s, GOLD['dark'], SHADOW, st=4 * s, gap=3 * s, op=.6))
    a0, a1, hot, rs = -.72, .72, .36, fr * .78
    o.append(f'<path d="{arc_d(*pc, rs, a0, hot)}" fill="none" stroke="{NAVY}" stroke-width="{3 * s:.1f}"/>')
    o.append(f'<path d="{arc_d(*pc, rs, hot, a1)}" fill="none" stroke="{LIGHT["danger"]}" stroke-width="{7 * s:.1f}"/>')
    for i in range(11 if fine else 5):
        n = 10 if fine else 4; a = a0 + (a1 - a0) * i / n; L = .13 if (i % 5 == 0 or not fine) else .08; col = LIGHT['danger'] if a > hot + .01 else NAVY
        x0, y0 = pc[0] + rs * math.sin(a), pc[1] - rs * math.cos(a); x1, y1 = pc[0] + fr * (.78 + L) * math.sin(a), pc[1] - fr * (.78 + L) * math.cos(a)
        o.append(f'<path d="M{f1(x0)} {f1(y0)}L{f1(x1)} {f1(y1)}" stroke="{col}" stroke-width="{3 * s:.1f}" stroke-linecap="round"/>')
    o.append(f'<path d="{text_line("VU", fr * .23, c, pc[1] - fr * .3, 800, 2 * s)}" fill="{NAVY}"/>')
    nx, ny = pc[0] + fr * .93 * math.sin(needle), pc[1] - fr * .93 * math.cos(needle)
    o.append(cord(f'M{f1(pc[0])} {f1(pc[1])}L{f1(nx)} {f1(ny)}', 4.4 * s, GOLD, TIE, SHADOW, ties=False))
    o.append(knots([pc], 9 * s, GOLD, SHADOW, sid + 'k'))

def meter_icon(size=512):
    c = size / 2; sq = f'M0 0H{size}V{size}H0Z'
    head, body = patch_base('vi', size, sq, NAVY, 41)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{head}{body}']
    o.append(running(circle_d(c, c, size * .4), 2.4, GOLD['mid'], SHADOW, st=7, gap=5, op=.85))
    meter(o, size, c, c + size * .13, size * .34, 'vit')
    o.append('</svg>'); return ''.join(o)

def meter_favicon(size=64):
    """Small cut: flat, no thread. Dome, red zone, needle; heavier strokes."""
    c = size / 2; pc = (c, size * .74); fr = size * .5; A = .95
    lx, ly = pc[0] - fr * math.sin(A), pc[1] - fr * math.cos(A); rx = pc[0] + fr * math.sin(A); base = size * .82
    face = f'M{f1(lx)} {f1(ly)}A{f1(fr)} {f1(fr)} 0 0 1 {f1(rx)} {f1(ly)}L{f1(rx)} {f1(base)}H{f1(lx)}Z'
    rs = fr * .78; nx, ny = pc[0] + fr * .9 * math.sin(.5), pc[1] - fr * .9 * math.cos(.5)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><rect width="{size}" height="{size}" rx="{f1(size * .22)}" fill="{NAVY}"/>'
            f'<path d="{face}" fill="{LIGHT["bg"]}"/>'
            f'<path d="{arc_d(*pc, rs, .36, .72)}" fill="none" stroke="{LIGHT["danger"]}" stroke-width="{f1(size * .09)}"/>'
            f'<path d="M{f1(pc[0])} {f1(pc[1])}L{f1(nx)} {f1(ny)}" stroke="{DARK["goldDeep"]}" stroke-width="{f1(size * .07)}" stroke-linecap="round"/>'
            f'<circle cx="{f1(pc[0])}" cy="{f1(pc[1])}" r="{f1(size * .07)}" fill="{DARK["goldDeep"]}"/></svg>')

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'products', 'vibe-u')
    os.makedirs(out, exist_ok=True)
    for k, f in {'vibe-u-patch': vu_meter, 'vibe-u-app-icon': meter_icon, 'vibe-u-favicon': meter_favicon}.items():
        open(os.path.join(out, f'{k}.svg'), 'w').write(f()); print(k)
