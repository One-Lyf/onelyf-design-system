// ─── OneLyf / Liv — Design Tokens ───────────────────────────────────────────
// The single brand source of truth. Ported from the inline `C` palette in
// finlyf-cash-stash/src/App.jsx and the v3 "Root Glyph" brand brief.
// Apps inherit these — they don't redefine colors or marks.
//
// Aesthetic (brief §13): Field Notes / botanical journal / heirloom paper /
// museum-catalog warmth. Avoid SaaS gradients, neon, AI-gradient glows.

// ── Foundation palette ──────────────────────────────────────────────────────
// Warm cream + ink + forest-green; shared everywhere regardless of space.
export const color = {
  bg: '#f4efe1',        // warm cream — the page / parchment ground
  surface: '#fffdf7',   // raised card surface
  surfaceHi: '#fffefb', // brightest surface (hover / active)
  track: '#ece4d0',     // inset track / muted fill

  ink: '#1c2b21',       // primary text — deep forest ink
  mid: '#5e6c60',       // secondary text
  dim: '#9aa593',       // tertiary / hint text

  primary: '#1f7a4d',   // forest-green — the brand green ("blue" in the legacy C object)
  primaryDeep: '#15623c',
  gold: '#c08a14',      // heirloom gold — Liv's warm accent + FinLyf space
  goldDeep: '#8a630e',  // text-safe gold: #9c6f10 only hit ~3.9-4.4:1 against
                         // surface/surfaceHi/bg — under WCAG AA's 4.5:1 floor
                         // for small text. This clears 4.5:1+ on all three.

  // Functional / status (kept from the live app palette)
  success: '#1f9d5e',
  danger: '#c0463a',
  warning: '#cf7a1f',

  border: 'rgba(31,90,60,0.14)',       // hairline engraved frame
  borderBright: 'rgba(31,90,60,0.30)', // emphasized border

  // Inverse text (on dark/green fills)
  onPrimary: '#fbf8ee',
} as const

// ── Dark theme — natural palette (deep stone/earth/forest) ─────────────────
// Deliberately NOT pure black — a warm, mossy dark rather than the cool
// blue-black of typical SaaS dark mode. Same shape as `color`; a first pass
// for Jeff to finalize exact values (visual-work-division law).
export const colorDark = {
  bg: '#171b16',         // deep stone-forest — the page ground
  surface: '#20251f',    // raised card surface
  surfaceHi: '#262c24',  // brightest surface (hover / active)
  track: '#2c322a',      // inset track / muted fill

  ink: '#e8e4d6',        // primary text — warm parchment
  mid: '#a8ad9c',        // secondary text
  dim: '#767c6c',        // tertiary / hint text

  primary: '#3fae7a',    // forest-green, brightened for contrast on dark
  primaryDeep: '#2c8a5e',
  gold: '#d8a83c',       // heirloom gold, brightened for dark bg
  goldDeep: '#b98a24',

  success: '#3fbd7a',
  danger: '#e0776b',
  warning: '#e0a050',

  border: 'rgba(232,228,214,0.10)',
  borderBright: 'rgba(232,228,214,0.22)',

  onPrimary: '#0f130e',
} as const

// ── Per-space accents (brief §6) ────────────────────────────────────────────
// Each life domain is a NODE in the root network with its own accent. The
// accent carries forward into that space's app; the foundation palette stays
// shared. `status` mirrors the brief: live / building / planned.
export type SpaceKey =
  | 'finlyf' | 'homlyf' | 'hlthlyf' | 'gudlyf' | 'wrklyf' | 'skoollyf' | 'family'

export interface Space {
  key: SpaceKey
  label: string
  accent: string
  accentName: string
  status: 'live' | 'building' | 'planned'
}

export const spaces: Record<SpaceKey, Space> = {
  finlyf:   { key: 'finlyf',   label: 'FinLyf',   accent: '#c08a14', accentName: 'gold',       status: 'live' },
  homlyf:   { key: 'homlyf',   label: 'HomLyf',   accent: '#bf6b49', accentName: 'terracotta', status: 'live' },
  hlthlyf:  { key: 'hlthlyf',  label: 'HlthLyf',  accent: '#6f9270', accentName: 'sage',       status: 'building' },
  gudlyf:   { key: 'gudlyf',   label: 'GudLyf',   accent: '#5d648f', accentName: 'indigo',     status: 'building' },
  wrklyf:   { key: 'wrklyf',   label: 'WrkLyf',   accent: '#b36c42', accentName: 'copper',     status: 'building' },
  skoollyf: { key: 'skoollyf', label: 'SkoolLyf', accent: '#6f8090', accentName: 'blue-gray',  status: 'planned' },
  family:   { key: 'family',   label: 'Family',   accent: '#8d6b52', accentName: 'walnut',     status: 'live' },
} as const

export const spaceList: Space[] = Object.values(spaces)

// ── Spacing ─────────────────────────────────────────────────────────────────
// One rhythm, everywhere. A 4px base step so every gap/pad/margin lands on the
// grid — this is the single lever that kills "arbitrary spacing". Reach for a
// named step (`space.md`) in components; the numeric map (`space[4]`) is there
// for the odd one-off. Never hand-type a raw pixel gap in an app again.
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,   // the default block gap
  5: 20,
  6: 24,   // section padding
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

// ── Typography ──────────────────────────────────────────────────────────────
export const font = {
  // Display serif — editorial / heirloom headings
  serif: "'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif",
  // Body sans — system stack, calm and legible (multi-generational, brief §14)
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const

// One type scale, role-named, everywhere. Headings are SERIF and clearly
// heavier/larger than body so hierarchy reads at a glance; body/label/caption
// are the sans stack. `size` is px, `line` is unitless line-height. Import a
// role and spread it (`style={{ ...textStyle('h2') }}`) instead of hand-setting
// fontSize — that's what removes the "no type hierarchy" tell.
export interface TypeStep {
  size: number
  line: number
  weight: number
  family: string
  letterSpacing?: string
}

export const type = {
  display: { size: 40, line: 1.05, weight: 600, family: font.serif, letterSpacing: '-0.01em' },
  h1:      { size: 30, line: 1.12, weight: 600, family: font.serif, letterSpacing: '-0.01em' },
  h2:      { size: 23, line: 1.18, weight: 600, family: font.serif },
  h3:      { size: 18, line: 1.25, weight: 600, family: font.serif },
  title:   { size: 15, line: 1.3,  weight: 700, family: font.sans },   // card / row titles
  body:    { size: 15, line: 1.5,  weight: 400, family: font.sans },
  bodySm:  { size: 13.5, line: 1.5, weight: 400, family: font.sans },
  label:   { size: 13, line: 1.3,  weight: 600, family: font.sans },   // form labels, buttons
  caption: { size: 12, line: 1.4,  weight: 400, family: font.sans },   // hints, meta
  overline:{ size: 11, line: 1.2,  weight: 700, family: font.sans, letterSpacing: '0.08em' },
} as const satisfies Record<string, TypeStep>

export type TypeRole = keyof typeof type

// Spread into an inline `style` to apply a type role.
export function textStyle(role: TypeRole): {
  fontSize: number; lineHeight: number; fontWeight: number; fontFamily: string; letterSpacing?: string
} {
  const t = type[role]
  return {
    fontSize: t.size,
    lineHeight: t.line,
    fontWeight: t.weight,
    fontFamily: t.family,
    ...('letterSpacing' in t ? { letterSpacing: (t as TypeStep).letterSpacing } : {}),
  }
}

// ── Motion ──────────────────────────────────────────────────────────────────
// Calm, quick, consistent. One easing + a couple of durations so interactions
// feel intentional without drawing attention to themselves (brief §13 — no
// SaaS flourish). Honour prefers-reduced-motion at the app layer.
export const motion = {
  fast: '.12s',
  base: '.18s',
  slow: '.28s',
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

// ── Shape ───────────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 11,   // default control radius
  lg: 16,   // cards
  pill: 999,
} as const

// Soft, low, warm shadows — never harsh SaaS drop-shadows.
export const shadow = {
  card: '0 1px 2px rgba(28,43,33,0.06), 0 8px 24px rgba(28,43,33,0.10)',
  soft: '0 1px 2px rgba(28,43,33,0.05), 0 10px 26px rgba(28,43,33,0.08)',
  primary: '0 1px 2px rgba(28,43,33,0.10), 0 6px 16px rgba(31,122,77,0.20)',
} as const

// Dark-theme shadows read against a dark ground, so they lean on true black
// rather than the ink-green used for light-mode depth.
export const shadowDark = {
  card: '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.45)',
  soft: '0 1px 2px rgba(0,0,0,0.30), 0 10px 26px rgba(0,0,0,0.35)',
  primary: '0 1px 2px rgba(0,0,0,0.40), 0 6px 16px rgba(63,174,122,0.30)',
} as const

// ── Convenience bundle ──────────────────────────────────────────────────────
export const tokens = { color, colorDark, spaces, spaceList, space, font, type, motion, radius, shadow, shadowDark } as const
export default tokens
