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
  goldDeep: '#9c6f10',

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

// ── Typography ──────────────────────────────────────────────────────────────
export const font = {
  // Display serif — editorial / heirloom headings
  serif: "'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif",
  // Body sans — system stack, calm and legible (multi-generational, brief §14)
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
export const tokens = { color, colorDark, spaces, spaceList, font, radius, shadow, shadowDark } as const
export default tokens
