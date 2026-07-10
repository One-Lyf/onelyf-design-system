// ─── LivThinking — the Liv "thinking" loader ────────────────────────────────
// Liv made visible while the intelligence works (brand brief §8: "thinking —
// paths illuminate, energy gathers"; warm, not neon). Renders the live glyph
// with a calm breathing pulse so the amber core reads as alive. Use as the
// spinner in any AI/assistant waiting state (Commis, Advisor, …).
//
// Requires the `liv-think` keyframes in the host app's CSS (see index.css):
//   @keyframes liv-think { 0%,100%{transform:scale(.95);opacity:.7} 50%{transform:scale(1.06);opacity:1} }
//   @media (prefers-reduced-motion: reduce){ .liv-think{animation:none;opacity:1} }
import liveUrl from './assets/glyph-live.svg'

export interface LivThinkingProps {
  /** Glyph size in px. */
  size?: number
  /** Optional caption shown beside the mark (e.g. "Liv is thinking…"). */
  caption?: string
  /** Accessible status label (announced to screen readers). */
  label?: string
}

export default function LivThinking({ size = 44, caption, label = 'Liv is thinking…' }: LivThinkingProps) {
  return (
    <span role="status" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <img
        className="liv-think"
        src={liveUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain', transformOrigin: 'center' }}
      />
      {caption && <span style={{ fontSize: 13, color: '#5e6c60' }}>{caption}</span>}
    </span>
  )
}
