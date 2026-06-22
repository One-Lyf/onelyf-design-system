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

// ── Convenience bundle ──────────────────────────────────────────────────────
export const tokens = { color, spaces, spaceList, font, radius, shadow } as const
export default tokens
