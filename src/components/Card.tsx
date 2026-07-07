// ─── Card ───────────────────────────────────────────────────────────────────
// Parchment surface card with the engraved hairline frame (the heirloom /
// museum-catalog feel from the brief §13). Presentational container only.
import type { CSSProperties, ReactNode } from 'react'
import { radius } from '../tokens'
import { cssVar, shadowVar } from '../theme'

export interface CardProps {
  children?: ReactNode
  /** Show the inset engraved hairline frame just inside the border. */
  framed?: boolean
  style?: CSSProperties
  padding?: number | string
}

export default function Card({ children, framed = true, padding = 16, style }: CardProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: cssVar.surface,
        border: `1px solid ${cssVar.border}`,
        borderRadius: radius.lg,
        padding,
        boxShadow: shadowVar.card,
        ...style,
      }}
    >
      {framed && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 5,
            borderRadius: radius.md,
            border: `1px solid ${cssVar.border}`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}
