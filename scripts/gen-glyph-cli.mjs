// Terminal frames of the Liv mark with its roots growing and retracting.
//
//   node scripts/gen-glyph-cli.mjs            # preview all frames
//   node scripts/gen-glyph-cli.mjs --json     # {frames: string[][]} for a CLI to embed
//
// For the enriched Liv CLI's thinking spinner. A terminal cannot render SVG, so
// the mark is rasterised into a character grid — but it is RASTERISED FROM THE
// CANONICAL GEOMETRY (the same lobes/spine/roots as scripts/gen-glyph.mjs), not
// hand-drawn as ASCII art. That matters: the standing law forbids inventing an
// L/dot/spark mark for Liv, and a hand-drawn terminal doodle would be exactly
// that. This is a reduction of the real mark, which Jeff blessed for CLI use
// ("that could be fine for the CLI thinking pulse").
//
// Motion follows canon (citadel/docs/liv-motion-canon.md): the CROWN IS STATIC
// in every frame; only the roots extend down and outward, then withdraw.
//
// Terminal cells are about twice as tall as they are wide, so y is compressed
// by ASPECT or the mark comes out stretched.

const CX = 50, CY = 50
// The core sits high in the grid, not centred: the crown occupies the rows above
// it and the roots need clear rows BELOW to grow into. Centring the mark put the
// roots straight through the crown arms, where they were invisible.
const COLS = 23, ROWS = 13, CORE_ROW = 4
const ASPECT = 0.5

// ── geometry, same constants as gen-glyph.mjs ───────────────────────────────
const lobePts = (angle, r0, r1, w, n = 26) => {
  const ca = Math.cos(angle), sa = Math.sin(angle), px = -sa, py = ca
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // quadratic out along one side and back along the other
    const side = t < 0.5 ? 1 : -1
    const u = t < 0.5 ? t * 2 : (1 - t) * 2
    const r = r0 + (r1 - r0) * u
    const bulge = Math.sin(u * Math.PI) * w * side
    out.push([CX + ca * r + px * bulge, CY + sa * r + py * bulge])
  }
  return out
}

// UPPER AND LATERAL LOBES ONLY. gen-glyph.mjs draws a symmetric 4-fold rosette,
// which at SVG scale is fine — but it puts a lobe pointing straight DOWN, into
// the exact cells the roots need. The real traced mark is crown above / roots
// below, so the reduction follows that: the south lobe and the two lower
// diagonals are dropped and the roots inherit the space.
const UP = -Math.PI / 2
const ORNAMENT = [
  lobePts(UP, 6, 30, 9),                    // north
  lobePts(0, 6, 30, 9),                     // east
  lobePts(Math.PI, 6, 30, 9),               // west
  lobePts(UP - Math.PI / 4, 5, 22, 6.5),    // upper-left diagonal
  lobePts(UP + Math.PI / 4, 5, 22, 6.5),    // upper-right diagonal
  lobePts(UP, -6, 34, 4.6),                 // spine, upper half only
]

// Roots: down-and-outward fan, more below the axis than above — the thing that
// makes it read as a root system rather than a starburst.
// LOWER HEMISPHERE ONLY (0 < a < PI puts +y downward on screen). The SVG version
// fans roots all round because the crown there is drawn at a scale where they
// read; in a 23-cell grid an upward root lands inside a crown arm and vanishes.
const ROOT_SPEC = [
  [Math.PI * 0.50, 46, 0.00],
  [Math.PI * 0.62, 44, 0.26], [Math.PI * 0.38, 44, -0.26],
  [Math.PI * 0.74, 40, 0.30], [Math.PI * 0.26, 40, -0.30],
  [Math.PI * 0.86, 34, 0.34], [Math.PI * 0.14, 34, -0.34],
]
const rootPts = (a0, len, curve, n = 22) => {
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = a0 + curve * t * t
    const r = 7 + len * t
    out.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r])
  }
  return out
}
const ROOTS = ROOT_SPEC.map(([a, l, c]) => rootPts(a, l, c))

// ── raster ──────────────────────────────────────────────────────────────────
// Two LAYERS, not one accumulating density field. A single field saturated to
// solid at this resolution — nine overlapping lobes fill the middle and the
// roots disappear inside the crown, so growth became invisible. Crown and roots
// get distinct glyphs instead, which is what makes the motion legible in a cell
// grid this coarse.
const CROWN_CH = '*'
const ROOT_CH = '.'
const CORE_CH = '@'

const cell = (x, y) => {
  const gx = Math.round(((x - CX) / 50) * ((COLS - 1) / 2) + (COLS - 1) / 2)
  const gy = Math.round(((y - CY) / 50) * ASPECT * ((ROWS - 1) / 2) * 2 + CORE_ROW)
  return (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) ? null : [gx, gy]
}

// Only the OUTER reach of each lobe is plotted — the arms, not the filled body.
// The interlace itself is unrepresentable at 23x11 and trying to draw it is what
// produced the solid blob.
const crownMarks = () => {
  const out = []
  for (const l of ORNAMENT) {
    for (let i = 0; i < l.length; i++) {
      const [x, y] = l[i]
      if (Math.hypot(x - CX, y - CY) < 14) continue   // skip the crowded centre
      out.push([x, y])
    }
  }
  return out
}
const CROWN = crownMarks()

/** One frame at root-growth fraction t (0 = roots hidden, 1 = fully extended). */
export function frame(t) {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '))
  for (const r of ROOTS) {                          // roots first, crown wins overlaps
    const keep = Math.max(0, Math.round(r.length * t))
    for (let i = 1; i < keep; i++) {
      const c = cell(...r[i]); if (c) grid[c[1]][c[0]] = ROOT_CH
    }
  }
  for (const [x, y] of CROWN) {                     // crown — identical every frame
    const c = cell(x, y); if (c) grid[c[1]][c[0]] = CROWN_CH
  }
  grid[CORE_ROW][Math.floor(COLS / 2)] = CORE_CH
  // Rows are padded to COLS, never right-trimmed. Trimming makes rows change
  // length as the roots extend, which makes a terminal spinner jitter and
  // breaks any fixed-width redraw the CLI does.
  return grid.map(row => row.join('').padEnd(COLS, ' ')).join('\n')
}

// Grow then retract, ending where it started so the loop wraps with no jump.
const STEPS = 8
export const frames = [
  ...Array.from({ length: STEPS }, (_, i) => frame(i / (STEPS - 1))),
  ...Array.from({ length: STEPS - 2 }, (_, i) => frame(1 - (i + 1) / (STEPS - 1))),
]

/** Single-line variant: the middle band, for an inline "Thinking…" spinner. */
export const inlineFrames = frames.map(f => {
  const rows = f.split('\n')
  return rows[CORE_ROW].trim()
})

if (process.argv[1] && process.argv[1].endsWith('gen-glyph-cli.mjs')) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ cols: COLS, rows: ROWS, frames, inlineFrames }, null, 2))
  } else {
    frames.forEach((f, i) => {
      console.log(`--- frame ${i} ---`)
      console.log(f)
    })
    console.log('--- inline ---')
    inlineFrames.forEach((f, i) => console.log(String(i).padStart(2), f))
  }
}
