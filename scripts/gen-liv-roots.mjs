// Generate the Liv glyph's roots from the brand film, as vectors.
//
//   node scripts/gen-liv-roots.mjs
//
// Writes:
//   src/assets/glyph-rooted.svg   the live glyph with the film's roots grown out of its stubs (static)
//   src/livRoots.ts               the same roots as data for LivGlyphGrow (outline, centreline, timing)
//
// The roots are the film's (film/onelyf.v3.4.html, RSTRANDS), same seed and same walk: seeded
// random-walk strands from the live glyph's stub tips, wandering curvature, the odd kink, a pull
// outward from the core that weakens with each branch order, uneven branching and dead ends. Each
// root stops near the edge of a rounded dome, so the whole reads as a well-grown tree turned over
// while the individual roots stay asymmetric (Jeff, 2026-09-26: "less fractal, more entropy", then
// "less chaos ... roughly even like a well rounded tree").
//
// One change from the film: its dome (rx 400, ry 390) runs well outside the glyph's 549 x 748 box,
// which the film could afford on a 1080 canvas. Here the dome is fitted inside the box so the asset
// keeps the glyph's aspect and every caller's layout. Everything else is in the same box units.

import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const TAU = Math.PI * 2
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
// film/core.js rng: the same seed gives the same roots as the film's walk
function rng(seed) { let a = (seed * 1000003) >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

const VB_W = 549, VB_H = 748, CORE_X = 274, CORE_Y = 443
// Stub tips of glyph-live.svg: [x, y, heading in degrees, 90 = straight down] (as in the film).
const ROOT_TIPS = [
  [88, 474, 165], [124, 497, 125], [157, 542, 118], [109, 565, 130], [75, 568, 150], [119, 576, 112],
  [153, 590, 105], [183, 600, 95], [210, 585, 82], [250, 619, 96], [274, 675, 90], [300, 619, 84],
  [340, 584, 98], [366, 600, 85], [397, 591, 75], [394, 542, 62], [431, 576, 68], [472, 568, 30],
  [416, 507, 55], [461, 471, 15],
]
// The film's dome, fitted inside the box: about 7 units clear of the sides and 12 of the bottom (strands overshoot the edge a little).
const ROOT_DOME = { x: CORE_X, y: 470, rx: 268, ry: 266 }
const ROOT_FILL = '#724213'   // the glyph's own strand colour in glyph-live.svg
// The film's widths (9-14 units at the base) are drawn at ~270 px on a dark cloth; at icon sizes on
// the glyph's own box they came out thicker than the stubs they grow from, and read as brush strokes.
// 0.4, so a root starts about as wide as the stub tip it grows from.
const ROOT_W = .4

const domeR = (x, y) => Math.hypot((x - ROOT_DOME.x) / ROOT_DOME.rx, (y - ROOT_DOME.y) / ROOT_DOME.ry)
const angTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

// ── the walk: a straight port of RSTRANDS (the film's colour mix is dropped) ──
function grow() {
  const r = rng(404), out = []
  const reachAt = (s, u) => u <= 0 ? 0 : Math.min(s.len, s.v * u + s.A * (Math.sin(s.w * u + s.ph) - Math.sin(s.ph)))
  const toEdge = (x, y, a) => { let d = 0; while (domeR(x + Math.cos(a) * d, y + Math.sin(a) * d) < 1 && d < 900) d += 4; return d }
  function strand(x, y, a, len, w0, depth, t0, v) {
    const pts = [[x, y]], cum = [0], edge = .93 + r() * .1
    let ang = a, curv = (r() - .5) * .05, L = 0
    while (L < len) {
      curv = clamp((curv + (r() - .5) * .04) * .93, -.07, .07)
      ang += curv + (r() - .5) * .1
      if (r() < .012) ang += (r() - .5) * .6                            // a stone in the way
      ang += angTo(ang, Math.atan2(y - CORE_Y, x - CORE_X)) * [.035, .02, .01, .005][depth]  // outward from the core
      if (y < 470) ang += angTo(ang, Math.PI / 2) * .3                  // never climb into the crown
      const st = 7 * (.7 + r() * .6)
      x += Math.cos(ang) * st; y += Math.sin(ang) * st; L += st
      pts.push([x, y]); cum.push(L)
      if (domeR(x, y) > edge) break
    }
    const w = TAU * (.7 + r() * .9)
    const s = { pts, cum, len: L, w0, t0, v, w, A: .6 * v / w, ph: r() * TAU, depth }
    out.push(s)
    if (depth >= 3 || pts.length < 6) return
    const nb = Math.floor(r() * [3, 2.4, 1.6][depth]) + (depth === 0 ? 1 : 0)
    for (let k = 0; k < nb; k++) {
      const i = 2 + Math.floor(r() * (pts.length * .8 - 2)), f = cum[i] / L
      let u = 0; while (reachAt(s, u) < cum[i]) u += .02               // when the parent's tip passes here
      const side = r() < .5 ? -1 : 1, da = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
      strand(pts[i][0], pts[i][1], da + side * (.35 + r() * .8), (L - cum[i]) * (.3 + r() * .6) + r() * 30,
        w0 * (1 - .55 * f) * (.55 + r() * .25), depth + 1, t0 + u + r() * .2, v * (.8 + r() * .3))
    }
  }
  for (const [x, y, deg] of ROOT_TIPS) {
    const a = deg * Math.PI / 180 + (r() - .5) * .3, len = toEdge(x, y, a) * (.9 + r() * .15)
    strand(x, y, a, len, (9 + r() * 5) * ROOT_W, 0, .7 + r() * .35, len / (2.4 + r() * .5))
  }
  // when each strand's tip reaches its end (the film's surge-and-pause speed)
  for (const s of out) { let u = 0; while (reachAt(s, u) < s.len - .01) u += .01; s.t1 = s.t0 + u }
  return out
}

// ── geometry ─────────────────────────────────────────────────────────────────
const f1 = v => (Math.round(v * 10) / 10).toString()
// Ramer-Douglas-Peucker on a polyline, keeping the widths of the points it keeps.
function simplify(pts, eps) {
  if (pts.length < 3) return pts.map((_, i) => i)
  const keep = new Set([0, pts.length - 1])
  const rec = (a, b) => {
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    let best = -1, bi = -1
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > best) { best = d; bi = i } }
    if (best > eps) { keep.add(bi); rec(a, bi); rec(bi, b) }
  }
  rec(0, pts.length - 1)
  return [...keep].sort((a, b) => a - b)
}
// A strand as the film draws it once fully grown: tapered from w0 down to a fine tip.
function outline(s) {
  const idx = simplify(s.pts, .4), P = idx.map(i => s.pts[i]), C = idx.map(i => s.cum[i])
  // a main root eases out of its stub over its first 14 units rather than stepping out of it
  const base = c => s.depth === 0 ? .6 + .4 * Math.min(1, c / 14) : 1
  const wAt = c => Math.max(.6, s.w0 * base(c) * (1 - .88 * c / s.len) * Math.min(1, .45 + s.len / 300))
  const L = [], R = []
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, h = wAt(C[i]) / 2
    L.push([P[i][0] - dy / n * h, P[i][1] + dx / n * h]); R.push([P[i][0] + dy / n * h, P[i][1] - dx / n * h])
  }
  const pt = p => `${f1(p[0])} ${f1(p[1])}`
  const o = `M${L.map(pt).join('L')}L${R.reverse().map(pt).join('L')}Z`
  const c = `M${P.map(pt).join('L')}`
  return { o, c }
}

const strands = grow()
const T0 = Math.min(...strands.map(s => s.t0)), T1 = Math.max(...strands.map(s => s.t1))
const roots = strands.map(s => {
  const { o, c } = outline(s)
  return {
    o, c,
    w: Math.round(s.w0 + 4),                                   // the reveal stroke covers the tapered body
    s: +((s.t0 - T0) / (T1 - T0)).toFixed(3),                  // when it starts growing, 0..1 of the whole
    g: +(Math.max(.02, (s.t1 - s.t0) / (T1 - T0))).toFixed(3), // how long it takes, 0..1 of the whole
  }
})

// ── outputs ──────────────────────────────────────────────────────────────────
// 1. glyph-rooted.svg: the live glyph, with the roots under its strands (the stubs overlap them).
const live = readFileSync(new URL('src/assets/glyph-live.svg', root), 'utf8')
const at = live.indexOf('<path')
if (at < 0) throw new Error('glyph-live.svg: no <path> to put the roots under')
const rootsSvg = `<g fill="${ROOT_FILL}">${roots.map(r => `<path d="${r.o}"/>`).join('')}</g>`
const rooted = (live.slice(0, at) + rootsSvg + live.slice(at)).replace(/id="liv"/, 'id="rooted"').replace(/url\(#liv\)/g, 'url(#rooted)')
writeFileSync(new URL('src/assets/glyph-rooted.svg', root), rooted)

// 2. livRoots.ts: the data LivGlyphGrow draws and reveals.
const ts = `// GENERATED by scripts/gen-liv-roots.mjs. Do not edit; re-run the script.
// The Liv glyph's roots, from the brand film (film/onelyf.v3.4.html), in the glyph's 549 x 748 box.
//   o  the strand's tapered outline (filled ${ROOT_FILL})
//   c  its centreline, stroked into a mask to reveal the outline as the strand grows
//   w  the width of that reveal stroke
//   s  when the strand starts growing, and g how long it takes, as fractions of the whole growth
//      (children start as their parent's tip passes the branch point, as in the film)
export const LIV_ROOT_FILL = '${ROOT_FILL}'

export interface LivRoot { o: string; c: string; w: number; s: number; g: number }

export const LIV_ROOTS: readonly LivRoot[] = [
${roots.map(r => `  { o: '${r.o}', c: '${r.c}', w: ${r.w}, s: ${r.s}, g: ${r.g} },`).join('\n')}
]
`
writeFileSync(new URL('src/livRoots.ts', root), ts)

const bounds = strands.flatMap(s => s.pts).reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9])
console.log(`${strands.length} strands (by depth ${[0, 1, 2, 3].map(d => strands.filter(s => s.depth === d).length).join('/')}), ` +
  `bounds x ${bounds[0].toFixed(0)}..${bounds[2].toFixed(0)} y ${bounds[1].toFixed(0)}..${bounds[3].toFixed(0)}; ` +
  `glyph-rooted.svg ${(rooted.length / 1024).toFixed(0)} KB, livRoots.ts ${(ts.length / 1024).toFixed(0)} KB`)
