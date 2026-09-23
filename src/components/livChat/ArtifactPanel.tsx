// ─── Artifacts side panel (livchat-artifacts-system v1) ──────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { highlightCode } from '../livChatSyntaxHighlight'
import type { LivArtifact } from '../livChatComposer'
import { SYNTAX_COLOR } from './constants'
import type { LivChatStyles } from './styles'
import { CheckI, CloseI, CodeI, CopyI, DownloadI, ExternalLinkI } from './icons'

export function ArtifactPanel({ S, artifact, splitPct, artifactCopied, onArtifactDividerPointerDown, copyArtifact, downloadArtifact,
  expandArtifact, closeArtifact }: {
  S: LivChatStyles
  artifact: LivArtifact
  splitPct: number
  artifactCopied: boolean
  onArtifactDividerPointerDown: (e: ReactPointerEvent) => void
  copyArtifact: () => void
  downloadArtifact: () => void
  expandArtifact: () => void
  closeArtifact: () => void
}) {
  return (
    <>
      <div
        className="lc-artifact-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the artifact panel"
        onPointerDown={onArtifactDividerPointerDown}
      />
      <div className="lc-artifact-panel" style={{ flex: `0 0 ${100 - splitPct}%`, minWidth: 0, display: 'flex', flexDirection: 'column', background: cssVar.surface, borderLeft: `1px solid ${cssVar.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${cssVar.border}` }}>
          <CodeI />
          <span style={{ ...textStyle('bodySm'), fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.title}</span>
          <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{artifact.language}</span>
          <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Copy" aria-label="Copy artifact" onClick={copyArtifact}>
            {artifactCopied ? <CheckI /> : <CopyI />}
          </button>
          <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Download" aria-label="Download artifact" onClick={downloadArtifact}>
            <DownloadI />
          </button>
          <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Open in a new tab" aria-label="Open artifact in a new tab" onClick={expandArtifact}>
            <ExternalLinkI />
          </button>
          <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Close" aria-label="Close artifact panel" onClick={closeArtifact}>
            <CloseI />
          </button>
        </div>
        <pre style={{ margin: 0, flex: 1, overflow: 'auto', padding: 12, ...textStyle('caption'), fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <code>
            {highlightCode(artifact.content, artifact.language).map((tok, i) => (
              <span key={i} style={{ color: SYNTAX_COLOR[tok.kind], fontStyle: tok.kind === 'comment' ? 'italic' : 'normal' }}>{tok.text}</span>
            ))}
          </code>
        </pre>
      </div>
    </>
  )
}
