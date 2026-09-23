// ─── Composer actions menu (tools popover + Run in Background) ───────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { Dispatch, SetStateAction } from 'react'
import type { LivChatAction, LivHat } from './types'
import type { LivChatStyles } from './styles'
import { ToolI } from './icons'

export function ActionsMenu({ S, hat, accent, actions, canBackgroundSend, actionsOpen, setActionsOpen, draft, files, sending, send }: {
  S: LivChatStyles
  hat: LivHat
  accent: string
  actions?: LivChatAction[]
  canBackgroundSend: boolean
  actionsOpen: boolean
  setActionsOpen: Dispatch<SetStateAction<boolean>>
  draft: string
  files: File[]
  sending: boolean
  send: (overrideText?: string, overrideFiles?: File[], background?: boolean) => Promise<void>
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="lc-iconbtn"
        style={{ ...S.composerIconbtn,
          background: actionsOpen ? accent : cssVar.surface,
          borderColor: actionsOpen ? accent : cssVar.borderBright,
          color: actionsOpen ? cssVar.onPrimary : cssVar.ink }}
        title="Actions" aria-label="Actions" aria-expanded={actionsOpen} aria-haspopup="menu"
        onClick={() => setActionsOpen((o) => !o)}>
        {hat.toolIcon ?? <ToolI />}
      </button>
      {actionsOpen && (
        <>
          {/* Click-out overlay — a full-viewport transparent div under the popover
              that dismisses on any tap outside. Under (z-index-wise) the popover
              itself so items still receive their own clicks. */}
          <div onClick={() => setActionsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }} />
          <div className="lc-actions-menu lc-glass" role="menu" style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
            minWidth: 200, maxWidth: 280, zIndex: 31,
            background: cssVar.surface, border: `1px solid ${cssVar.border}`,
            borderRadius: radius.md, padding: 4, boxShadow: 'var(--ds-shadow-card)',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            {actions?.map((a) => (
              <button key={a.id} type="button" role="menuitem"
                className="lc-actions-item"
                disabled={a.disabled}
                style={{ ...textStyle('bodySm'), textAlign: 'left', background: 'transparent', border: 0,
                  padding: '8px 10px', borderRadius: radius.sm, cursor: a.disabled ? 'not-allowed' : 'pointer',
                  color: a.disabled ? cssVar.dim : cssVar.ink, opacity: a.disabled ? 0.6 : 1,
                  display: 'flex', flexDirection: 'column', gap: 2 }}
                onClick={async () => { setActionsOpen(false); try { await a.onSelect() } catch (e) { console.error('action.onSelect threw', e) } }}>
                <span>{a.label}</span>
                {a.hint && <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{a.hint}</span>}
              </button>
            ))}
            {canBackgroundSend && (() => {
              const empty = !draft.trim() && files.length === 0
              return (
                <button type="button" role="menuitem"
                  className="lc-actions-item"
                  disabled={empty || sending}
                  style={{ ...textStyle('bodySm'), textAlign: 'left', background: 'transparent', border: 0,
                    padding: '8px 10px', borderRadius: radius.sm, cursor: (empty || sending) ? 'not-allowed' : 'pointer',
                    color: (empty || sending) ? cssVar.dim : cssVar.ink, opacity: (empty || sending) ? 0.6 : 1,
                    display: 'flex', flexDirection: 'column', gap: 2 }}
                  onClick={() => { setActionsOpen(false); void send(undefined, undefined, true) }}>
                  <span>Run in Background</span>
                  <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Liv keeps working while you do something else. This reply lands in the conversation when it's done.</span>
                </button>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
