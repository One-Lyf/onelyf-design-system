// ─── Empty-thread state ──────────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, space, textStyle } from '../../tokens'
import Glyph from '../../Glyph'
import type { Dispatch, SetStateAction } from 'react'
import type { LivHat } from './types'
import type { LivChatStyles } from './styles'
import { titleCase } from './helpers'

export function EmptyState({ S, hat, accent, livGlyphState, setDraft }: {
  S: LivChatStyles
  hat: LivHat
  accent: string
  livGlyphState: 'idle' | 'thinking' | 'running'
  setDraft: Dispatch<SetStateAction<string>>
}) {
  return (
    <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm, padding: `${space.md}px ${space.sm}px`, maxWidth: 460 }}>
      {hat.glyph && <Glyph variant={hat.glyph} size={hat.hideHeaderTitle ? 120 : 64} animated={hat.glyph === 'live' ? livGlyphState : 'none'} />}
      <h3 style={{ ...textStyle('h2'), margin: 0 }}>Ask Liv</h3>
      {(hat.description || hat.emptyText) && (
        <p style={{ ...S.muted, margin: 0 }}>{hat.description || hat.emptyText}</p>
      )}
      {hat.pills && hat.pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 2 }}>
          {hat.pills.map((p, i) => (
            <span key={i} style={{ ...textStyle('caption'), border: `1px solid ${accent}`, color: accent, borderRadius: radius.pill, padding: '3px 10px' }}>{titleCase(p)}</span>
          ))}
        </div>
      )}
      {hat.suggestions && hat.suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: space.xs }}>
          {hat.suggestions.slice(0, 4).map((sug, i) => (
            <button key={i} type="button" className="ds-btn ds-btn--ghost" style={{ ...S.ghostBtn, ...textStyle('caption'), padding: '6px 10px', textAlign: 'left' }}
              onClick={() => setDraft(sug)}>{sug}</button>
          ))}
        </div>
      )}
    </div>
  )
}
