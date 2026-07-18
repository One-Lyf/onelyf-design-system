// ─── UI-state primitives ────────────────────────────────────────────────────
// Empty / Loading / Error / Status. Flat, stateless surfaces are the biggest
// "vibe-coded" tell — an app that never shows a considered empty or loading
// state feels unfinished. These give every screen those states for free, in
// the shared aesthetic, so the required-states checklist is satisfied by
// composition rather than re-invented per screen.
import type { CSSProperties, ReactNode } from 'react'
import { radius, space, textStyle, color as palette } from '../tokens'
import { cssVar } from '../theme'

// ── EmptyState — no data yet / nothing matches ──────────────────────────────
export interface EmptyStateProps {
  /** Small icon or Glyph above the title. */
  icon?: ReactNode
  title: ReactNode
  /** One calm sentence on what this is / what to do next. */
  description?: ReactNode
  /** Primary action (usually a <Button>). */
  action?: ReactNode
  style?: CSSProperties
}
export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: space.sm, padding: `${space[9]}px ${space.lg}px`, color: cssVar.mid, ...style,
      }}
    >
      {icon && <div style={{ opacity: 0.6, marginBottom: space.xs }}>{icon}</div>}
      <div style={{ ...textStyle('h3'), color: cssVar.ink }}>{title}</div>
      {description && (
        <p style={{ ...textStyle('bodySm'), color: cssVar.mid, margin: 0, maxWidth: 340 }}>{description}</p>
      )}
      {action && <div style={{ marginTop: space.sm }}>{action}</div>}
    </div>
  )
}

// ── Spinner — indeterminate loading ─────────────────────────────────────────
export interface SpinnerProps {
  size?: number
  /** Stroke colour; defaults to the theme primary. */
  color?: string
  label?: string
  style?: CSSProperties
}
export function Spinner({ size = 20, color, label = 'Loading', style }: SpinnerProps) {
  return (
    <span
      className="ds-spinner"
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block', width: size, height: size,
        border: `${Math.max(2, Math.round(size / 10))}px solid ${cssVar.border}`,
        borderTopColor: color ?? cssVar.primary,
        borderRadius: radius.pill,
        animation: 'ds-spin .7s linear infinite',
        ...style,
      }}
    />
  )
}

// ── Skeleton — content-shaped loading placeholder ───────────────────────────
export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number
  style?: CSSProperties
}
export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }: SkeletonProps) {
  return (
    <span
      className="ds-skeleton"
      aria-hidden
      style={{
        display: 'block', width, height, borderRadius: r,
        // Track → highlight → track sweep; sits calmly on the parchment ground.
        background: `linear-gradient(90deg, ${cssVar.track} 25%, ${cssVar.surfaceHi} 37%, ${cssVar.track} 63%)`,
        backgroundSize: '200% 100%',
        animation: 'ds-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// ── ErrorState — something failed, with a retry path ────────────────────────
export interface ErrorStateProps {
  title?: ReactNode
  description?: ReactNode
  /** Retry / recover action (usually a ghost <Button>). */
  action?: ReactNode
  style?: CSSProperties
}
export function ErrorState({
  title = 'Something went wrong', description, action, style,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: space.sm, padding: `${space[8]}px ${space.lg}px`, ...style,
      }}
    >
      <div style={{ ...textStyle('h3'), color: cssVar.danger }}>{title}</div>
      {description && (
        <p style={{ ...textStyle('bodySm'), color: cssVar.mid, margin: 0, maxWidth: 360 }}>{description}</p>
      )}
      {action && <div style={{ marginTop: space.sm }}>{action}</div>}
    </div>
  )
}

// ── Badge — status pill (success / danger / warning / neutral / accent) ─────
export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral' | 'accent'

// Soft tinted fill + text-safe ink. Kept restrained — a quiet marker, not a
// call-to-action. Uses the static `color` values (not cssVar) for the tints so
// they read the same in both themes without a second dark ramp.
const badgeTone: Record<BadgeTone, { fill: string; ink: string }> = {
  success: { fill: 'rgba(31,157,94,0.14)',  ink: palette.success },
  danger:  { fill: 'rgba(192,70,58,0.14)',  ink: palette.danger },
  warning: { fill: 'rgba(207,122,31,0.16)', ink: palette.warning },
  accent:  { fill: 'rgba(31,122,77,0.12)',  ink: palette.primary },
  neutral: { fill: 'rgba(94,108,96,0.14)',  ink: palette.mid },
}

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  style?: CSSProperties
}
export function Badge({ tone = 'neutral', children, style }: BadgeProps) {
  const t = badgeTone[tone]
  return (
    <span
      style={{
        ...textStyle('overline'),
        display: 'inline-flex', alignItems: 'center', gap: space.xs,
        padding: `${space[1]}px ${space.sm}px`,
        background: t.fill, color: t.ink,
        borderRadius: radius.pill, whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
