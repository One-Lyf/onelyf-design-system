// ─── JunctionCard ───────────────────────────────────────────────────────────
// The cross-domain "junction moment" (brief §7, §9): Liv surfacing an insight
// AT a connection between two spaces — e.g. "FinLyf ↔ HomLyf". Connections are
// directional + typed; the arrow shows flow direction. Presentational shell of
// the live `LivMealInsight` card in finlyf-cash-stash — no data/fetch logic.
import type { CSSProperties, ReactNode } from 'react'
import { font } from '../tokens'
import { cssVar, shadowVar } from '../theme'
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
        border: `1px solid ${cssVar.borderBright}`,
        borderRadius: 16,
        padding: '16px 16px 15px',
        // warm parchment / heirloom card — the cross-domain junction moment.
        // Theme-reactive (cssVar/shadowVar), same as Card's identical "parchment
        // surface" treatment — this was previously hardcoded to light-mode-only
        // literals, so the caption text (cssVar.mid) went low-contrast against
        // it in dark mode once cssVar.mid switched to its light-on-dark value.
        background: `linear-gradient(176deg, ${cssVar.surfaceHi} 0%, ${cssVar.surface} 100%)`,
        boxShadow: shadowVar.card,
        ...style,
      }}
    >
      {/* engraved hairline frame, just inside the border — archival feel */}
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 5, borderRadius: 12, border: `1px solid ${cssVar.border}`, pointerEvents: 'none' }}
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
                // cssVar.gold is a fill/accent token (~3:1 against the card's
                // light-mode surface — fails WCAG AA's 4.5:1 floor for text
                // this small, same class of bug as the dark-mode contrast
                // breaks fixed above). goldDeep is the text-safe variant,
                // same pattern as primaryDeep just below.
                color: cssVar.goldDeep,
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
                color: cssVar.primaryDeep,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {from} <span style={{ color: cssVar.goldDeep, fontWeight: 600 }}>{direction}</span> {to}
            </div>
          </div>
        </div>
        {children && (
          <div style={{ fontSize: 12.5, color: cssVar.mid, marginBottom: action ? 11 : 0, lineHeight: 1.5 }}>
            {children}
          </div>
        )}
        {action}
      </div>
    </div>
  )
}
