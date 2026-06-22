// ─── OneLyf / Liv Root Glyph ────────────────────────────────────────────────
// The one master mark (brief §2–§4). Split by STATE, not by symbol:
//   variant="crest"   → OneLyf: static engraved root-star. The home / ownership
//                        mark — present and complete even with the AI off.
//   variant="live"    → Liv: the same mark, junctions lit warm amber. The
//                        intelligence woven through the network.
//   variant="essence" → reduced single-color mark for small / mono uses
//                        (favicon, tiny UI).
//
// VECTOR marks, traced from the approved GPT brand board (crisp at any size;
// every tendril tapers to a point, north petal closes as a knot loop). live's
// glow is a separate radial gradient inside the SVG, so it stays tintable.
// Imported (not in /public) so Vite content-hashes them — each update gets a
// fresh URL, so browsers / PWAs can't serve a stale glyph.
import crestUrl from './assets/glyph-crest.svg'
import liveUrl from './assets/glyph-live.svg'
import essenceUrl from './assets/glyph-essence.svg'

export type GlyphVariant = 'crest' | 'live' | 'essence'

const URLS: Record<GlyphVariant, string> = {
  crest: crestUrl,
  live: liveUrl,
  essence: essenceUrl,
}

export interface GlyphProps {
  variant?: GlyphVariant
  /** Rendered width in px; height scales to keep aspect ratio. */
  size?: number
  /** Accessible label. Defaults to a sensible per-variant string. */
  alt?: string
}

export default function Glyph({ variant = 'crest', size = 96, alt }: GlyphProps) {
  const src = URLS[variant] ?? URLS.crest
  return (
    <img
      src={src}
      alt={alt ?? `OneLyf ${variant === 'live' ? 'Liv' : 'mark'}`}
      style={{ display: 'block', width: size, height: 'auto', objectFit: 'contain' }}
    />
  )
}
