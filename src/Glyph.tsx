// ─── OneLyf / Liv Root Glyph ────────────────────────────────────────────────
// The one master mark (brief §2–§4). Split by STATE, not by symbol:
//   variant="crest"   → OneLyf: static engraved root-star. The home / ownership
//                        mark — present and complete even with the AI off.
//   variant="live"    → Liv: the same mark, junctions lit warm amber. The
//                        intelligence woven through the network.
//   variant="essence" → reduced single-color mark for small / mono uses
//                        (favicon, tiny UI).
//   variant="rooted"   → "Rooted Connection" brand-board variant (Section B.5):
//                        same crown knot and junction as live, roots extending
//                        into a fuller mycelium cascade. Used for the Liv
//                        Console v1 app icon, not a chat-time state.
//
// VECTOR marks, traced from the approved GPT brand board (crisp at any size;
// every tendril tapers to a point, north petal closes as a knot loop). live's
// glow is a separate radial gradient inside the SVG, so it stays tintable.
// Imported (not in /public) so Vite content-hashes them — each update gets a
// fresh URL, so browsers / PWAs can't serve a stale glyph.
import crestUrl from './assets/glyph-crest.svg'
import liveUrl from './assets/glyph-live.svg'
import essenceUrl from './assets/glyph-essence.svg'
import rootedUrl from './assets/glyph-rooted.svg'

export type GlyphVariant = 'crest' | 'live' | 'essence' | 'rooted'

const URLS: Record<GlyphVariant, string> = {
  crest: crestUrl,
  live: liveUrl,
  essence: essenceUrl,
  rooted: rootedUrl,
}

// Liv-state motion: the SAME canonical mark, animated by CSS to signal
// what Liv is doing — never a new/alternate glyph (the naming/glyph law forbids inventing an
// L/dot/spark mark). Optional and defaults to unanimated ('none') so every existing consumer
// (crest in headers/marketing, live/rooted elsewhere) is byte-for-byte unaffected; a caller opts
// in only where it actually has a live generating-state signal to drive it (LivChat's Brain
// pill/header). Keyframes live in livChatStylesheet (see .lc-glyph-*) since that's the one
// stylesheet every Liv-chat consumer already injects; Glyph itself stays framework-agnostic.
export type GlyphAnimationState = 'none' | 'idle' | 'thinking' | 'running'

export interface GlyphProps {
  variant?: GlyphVariant
  /** Rendered width in px; height scales to keep aspect ratio. */
  size?: number
  /** Accessible label. Defaults to a sensible per-variant string. */
  alt?: string
  /** Liv-state motion — see GlyphAnimationState above. Default 'none' (static, unchanged). */
  animated?: GlyphAnimationState
}

export default function Glyph({ variant = 'crest', size = 96, alt, animated = 'none' }: GlyphProps) {
  const src = URLS[variant] ?? URLS.crest
  return (
    <img
      src={src}
      alt={alt ?? `OneLyf ${variant === 'live' ? 'Liv' : variant === 'rooted' ? 'Rooted Connection' : 'mark'}`}
      className={animated !== 'none' ? `lc-glyph-${animated}` : undefined}
      style={{ display: 'block', width: size, height: 'auto', objectFit: 'contain' }}
    />
  )
}
