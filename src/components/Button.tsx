// ─── Button ─────────────────────────────────────────────────────────────────
// Presentational, token-driven. Ported from the `btn()` helper in
// finlyf-cash-stash. Two variants:
//   primary → forest-green gradient fill (the main action)
//   ghost   → bordered, green ink (secondary / inline action)
import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { radius } from '../tokens'
import { cssVar, shadowVar } from '../theme'

export type ButtonVariant = 'primary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Stretch to fill the container width (default true, matching the apps). */
  full?: boolean
}

export function buttonStyle(variant: ButtonVariant = 'primary', full = true): CSSProperties {
  const isGhost = variant === 'ghost'
  return {
    // Theme-reactive (was a hardcoded light-mode gradient) — `color` below
    // already used cssVar.onPrimary, which is intentionally different per
    // theme to pair with the *current* theme's primary fill; pairing it with
    // a fixed light-mode gradient dropped dark-mode contrast to ~3.9:1.
    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${cssVar.primary}, ${cssVar.primaryDeep})`,
    color: isGhost ? cssVar.primary : cssVar.onPrimary,
    border: isGhost ? `1px solid ${cssVar.borderBright}` : 'none',
    borderRadius: radius.md,
    padding: '12px 16px',
    fontSize: 13.5,
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    width: full ? '100%' : 'auto',
    letterSpacing: '0.01em',
    boxShadow: isGhost ? 'none' : shadowVar.primary,
    transition: 'transform .12s ease, opacity .12s ease',
  }
}

export default function Button({ variant = 'primary', full = true, style, children, ...rest }: ButtonProps) {
  return (
    <button style={{ ...buttonStyle(variant, full), ...style }} {...rest}>
      {children}
    </button>
  )
}
