// ─── Button ─────────────────────────────────────────────────────────────────
// Presentational, token-driven. Ported from the `btn()` helper in
// finlyf-cash-stash. Variants:
//   primary → forest-green gradient fill (the ONE dominant action per view)
//   ghost   → bordered, green ink (secondary / inline action)
//   danger  → red fill for destructive confirmation
// Hover / active / focus-visible / disabled states come from the shared
// componentStylesheet via the `ds-btn` class — inject it once per app.
import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { radius, space, textStyle, motion } from '../tokens'
import { cssVar, shadowVar } from '../theme'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Stretch to fill the container width (default true, matching the apps). */
  full?: boolean
}

export function buttonStyle(variant: ButtonVariant = 'primary', full = true): CSSProperties {
  const isGhost = variant === 'ghost'
  const isDanger = variant === 'danger'
  const fill =
    isGhost ? 'transparent'
    : isDanger ? cssVar.danger
    : `linear-gradient(180deg, ${cssVar.primary}, ${cssVar.primaryDeep})`
  return {
    ...textStyle('label'),
    // Theme-reactive (was a hardcoded light-mode gradient) — `color` below
    // already used cssVar.onPrimary, which is intentionally different per
    // theme to pair with the *current* theme's primary fill.
    background: fill,
    color: isGhost ? cssVar.primary : cssVar.onPrimary,
    border: isGhost ? `1px solid ${cssVar.borderBright}` : 'none',
    borderRadius: radius.md,
    padding: `${space.sm + 4}px ${space.md}px`,   // 12px / 16px
    cursor: 'pointer',
    width: full ? '100%' : 'auto',
    letterSpacing: '0.01em',
    boxShadow: isGhost ? 'none' : shadowVar.primary,
    transition: `transform ${motion.fast} ${motion.ease}, filter ${motion.fast} ${motion.ease}, background ${motion.fast} ${motion.ease}`,
  }
}

export default function Button({
  variant = 'primary', full = true, className, style, children, ...rest
}: ButtonProps) {
  const cls = ['ds-btn', variant === 'ghost' && 'ds-btn--ghost', className]
    .filter(Boolean).join(' ')
  return (
    <button className={cls} style={{ ...buttonStyle(variant, full), ...style }} {...rest}>
      {children}
    </button>
  )
}
