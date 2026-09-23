import { pathToFileURL } from 'node:url'
// Animated PIXEL-ART Liv mascot for the terminal — the simplified glyph, roots
// growing and retracting.
//
//   node scripts/gen-glyph-pixel.mjs             # play it in the terminal
//   node scripts/gen-glyph-pixel.mjs --frames    # print frames once, no loop
//   node scripts/gen-glyph-pixel.mjs --json      # pixel grids for a CLI to embed
//   node scripts/gen-glyph-pixel.mjs --html      # HTML preview (for screenshotting)
//
// Jeff: "Look at Mistrals cat mascot. How it's an animated pixel art. THAT is
// what I'm looking for. Not this big ASCII drawing that sits still after load."
//
// TECHNIQUE: one character cell renders TWO pixels using the upper-half block
// U+2580 '▀' — foreground colours the top pixel, background the bottom. With
// 24-bit colour that gives a real pixel canvas at half the row count, which is
// how terminal mascots are done. Line-art ASCII cannot do this; it has no fill
// and no colour, which is why the previous attempts read as diagrams rather
// than as a mascot.
//
// The art is RASTERISED from the simplified glyph's geometry (the same lobes,
// spine and branching roots as gen-glyph.mjs), not hand-painted, so it stays a
// reduction of the real mark rather than a new one.
//
// Motion follows citadel/docs/liv-motion-canon.md: the crown is identical in
// every frame; only the roots grow, down and out, then withdraw.

// 24x24 -> 24 cols x 12 rows in the terminal. Strokes are ONE pixel wide: at
// this scale a 2px stroke merges the lobes into a solid blob (the first pass
// read as a gold lantern, not as Liv).
const W = 24, H = 24
const CX = (W - 1) / 2, CY = 9  // core sits high so roots have room below

// Brand gold, light theme. Index 0 is "no pixel".
// tokens.ts: gold #c08a14, goldDeep #8a630e; glow stops #ffd35e / #fffaf0.
export const PALETTE = [
  null,        // 0 transparent
  '#8a630e',   // 1 deep  — root tips, shadow side
  '#c08a14',   // 2 base  — crown body, roots
  '#e8a92a',   // 3 lit   — crown highlight
  '#ffd35e',   // 4 glow  — near the core
  '#fffaf0',   // 5 core  — the lit junction itself
]
export const PALETTE_DARK = [null, '#b98a24', '#d8a83c', '#e8b94a', '#ffd35e', '#fffaf0']

// ── geometry (mirrors gen-glyph.mjs, sampled as points to stamp) ────────────
const pt = (a, r) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r]

function lobe(angle, r0, r1, w, n = 40) {
  const out = []
  const ca = Math.cos(angle), sa = Math.sin(angle), px = -sa, py = ca
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const side = t < 0.5 ? 1 : -1
    const u = t < 0.5 ? t * 2 : (1 - t) * 2
    const r = r0 + (r1 - r0) * u
    const b = Math.sin(u * Math.PI) * w * side
    out.push([CX + ca * r + px * b, CY + sa * r + py * b])
  }
  return out
}

// Crown: four cardinal lobes, four diagonals, spine, top finial. Static.
const CROWN = []
// Flanking lobes are ROUND (east, west, south). The north lobe is deliberately
// absent — a fourth round lobe up there made the crown read as just another
// radius, which is what Jeff called "overly rounded radii that flank the crown".
for (const a of [0, Math.PI / 2, Math.PI]) CROWN.push(...lobe(a, 2.5, 7.5, 3))
// Spine kept very narrow — at w=1.4 it filled as a solid bar straight through
// the mark instead of reading as an axis.
CROWN.push(...lobe(-Math.PI / 2, -7, 6, 0.55))

// The CROWN POINT: an explicit taper, not a lobe. It rises above the flanking
// lobes and narrows to a single pixel, so the silhouette reads pointed rather
// than round. Drawn as pixels because at 24px a curve-derived taper rounds off
// in the raster and loses the point entirely.
const SPIRE = []
{
  const apexY = 0, baseY = 7          // flanking lobes top out around y=2
  for (let y = baseY; y >= apexY; y--) {
    const t = (baseY - y) / (baseY - apexY)
    const halfW = Math.max(0, Math.round((1 - t) * 2.2))
    // Math.round(CX), not CX: the canvas is an even 24 wide, so CX is 11.5 and
    // every spire pixel landed on x.5 — a 0.4-radius stamp around a half
    // coordinate covers NO integer pixel, so the whole spire rasterised to
    // nothing and the crown silently kept its old flat top.
    for (let dx = -halfW; dx <= halfW; dx++) SPIRE.push([Math.round(CX) + dx, y])
  }
}
CROWN.push(...SPIRE)

// Roots: branching, downward-biased, ordered by distance so growth reveals them
// tip-last. Width comes from run length, same as the line-art version.
const ROOTS = []
{
  const run = (x, y, a, len, steps = 14) => {
    const p = []
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      p.push([x + Math.cos(a) * len * t, y + Math.sin(a) * len * t])
    }
    return p
  }
  const mains = [
    [Math.PI * 0.50, 11], [Math.PI * 0.35, 10], [Math.PI * 0.65, 10],
    [Math.PI * 0.22, 8.5], [Math.PI * 0.78, 8.5],
    [Math.PI * 0.10, 6.5], [Math.PI * 0.90, 6.5],
  ]
  for (const [a, len] of mains) {
    const path = run(CX, CY + 2, a, len)
    ROOTS.push(...path)
    const at = path[Math.floor(path.length * 0.55)]
    for (const d of [-0.5, 0.5]) ROOTS.push(...run(at[0], at[1], a + d, len * 0.45, 7))
  }
}
// Sorted nearest-first so growth reveals them by COUNT, not by radius. Radius
// reveal stalled: the nearest root sample sits well off the core, so the first
// two steps of the ramp uncovered zero pixels and the animation held still.
ROOTS.sort((a, b) => Math.hypot(a[0] - CX, a[1] - CY) - Math.hypot(b[0] - CX, b[1] - CY))

// ── raster ──────────────────────────────────────────────────────────────────
// Stamp-based: a pixel takes a colour if it is within `r` of a geometry sample.
// Simpler and steadier than scanline-filling nine overlapping lobes at 22px.
function stamp(grid, pts, r, colour) {
  for (const [x, y] of pts) {
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r))
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r))
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        if (Math.hypot(px - x, py - y) <= r) grid[py][px] = Math.max(grid[py][px], colour)
      }
    }
  }
}

/** One frame; t in 0..1 is how far the roots have grown. */
export function pixelFrame(t) {
  const g = Array.from({ length: H }, () => new Array(W).fill(0))
  const n = Math.round(t * ROOTS.length)
  const grown = ROOTS.slice(0, n)
  stamp(g, grown, 0.35, 1)
  stamp(g, grown.slice(0, Math.floor(n * 0.55)), 0.35, 2)   // older growth is brighter
  stamp(g, CROWN, 0.4, 2)
  stamp(g, CROWN.filter(([x, y]) => Math.hypot(x - CX, y - CY) < 5.5), 0.4, 3)
  // Core glow: a small lit junction that brightens as the roots reach full
  // extension. (The first cut of this had a broken precedence chain that always
  // evaluated to 4.)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - CX, y - CY)
      // Only the innermost pixels are painted unconditionally; beyond that the
      // glow LIGHTS existing pixels rather than filling empty ones. Filling
      // produced a solid cream block that read as a hole punched in the mark.
      if (d <= 0.9) g[y][x] = 5
      else if (d <= 2.0 && g[y][x] > 0) g[y][x] = Math.max(g[y][x], t > 0.45 ? 5 : 4)
      else if (d <= 3.6 && g[y][x] > 0) g[y][x] = Math.max(g[y][x], 4)
    }
  }
  return g
}

const STEPS = 10
// Consecutive identical frames are dropped, and so is a final frame equal to the
// first. Both happen naturally: early growth steps land under the crown and add
// no visible pixels, and the retract ends where the loop restarts. Either one
// shows up as the animation HOLDING STILL, which is exactly the complaint that
// started this. Deduping here keeps it true no matter how the ramp is retuned.
const dedupe = list => {
  const out = []
  for (const f of list) {
    const k = JSON.stringify(f)
    if (out.length && JSON.stringify(out[out.length - 1]) === k) continue
    out.push(f)
  }
  while (out.length > 1 && JSON.stringify(out[out.length - 1]) === JSON.stringify(out[0])) out.pop()
  return out
}
export const pixelFrames = dedupe([
  ...Array.from({ length: STEPS }, (_, i) => pixelFrame(i / (STEPS - 1))),
  ...Array.from({ length: STEPS - 2 }, (_, i) => pixelFrame(1 - (i + 1) / (STEPS - 1))),
])

// ── terminal output ─────────────────────────────────────────────────────────
// COLOUR MODE. 256 is the DEFAULT, not a fallback: macOS Terminal.app — Jeff's
// terminal — has no truecolor support at all, and a 24-bit escape there gets
// misparsed into arbitrary palette entries. He saw grey and green instead of
// gold. Truecolor is used only when the terminal actually advertises it.
const TRUECOLOR = /^(truecolor|24bit)$/i.test(process.env.COLORTERM || '')
  || process.argv.includes('--truecolor')

const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))

// Nearest xterm-256 index: the 6x6x6 colour cube (16-231) or the grey ramp
// (232-255), whichever is closer.
function xterm256(hex) {
  const [r, g, b] = rgb(hex)
  const q = v => { const L = [0, 95, 135, 175, 215, 255]; let bi = 0
    for (let i = 1; i < 6; i++) if (Math.abs(L[i] - v) < Math.abs(L[bi] - v)) bi = i
    return bi }
  const ci = [q(r), q(g), q(b)]
  const L = [0, 95, 135, 175, 215, 255]
  const cubeErr = Math.hypot(L[ci[0]] - r, L[ci[1]] - g, L[ci[2]] - b)
  const cube = 16 + 36 * ci[0] + 6 * ci[1] + ci[2]
  const gi = Math.max(0, Math.min(23, Math.round((((r + g + b) / 3) - 8) / 10)))
  const gv = 8 + gi * 10
  const greyErr = Math.hypot(gv - r, gv - g, gv - b)
  return greyErr < cubeErr ? 232 + gi : cube
}

const fg = c => TRUECOLOR
  ? `\x1b[38;2;${rgb(c).join(';')}m`
  : `\x1b[38;5;${xterm256(c)}m`
const bg = c => TRUECOLOR
  ? `\x1b[48;2;${rgb(c).join(';')}m`
  : `\x1b[48;5;${xterm256(c)}m`
const RESET = '\x1b[0m'

/** Render a pixel grid as half-block rows: one cell = two vertical pixels. */
export function toAnsi(grid, palette = PALETTE) {
  const rows = []
  for (let y = 0; y < H; y += 2) {
    let line = ''
    for (let x = 0; x < W; x++) {
      const top = palette[grid[y][x]], bot = palette[grid[y + 1]?.[x] ?? 0]
      if (!top && !bot) { line += RESET + ' '; continue }
      line += (top ? fg(top) : '') + (bot ? bg(bot) : '\x1b[49m') + (top ? '▀' : ' ') + RESET
    }
    rows.push(line)
  }
  return rows.join('\n')
}

export const ansiFrames = pixelFrames.map(f => toAnsi(f))

// Filename-agnostic main-module check. Matching on the filename meant a renamed
// or copied script silently produced NO output at all — it imported fine and
// then did nothing, which looks identical to a broken install.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const a = process.argv
  if (a.includes('--json')) {
    console.log(JSON.stringify({ w: W, h: H, palette: PALETTE, paletteDark: PALETTE_DARK, frames: pixelFrames }))
  } else if (a.includes('--html')) {
    const cell = 12
    const box = (g, pal, label) => `<figure><div class="px" style="width:${W * cell}px;height:${H * cell}px">`
      + g.map((row, y) => row.map((v, x) => v ? `<i style="left:${x * cell}px;top:${y * cell}px;background:${pal[v]}"></i>` : '').join('')).join('')
      + `</div><figcaption>${label}</figcaption></figure>`
    const picks = [0, 3, 6, 9]
    console.log(`<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:20px;background:#2a2a28;color:#e8e4d6;font:12px system-ui;display:flex;flex-wrap:wrap;gap:18px}
      .row{display:flex;gap:18px;padding:14px;border-radius:10px}
      .light{background:#f4efe1}.dark{background:#171b16}
      .px{position:relative;image-rendering:pixelated}
      .px i{position:absolute;width:${cell}px;height:${cell}px}
      figure{margin:0;text-align:center}figcaption{margin-top:6px;opacity:.7}
      .light figcaption{color:#1c2b21}.dark figcaption{color:#e8e4d6}
      h3{width:100%;margin:6px 0;font:600 12px system-ui;letter-spacing:.07em;text-transform:uppercase;opacity:.6}
    </style>
    <h3>light ground — frames ${picks.join(' / ')} of ${pixelFrames.length}</h3>
    <div class="row light">${picks.map(i => box(pixelFrames[i], PALETTE, 'frame ' + i)).join('')}</div>
    <h3>dark ground</h3>
    <div class="row dark">${picks.map(i => box(pixelFrames[i], PALETTE_DARK, 'frame ' + i)).join('')}</div>`)
  } else if (a.includes('--frames')) {
    ansiFrames.forEach((f, i) => { console.log(`--- ${i} ---`); console.log(f) })
  } else {
    let i = 0
    process.stdout.write('\x1b[?25l')
    const rows = H / 2
    const tick = () => {
      process.stdout.write(ansiFrames[i % ansiFrames.length] + '\n')
      process.stdout.write(`\x1b[${rows}A`)
      i++
    }
    const id = setInterval(tick, 110)
    setTimeout(() => { clearInterval(id); process.stdout.write(`\x1b[${rows}B\x1b[?25h\n`) }, 4000)
  }
}
