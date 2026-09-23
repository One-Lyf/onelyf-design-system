// ─── Chat header ─────────────────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import Glyph from '../../Glyph'
import type { Dispatch, SetStateAction } from 'react'
import type { LivHat, LivKeyInfo, LivMessage, LivSession, LivUsage } from './types'
import type { LivChatStyles } from './styles'
import type { PendingTask } from './useBackgroundTasks'
import { usageCost } from './helpers'
import { ChevronDownI, CloseI, DownloadI, ListChecksI, Maximize2I, MenuI, Minimize2I } from './icons'

export function ChatHeader({ S, hat, accent, livGlyphState, railOpen, setRailOpen, sessions, messages, setTranscriptOpen,
  canBackgroundSend, setTasksOpen, pendingTasks, usage, setUsage, setLastTurn, keyInfo, costHintFor,
  dock, onRestore, onMaximize, onMinimize, onClose }: {
  S: LivChatStyles
  hat: LivHat
  accent: string
  livGlyphState: 'idle' | 'thinking' | 'running'
  railOpen: boolean
  setRailOpen: Dispatch<SetStateAction<boolean>>
  sessions: LivSession[]
  messages: LivMessage[]
  setTranscriptOpen: (open: boolean) => void
  canBackgroundSend: boolean
  setTasksOpen: (open: boolean) => void
  pendingTasks: Record<string, PendingTask>
  usage: LivUsage
  setUsage: Dispatch<SetStateAction<LivUsage>>
  setLastTurn: Dispatch<SetStateAction<LivUsage | null>>
  keyInfo: LivKeyInfo
  costHintFor: (id?: string | null) => { input: number; output: number } | undefined
  dock: 'panel' | 'full'
  onRestore?: () => void
  onMaximize?: () => void
  onMinimize?: () => void
  onClose?: () => void
}) {
  return (
    <div style={S.head}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
        {/* History (N) pill — always visible, opens the slide-in drawer over the transcript.
            Matches Tummyful's `.commis-history-btn`. Text style is subtle so it doesn't
            compete with the hat identity in the header. */}
        <button
          type="button"
          className="lc-iconbtn"
          aria-expanded={railOpen}
          aria-label="Past conversations"
          title="Past conversations"
          onClick={() => setRailOpen((o) => !o)}
          style={{ ...textStyle('caption'), background: 'transparent', border: `1px solid ${cssVar.border}`,
            borderRadius: radius.pill, padding: '3px 10px', color: cssVar.mid, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <MenuI /> History{sessions.length ? ` (${sessions.length})` : ''}
        </button>
        {/* View the whole conversation in a chosen format (Markdown / Plain / JSON) with copy +
            download. Disabled until there's something to show. */}
        <button
          type="button"
          className="lc-iconbtn"
          style={{ ...S.iconbtn, opacity: messages.length ? 1 : 0.4 }}
          disabled={!messages.length}
          aria-label="View transcript"
          title="View / export this conversation"
          onClick={() => setTranscriptOpen(true)}
        >
          <DownloadI />
        </button>
        {/* Task-visibility tray trigger. Gated on canBackgroundSend — same optional-port rule
            as the composer's "Run in Background" item, zero surface change for an adapter that
            doesn't support background turns. */}
        {canBackgroundSend && (
          <button
            type="button"
            className="lc-iconbtn"
            style={{ ...S.iconbtn, position: 'relative' }}
            aria-label="Background tasks"
            title="Background tasks"
            onClick={() => setTasksOpen(true)}
          >
            <ListChecksI />
            {Object.keys(pendingTasks).length > 0 && (
              <span aria-hidden="true" style={{
                position: 'absolute', top: 0, right: 0, minWidth: 14, height: 14, borderRadius: radius.pill,
                background: accent, color: cssVar.onPrimary, fontSize: 9, fontWeight: 700, lineHeight: '14px',
                textAlign: 'center', padding: '0 3px',
              }}>{Object.keys(pendingTasks).length}</span>
              /* badge counts only in-flight tasks — recentTasks are already-resolved history,
                 not something that needs the user's attention the way a running task does */
            )}
          </button>
        )}
      </div>
      {!hat.hideHeaderTitle && (
        <h2 style={{ ...textStyle('h3'), margin: 0, display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0, flex: 1, justifyContent: 'center' }}>
          {hat.glyph && <Glyph variant={hat.glyph} size={22} animated={hat.glyph === 'live' ? livGlyphState : 'none'} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Liv{hat.subtitle && <span style={{ ...S.muted, marginLeft: 6 }}>· {hat.subtitle}</span>}</span>
        </h2>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
        {(() => {
          const totalTok = (usage.input || 0) + (usage.output || 0)
          if (totalTok <= 0) return null
          const cost = usageCost(usage, keyInfo.model, costHintFor(keyInfo.model))
          return (
            <button
              type="button"
              className="lc-iconbtn"
              title={`${totalTok.toLocaleString()} tokens this session total · estimated ${keyInfo.model || 'model'} list cost — tap to reset`}
              onClick={() => { setUsage({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }); setLastTurn(null) }}
              style={{ background: 'transparent', border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: '3px 7px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, lineHeight: 1.1 }}
            >
              <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>${cost.toFixed(4)}</span>
              <span style={{ ...textStyle('overline'), color: cssVar.dim }}>{totalTok.toLocaleString()} tok</span>
            </button>
          )
        })()}
        {/* Brain pill moved into the composer (see onelyf-planning/docs/liv-chat-canon.md — Tummyful's
            placement is canon). The header now only carries the token/cost meter + optional
            dock controls; API-key entry, model selector, and usage breakdown all live in the
            composer's Brain popover next to attach/mic/send. */}
        {/* Dock controls — only when a floating host supplies them. Maximize expands to a
            fixed full-viewport overlay; restore returns to the panel; chevron-down collapses
            back to the launcher (conversation kept); X dismisses. The maximize/restore icon
            only renders when the host supplies the matching handler for the current dock state. */}
        {dock === 'full'
          ? onRestore && (
              <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onRestore} title="Restore" aria-label="Restore Liv to a panel"><Minimize2I /></button>
            )
          : onMaximize && (
              <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onMaximize} title="Maximize" aria-label="Maximize Liv to full screen"><Maximize2I /></button>
            )}
        {onMinimize && (
          <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onMinimize} title="Minimize" aria-label="Minimize Liv"><ChevronDownI /></button>
        )}
        {onClose && (
          <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onClose} title="Close" aria-label="Close Liv"><CloseI /></button>
        )}
      </div>
    </div>
  )
}
