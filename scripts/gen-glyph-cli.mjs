import { pathToFileURL } from 'node:url'
// Terminal frames of the Liv mark: static crown, roots spreading fractally.
//
//   node scripts/gen-glyph-cli.mjs            # preview all frames
//   node scripts/gen-glyph-cli.mjs --json     # for a CLI to embed
//
// For the enriched Liv CLI's thinking spinner (liv-console/cli/src/theme.ts).
//
// WHAT THIS IS, after three wrong turns:
//  1. A density raster of the INTERLACED glyph — saturated to mush, unreadable.
//  2. A plain eight-armed asterisk — clean but it lost the crown, so it stopped
//     reading as Liv at all. Jeff: "that looks worse than before."
//  3. This. Jeff: "Keep the simple form but include the iconic crown with the
//     fractal like spreading of the roots as the frames progress."
//
// So: the crown is a fixed piece of line art — finial, knot, lateral petals —
// and it is IDENTICAL in every frame, per citadel/docs/liv-motion-canon.md ("the
// crown never moves; only the roots grow, down and out"). The roots below are a
// branching system that spreads as the loop progresses, then withdraws.
//
// This is a hand-placed doodle, which Jeff authorised explicitly for the CLI
// ("I'm open to a terminal doodle rather than the ASCII"). It is the ONE
// sanctioned exception to the law against hand-drawing a Liv mark. Do not read
// it as licence anywhere else.

// CORE_ROW 4 puts the crown on rows 0-3 with no dead leading row — a spinner
// should not waste a terminal line on blank padding.
const COLS = 25, ROWS = 14, CX = 12, CORE_ROW = 4

// The crown: finial, knot, lateral petals. Static in every frame.
const CROWN = [
  '    ◦    ',
  '   ╱╲    ',
  '  ╲╳╱   ',
  '╲──╯╰──╱',
]

const CORE = ['·', '∘', '◦', '●', '◉']
const ch = d => (d < 0 ? '╱' : d > 0 ? '╲' : '│')

// A few long mains, each throwing forks partway down, each fork throwing one
// more. Width comes from run LENGTH, not branching factor — on a character grid
// a clean diagonal moves exactly one column per row, so a wide spread needs a
// long run. An earlier pass recursed deeply instead and packed the roots into a
// solid block of slashes.
const MAINS = [
  { dx: -1, len: 7, forks: [[3, 0, 3], [5, -1, 2]] },
  { dx: 1, len: 7, forks: [[3, 0, 3], [5, 1, 2]] },
  { dx: -1, len: 4, forks: [[2, -1, 3]] },
  { dx: 1, len: 4, forks: [[2, 1, 3]] },
  { dx: 0, len: 6, forks: [[2, -1, 3], [4, 1, 2]] },
]

function rootSegments() {
  const out = []
  const run = (x, y, dx, len) => {
    const path = []
    for (let i = 0; i < len; i++) {
      x += dx; y += 1
      if (y >= ROWS || x < 1 || x >= COLS - 1) break
      path.push([x, y, ch(dx)])
    }
    return path
  }
  for (const m of MAINS) {
    const path = run(CX, CORE_ROW, m.dx, m.len)
    out.push(...path)
    for (const [at, fdx, flen] of m.forks) {
      const node = path[Math.min(at, path.length - 1)]
      if (!node) continue
      const fork = run(node[0], node[1], fdx, flen)
      out.push(...fork)
      // one more generation, so the spread reads as fractal rather than as a fan
      const tip = fork[fork.length - 1]
      if (tip) out.push(...run(tip[0], tip[1], fdx === 0 ? -1 : 0, 2))
    }
  }
  return out
}

const SEGMENTS = rootSegments()
const MAX_ROOT_ROW = Math.max(...SEGMENTS.map(s => s[1])) - CORE_ROW

/** One frame: roots revealed down to `depth` rows below the core. */
export function frame(depth) {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '))
  CROWN.forEach((line, i) => {
    const y = CORE_ROW - CROWN.length + i
    const start = CX - Math.floor(line.length / 2)
    ;[...line].forEach((c, k) => { if (c !== ' ' && y >= 0) g[y][start + k] = c })
  })
  for (const [x, y, c] of SEGMENTS) {
    if (y <= CORE_ROW + depth && g[y][x] === ' ') g[y][x] = c
  }
  const t = depth / MAX_ROOT_ROW
  g[CORE_ROW][CX] = CORE[Math.min(CORE.length - 1, Math.round(t * (CORE.length - 1)))]
  // Padded, never right-trimmed: rows that change length make a spinner jitter.
  return g.map(r => r.join('').padEnd(COLS, ' ')).join('\n')
}

// Grow then withdraw. Stops one step short of 0 so the wrap back to frame 0 is
// itself the last step of the retract — no repeated frame, no visible hitch.
export const frames = [
  ...Array.from({ length: MAX_ROOT_ROW + 1 }, (_, i) => frame(i)),
  ...Array.from({ length: MAX_ROOT_ROW - 1 }, (_, i) => frame(MAX_ROOT_ROW - 1 - i)),
]

/** Single-line variant for an inline "Thinking…" status line.
 *
 *  The crown cannot fit on one row, so this is not a crop of the block — it is
 *  the mark reduced to its core and spreading threads. Generated at its own
 *  reach and centred in a fixed field: cropping the block gave 1..13-char rows
 *  (which shove the text after the spinner sideways) and clipped growth steps
 *  (which made consecutive frames identical and the spinner hitch). */
export const INLINE_COLS = 9
const INLINE_REACH = (INLINE_COLS - 1) / 2
function inlineFrame(t) {
  const reach = Math.round(INLINE_REACH * t)
  const arm = '─'.repeat(reach)
  const core = CORE[Math.min(CORE.length - 1, Math.round(t * (CORE.length - 1)))]
  const body = arm + core + arm
  const left = Math.floor((INLINE_COLS - body.length) / 2)
  return (' '.repeat(left) + body).padEnd(INLINE_COLS, ' ')
}
export const inlineFrames = [
  ...Array.from({ length: INLINE_REACH + 1 }, (_, i) => inlineFrame(i / INLINE_REACH)),
  ...Array.from({ length: INLINE_REACH - 1 }, (_, i) => inlineFrame(1 - (i + 1) / INLINE_REACH)),
]

// Filename-agnostic main-module check. Matching on the filename meant a renamed
// or copied script silently produced NO output at all — it imported fine and
// then did nothing, which looks identical to a broken install.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ cols: COLS, rows: ROWS, frames, inlineCols: INLINE_COLS, inlineFrames }, null, 2))
  } else {
    frames.forEach((f, i) => { console.log(`--- ${i} ---`); console.log(f) })
    console.log('--- inline ---')
    inlineFrames.forEach((f, i) => console.log(String(i).padStart(2), '[' + f + ']'))
  }
}
