// ─── One transcript message bubble ───────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
//
// Memoized: while a reply streams, LivChat re-renders on every token, and without memo every
// finished row re-ran its fence parsing and linkify each time. The parent passes per-row
// primitives (isLast / isPlaying / isCopied / sendingLast) and stable handlers, so a row
// re-renders only when something it shows actually changed.
import { memo, useMemo } from 'react'
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import { extractDocument, extractArtifact, extractOptions, type LivDocument, type LivArtifact } from '../livChatComposer'
import type { LivMessage } from './types'
import { bubbleStyle, type LivChatStyles } from './styles'
import { attachmentsOf } from './helpers'
import { HighlightedText, Linkified, ModalityPill } from './MessageParts'
import { CheckI, CodeI, CopyI, DownloadI, FileTextI, ImageI, PlayI, StopSmallI } from './icons'

export const MessageBubble = memo(function MessageBubble({ S, m, isLast, sendingLast, urls, isPlaying, highlightRange, playMessage,
  isCopied, copyMessage, handleLinkTap, send, downloadDocument, openArtifact }: {
  S: LivChatStyles
  m: LivMessage
  /** This is the newest message in the transcript. */
  isLast: boolean
  /** A turn is sending AND this is the newest message (only the newest row's option cards care). */
  sendingLast: boolean
  urls: Record<string, string>
  /** This message is the one being read aloud. */
  isPlaying: boolean
  /** Spoken-word range; only meaningful (and only passed non-null) while this row is playing. */
  highlightRange: { start: number; end: number } | null
  playMessage: (id: string, text?: string | null) => void
  isCopied: boolean
  copyMessage: (id: string, text?: string | null) => void
  handleLinkTap: (url: string) => void
  send: (overrideText?: string) => void
  downloadDocument: (doc: LivDocument) => void
  openArtifact: (a: LivArtifact) => void
}) {
  // livchat-document-creation: a liv reply can flag part of itself as a real,
  // downloadable document (see extractDocument's own comment for the fence
  // convention). Only checked on liv turns — a user's own message is never
  // parsed as a document, even if it happens to contain a ```document fence.
  // Parsing is keyed on the message text, so a row that re-renders for another reason (read-aloud
  // highlight, copy tick) doesn't re-scan its whole content.
  const { doc, artifactFound, opts } = useMemo(() => {
    const doc = m.role === 'liv' ? extractDocument(m.content) : null
    // livchat-artifacts-system: a liv reply can flag CODE as a live-rendered artifact
    // (```artifact lang Title) instead of a plain downloadable ```document — opens in
    // the dedicated side panel (see the artifact state/effects above `send`) rather
    // than an inline download. Checked after `doc` (document wins the rare both-fence
    // case, same precedence style as doc-vs-options below).
    const artifactFound = !doc && m.role === 'liv' ? extractArtifact(m.content) : null
    // livchat-decision-options-cards: a liv reply can offer labelled choices via an
    // ```options fence; DS renders them as tappable cards and a tap sends that choice
    // as the next turn. Always PARSED on liv turns (so the raw fence is stripped from
    // the transcript even on older messages), but only the MOST-RECENT message's cards
    // stay tappable — stale choices from an earlier turn shouldn't re-fire once the
    // conversation has moved on. Documents/artifacts take precedence in the rare
    // multi-fence case.
    const opts = !doc && !artifactFound && m.role === 'liv' ? extractOptions(m.content) : null
    return { doc, artifactFound, opts }
  }, [m.role, m.content])
  const optionsLive = !!opts && isLast && !sendingLast
  // livchat-agentic-workflows: the locally-synthesized placeholder for a background
  // task still in flight (queued/running) — send() inserts it with empty content and
  // an id prefixed `task-`; the polling effect above fills in real content (done) or
  // an error line (error) once pollTask reports a terminal status.
  const isPendingTask = m.role === 'liv' && !m.content && m.id.startsWith('task-')
  return (
    <div className="lc-bubble" style={bubbleStyle(m.role)}>
      {/* Read-aloud (accessibility): Play sits top-left of the response frame — the
          leftmost control in the header row. Copy moves to a footer row, bottom-right
          (see below the content). Liv's own replies only; reading back the user's own
          typed message aloud isn't the ask here. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {m.role === 'liv' && m.content && (
          <button className="lc-iconbtn" style={S.iconbtn}
            title={isPlaying ? 'Stop reading aloud' : 'Read this message aloud'}
            aria-label={isPlaying ? 'Stop reading aloud' : 'Read this message aloud'}
            aria-pressed={isPlaying}
            onClick={() => playMessage(m.id, m.content)}>
            {isPlaying ? <StopSmallI /> : <PlayI />}
          </button>
        )}
        <span style={{ ...textStyle('overline'), color: cssVar.mid }}>{m.role === 'liv' ? 'Liv' : 'You'}</span>
        <ModalityPill modality={m.modality} />
      </div>
      {attachmentsOf(m).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: m.content ? 6 : 0 }}>
          {attachmentsOf(m).map((a, i) => {
            // Images render as thumbnails (backward compatible — older attachments were all
            // stamped kind:'image'); anything else renders as a file chip styled like the
            // composer's own file pills. A path/mime-less legacy attachment defaults to image.
            const isImage = a.kind === 'image' || (!!a.mime && a.mime.startsWith('image/')) || (!a.kind && !a.mime)
            if (isImage) {
              return urls[a.path]
                ? <img key={i} src={urls[a.path]} alt="attachment" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: radius.sm, border: `1px solid ${cssVar.border}` }} />
                : <span key={i} style={{ width: 84, height: 84, display: 'grid', placeItems: 'center', borderRadius: radius.sm, border: `1px dashed ${cssVar.border}`, color: cssVar.dim }}><ImageI /></span>
            }
            const fname = a.name || a.path.split('/').pop() || 'file'
            return (
              <span key={i} title={fname} style={{ ...textStyle('caption'), background: cssVar.track, borderRadius: radius.pill, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                <FileTextI /> {fname}
              </span>
            )
          })}
        </div>
      )}
      {isPendingTask ? (
        // Same "Thinking" pill language as the live-streaming bubble below (lc-thinking),
        // relabeled — this task is running detached from the turn that queued it, not
        // this component's own `sending` state, so it gets its own always-on pulse.
        <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="lc-thinking-label">Running in background</span>
        </span>
      ) : opts ? (
        <>
          {opts.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={opts.text} onLinkTap={handleLinkTap} /></div>}
          <div className="lc-options" role="group" aria-label="Choose an option" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opts.options.map((label, i) => (
              <button
                key={i}
                type="button"
                className="lc-option ds-btn"
                disabled={!optionsLive}
                onClick={() => { if (optionsLive) send(label) }}
                style={{ ...textStyle('bodySm'), textAlign: 'left', color: cssVar.ink, background: cssVar.surface,
                  border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '9px 12px',
                  cursor: optionsLive ? 'pointer' : 'default', opacity: optionsLive ? 1 : 0.55 }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : doc ? (
        <>
          {doc.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={doc.text} onLinkTap={handleLinkTap} /></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px', background: cssVar.surface }}>
            <FileTextI />
            <span style={{ ...textStyle('bodySm'), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.document.title}</span>
            <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Download this document (Markdown)" aria-label={`Download ${doc.document.title}`} onClick={() => downloadDocument(doc.document)}>
              <DownloadI />
            </button>
          </div>
        </>
      ) : artifactFound ? (
        <>
          {artifactFound.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={artifactFound.text} onLinkTap={handleLinkTap} /></div>}
          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px', background: cssVar.surface, color: cssVar.ink, cursor: 'pointer', width: '100%', textAlign: 'left' }}
            onClick={() => openArtifact(artifactFound.artifact)}
            title={`Open ${artifactFound.artifact.title} in the artifacts panel`}
          >
            <CodeI />
            <span style={{ ...textStyle('bodySm'), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifactFound.artifact.title}</span>
            <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{artifactFound.artifact.language}</span>
          </button>
        </>
      ) : (
        m.content && (
          <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {isPlaying && highlightRange
              ? <HighlightedText text={m.content} range={highlightRange} />
              : <Linkified text={m.content} onLinkTap={handleLinkTap} />}
          </div>
        )
      )}
      {m.content && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="lc-copy lc-iconbtn" style={S.iconbtn} title="Copy message" onClick={() => copyMessage(m.id, m.content)}>
            {isCopied ? (<><CheckI /> <span style={textStyle('caption')}>Copied</span></>) : <CopyI />}
          </button>
        </div>
      )}
    </div>
  )
})
