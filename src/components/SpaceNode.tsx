// ─── SpaceNode ──────────────────────────────────────────────────────────────
// A life domain rendered as a NODE in the root network (brief §6, §9): an
// accent-colored node + label. Used in the OneLyf home (spaces above ground)
// and the Liv connection console. Presentational only — no app logic.
import type { CSSProperties } from 'react'
import { font, spaces, type SpaceKey } from '../tokens'
import { cssVar } from '../theme'

export interface SpaceNodeProps {
  /** One of the known spaces — pulls its accent + label automatically. */
  space?: SpaceKey
  /** Override label (else taken from the space). */
  label?: string
  /** Override accent (else taken from the space). */
  accent?: string
  /** Diameter of the node dot in px. */
  size?: number
  /**
   * Dormant = the AI-off / "network sleeps" state (brief §3, §8). The node is
   * present and ownable but its glow is off (muted, no halo).
   */
  dormant?: boolean
  style?: CSSProperties
}

export default function SpaceNode({
  space,
  label,
  accent,
  size = 14,
  dormant = false,
  style,
}: SpaceNodeProps) {
  const def = space ? spaces[space] : undefined
  const dot = accent ?? def?.accent ?? cssVar.primary
  const text = label ?? def?.label ?? ''

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, ...style }}>
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: dot,
          // Warm lantern halo when "lit"; just the engraved dot when dormant.
          boxShadow: dormant ? 'none' : `0 0 0 4px ${dot}22, 0 0 10px ${dot}55`,
          opacity: dormant ? 0.55 : 1,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: font.serif,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: cssVar.ink,
        }}
      >
        {text}
      </span>
    </div>
  )
}
