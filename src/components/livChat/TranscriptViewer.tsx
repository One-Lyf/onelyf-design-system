// ─── Transcript viewer dialog ────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import { TRANSCRIPT_FORMATS, type TranscriptFormat } from './constants'
import type { LivChatStyles } from './styles'

export function TranscriptViewer({ S, accent, setTranscriptOpen, transcriptFormat, setTranscriptFormat, renderTranscript,
  copyTranscript, downloadTranscript }: {
  S: LivChatStyles
  accent: string
  setTranscriptOpen: (open: boolean) => void
  transcriptFormat: TranscriptFormat
  setTranscriptFormat: (f: TranscriptFormat) => void
  renderTranscript: (format: TranscriptFormat) => string
  copyTranscript: () => void
  downloadTranscript: () => void
}) {
  return (
    <div onClick={() => setTranscriptOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Transcript" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="lc-glass"
        style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.md, boxShadow: 'var(--ds-shadow-card)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Transcript</span>
          <button type="button" className="ds-btn" style={{ ...textStyle('caption'), color: cssVar.mid, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            aria-label="Close transcript" onClick={() => setTranscriptOpen(false)}>Close</button>
        </div>
        <div role="group" aria-label="Transcript format" style={{ display: 'flex', gap: 4 }}>
          {TRANSCRIPT_FORMATS.map((f) => {
            const active = transcriptFormat === f.id
            return (
              <button key={f.id} type="button" className="ds-btn" aria-pressed={active}
                style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                  border: `1px solid ${active ? accent : cssVar.border}`,
                  background: active ? accent : cssVar.surface,
                  color: active ? cssVar.surface : cssVar.mid }}
                onClick={() => setTranscriptFormat(f.id)}>{f.label}</button>
            )
          })}
        </div>
        <pre style={{ margin: 0, overflow: 'auto', flex: 1, minHeight: 120, background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 10, ...textStyle('caption'), whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{renderTranscript(transcriptFormat)}</pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ds-btn" style={{ ...S.primaryBtn, flex: 1 }} onClick={copyTranscript}>Copy</button>
          <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, flex: 1, padding: '8px 10px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${accent}`, background: cssVar.surface, color: accent }} onClick={downloadTranscript}>Download</button>
        </div>
      </div>
    </div>
  )
}
