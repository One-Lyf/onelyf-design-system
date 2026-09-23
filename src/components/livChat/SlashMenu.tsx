// ─── `/`-menu: pending-tool form + command popover ───────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { LivChatStyles } from './styles'
import type { SlashMenuState } from './useSlashMenu'
import { CloseI, ToolI } from './icons'

export function SlashToolForm({ S, slashPending, setSlashPending, runSlashPending }: {
  S: LivChatStyles
  slashPending: NonNullable<SlashMenuState['slashPending']>
  setSlashPending: SlashMenuState['setSlashPending']
  runSlashPending: () => void
}) {
  return (
    <div style={{ background: cssVar.track, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ ...textStyle('bodySm'), fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {slashPending.tool.icon ?? <ToolI />} /{slashPending.tool.command}
        </span>
        <button type="button" className="lc-iconbtn" title="Cancel" aria-label="Cancel"
          onClick={() => setSlashPending(null)} style={{ ...S.composerIconbtn, width: 22, height: 22 }}>
          <CloseI />
        </button>
      </div>
      {slashPending.tool.args!.map((a) => (
        <label key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{a.label}{a.required && ' *'}</span>
          <input className="ds-input" style={S.input} placeholder={a.placeholder}
            value={slashPending.args[a.name] ?? ''}
            onChange={(e) => { const v = e.target.value; setSlashPending((p) => p && ({ ...p, args: { ...p.args, [a.name]: v } })) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSlashPending() } else if (e.key === 'Escape') { e.preventDefault(); setSlashPending(null) } }} />
        </label>
      ))}
      <button type="button" className="ds-btn" style={S.primaryBtn}
        disabled={slashPending.tool.args!.some((a) => a.required && !slashPending.args[a.name]?.trim())}
        onClick={runSlashPending}>Run</button>
    </div>
  )
}

export function SlashMenuPopover({ filteredSlashTools, slashActiveIndex, setSlashOpen, setSlashDismissed, setSlashIndex, selectSlashTool }: {
  filteredSlashTools: SlashMenuState['filteredSlashTools']
  slashActiveIndex: number
  setSlashOpen: SlashMenuState['setSlashOpen']
  setSlashDismissed: SlashMenuState['setSlashDismissed']
  setSlashIndex: SlashMenuState['setSlashIndex']
  selectSlashTool: SlashMenuState['selectSlashTool']
}) {
  return (
    <>
      {/* Click-out overlay, same technique as the composer actions-menu popover
          above: a full-viewport transparent div under the popover (but over
          everything else) that dismisses on any tap outside it. Needed because
          clicking away doesn't otherwise change `draft`, so without this the
          popover would stay visually open until the next keystroke or Escape. */}
      <div onClick={() => { setSlashOpen(false); setSlashDismissed(true) }}
        style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }} />
      <div className="lc-slash-menu lc-glass" role="listbox" aria-label="Tools" style={{
        position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, zIndex: 31,
        maxHeight: 220, overflowY: 'auto',
        background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.md,
        boxShadow: 'var(--ds-shadow-card)', padding: 4, display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        {filteredSlashTools.map((t, i) => (
          <button key={t.id} type="button" role="option" aria-selected={i === slashActiveIndex}
            onMouseEnter={() => setSlashIndex(i)}
            onClick={() => selectSlashTool(t)}
            style={{ ...textStyle('bodySm'), textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
              background: i === slashActiveIndex ? cssVar.track : 'transparent',
              border: 0, borderRadius: radius.sm, padding: '6px 8px', cursor: 'pointer', color: cssVar.ink }}>
            <span style={{ display: 'inline-flex', width: 16, flexShrink: 0 }}>{t.icon ?? <ToolI />}</span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span>/{t.command}</span>
              <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{t.label}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
