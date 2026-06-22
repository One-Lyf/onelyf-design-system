// ─── OneLyf Design System — public surface ──────────────────────────────────
// The single brand source the Lyf apps inherit: tokens, the Root Glyph, and
// presentational components. Everything here is token-driven and presentational
// (no app logic, no data fetching).

// Tokens
export {
  color,
  spaces,
  spaceList,
  font,
  radius,
  shadow,
  tokens,
  default as tokensDefault,
  type Space,
  type SpaceKey,
} from './tokens'

// Brand mark
export { default as Glyph, type GlyphProps, type GlyphVariant } from './Glyph'

// Components
export { default as Button, buttonStyle, type ButtonProps, type ButtonVariant } from './components/Button'
export { default as Card, type CardProps } from './components/Card'
export { default as JunctionCard, type JunctionCardProps } from './components/JunctionCard'
export { default as SpaceNode, type SpaceNodeProps } from './components/SpaceNode'

// Brand reference boards (reference only — not UI building blocks)
export { default as RootGlyphBoard, type RootGlyphBoardProps } from './components/RootGlyphBoard'
export { default as BrandIdentityBoard, type BrandIdentityBoardProps } from './components/BrandIdentityBoard'
