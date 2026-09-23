// ─── Sessions rail ───────────────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { Dispatch, SetStateAction } from 'react'
import type { LivSession } from './types'
import type { LivChatStyles } from './styles'
import { displayTitle } from './helpers'
import { ChannelIcon } from './MessageParts'
import { PencilI, TrashI } from './icons'

export function SessionRail({ S, accent, railOpen, sessions, activeId, newSession, selectSession, renamingId, renameDraft,
  setRenameDraft, startRename, commitRename, cancelRename, setRenaming, confirmDeleteId, setConfirmDeleteId, confirmDelete }: {
  S: LivChatStyles
  accent: string
  railOpen: boolean
  sessions: LivSession[]
  activeId: string | null
  newSession: () => void
  selectSession: (id: string) => void
  renamingId: string | null
  renameDraft: string
  setRenameDraft: Dispatch<SetStateAction<string>>
  startRename: (s: LivSession) => void
  commitRename: (s: LivSession) => void
  cancelRename: () => void
  setRenaming: (id: string | null) => void
  confirmDeleteId: string | null
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>
  confirmDelete: (s: LivSession) => void
}) {
  return (
    <aside className="lc-rail" data-open={railOpen} style={S.rail}>
      <button className="ds-btn" style={{ ...S.ghostBtn, width: '100%' }} onClick={newSession}>+ New chat</button>
      {sessions.length === 0 && <p style={S.muted}>No conversations yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sessions.map((s) => (
          <li key={s.id} className="lc-session" data-active={s.id === activeId} style={S.sessionRow}>
            {renamingId === s.id ? (
              <input className="ds-input" autoFocus style={{ ...S.input, flex: 1, minWidth: 0, padding: '5px 8px', borderColor: accent }}
                value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(s) } else if (e.key === 'Escape') { e.preventDefault(); cancelRename() } }}
                onBlur={() => commitRename(s)} />
            ) : (
              <>
                <button style={S.sessionOpen} onClick={() => selectSession(s.id)}>
                  <span style={S.sessionTitle}>{displayTitle(s.title)}</span>
                  <span style={{ color: cssVar.dim, lineHeight: 0 }} title={s.channel} aria-label={s.channel}><ChannelIcon channel={s.channel} /></span>
                </button>
                {confirmDeleteId === s.id ? (
                  <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="lc-iconbtn" style={{ ...S.iconbtn, ...textStyle('caption'), color: cssVar.danger }} onClick={() => confirmDelete(s)}>Delete</button>
                    <button className="lc-iconbtn" style={{ ...S.iconbtn, ...textStyle('caption') }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </span>
                ) : (
                  <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="lc-iconbtn" style={S.iconbtn} title="Rename" onClick={() => startRename(s)}><PencilI /></button>
                    <button className="lc-iconbtn" style={S.iconbtn} title="Delete" onClick={() => { setRenaming(null); setConfirmDeleteId(s.id) }}><TrashI /></button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
