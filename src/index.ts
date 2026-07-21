// ─── OneLyf Design System — public surface ──────────────────────────────────
// The single brand source the Lyf apps inherit: tokens, the Root Glyph, and
// presentational components. Everything here is token-driven and presentational
// (no app logic, no data fetching).

// Tokens
export {
  color,
  colorDark,
  spaces,
  spaceList,
  space,
  font,
  type,
  textStyle,
  motion,
  radius,
  shadow,
  shadowDark,
  tokens,
  default as tokensDefault,
  type Space,
  type SpaceKey,
  type TypeStep,
  type TypeRole,
} from './tokens'

// Component stylesheet — inject once, alongside themeStylesheet, for the
// shared :hover / :focus-visible / :disabled states.
export { componentStylesheet } from './styles'

// Theme runtime — CSS-variable tokens + light/dark/system mode state
export {
  cssVar,
  shadowVar,
  themeStylesheet,
  resolveTheme,
  getStoredThemeMode,
  setThemeMode,
  initTheme,
  THEME_CHANGE_EVENT,
  type ThemeMode,
  type ResolvedTheme,
} from './theme'

// Brand mark
export { default as Glyph, type GlyphProps, type GlyphVariant } from './Glyph'
export { default as LivThinking, type LivThinkingProps } from './LivThinking'

// Components
export { default as Button, buttonStyle, type ButtonProps, type ButtonVariant } from './components/Button'
export { default as Card, type CardProps } from './components/Card'
export {
  Input, Textarea, Select, Field,
  type InputProps, type TextareaProps, type SelectProps, type FieldProps,
} from './components/Input'
export {
  EmptyState, Spinner, Skeleton, ErrorState, Badge,
  type EmptyStateProps, type SpinnerProps, type SkeletonProps, type ErrorStateProps,
  type BadgeProps, type BadgeTone,
} from './components/States'
export {
  default as LivChat, livChatStylesheet,
  type LivChatProps, type LivHat, type LivChatAdapter,
  type LivMessage, type LivSession, type LivAttachment, type LivKeyInfo,
  type LivModel, type LivResult,
} from './components/LivChat'
export { default as JunctionCard, type JunctionCardProps } from './components/JunctionCard'
export { default as SpaceNode, type SpaceNodeProps } from './components/SpaceNode'
export { default as ThemeToggle, type ThemeToggleProps } from './components/ThemeToggle'

// Brand reference boards (reference only — not UI building blocks)
export { default as RootGlyphBoard, type RootGlyphBoardProps } from './components/RootGlyphBoard'
export { default as BrandIdentityBoard, type BrandIdentityBoardProps } from './components/BrandIdentityBoard'
