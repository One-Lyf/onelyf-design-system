// ─── RootGlyphBoard (reference) ─────────────────────────────────────────────
// The approved OneLyf / Liv master board: the Root Glyph, the crest (OneLyf) vs
// glowing (Liv) state duality, the network/motion/OS visual language, and the
// brand taglines. REFERENCE ONLY — not a UI building block. It exists so the
// approved mark + system read are visible in Claude Design; compose real screens
// from Glyph / Button / Card / JunctionCard / SpaceNode, not from this board.
import boardUrl from '../assets/root-glyph-board.jpg'

export interface RootGlyphBoardProps {
  /** Rendered width in px; height scales to keep aspect ratio. */
  size?: number
}

export default function RootGlyphBoard({ size = 760 }: RootGlyphBoardProps) {
  return (
    <img
      src={boardUrl}
      alt="OneLyf / Liv master board — Root Glyph, crest vs Liv states, network / motion / OS language, taglines"
      style={{ display: 'block', width: size, maxWidth: '100%', height: 'auto' }}
    />
  )
}
