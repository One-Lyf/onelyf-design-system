// ─── Card ───────────────────────────────────────────────────────────────────
// Parchment surface card with the engraved hairline frame (the heirloom /
// museum-catalog feel from the brief §13). Presentational container only.
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { radius } from '../tokens'
import { cssVar, shadowVar } from '../theme'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'className'> {
  children?: ReactNode
  /** Show the inset engraved hairline frame just inside the border. */
  framed?: boolean
  /** Whole card is clickable — adds hover-lift + keyboard focus ring. */
  interactive?: boolean
  style?: CSSProperties
  padding?: number | string
  className?: string
}

export default function Card({
  children, framed = true, interactive = false, padding = 16, style, className,
  onKeyDown, role, ...rest
}: CardProps) {
  const cls = [interactive && 'ds-card-interactive', className].filter(Boolean).join(' ') || undefined
  // `interactive` promises "whole card is a link/button" (see componentStylesheet's
  // .ds-card-interactive — cursor: pointer, hover-lift, focus ring) and makes the
  // card focusable via tabIndex, but a focusable element that only responds to a
  // mouse click is a broken keyboard contract: Enter/Space did nothing, and the
  // props type didn't even accept onClick/onKeyDown to fix that from the outside
  // (unlike Button/Input, which extend the native HTML attributes and spread
  // ...rest). Extending HTMLAttributes + spreading rest restores pass-through of
  // onClick etc.; the default onKeyDown activates onClick on Enter/Space, same as
  // a native <button>, while still letting a caller override onKeyDown entirely.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e)
    if (interactive && !e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      e.currentTarget.click()
    }
  }
  return (
    <div
      className={cls}
      tabIndex={interactive ? 0 : undefined}
      role={role ?? (interactive ? 'button' : undefined)}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
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
      {...rest}
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
