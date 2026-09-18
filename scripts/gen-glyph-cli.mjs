// Terminal frames of the SIMPLIFIED Liv mark, threads growing and retracting.
//
//   node scripts/gen-glyph-cli.mjs            # preview all frames
//   node scripts/gen-glyph-cli.mjs --json     # for a CLI to embed
//
// For the enriched Liv CLI's thinking spinner (liv-console/cli/src/theme.ts).
//
// WHICH MARK: the SIMPLIFIED curve glyph from src/LivThinking.tsx — the eight-
// armed rosette with a vertical spine and looped finials — NOT the interlaced
// traced glyph. Jeff, 2026-09-17: "I am wanting the simpler rendering you
// created earlier before I redirected you to the interlace icon." The interlace
// is unrepresentable in a character grid; the simplified mark is not, because it
// is already radial lines around a lit core, which is what box-drawing
// characters do well.
//
// WHY A DOODLE AND NOT A RASTER: an earlier pass rasterised the real geometry
// into a density field. It saturated to mush and read as a blob. Jeff: "I'm open
// to a terminal doodle rather than the ASCII." So the arms are PLACED, using
// line characters whose slope matches each arm's direction — a faithful
// reduction of the simplified mark, authorised explicitly. This is the one
// sanctioned exception to "never hand-draw a Liv mark"; do not extend it.
//
// Motion follows citadel/docs/liv-motion-canon.md: threads grow outward from the
// core and withdraw the way they came. The crown/roots split does NOT apply here
// — that governs the INTERLACED glyph, which has a crown. The simplified mark is
// radially symmetric, which is how Jeff approved it.

const COLS = 15, ROWS = 9
const CX = 7, CY = 4

// Eight arms. Step per unit, and the character whose slope matches the arm.
// Horizontal reach is longer in CELLS than vertical because terminal cells are
// roughly twice as tall as wide — equal counts render as a tall thin cross.
const ARMS = [
  { dx: 0, dy: -1, ch: '│', max: 3, spine: true },   // N
  { dx: 0, dy: 1, ch: '│', max: 3, spine: true },    // S
  { dx: 1, dy: 0, ch: '─', max: 6 },                 // E
  { dx: -1, dy: 0, ch: '─', max: 6 },                // W
  { dx: 1, dy: -1, ch: '╱', max: 3 },                // NE
  { dx: -1, dy: 1, ch: '╱', max: 3 },                // SW
  { dx: -1, dy: -1, ch: '╲', max: 3 },               // NW
  { dx: 1, dy: 1, ch: '╲', max: 3 },                 // SE
]

// The lit core, brightening as the threads reach full extension — the amber
// junction, which is the whole point of the `live` state.
const CORE = ['·', '∘', '◦', '●', '◉']
// Looped finials cap the spine at full reach; the real mark has them top+bottom.
const FINIAL = '◦'

/** One frame at growth fraction t (0 = threads withdrawn, 1 = fully extended). */
export function frame(t) {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '))
  for (const a of ARMS) {
    const reach = Math.round(a.max * t)
    for (let i = 1; i <= reach; i++) {
      const x = CX + a.dx * i, y = CY + a.dy * i
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue
      g[y][x] = a.ch
    }
    if (a.spine && reach === a.max) {
      const x = CX + a.dx * (reach + 1), y = CY + a.dy * (reach + 1)
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = FINIAL
    }
  }
  g[CY][CX] = CORE[Math.min(CORE.length - 1, Math.round(t * (CORE.length - 1)))]
  // Padded, never right-trimmed: variable-length rows make a spinner jitter.
  return g.map(r => r.join('').padEnd(COLS, ' ')).join('\n')
}

// Grow then retract. Stops one step short of 0 so the wrap back to frame 0 is
// itself the final step of the retract — no repeated frame, no visible hitch.
const STEPS = 7
export const frames = [
  ...Array.from({ length: STEPS }, (_, i) => frame(i / (STEPS - 1))),
  ...Array.from({ length: STEPS - 2 }, (_, i) => frame(1 - (i + 1) / (STEPS - 1))),
]

/** Single-line variant for an inline "Thinking…" line.
 *
 *  Generated at its OWN reach rather than sliced out of the block frames. Two
 *  reasons, both found by looking at the output:
 *   - fixed width. Trimmed rows run 1..13 chars as the arms extend, which shoves
 *     any text after the spinner sideways on every tick.
 *   - no stalls. Slicing a 9-cell window out of a mark whose arms reach 6 clips
 *     the last two growth steps, so consecutive frames came out identical and
 *     the spinner visibly hitched twice per cycle. */
export const INLINE_COLS = 9
const INLINE_REACH = (INLINE_COLS - 1) / 2

function inlineFrame(t) {
  const reach = Math.round(INLINE_REACH * t)
  const arm = '\u2500'.repeat(reach)
  const core = CORE[Math.min(CORE.length - 1, Math.round(t * (CORE.length - 1)))]
  const body = arm + core + arm                        // length 2*reach + 1, max == INLINE_COLS
  const left = Math.floor((INLINE_COLS - body.length) / 2)
  return (' '.repeat(left) + body).padEnd(INLINE_COLS, ' ')
}

export const inlineFrames = [
  ...Array.from({ length: INLINE_REACH + 1 }, (_, i) => inlineFrame(i / INLINE_REACH)),
  ...Array.from({ length: INLINE_REACH - 1 }, (_, i) => inlineFrame(1 - (i + 1) / INLINE_REACH)),
]

if (process.argv[1] && process.argv[1].endsWith('gen-glyph-cli.mjs')) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ cols: COLS, rows: ROWS, frames, inlineFrames }, null, 2))
  } else {
    frames.forEach((f, i) => { console.log(`--- ${i} ---`); console.log(f) })
    console.log('--- inline ---')
    inlineFrames.forEach((f, i) => console.log(String(i).padStart(2), '[' + f + ']'))
  }
}
