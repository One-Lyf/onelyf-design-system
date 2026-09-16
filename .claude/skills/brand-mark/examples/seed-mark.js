// Worked example: the Liv seed — a gold core inside a drawn ring.
// Shows the whole vocabulary in one file: baked wobble, smooth organic curves,
// hatch and dot finishes, grain, crayon, a value ramp, and a line-only cut for
// small sizes. Copy this file as the starting point for a new mark.
import { color, colorDark, ground, ramp, alpha, contrast } from '../assets/palette.js'
import { svg, g, rng, wobPath, smoothPath, crayon, ellPts, polarPts,
         hatchDef, dotsDef, grainDef } from '../assets/marks.js'

export const meta = { name: 'seed-mark', w: 512, h: 512 }

const C = 256, RING = 168, CORE = 52

// The seed silhouette, as a polar shape: a circle pushed around by a few seeded
// harmonics. Same seed, same shape — change the seed to explore, not the maths.
const seedShape = (seed, lobes = 5) => {
  const r = rng(seed)
  const phase = Array.from({ length: lobes }, () => r() * Math.PI * 2)
  return polarPts(C, C, a =>
    CORE * 1.55 + phase.reduce((acc, p, k) => acc + Math.sin(a * (k + 2) + p) * (9 - k), 0), 160)
}

// three ticks on the ring — the spokes out to the spaces.
// Dropped from the small-size cut: at 16 px they read as stray hairs, not spokes.
const spokes = (stroke) => [0, 120, 240].map((deg, k) => {
  const a = (deg - 90) * Math.PI / 180
  const p0 = [C + Math.cos(a) * (RING + 12), C + Math.sin(a) * (RING + 12)]
  const p1 = [C + Math.cos(a) * (RING + 40), C + Math.sin(a) * (RING + 40)]
  return crayon([p0, p1], { color: stroke, width: 5, seed: 30 + k })
}).join('')

// The one rule dark ground teaches: ink becomes chalk, or the mark disappears.
// color.ink #1c2b21 on colorDark.bg #171b16 is a 1.1:1 ratio — invisible.
const inkFor = gnd => (gnd === 'dark' ? colorDark.ink : color.ink)
const goldFor = gnd => (gnd === 'dark' ? colorDark.gold : color.gold)
const greenFor = gnd => (gnd === 'dark' ? colorDark.primary : color.primary)

function build({ id, label, finish, gnd }) {
  const ink = inkFor(gnd), gold = goldFor(gnd)
  const sfx = `${id}-${gnd}`
  const hatch = hatchDef(`h-${sfx}`, { angle: 34, gap: 6, width: 1.1, color: shadeInk(gold), opacity: 0.4 })
  const dots  = dotsDef(`d-${sfx}`, { cell: 7, r: 1.7, color: shadeInk(gold), opacity: 0.55, angle: 18 })
  const grain = grainDef(`g-${sfx}`, { amount: 1.1, opacity: 0.2, seed: 9 })

  const ring = ellPts(C, C, RING, RING, 0, 96)
  const line = finish === 'line'
  // the small-size cut is a DIFFERENT drawing, not the same one scaled down:
  // fewer lobes and a heavier pen, because detail below ~24 px is noise.
  const shape = smoothPath(seedShape(21, line ? 3 : 5), line ? 0.8 : 1.2, 22)
  const val = ramp(gold, 5)                       // [lightest .. darkest]

  const texture = finish === 'hatch' ? `url(#${hatch.id})`
                : finish === 'riso'  ? `url(#${dots.id})`
                : null

  const body = [
    // outer ring, drawn twice for a slightly doubled pen line
    `<path d="${wobPath(ring, 2.2, 11)}" fill="none" stroke="${ink}" stroke-width="${line ? 14 : 7}" stroke-linejoin="round"/>`,
    line ? '' : `<path d="${wobPath(ring, 3.4, 12)}" fill="none" stroke="${alpha(ink, 0.35)}" stroke-width="3"/>`,
    line ? '' : spokes(greenFor(gnd)),
    // the seed body
    line
      ? `<path d="${shape}" fill="none" stroke="${ink}" stroke-width="20" stroke-linejoin="round"/>`
      : `<path d="${shape}" fill="${val[1]}" filter="url(#${grain.id})"/>`,
    texture ? `<path d="${shape}" fill="${texture}"/>` : '',
    // the lit centre — what makes it Liv rather than a blob
    line ? '' : `<circle cx="${C - 10}" cy="${C - 12}" r="${CORE * 0.42}" fill="${val[0]}" opacity="0.85"/>`,
  ].join('')

  const defs = line ? [] : [hatch, dots, grain]
  return { id, label, svg: svg(body, { w: 512, h: 512, defs, title: `OneLyf seed mark — ${label}` }) }
}

// hatch/dot ink: a step darker than the fill on light ground, a step lighter on
// dark, so the texture always reads as shading rather than as a second colour.
const shadeInk = gold => (gold === colorDark.gold ? ramp(gold, 5)[3] : color.goldDeep)

export function variants(gnd = 'light') {
  return [
    build({ gnd, id: 'solid', label: 'solid gold, grain finish', finish: 'solid' }),
    build({ gnd, id: 'hatch', label: 'hatched ink finish', finish: 'hatch' }),
    build({ gnd, id: 'riso',  label: 'halftone dot screen', finish: 'riso' }),
    build({ gnd, id: 'line',  label: 'line only — favicon / 16 px cut', finish: 'line' }),
  ]
}

// Contrast facts, not opinions. A mark failing these has a problem that no
// amount of restyling fixes — change the colour pairing instead.
export const checks = () => ({
  'gold on cream':      contrast(color.gold, ground.light.paper),
  'goldDeep on cream':  contrast(color.goldDeep, ground.light.paper),
  'ink on cream':       contrast(color.ink, ground.light.paper),
  'gold on dark':       contrast(colorDark.gold, ground.dark.paper),
})
