// ─── In-flight Liv turn (streaming / tool activity) ──────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { RefObject } from 'react'
import { streamingArtifactPreview } from '../livChatComposer'
import type { LivChatAdapter, LivHat, LivToolActivity } from './types'
import { bubbleStyle, type LivChatStyles } from './styles'
import { Linkified, ModalityPill, ToolActivityLine } from './MessageParts'

export function LiveTurnBubble({ S, hat, adapter, liveTurnRef, sending, elapsedSec, toolActivity, streaming, stop, handleLinkTap }: {
  S: LivChatStyles
  hat: LivHat
  adapter: LivChatAdapter
  liveTurnRef: RefObject<HTMLDivElement | null>
  sending: boolean
  elapsedSec: number
  toolActivity: LivToolActivity | null
  streaming: string
  stop: () => void
  handleLinkTap: (url: string) => void
}) {
  return (
    <div ref={liveTurnRef} className="lc-bubble" style={bubbleStyle('liv')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ ...textStyle('overline'), color: cssVar.mid }}>Liv</span>
        <ModalityPill modality="text" />
        {/* 'Thinking' status + live run-time counter: a
            Claude-style generating indicator, model-agnostic (driven by LivChat's own
            `sending` state, never a vendor name). Ticks for the whole turn, not just
            before the first token — LivChat has no separate reasoning/output signal to
            freeze it at. Shares the idle/thinking/running-workflow state machine with
            the animated header glyph (see livGlyphState below). */}
        {sending && (
          <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="lc-thinking-label">{toolActivity ? 'Working' : 'Thinking'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{elapsedSec}s</span>
          </span>
        )}
        {/* Stop — only when the adapter exposes an abort port; a click cancels the
            in-flight reply so a slow answer stops burning tokens. Placed right of the
            pill in the streaming bubble's own header so it sits with the "in flight"
            signal, not in the composer where the send arrow already lives. */}
        {adapter.chat.abort && (
          <button
            type="button"
            className="lc-iconbtn"
            style={{ ...S.iconbtn, marginLeft: 'auto', ...textStyle('caption'), color: cssVar.mid, padding: '2px 8px', border: `1px solid ${cssVar.border}`, borderRadius: radius.pill }}
            onClick={stop}
            title="Stop generating"
            aria-label="Stop generating"
          >
            Stop
          </button>
        )}
      </div>
      {toolActivity && <ToolActivityLine activity={toolActivity} brandIcon={hat.toolIcon} labels={hat.toolLabels} />}
      {/* The caret only trails live text; while a tool runs (no text yet)
          the activity line above carries the "working" signal instead. livchat-console-
          artifact-regressions: once an ```artifact fence opens, everything from there
          onward is raw code streaming in one character at a time — show a "Generating
          artifact" placeholder instead of dumping it into the transcript; the normal
          collapsed-link rendering (extractArtifact against `m.content`) takes over the
          instant the turn commits. */}
      {streaming && (() => {
        const preview = streamingArtifactPreview(streaming)
        if (!preview) {
          return <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Linkified text={streaming} onLinkTap={handleLinkTap} /><span className="lc-caret">▍</span></div>
        }
        return (
          <>
            {preview.textBefore && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={preview.textBefore} onLinkTap={handleLinkTap} /></div>}
            <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="lc-thinking-label">Generating artifact: {preview.title}…</span>
            </span>
          </>
        )
      })()}
    </div>
  )
}
