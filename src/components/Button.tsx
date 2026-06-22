// ─── Button ─────────────────────────────────────────────────────────────────
// Presentational, token-driven. Ported from the `btn()` helper in
// finlyf-cash-stash. Two variants:
//   primary → forest-green gradient fill (the main action)
//   ghost   → bordered, green ink (secondary / inline action)
import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { color, radius, shadow } from '../tokens'

export type ButtonVariant = 'primary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Stretch to fill the container width (default true, matching the apps). */
  full?: boolean
}

export function buttonStyle(variant: ButtonVariant = 'primary', full = true): CSSProperties {
  const isGhost = variant === 'ghost'
  return {
    background: isGhost ? 'transparent' : 'linear-gradient(180deg,#2a936a,#15623c)',
    color: isGhost ? color.primary : color.onPrimary,
    border: isGhost ? `1px solid ${color.borderBright}` : 'none',
    borderRadius: radius.md,
    padding: '12px 16px',
    fontSize: 13.5,
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    width: full ? '100%' : 'auto',
    letterSpacing: '0.01em',
    boxShadow: isGhost ? 'none' : shadow.primary,
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
