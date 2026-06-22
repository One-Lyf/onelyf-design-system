// ─── JunctionCard ───────────────────────────────────────────────────────────
// The cross-domain "junction moment" (brief §7, §9): Liv surfacing an insight
// AT a connection between two spaces — e.g. "FinLyf ↔ HomLyf". Connections are
// directional + typed; the arrow shows flow direction. Presentational shell of
// the live `LivMealInsight` card in finlyf-cash-stash — no data/fetch logic.
import type { CSSProperties, ReactNode } from 'react'
import { color, font } from '../tokens'
import Glyph from '../Glyph'

export interface JunctionCardProps {
  /** Label of the source space (data origin). */
  from?: string
  /** Label of the destination space (data consumer). */
  to?: string
  /** '→' directional (default, matches "budget feeds meals") or '↔' mutual. */
  direction?: '→' | '↔'
  /** Small uppercase eyebrow. */
  eyebrow?: string
  /** Body copy describing the insight / what the connection does. */
  children?: ReactNode
  /** Optional action (e.g. a Button). */
  action?: ReactNode
  style?: CSSProperties
}

export default function JunctionCard({
  from = 'FinLyf',
  to = 'HomLyf',
  direction = '↔',
  eyebrow = 'Liv · at a connection',
  children,
  action,
  style,
}: JunctionCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${color.borderBright}`,
        borderRadius: 16,
        padding: '16px 16px 15px',
        // warm parchment / heirloom card — the cross-domain junction moment
        background: 'linear-gradient(176deg, #fbf6e7 0%, #f6efdc 100%)',
        boxShadow: '0 1px 2px rgba(28,43,33,0.05), 0 10px 26px rgba(28,43,33,0.08)',
        ...style,
      }}
    >
      {/* engraved hairline frame, just inside the border — archival feel */}
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 5, borderRadius: 12, border: `1px solid ${color.border}`, pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
          <Glyph variant="live" size={38} alt="Liv" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: color.gold,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ fontSize: 8 }}>◦</span> {eyebrow}
            </div>
            <div
              style={{
                fontFamily: font.serif,
                fontSize: 19,
                fontWeight: 700,
                color: color.primaryDeep,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {from} <span style={{ color: color.gold, fontWeight: 600 }}>{direction}</span> {to}
            </div>
          </div>
        </div>
        {children && (
          <div style={{ fontSize: 12.5, color: color.mid, marginBottom: action ? 11 : 0, lineHeight: 1.5 }}>
            {children}
          </div>
        )}
        {action}
      </div>
    </div>
  )
}
