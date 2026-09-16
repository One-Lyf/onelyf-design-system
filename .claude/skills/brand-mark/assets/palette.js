// Palette for marks, imported straight from the design system's own tokens.
// Node 22 strips the types, so this reads tokens.ts directly — the values here
// CANNOT drift from canon, because there is only one copy of them.
//
// Canon reminders, enforced by lint() below:
//   - Gold #c08a14 is Liv's accent across the whole suite.
//   - The ONLY orange in the system is HomLyf/Tummyful terracotta #bf6b49.
//   - Text-safe gold is goldDeep #8a630e; plain gold fails AA on cream.
import { color, colorDark, spaces, font } from '../../../../src/tokens.ts'

export { color, colorDark, spaces, font }

// A mark is drawn against one of these grounds. Never pure white or pure black.
export const ground = {
  light: { paper: color.bg, surface: color.surface, ink: color.ink, mid: color.mid, dim: color.dim },
  dark:  { paper: colorDark.bg, surface: colorDark.surface, ink: colorDark.ink, mid: colorDark.mid, dim: colorDark.dim },
}

// ===================== COLOUR MATHS =====================
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const parse = c => {
  let h = c.replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const v = parseInt(h, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

export const mix = (a, b, t) => { const A = parse(a), B = parse(b); return hex(A.map((v, i) => v + (B[i] - v) * t)) }
export const tint = (c, t) => mix(c, '#ffffff', t)
export const shade = (c, t) => mix(c, '#000000', t)
export const alpha = (c, a) => { const [r, g, b] = parse(c); return `rgba(${r},${g},${b},${a})` }

// ramp: n steps from a light tint through the colour to a dark shade. The value
// structure of a mark — pick 2 or 3 adjacent steps, never all of them.
export const ramp = (c, n = 5) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1)
  return t < 0.5 ? tint(c, (0.5 - t) * 1.4) : shade(c, (t - 0.5) * 1.4)
})

// ===================== CONTRAST =====================
// WCAG relative luminance, so a mark can be checked rather than eyeballed.
const lum = c => {
  const [r, g, b] = parse(c).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100
}

// ===================== CANON LINT =====================
// Returns a list of violations. An empty array is the pass condition; the
// SKILL.md procedure requires running this before a mark is delivered.
const SANCTIONED_ORANGE = new Set(['#bf6b49', '#a4542f', '#7f3f22', '#d98b64', '#b9663f'])
const ALLOWED = new Set([
  ...Object.values(color).filter(v => typeof v === 'string' && v.startsWith('#')),
  ...Object.values(colorDark).filter(v => typeof v === 'string' && v.startsWith('#')),
  ...Object.values(spaces).map(s => s.accent),
  ...SANCTIONED_ORANGE,
  '#ffffff', '#000000',   // permitted only inside gradients/masks, flagged if used as a fill
])

// A tint or shade of a canon colour is still on-canon — that is what ramp() is
// for, and a mark with no value structure looks flat. So a colour passes if it
// is a token, or lies on some token's tint/shade line.
//
// Tested analytically, not by sampling the ramp: sampling at N steps misses
// every value that falls between two steps, which is most of them.
//   shade: c = base * (1 - t)            =>  t = 1 - c/base
//   tint:  c = base + (255 - base) * t   =>  t = (c - base) / (255 - base)
// A real tint/shade solves for the SAME t on all three channels.
const CHANNEL_TOLERANCE = 4   // per-channel slack, absorbs hex rounding

function onRamp(c, base) {
  const C = parse(c), B = parse(base)
  const fits = (solveT, predict) => {
    const ts = [0, 1, 2].map(solveT).filter(t => t !== null)
    if (!ts.length) return false
    const t = ts.reduce((a, b) => a + b, 0) / ts.length
    if (t < -0.01 || t > 1.01) return false
    return [0, 1, 2].every(i => Math.abs(predict(i, t) - C[i]) <= CHANNEL_TOLERANCE)
  }
  const shade = fits(i => (B[i] === 0 ? null : 1 - C[i] / B[i]), (i, t) => B[i] * (1 - t))
  const tint  = fits(i => (B[i] === 255 ? null : (C[i] - B[i]) / (255 - B[i])), (i, t) => B[i] + (255 - B[i]) * t)
  return shade || tint ? base : null
}

const derivedFrom = c => {
  for (const base of ALLOWED) {
    if (base === '#ffffff' || base === '#000000') continue
    if (onRamp(c, base)) return base
  }
  return null
}

export function lint(svgText, { allow = [] } = {}) {
  const out = []
  const extra = new Set(allow.map(c => c.toLowerCase()))
  const used = [...svgText.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toLowerCase())

  // Warm tokens whose tints and shades are allowed to look orange-ish. Checked
  // against the colour's *base*, not the colour itself — a tint of gold is still
  // gold, and an earlier cut of this flagged every light gold as rogue orange.
  const WARM_BASES = new Set([
    color.gold, colorDark.gold, color.goldDeep, colorDark.goldDeep,
    color.warning, colorDark.warning,
    spaces.wrklyf.accent, spaces.family.accent, spaces.homlyf.accent,
    ...SANCTIONED_ORANGE,
  ].map(c => c.toLowerCase()))

  for (const c of new Set(used)) {
    if (extra.has(c)) continue
    const base = ALLOWED.has(c) ? c : derivedFrom(c)
    if (!base) { out.push(`off-canon colour ${c} — not a token, a space accent, or a tint/shade of one`); continue }
    // The only orange that may appear is HomLyf terracotta (or a warm token's ramp).
    const [r, g, b] = parse(c)
    const isOrange = r > 150 && g > 60 && g < 170 && b < 110 && r - b > 60
    if (isOrange && !WARM_BASES.has(base.toLowerCase())) {
      out.push(`unsanctioned orange ${c} — the only orange in OneLyf is HomLyf terracotta #bf6b49`)
    }
  }
  if (/\b(width|height)=["']\d/.test(svgText.slice(0, svgText.indexOf('>') + 1))) {
    out.push('root <svg> has a hard width/height — a mark must scale to its container')
  }
  if (!/viewBox=/.test(svgText)) out.push('root <svg> is missing viewBox')
  if (/font-family=["'][^"']*(Comic|Papyrus|Impact)/i.test(svgText)) out.push('off-brand typeface; display is Fraunces, body is the system sans')
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(svgText)) out.push('emoji in artwork — use brand marks or text only')
  return out
}
