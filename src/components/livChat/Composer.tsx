// ─── Composer: attachments, `/`-menu, textarea, toolbar ────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy. The Brain sheet arrives as a pre-rendered slot (`brainSheet`) so it keeps its
// exact DOM position inside the toolbar row without this file needing the Brain settings.
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import Glyph from '../../Glyph'
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import { shouldSendOnEnter, attachmentError } from '../livChatComposer'
import { PROVIDER_LABELS } from '../livChatModels'
import type { LivModel } from '../livChatModels'
import type { LivChatAction, LivChatAdapter, LivHat, LivKeyInfo, LivSlashTool } from './types'
import type { LivChatStyles } from './styles'
import type { SlashMenuState } from './useSlashMenu'
import { ATTACH_ACCEPT, ATTACH_ALLOWED, ATTACH_MAX_BYTES } from './constants'
import { SlashMenuPopover, SlashToolForm } from './SlashMenu'
import { ActionsMenu } from './ActionsMenu'
import { ArrowUpI, FileTextI, ImageI, MicI, PlusI, SpeakerI } from './icons'

export function Composer({ S, hat, accent, adapter, draft, setDraft, files, setFiles, setMsg, composerRef, fileRef, enterSends,
  send, stop, sending, slash, slashTools, showKey, showAttach, brainOpen, setBrainOpen, keyInfo, models, modelInput,
  providerInput, livGlyphState, brainSheet, canBackgroundSend, actions, actionsOpen, setActionsOpen,
  handsFree, toggleHandsFree, listening, speechInSupported, toggleMic }: {
  S: LivChatStyles
  hat: LivHat
  accent: string
  adapter: LivChatAdapter
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  files: File[]
  setFiles: Dispatch<SetStateAction<File[]>>
  setMsg: Dispatch<SetStateAction<string>>
  composerRef: RefObject<HTMLTextAreaElement | null>
  fileRef: RefObject<HTMLInputElement | null>
  enterSends: boolean
  send: (overrideText?: string, overrideFiles?: File[], background?: boolean) => Promise<void>
  stop: () => void
  sending: boolean
  slash: SlashMenuState
  slashTools?: LivSlashTool[]
  showKey: boolean
  showAttach: boolean
  brainOpen: boolean
  setBrainOpen: Dispatch<SetStateAction<boolean>>
  keyInfo: LivKeyInfo
  models: LivModel[]
  modelInput: string
  providerInput: string
  livGlyphState: 'idle' | 'thinking' | 'running'
  brainSheet: ReactNode
  canBackgroundSend: boolean
  actions?: LivChatAction[]
  actionsOpen: boolean
  setActionsOpen: Dispatch<SetStateAction<boolean>>
  handsFree: boolean
  toggleHandsFree: () => void
  listening: boolean
  speechInSupported: boolean
  toggleMic: () => void
}) {
  const {
    slashOpen, setSlashOpen, setSlashIndex, slashDismissed, setSlashDismissed, slashPending, setSlashPending,
    filteredSlashTools, slashActiveIndex, selectSlashTool, runSlashPending,
  } = slash
  return (
    <div className="lc-composer" style={{ marginTop: space.sm, borderTop: `1px solid ${cssVar.border}`, paddingTop: space.sm, flex: '0 0 auto' }}>
      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {files.map((f, i) => (
            <span key={i} style={{ ...textStyle('caption'), background: cssVar.track, borderRadius: radius.pill, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflowWrap: 'anywhere' }}>{f.type.startsWith('image/') ? <ImageI /> : <FileTextI />} {f.name}</span>
          ))}
        </div>
      )}
      {slashPending && (
        <SlashToolForm S={S} slashPending={slashPending} setSlashPending={setSlashPending} runSlashPending={runSlashPending} />
      )}
      <div style={{ position: 'relative' }}>
        {/* `/`-menu popover (livchat-slash-menu-canon) — opens above the composer when the
            draft is a bare `/command` at the very start, filtered as the user keeps typing.
            Arrow keys move slashIndex; Enter/Tab/click selects; Escape dismisses without
            clearing the draft (handled in the textarea's onKeyDown below). */}
        {filteredSlashTools.length > 0 && (
          <SlashMenuPopover filteredSlashTools={filteredSlashTools} slashActiveIndex={slashActiveIndex}
            setSlashOpen={setSlashOpen} setSlashDismissed={setSlashDismissed} setSlashIndex={setSlashIndex}
            selectSlashTool={selectSlashTool} />
        )}
        <textarea ref={composerRef} className="ds-input" style={{ ...S.input, width: '100%', resize: 'none', minHeight: 44, maxHeight: 160 }}
          placeholder={hat.placeholder || 'Message Liv…'}
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            setDraft(v)
            setSlashIndex(0)
            if (!slashTools || slashTools.length === 0) return
            if (/^\/(\S*)$/.test(v)) { if (!slashDismissed) setSlashOpen(true) }
            else { setSlashOpen(false); setSlashDismissed(false) }
          }}
          onKeyDown={(e) => {
            if (slashOpen && filteredSlashTools.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % filteredSlashTools.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + filteredSlashTools.length) % filteredSlashTools.length); return }
              if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); setSlashDismissed(true); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectSlashTool(filteredSlashTools[slashActiveIndex]); return }
            }
            if (shouldSendOnEnter(e.key, e.shiftKey, e.nativeEvent.isComposing, enterSends)) { e.preventDefault(); send() }
          }}
          rows={1} />
      </div>
      {/* Toolbar row order: Brain (far LEFT) | Attach (+) | Tools (actions) | [spacer] |
          Hands-free | Dictate | Send/Stop. The spacer (marginLeft: auto on the Hands-free
          button below) balances the row left/right — a brief no-spacer revision read
          left-clustered/unbalanced on a real phone. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {/* Brain pill: model + API-key + provider settings, all folded together. Gated on
            showKey (which respects hat.enableKey === false — a hat that opts out gets no
            Brain pill at all). Opens a bottom SHEET (see below, outside this row) — not an
            anchored popover — a professional, Claude-model-selector-like
            brain-menu direction. */}
        {showKey && (
          <div style={{ display: 'inline-flex', minWidth: 0 }}>
            {/* Brain pill: opaque surface backing + accent border, matching Tummyful's
                original `.composer-modelpill` canon — was `background: transparent` with
                a subtle grey border, which read as a floating word rather than a pill
                button (Jeff 2026-08-09: "I want the terra cotta pill backing for the
                buttons not just a glow"). Every consumer now gets the pill shape; the
                accent color they wear (terracotta / green) still comes from their own
                hat.accent, so this stays palette-agnostic. */}
            <button type="button" className="lc-iconbtn ds-btn"
              style={{ ...textStyle('caption'), color: accent, background: cssVar.surface, border: `1px solid ${accent}`, borderRadius: radius.pill, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, minWidth: 0 }}
              title="Brain: model + API key" aria-label="Brain: model, API key, and settings"
              aria-expanded={brainOpen} aria-haspopup="dialog" onClick={() => setBrainOpen((o) => !o)}>
              {hat.glyph === 'live' && <Glyph variant="live" size={14} animated={livGlyphState} alt="" />}
              {/* whiteSpace:nowrap + ellipsis, NOT the default wrap: a cramped toolbar (many
                  icons + a long model name) wraps this label to 2 lines, growing the pill
                  taller than its sibling icon buttons and visually breaking the row — reads
                  as the label text bleeding past the pill's edges. minWidth:0 up the chain
                  (this span + its button + wrapper div) is what lets it actually
                  shrink/truncate instead of forcing the row to overflow the card's own
                  overflow:hidden bounds. */}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {keyInfo.hasKey ? (models.find((m) => m.id === (keyInfo.model || modelInput))?.label.split('·')[0].trim() || (PROVIDER_LABELS[providerInput] ?? 'Model')) : 'Add Key'}
              </span>
              <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>▾</span>
            </button>
          </div>
        )}
        {/* Gated on hat.enableAttachments alone, NOT adapter.attachments — that field is a
            signedUrl RESOLVER for redisplaying a past attachment already in storage (see
            its use below in the history-hydration effect), an unrelated capability from
            "can this turn carry a file." chat.send(args: {files?: File[]}) accepts files on
            every adapter per the interface, so an adapter with no storage-backed redisplay
            (attachments ride into the model call inline, never persisted — e.g. Commis)
            could still never show this button before this fix, even though sending files
            worked fine end to end. */}
        {showAttach && (
          <>
            <button className="lc-iconbtn" style={S.composerIconbtn} title="Attach a file" aria-label="Attach a file" onClick={() => fileRef.current?.click()}><PlusI /></button>
            <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} multiple style={{ display: 'none' }} onChange={(e) => {
              // Validate each pick against the size + type policy. Accepted files stage as
              // attachments; rejected ones surface a VISIBLE error line (not a silent drop) via
              // the same setMsg channel key/rename/model errors already use. Reset the input so
              // re-picking a just-rejected file re-fires onChange.
              const picked = Array.from(e.target.files || [])
              const accepted: File[] = []
              const errors: string[] = []
              for (const f of picked) {
                const err = attachmentError(f, { maxBytes: ATTACH_MAX_BYTES, allowed: ATTACH_ALLOWED })
                if (err) errors.push(err); else accepted.push(f)
              }
              setFiles(accepted)
              setMsg(errors.join(' '))
              if (errors.length && fileRef.current) fileRef.current.value = ''
            }} />
          </>
        )}
        {/* Brain bottom sheet — a more professional take on Claude's model-selector
            sheet, not a literal copy. Rendered as a fixed
            scrim + rise-from-bottom panel rather than an anchored popover: scrollable,
            expandable, Liquid Glass (see .lc-brain-sheet / .lc-glass below). */}
        {brainSheet}
        {/* Composer actions menu — Commis's chef's-knife popover ("turn this into…"),
            Advisor's "add to budget" etc. DS owns the trigger + popover layout + click-out;
            the app supplies items + handlers. The trigger uses hat.toolIcon when set (so
            Commis gets its chef's knife), else a generic tool glyph. Also the background-
            send trigger (livchat-agentic-workflows): reusing this EXISTING popover rather
            than adding a new composer icon keeps the locked composer icon order untouched
            — a background-capable adapter just unlocks one more DS-owned item in the same
            list, host items and all. */}
        {(canBackgroundSend || (actions && actions.length > 0)) && (
          <ActionsMenu S={S} hat={hat} accent={accent} actions={actions} canBackgroundSend={canBackgroundSend}
            actionsOpen={actionsOpen} setActionsOpen={setActionsOpen} draft={draft} files={files} sending={sending} send={send} />
        )}
        {/* Voice: hands-free read-aloud (always available via browser TTS fallback) + mic
            dictation (only where the browser supports speech-in). marginLeft: auto pushes
            this Hands-free/Dictate/Send cluster to the row's far right — restores the
            left/right balance of the original `+ | Brain ▾ | actions ▾ | (spacer) | 🔊 | 🎙
            | ↑` canon (a brief no-spacer revision read left-clustered/unbalanced on a real
            phone). Pressed states use
            filled backgrounds — Tummyful's `.composer-icon.on` (hands-free accent fill) +
            `.composer-icon.listening` (mic danger fill) — so the active mode is
            unmistakable at a glance, not just a color shift on the SVG. */}
        <button type="button" className="lc-iconbtn"
          style={{ ...S.composerIconbtn,
            marginLeft: 'auto',
            background: handsFree ? accent : cssVar.surface,
            borderColor: handsFree ? accent : cssVar.borderBright,
            color: handsFree ? cssVar.onPrimary : cssVar.ink }}
          title="Hands-free: read replies aloud" aria-pressed={handsFree}
          onClick={toggleHandsFree}><SpeakerI /></button>
        {speechInSupported && (
          <button type="button" className="lc-iconbtn"
            style={{ ...S.composerIconbtn,
              background: listening ? cssVar.danger : cssVar.surface,
              borderColor: listening ? cssVar.danger : cssVar.borderBright,
              color: listening ? '#fff' : cssVar.ink }}
            title={listening ? 'Stop dictation' : 'Dictate'} aria-pressed={listening} onClick={toggleMic}><MicI /></button>
        )}
        {/* Send button: flat accent fill (canon). While streaming, swap in a red stop
            square so the abort control lives IN the send slot — matches Tummyful's
            `.composer-send.stop` behavior, not a separate "Stop" pill floating above
            the transcript. Only wired to an abort when the adapter supports it. */}
        {sending && adapter.chat.abort ? (
          <button
            type="button"
            className="ds-btn"
            style={{ width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center',
              background: cssVar.danger, color: '#fff', border: 0, cursor: 'pointer' }}
            title="Stop" aria-label="Stop"
            onClick={stop}>
            <span style={{ fontSize: 12, lineHeight: 1 }}>■</span>
          </button>
        ) : (
          <button
            className="ds-btn"
            style={{ ...S.primaryBtn, width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center',
              background: accent, color: cssVar.onPrimary,
              opacity: (sending || (!draft.trim() && files.length === 0)) ? 0.5 : 1 }}
            title="Send" aria-label="Send"
            disabled={sending || (!draft.trim() && files.length === 0)} onClick={() => send()}>
            {sending ? '…' : <ArrowUpI />}
          </button>
        )}
      </div>
    </div>
  )
}
