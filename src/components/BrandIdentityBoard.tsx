// ─── BrandIdentityBoard (reference) ─────────────────────────────────────────
// The OneLyf / Liv identity exploration board: logo / wordmark lockups, Liv
// identity, motion frames, the home/OS concept, and the three style directions
// (Modern Homestead / Field Journal / Living Atlas). REFERENCE ONLY — not a UI
// building block; see RootGlyphBoard for the same caveat.
import boardUrl from '../assets/brand-identity-exploration.jpg'

export interface BrandIdentityBoardProps {
  /** Rendered width in px; height scales to keep aspect ratio. */
  size?: number
}

export default function BrandIdentityBoard({ size = 760 }: BrandIdentityBoardProps) {
  return (
    <img
      src={boardUrl}
      alt="OneLyf / Liv identity exploration — logo lockups, Liv identity, motion, home concept, style directions"
      style={{ display: 'block', width: size, maxWidth: '100%', height: 'auto' }}
    />
  )
}
