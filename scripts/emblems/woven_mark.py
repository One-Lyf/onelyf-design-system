# The WOVEN OneLyf mark: the same composition as final_mark.py (Liv at the centre, the seven
# branch patches on a ring, mycelium between them), stitched the way the brand film's woven cut
# (film/onelyf.v4.8-woven.html) stitches it:
#   ground  plain-weave linen, a baked tile of shaded warp/weft floats with slubs and mottling
#   glyph   satin laid across the strands, inside a darker split-stitch edge
#   hyphae  twisted two-ply cord, couched down with dark ties every ~14 px
#   twigs   stem stitch (thin cord, no ties); junctions as French knots
#   rings   running stitch around each patch
# Everything is vector, patterns and dash arrays rather than a path per stitch, so each file
# stays near the flat mark's size. Every colour is a token from src/tokens.ts or a tint/shade of
# one (the brand-mark lint checks this).
import math, random, re, os
from set_patch import SET2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

# ---- tokens, read from tokens.ts so they cannot drift ----
_TOK = open(os.path.join(ROOT, 'src', 'tokens.ts')).read()
def _block(name):
    m = re.search(r'export const ' + name + r' = \{(.*?)\n\}', _TOK, re.S)
    return dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", m.group(1)))
LIGHT, DARK = _block('color'), _block('colorDark')

def _hx(c): return [int(c[i:i + 2], 16) for i in (1, 3, 5)]
def mix(a, b, t):
    A, B = _hx(a), _hx(b); return '#%02x%02x%02x' % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
def tint(c, t): return mix(c, '#ffffff', t)
def shade(c, t): return mix(c, '#000000', t)
def thread(base, dark=.55, hi=.55): return {'dark': shade(base, dark), 'mid': base, 'hi': tint(base, hi)}

# Grounds. Night: gold thread, the LIVE glyph. Day: goldDeep cord, the CREST glyph in bronze
# (owner's call, 2026-09-26: the day mark is OneLyf at rest; Liv lights it at night).
GROUNDS = {
    'dark': dict(bg=DARK['bg'], cord=thread(DARK['gold'], .6, .5), glyph=thread(DARK['gold'], .5, .6),
                 tie=shade(DARK['bg'], .45), shadow=shade(DARK['bg'], .7), glyph_file='glyph-live.svg',
                 linen_spread=.09, gap=.4, lit=True, rim=tint(DARK['bg'], .2)),
    'light': dict(bg=LIGHT['bg'], cord=thread(LIGHT['goldDeep'], .45, .35), glyph={'dark': shade(LIGHT['goldDeep'], .62), 'mid': shade(LIGHT['goldDeep'], .3), 'hi': tint(LIGHT['goldDeep'], .22)},
                  tie=LIGHT['ink'], shadow=shade(LIGHT['bg'], .55), glyph_file='glyph-crest.svg',
                  linen_spread=.045, gap=.1, lit=False, rim=shade(LIGHT['bg'], .12)),
}

f1 = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')

# The branch patches are PERSISTENT assets (src/assets/emblems/*.svg), not regenerated: the woven
# mark embeds each file's embroidered body as shipped, so it always matches the emblems apps use.
def emblem_body(name):
    s = open(os.path.join(ROOT, 'src', 'assets', 'emblems', f'{name.lower()}.svg')).read()
    m = re.search(r'<g transform="translate\([\d.]+ [\d.]+\) scale\([\d.]+\)">(.*)</g></svg>\s*$', s, re.S)
    if not m: raise ValueError(f'unexpected emblem layout: {name}')
    return m.group(1)

# ---- linen ----
def linen_defs(pid, base, seed, spread, gap, p=2.8, n=16):
    """A plain-weave tile: each float a tone of the ground, shaded as a cylinder by a repeating
    gradient (one path per direction, not one gradient per float)."""
    r = random.Random(seed); T = p * n
    tone = lambda: (tint if r.random() < .5 else shade)(base, r.random() * spread)
    warp = [tone() for _ in range(n)]; weft = [tone() for _ in range(n)]
    cells = []; over_d = []; under_d = []
    for j in range(n):
        for i in range(n):
            over = (i + j) % 2 == 0; x, y = i * p, j * p
            if over: rx, ry, w, h = x + p * .1, y, p * .8, p
            else: rx, ry, w, h = x, y + p * .1, p, p * .8
            cells.append(f'<rect x="{f1(rx)}" y="{f1(ry)}" width="{f1(w)}" height="{f1(h)}" rx="1" fill="{warp[i] if over else weft[j]}"/>')
            (over_d if over else under_d).append(f'M{f1(rx)} {f1(ry)}h{f1(w)}v{f1(h)}h-{f1(w)}z')
    return (f'<linearGradient id="{pid}h" gradientUnits="userSpaceOnUse" x1="0" x2="{p}" y1="0" y2="0" spreadMethod="repeat">'
            f'<stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".38"/></linearGradient>'
            f'<linearGradient id="{pid}v" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="{p}" spreadMethod="repeat">'
            f'<stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".38"/></linearGradient>'
            f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="{f1(T)}" height="{f1(T)}">'
            f'<rect width="{f1(T)}" height="{f1(T)}" fill="{shade(base, gap)}"/>' + ''.join(cells) +
            f'<path d="{"".join(over_d)}" fill="url(#{pid}h)"/><path d="{"".join(under_d)}" fill="url(#{pid}v)"/></pattern>')

def linen_cloth(pid, shape, base, seed, W, H, spread):
    """The cloth: the tiled weave, then low mottling and a few slubs so the repeat doesn't show."""
    r = random.Random(seed + 1); o = [f'<g clip-path="url(#{pid}c)">{shape.replace("FILL", f"url(#{pid})")}']
    o.append(f'<radialGradient id="{pid}m"><stop offset="0" stop-color="{tint(base, .25)}" stop-opacity=".09"/><stop offset="1" stop-color="{tint(base, .25)}" stop-opacity="0"/></radialGradient>')
    o.append(f'<radialGradient id="{pid}n"><stop offset="0" stop-color="{shade(base, .5)}" stop-opacity=".16"/><stop offset="1" stop-color="{shade(base, .5)}" stop-opacity="0"/></radialGradient>')
    for k in range(8):
        o.append(f'<circle cx="{f1(r.random() * W)}" cy="{f1(r.random() * H)}" r="{f1(W * (.12 + r.random() * .22))}" fill="url(#{pid}{"mn"[k % 2]})"/>')
    for _ in range(int(16 * W / 512)):
        y = round(r.random() * H / 2.8) * 2.8 + 1.4; x = r.random() * W; L = 20 + r.random() * 70
        o.append(f'<path d="M{f1(x)} {f1(y)}h{f1(L)}" stroke="{tint(base, spread * 2.2)}" stroke-opacity="{.10 + r.random() * .08:.2f}" stroke-width="2.4" stroke-linecap="round"/>')
    o.append('</g>'); return ''.join(o)

# ---- the glyph, baked into place ----
def glyph_path(name, cx, cy, h):
    """The traced glyph (M/L/Z only), scaled so it is h tall with Liv's heart (274, 443 in the
    549x748 source) at (cx, cy), rounded to 0.1 px with repeated points dropped."""
    s = open(os.path.join(ROOT, 'src', 'assets', name)).read()
    vw, vh = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s).groups())
    d = re.search(r'<path[^>]* d="([^"]+)"', s).group(1); k = h / vh
    x0 = cx - vw * k * 274 / 549; y0 = cy - h * 443 / 748
    parts = []; last = None
    for cmd, body in re.findall(r'([MLZ])([^MLZ]*)', d):
        if cmd == 'Z': parts.append('Z'); last = None; continue
        nums = list(map(float, re.findall(r'-?[\d.]+', body)))
        for i in range(0, len(nums), 2):
            pt = (f1(x0 + nums[i] * k), f1(y0 + nums[i + 1] * k))
            if pt == last: continue
            parts.append(('M' if cmd == 'M' and i == 0 else 'L') + f'{pt[0]} {pt[1]}'); last = pt
    return ''.join(parts)

def satin_glyph(gid, name, cx, cy, h, T, shadow, glow=None, s=1.0):
    """Satin across the strands (two stitch angles: flame and trunk vs. roots), a lit-from-top-left
    sheen, a darker split-stitch edge, and a contact shadow on the cloth."""
    d = glyph_path(name, cx, cy, h)
    st = 2.6 * s; split = cy + h * .06
    o = [f'<defs><path id="{gid}" d="{d}" fill-rule="evenodd"/>'
         f'<pattern id="{gid}a" patternUnits="userSpaceOnUse" width="{st:.2f}" height="{st:.2f}" patternTransform="rotate(58)"><rect width="{st:.2f}" height="{st:.2f}" fill="{T["mid"]}"/><rect width="{st * .55:.2f}" height="{st:.2f}" fill="{T["hi"]}"/><rect x="{st * .82:.2f}" width="{st * .18:.2f}" height="{st:.2f}" fill="{T["dark"]}" fill-opacity=".6"/></pattern>'
         f'<pattern id="{gid}b" patternUnits="userSpaceOnUse" width="{st:.2f}" height="{st:.2f}" patternTransform="rotate(-24)"><rect width="{st:.2f}" height="{st:.2f}" fill="{T["mid"]}"/><rect width="{st * .5:.2f}" height="{st:.2f}" fill="{T["hi"]}"/><rect x="{st * .82:.2f}" width="{st * .18:.2f}" height="{st:.2f}" fill="{T["dark"]}" fill-opacity=".6"/></pattern>'
         f'<linearGradient id="{gid}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".3"/></linearGradient>'
         f'<clipPath id="{gid}t"><rect x="0" y="0" width="100000" height="{split:.1f}"/></clipPath><clipPath id="{gid}r"><rect x="0" y="{split:.1f}" width="100000" height="100000"/></clipPath></defs>']
    if glow:
        o.append(f'<radialGradient id="{gid}g"><stop offset="0" stop-color="{glow}" stop-opacity=".42"/><stop offset=".5" stop-color="{glow}" stop-opacity=".12"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>'
                 f'<circle cx="{f1(cx)}" cy="{f1(cy)}" r="{f1(h * .42)}" fill="url(#{gid}g)"/>')
    o.append(f'<use href="#{gid}" fill="{shadow}" fill-opacity=".5" transform="translate({1.6 * s:.1f} {2.2 * s:.1f})"/>')
    o.append(f'<use href="#{gid}" fill="{T["dark"]}" stroke="{T["dark"]}" stroke-width="{2.4 * s:.1f}" stroke-linejoin="round"/>')
    o.append(f'<use href="#{gid}" fill="url(#{gid}a)" clip-path="url(#{gid}t)"/><use href="#{gid}" fill="url(#{gid}b)" clip-path="url(#{gid}r)"/>')
    o.append(f'<use href="#{gid}" fill="url(#{gid}l)"/>')
    o.append(f'<use href="#{gid}" fill="none" stroke="{T["dark"]}" stroke-width="{.9 * s:.1f}" stroke-dasharray="{2.2 * s:.1f} {.8 * s:.1f}" stroke-opacity=".9"/>')
    return ''.join(o)

# ---- cord, stem stitch, knots, running stitch ----
def cord(d, w, T, tie, shadow, ties=True, step=None):
    st = step or max(2.2, w * .9)
    o = [f'<g fill="none" stroke-linejoin="round">',
         f'<path d="{d}" stroke="{shadow}" stroke-opacity=".5" stroke-width="{w * 1.15:.2f}" stroke-linecap="round" transform="translate({w * .4:.2f} {w * .6:.2f})"/>',
         f'<path d="{d}" stroke="{T["dark"]}" stroke-width="{w:.2f}" stroke-linecap="round"/>',
         f'<path d="{d}" stroke="{T["mid"]}" stroke-width="{w * .78:.2f}" stroke-dasharray="{st * .62:.2f} {st * .38:.2f}"/>',
         f'<path d="{d}" stroke="{T["hi"]}" stroke-opacity=".75" stroke-width="{max(.5, w * .24):.2f}" stroke-dasharray="{st * .45:.2f} {st * .55:.2f}" transform="translate({-w * .12:.2f} {-w * .16:.2f})"/>']
    if ties: o.append(f'<path d="{d}" stroke="{tie}" stroke-opacity=".85" stroke-width="{w + 3.2:.2f}" stroke-dasharray="1.3 14" stroke-dashoffset="-6"/>')
    o.append('</g>'); return ''.join(o)

def running(d, w, col, shadow, st=5.5, gap=3.5, op=1):
    return (f'<g fill="none" stroke-linecap="round" stroke-opacity="{op}"><path d="{d}" stroke="{shadow}" stroke-opacity=".45" stroke-width="{w * 1.2:.2f}" stroke-dasharray="{st} {gap}" transform="translate({w * .35:.2f} {w * .5:.2f})"/>'
            f'<path d="{d}" stroke="{col}" stroke-width="{w:.2f}" stroke-dasharray="{st} {gap}"/></g>')

def circle_d(x, y, r): return f'M{f1(x - r)} {f1(y)}a{f1(r)} {f1(r)} 0 1 0 {f1(2 * r)} 0a{f1(r)} {f1(r)} 0 1 0 {f1(-2 * r)} 0'

def knots(pts, s, T, shadow, kid):
    o = [f'<radialGradient id="{kid}" fx=".32" fy=".3"><stop offset="0" stop-color="{T["hi"]}"/><stop offset=".55" stop-color="{T["mid"]}"/><stop offset="1" stop-color="{T["dark"]}"/></radialGradient>']
    o += [f'<circle cx="{f1(x + s * .5)}" cy="{f1(y + s * .6)}" r="{f1(s * 1.05)}" fill="{shadow}" fill-opacity=".5"/>' for x, y in pts]
    o += [f'<circle cx="{f1(x)}" cy="{f1(y)}" r="{f1(s)}" fill="url(#{kid})"/>' for x, y in pts]
    return ''.join(o)

# ---- mycelium: the same seeded network as final_mark.py, as cubic path data by stitch class ----
def _perp(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); return (-dy / L, dx / L), L
def _bez(p0, p1, p2, p3, t):
    a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; d = t ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])
def _C(p0, p1, p2, p3): return f'M{f1(p0[0])} {f1(p0[1])}C{f1(p1[0])} {f1(p1[1])} {f1(p2[0])} {f1(p2[1])} {f1(p3[0])} {f1(p3[1])}'

def network(size, c, pts, r, seed=7):
    rng = random.Random(seed); R = math.dist((c, c), pts[0]); main, links, twigs, chords, dots = [], [], [], [], []
    def twig(p0, p1, p2, p3, count, scale):
        for _ in range(count):
            t = rng.uniform(.25, .75); p = _bez(p0, p1, p2, p3, t); q = _bez(p0, p1, p2, p3, t + .02)
            side = rng.choice((-1, 1)); L = scale * rng.uniform(.10, .2)
            ang = math.atan2(q[1] - p[1], q[0] - p[0]) + side * rng.uniform(.5, 1.0)
            e = (p[0] + math.cos(ang) * L, p[1] + math.sin(ang) * L)
            c1 = (p[0] + math.cos(ang - side * .3) * L * .4, p[1] + math.sin(ang - side * .3) * L * .4)
            c2 = (e[0] - math.cos(ang + side * .4) * L * .3, e[1] - math.sin(ang + side * .4) * L * .3)
            twigs.append(_C(p, c1, c2, e)); dots.append(p)
    for (x, y) in pts:                                   # Liv -> each branch
        (nx, ny), L = _perp((c, c), (x, y)); ux, uy = (x - c) / L, (y - c) / L
        a = (c + ux * size * .06, c + uy * size * .06); b = (x - ux * r * 1.12, y - uy * r * 1.12)
        k = rng.uniform(.07, .13) * R * rng.choice((-1, 1))
        p1 = (a[0] + (b[0] - a[0]) * .33 + nx * k, a[1] + (b[1] - a[1]) * .33 + ny * k)
        p2 = (a[0] + (b[0] - a[0]) * .66 - nx * k * .8, a[1] + (b[1] - a[1]) * .66 - ny * k * .8)
        main.append(_C(a, p1, p2, b)); twig(a, p1, p2, b, 2, R)
    n = len(pts)
    for i in range(n):                                   # neighbour links around the ring
        A, B = pts[i], pts[(i + 1) % n]; (nx, ny), L = _perp(A, B); ux, uy = (B[0] - A[0]) / L, (B[1] - A[1]) / L
        mx, my = (A[0] + B[0]) / 2, (A[1] + B[1]) / 2; tl = math.hypot(c - mx, c - my); inward = ((c - mx) / tl, (c - my) / tl)
        a = (A[0] + ux * r * 1.12, A[1] + uy * r * 1.12); b = (B[0] - ux * r * 1.12, B[1] - uy * r * 1.12); k = rng.uniform(.05, .1) * R
        p1 = (a[0] + (b[0] - a[0]) * .3 + inward[0] * k, a[1] + (b[1] - a[1]) * .3 + inward[1] * k)
        p2 = (a[0] + (b[0] - a[0]) * .7 + inward[0] * k * 1.4, a[1] + (b[1] - a[1]) * .7 + inward[1] * k * 1.4)
        links.append(_C(a, p1, p2, b)); twig(a, p1, p2, b, 1, R * .8)
    for i in range(n):                                   # faint skip-one chords (the wider web)
        A, B = pts[i], pts[(i + 2) % n]; (nx, ny), L = _perp(A, B); ux, uy = (B[0] - A[0]) / L, (B[1] - A[1]) / L
        a = (A[0] + ux * r * 1.15, A[1] + uy * r * 1.15); b = (B[0] - ux * r * 1.15, B[1] - uy * r * 1.15); k = rng.uniform(-.08, .08) * R
        chords.append(_C(a, (a[0] + (b[0] - a[0]) * .35 + nx * k, a[1] + (b[1] - a[1]) * .35 + ny * k), (a[0] + (b[0] - a[0]) * .65 + nx * k, a[1] + (b[1] - a[1]) * .65 + ny * k), b))
    return ''.join(main), ''.join(links), ''.join(twigs), ''.join(chords), dots

# ---- the compositions ----
def woven_mark(ground, size=512, S=SET2):
    """The whole mark on a round linen patch (so it sits on any page), dark or light."""
    g = GROUNDS[ground]; c = size / 2; R = size * .34; r = size * .1; s = size / 512
    pts = [(c + R * math.sin(2 * math.pi * i / 7), c - R * math.cos(2 * math.pi * i / 7)) for i in range(7)]
    pid = f'ln{ground[0]}'; disc = f'<circle cx="{f1(c)}" cy="{f1(c)}" r="{f1(size * .495)}" fill="FILL"/>'
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{linen_defs(pid, g["bg"], 21 if ground == "dark" else 22, g["linen_spread"], g["gap"])}'
         f'<clipPath id="{pid}c"><circle cx="{f1(c)}" cy="{f1(c)}" r="{f1(size * .495)}"/></clipPath></defs>']
    o.append(linen_cloth(pid, disc, g['bg'], 3, size, size, g['linen_spread']))
    o.append(running(circle_d(c, c, size * .475), 1.6 * s, g['cord']['mid'], g['shadow'], st=7, gap=5, op=.8))
    main, links, twigs, chords, dots = network(size, c, pts, r)
    o.append(running(chords, 1.1 * s, g['cord']['mid'], g['shadow'], st=4, gap=4, op=.45))
    o.append(cord(twigs, 1.6 * s, g['cord'], g['tie'], g['shadow'], ties=False))
    o.append(cord(links, 3.0 * s, g['cord'], g['tie'], g['shadow']))
    o.append(cord(main, 4.2 * s, g['cord'], g['tie'], g['shadow']))
    o.append(knots(dots, 1.9 * s, g['cord'], g['shadow'], f'kn{ground[0]}'))
    o.append(satin_glyph(f'gl{ground[0]}', g['glyph_file'], c, c, size * .43, g['glyph'], g['shadow'],
                         glow=g['glyph']['hi'] if g['lit'] else None, s=s))
    for (x, y), (name, title, fn, col) in zip(pts, S):
        body = emblem_body(name)
        o.append(f'<circle cx="{f1(x + 2 * s)}" cy="{f1(y + 3 * s)}" r="{f1(r * 1.02)}" fill="{g["shadow"]}" fill-opacity=".5"/>')
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" stroke="{shade(col, .45)}" stroke-width="{size * .006:.2f}"/>')
        o.append(f'<g transform="translate({x:.1f} {y:.1f}) scale({r * .98:.2f})">{body}</g>')
        o.append(running(circle_d(x, y, r * 1.1), 2.0 * s, g['cord']['mid'], g['shadow'], st=5.5, gap=3.2))
    o.append('</svg>'); return ''.join(o)

def woven_app_icon(size=512):
    """App icon (owner's call: the glyph on linen inside one couched cord ring, not the whole
    mandala, which gets busy under ~64 px). Full-bleed night linen; the ring sits inside the 80%
    maskable safe zone, so one file serves both the plain and maskable slots."""
    g = GROUNDS['dark']; c = size / 2; s = size / 512
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><defs>{linen_defs("lni", g["bg"], 21, g["linen_spread"], g["gap"])}'
         f'<clipPath id="lnic"><rect width="{size}" height="{size}"/></clipPath></defs>']
    o.append(linen_cloth('lni', f'<rect width="{size}" height="{size}" fill="FILL"/>', g['bg'], 5, size, size, g['linen_spread']))
    o.append(cord(circle_d(c, c, size * .375), 6.4 * s, g['cord'], g['tie'], g['shadow'], step=4.2 * s))
    o.append(running(circle_d(c, c, size * .335), 1.8 * s, g['cord']['mid'], g['shadow'], st=6, gap=5, op=.6))
    o.append(satin_glyph('gli', 'glyph-live.svg', c, c + size * .015, size * .6, g['glyph'], g['shadow'], glow=g['glyph']['hi'], s=s * 1.25))
    o.append('</svg>'); return ''.join(o)

def favicon(size=64, S=SET2):
    """The small cut (owner's call: glyph + the seven branch dots). No linen, no cord: at 16 to
    32 px thread texture is noise. Night rounded square so it reads on light and dark tab strips."""
    c = size / 2; R = size * .4
    d = glyph_path('glyph-live.svg', c, c + size * .02, size * .7)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">',
         f'<rect width="{size}" height="{size}" rx="{f1(size * .22)}" fill="{DARK["bg"]}"/>']
    for i, (name, title, fn, col) in enumerate(S):
        a = 2 * math.pi * i / 7
        o.append(f'<circle cx="{f1(c + R * math.sin(a))}" cy="{f1(c - R * math.cos(a))}" r="{f1(size * .07)}" fill="{col}"/>')
    # Heavier than the large cut: a same-colour stroke fattens every strand so it survives 16 px.
    o.append(f'<path d="{d}" fill-rule="evenodd" fill="{DARK["gold"]}" stroke="{DARK["gold"]}" stroke-width="{f1(size * .03)}" stroke-linejoin="round"/></svg>')
    return ''.join(o)

def og_card(W=1200, H=630):
    """Social card: the woven mark on the left of a night-linen cloth, the lockup on the right.
    The lettering is set in Fraunces; export_png.mjs loads the vendored face before rendering, so
    ship the PNG, not this SVG."""
    g = GROUNDS['dark']; T = g['glyph']; m = woven_mark('dark', 512)
    inner = m[m.index('>') + 1:m.rindex('</svg>')]
    ms = 540; mx = 60; my = (H - ms) / 2; tx = mx + ms + 50
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs>{linen_defs("lno", g["bg"], 21, g["linen_spread"], g["gap"])}'
         f'<clipPath id="lnoc"><rect width="{W}" height="{H}"/></clipPath>'
         f'<pattern id="tsat" patternUnits="userSpaceOnUse" width="3.2" height="3.2" patternTransform="rotate(72)"><rect width="3.2" height="3.2" fill="{T["mid"]}"/><rect width="1.8" height="3.2" fill="{T["hi"]}"/><rect x="2.6" width=".6" height="3.2" fill="{T["dark"]}" fill-opacity=".6"/></pattern></defs>']
    o.append(linen_cloth('lno', f'<rect width="{W}" height="{H}" fill="FILL"/>', g['bg'], 9, W, H, g['linen_spread']))
    o.append(f'<svg x="{mx}" y="{f1(my)}" width="{ms}" height="{ms}" viewBox="0 0 512 512">{inner}</svg>')
    word = f'font-family="Fraunces, Georgia, serif" font-weight="600" font-size="118" letter-spacing="-2"'
    o.append(f'<text x="{tx + 3}" y="{H / 2 - 2}" {word} fill="{g["shadow"]}" fill-opacity=".55">OneLyf</text>')
    o.append(f'<text x="{tx}" y="{H / 2 - 6}" {word} fill="url(#tsat)" stroke="{T["dark"]}" stroke-width="1.6" paint-order="stroke">OneLyf</text>')
    o.append(knots([(tx + 8, H / 2 + 34), (tx + 26, H / 2 + 34)], 4.2, g['cord'], g['shadow'], 'kno'))
    o.append(f'<text x="{tx}" y="{H / 2 + 92}" font-family="Fraunces, Georgia, serif" font-size="35" fill="{DARK["ink"]}">Many Spaces, Woven Together</text>')
    o.append(running(f'M{tx} {H / 2 + 128}h{W - tx - 70}', 2, g['cord']['mid'], g['shadow'], st=8, gap=6, op=.8))
    o.append('</svg>'); return ''.join(o)
