// ─── Brain bottom sheet (model / key / effort / mode / usage) ────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import { PROVIDER_LABELS, providerLabel, PROVIDER_FALLBACK_MODELS } from '../livChatModels'
import { EFFORT_LEVELS, effortIndex, effortAtIndex, MODES, VERBOSITY_OPTIONS, DEFAULT_COMPACT_THRESHOLD } from '../livChatModes'
import type { LivChatAdapter, LivHat, LivMessage, LivUsage } from './types'
import type { LivChatStyles } from './styles'
import type { BrainSettings } from './useBrainSettings'
import { usageCost } from './helpers'
import { CloseI } from './icons'
import { BrainSpendLimit, useBrainSpend } from './BrainSpendLimit'

export function BrainSheet({ S, hat, accent, adapter, brain, setBrainOpen, sheetDragY, onBrainSheetHandlePointerDown, setMsg,
  activeId, messages, doCompact, tier, onTierChange, usage, lastTurn, daily }: {
  S: LivChatStyles
  hat: LivHat
  accent: string
  adapter: LivChatAdapter
  brain: BrainSettings
  setBrainOpen: Dispatch<SetStateAction<boolean>>
  sheetDragY: number
  onBrainSheetHandlePointerDown: (e: ReactPointerEvent) => void
  setMsg: Dispatch<SetStateAction<string>>
  activeId: string | null
  messages: LivMessage[]
  doCompact: (sessionId: string | null) => void
  tier?: string
  onTierChange?: (id: string) => void
  usage: LivUsage
  lastTurn: LivUsage | null
  daily: LivUsage
}) {
  const {
    keyInfo, setKeyInfo, providerInput, setProviderInput, setLiveModels, setModelInput, keyInput, setKeyInput,
    models, modelInput, showEffort, effortInput, setEffortInput, showMode, modeInput, setModeInput,
    showVerbosity, verbosityInput, setVerbosityInput, showCompact, compacting, autoCompact, setAutoCompact,
    costHintFor, saveKey,
  } = brain
  // Optional monthly spend limit: inert (and unrendered) without adapter.spend.
  const spend = useBrainSpend(adapter.spend)
  return (
    <div className="lc-sheet-scrim" onClick={() => setBrainOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-label="Brain: model, API key, and settings"
        onClick={(e) => e.stopPropagation()}
        className="lc-glass lc-brain-sheet"
        style={{
          width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain',
          borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          boxShadow: 'var(--ds-shadow-card)', display: 'flex', flexDirection: 'column', gap: 8,
          transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined,
        }}>
        {/* Drag-to-dismiss: swipe the handle down past SHEET_DISMISS_THRESHOLD_PX to close. */}
        <div className="lc-sheet-handle" aria-hidden="true"
          onPointerDown={onBrainSheetHandlePointerDown}
          style={{ cursor: 'grab', touchAction: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Brain</div>
          <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={() => setBrainOpen(false)}
            title="Close" aria-label="Close Brain settings"><CloseI /></button>
        </div>
            <p style={{ ...S.muted, margin: 0 }}>
              Liv replies using <strong>your own API key</strong>.
              {keyInfo.hasKey ? ' A key is set.' : ' No key yet.'}
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Provider</span>
              <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                value={providerInput}
                onChange={async (e) => {
                  const id = e.target.value
                  setProviderInput(id)
                  setLiveModels(null)
                  const fallback = PROVIDER_FALLBACK_MODELS[id]
                  if (fallback?.length) setModelInput(fallback[0].id)
                  const r = await adapter.key!.set({ provider: id })
                  if (r.ok) setKeyInfo((k) => ({ ...k, provider: id, hasKey: r.value?.hasKey ?? k.hasKey }))
                  else setMsg(r.error?.message || 'Could not switch provider.')
                }}>
                {(keyInfo.availableProviders?.length
                  ? keyInfo.availableProviders
                  : Object.keys(PROVIDER_LABELS)
                ).map((p) => <option key={p} value={p}>{providerLabel(p)}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...textStyle('caption'), color: cssVar.mid }}>API Key</span>
              <input className="ds-input" type="password" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                placeholder={keyInfo.hasKey ? 'Replace key' : 'API key'}
                value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
            </label>
            {models.length > 1 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Model</span>
                <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                  value={keyInfo.model || modelInput}
                  onChange={async (e) => {
                    const id = e.target.value
                    setModelInput(id)
                    const r = await adapter.key!.set({ model: id })
                    if (r.ok) setKeyInfo((k) => ({ ...k, model: id }))
                    else setMsg(r.error?.message || 'Could not switch model.')
                  }}>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            )}
            {/* Effort slider — reasoning depth (Low→Max). Ordinal, so a slider. The
                app's adapter maps this to the provider's effort param on each request. */}
            {showEffort && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Effort</span>
                  <span style={{ color: accent, fontWeight: 700 }}>{EFFORT_LEVELS[effortIndex(effortInput)].label}</span>
                </span>
                <input type="range" min={0} max={EFFORT_LEVELS.length - 1} step={1}
                  style={{ width: '100%', accentColor: accent }}
                  value={effortIndex(effortInput)}
                  aria-label="Reasoning effort"
                  onChange={async (e) => {
                    const next = effortAtIndex(Number(e.target.value))
                    setEffortInput(next)
                    const r = await adapter.key!.set({ effort: next })
                    if (r.ok) setKeyInfo((k) => ({ ...k, effort: next }))
                    else setMsg(r.error?.message || 'Could not set effort.')
                  }} />
              </label>
            )}
            {/* Autonomy mode — Auto/Plan/Manual. Segmented (discrete, non-ordinal). The
                app enforces the Auto boundary: reversible edits apply directly, money /
                deletes / sends / irreversible always confirm-gate regardless of mode. */}
            {showMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Mode</span>
                <div role="group" aria-label="Autonomy mode" style={{ display: 'flex', gap: 4 }}>
                  {MODES.map((m) => {
                    const active = modeInput === m.id
                    return (
                      <button key={m.id} type="button" className="ds-btn" title={m.hint}
                        aria-pressed={active}
                        style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                          border: `1px solid ${active ? accent : cssVar.border}`,
                          background: active ? accent : cssVar.surface,
                          color: active ? cssVar.surface : cssVar.mid }}
                        onClick={async () => {
                          setModeInput(m.id)
                          const r = await adapter.key!.set({ mode: m.id })
                          if (r.ok) setKeyInfo((k) => ({ ...k, mode: m.id }))
                          else setMsg(r.error?.message || 'Could not set mode.')
                        }}>{m.label}</button>
                    )
                  })}
                </div>
                <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{MODES.find((m) => m.id === modeInput)?.hint}</span>
              </div>
            )}
            {/* Output verbosity — Terse/Verbose/Summary. How long each reply is; the
                app maps it to a system-prompt directive. Independent of effort. */}
            {showVerbosity && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Output</span>
                <div role="group" aria-label="Output verbosity" style={{ display: 'flex', gap: 4 }}>
                  {VERBOSITY_OPTIONS.map((v) => {
                    const active = verbosityInput === v.id
                    return (
                      <button key={v.id} type="button" className="ds-btn" title={v.hint}
                        aria-pressed={active}
                        style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                          border: `1px solid ${active ? accent : cssVar.border}`,
                          background: active ? accent : cssVar.surface,
                          color: active ? cssVar.surface : cssVar.mid }}
                        onClick={async () => {
                          setVerbosityInput(v.id)
                          const r = await adapter.key!.set({ verbosity: v.id })
                          if (r.ok) setKeyInfo((k) => ({ ...k, verbosity: v.id }))
                          else setMsg(r.error?.message || 'Could not set output style.')
                        }}>{v.label}</button>
                    )
                  })}
                </div>
                <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{VERBOSITY_OPTIONS.find((v) => v.id === verbosityInput)?.hint}</span>
              </div>
            )}
            {/* Compaction — manual "Compact now" + Auto toggle. Summarizes the session
                to keep the working context small (auto fires past the token threshold). */}
            {showCompact && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Context</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="ds-btn"
                    disabled={compacting || !activeId || !messages.length}
                    style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: (compacting || !messages.length) ? 'default' : 'pointer', border: `1px solid ${accent}`, background: cssVar.surface, color: accent, opacity: (compacting || !messages.length) ? 0.5 : 1 }}
                    onClick={() => doCompact(activeId)}>{compacting ? 'Compacting…' : 'Compact now'}</button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...textStyle('caption'), color: cssVar.mid, cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoCompact}
                      onChange={async (e) => {
                        const on = e.target.checked
                        setAutoCompact(on)
                        const r = await adapter.key?.set({ autoCompact: on })
                        if (r && !r.ok) setMsg(r.error?.message || 'Could not save auto-compact.')
                      }} />
                    Auto
                  </label>
                </div>
                <span style={{ ...textStyle('caption'), color: cssVar.dim }}>Summarize the conversation to keep the context small. Auto compacts past ~{Math.round((hat.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD) / 1000)}K tokens.</span>
              </div>
            )}
            {/* Persona tier selector — Cash Stash Advisor's Standard/Premium pattern.
                Only rendered when the hat opts in via hat.tiers + LivChatProps.tier
                /onTierChange. Ignored for hats without a tier concept (Commis today). */}
            {hat.tiers && hat.tiers.length > 0 && onTierChange && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Tier</span>
                <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                  value={tier ?? hat.tiers[0].id}
                  onChange={(e) => onTierChange(e.target.value)}>
                  {hat.tiers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            )}
            {/* Usage rows — Today / Session / Last Turn / Balance, matching Tummyful
                + Cash Stash canon. Today is localStorage-backed, rolls over at local
                midnight. Session + Last Turn + Balance are this-tab-only. Rendered
                ALWAYS (even at zero) so the Brain menu doesn't look empty on a cold
                session — Jeff 2026-08-09: "Brain menu still lacking". Empty rows
                show a dimmed em-dash instead of hiding. */}
            {(() => {
              const costHint = costHintFor(keyInfo.model)
              const totalTok = (usage.input || 0) + (usage.output || 0)
              const sessionCost = usageCost(usage, keyInfo.model, costHint)
              const lastTok = lastTurn ? (lastTurn.input || 0) + (lastTurn.output || 0) : 0
              const lastCost = lastTurn ? usageCost(lastTurn, keyInfo.model, costHint) : 0
              const dailyTok = (daily.input || 0) + (daily.output || 0)
              const dailyCost = usageCost(daily, keyInfo.model, costHint)
              const row = { display: 'flex', justifyContent: 'space-between', gap: 8, ...textStyle('caption') } as CSSProperties
              const val = (cost: number, tok: number) => tok > 0
                ? { text: `$${cost.toFixed(4)} · ${tok.toLocaleString()} tok`, color: cssVar.ink }
                : { text: '—', color: cssVar.dim }
              const today = val(dailyCost, dailyTok)
              const session = val(sessionCost, totalTok)
              const last = val(lastCost, lastTok)
              const balText = totalTok > 0
                ? `${(usage.input || 0).toLocaleString()} in · ${(usage.output || 0).toLocaleString()} out`
                : '—'
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${cssVar.border}`, paddingTop: 8 }}>
                  <div style={row}><span style={{ color: cssVar.mid }}>Today</span><span style={{ color: today.color, fontVariantNumeric: 'tabular-nums' }}>{today.text}</span></div>
                  <div style={row}><span style={{ color: cssVar.mid }}>Session</span><span style={{ color: session.color, fontVariantNumeric: 'tabular-nums' }}>{session.text}</span></div>
                  <div style={row}><span style={{ color: cssVar.mid }}>Last Turn</span><span style={{ color: last.color, fontVariantNumeric: 'tabular-nums' }}>{last.text}</span></div>
                  <div style={row}><span style={{ color: cssVar.mid }}>Balance</span><span style={{ color: cssVar.dim, fontVariantNumeric: 'tabular-nums' }}>{balText}</span></div>
                </div>
              )
            })()}
            {/* Optional monthly spend limit (BYOK owner-set cap). Only when the host wires
                adapter.spend; otherwise nothing renders. Saved by the sheet's Save below. */}
            {adapter.spend && <BrainSpendLimit state={spend} />}
        <button className="ds-btn" style={S.primaryBtn} onClick={async () => {
          // One Save for the whole sheet: an invalid spend-limit draft blocks it (error shown
          // inline); a changed, valid limit is persisted alongside the key/model save.
          if (adapter.spend && !spend.validate()) return
          await saveKey()
          if (adapter.spend && !(await spend.commit())) return
          setBrainOpen(false)
        }}>Save</button>
      </div>
    </div>
  )
}
