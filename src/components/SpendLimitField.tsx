// ─── SpendLimitField ────────────────────────────────────────────────────────
// The shared "Monthly Spend Limit" control for a bring-your-own-key AI setup. There is no
// platform key and no platform cap: the key's OWNER may set an optional monthly USD limit
// (blank = no limit, the default) that also bounds household members sharing the key. A user
// on someone else's shared key sees it read-only (`canEdit` false).
//
// Two modes:
// - Standalone (default, for an app's Settings page): owns its draft and renders its own
//   "Save Limit" button; persists via `onSave`.
// - `embedded` (inside a surface that already has ONE Save, e.g. LivChat's Brain sheet): no
//   button; the host controls the draft (`draft` / `onDraftChange`), shows `error`, and persists
//   on its own Save (see spendLimitSaveAction).
// Validation and formatting come from src/spend so the UI and the server enforce the same rule.
import { useEffect, useId, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { radius, textStyle } from '../tokens'
import { cssVar } from '../theme'
import { formatUsd, parseSpendLimitInput } from '../spend/index.ts'

interface SpendLimitFieldBase {
  /** Current (saved) limit in USD; null = no limit. */
  limitUsd: number | null
  /** This month's estimated spend on the key, USD. */
  monthSpendUsd: number
  /** False when the user is on someone else's shared key: read-only. */
  canEdit: boolean
  /** Button/focus accent; defaults to the brand primary. */
  accent?: string
  style?: CSSProperties
}
export interface SpendLimitFieldStandaloneProps extends SpendLimitFieldBase {
  embedded?: false
  /** Persist the new limit (null clears it). Reject to show an error. */
  onSave(limitUsd: number | null): Promise<void>
  /** Disable Save Limit from outside (e.g. while the host is busy). */
  busy?: boolean
}
export interface SpendLimitFieldEmbeddedProps extends SpendLimitFieldBase {
  /** No own Save button; the host's Save persists (see spendLimitSaveAction). */
  embedded: true
  draft: string
  onDraftChange(draft: string): void
  /** Inline error (validation or a failed save), shown under the field. */
  error?: string | null
}
export type SpendLimitFieldProps = SpendLimitFieldStandaloneProps | SpendLimitFieldEmbeddedProps

// "This Month So Far: $X.XX (estimated)" + " of $Y.YY" when a limit is set.
export function spendMonthLine(monthSpendUsd: number, limitUsd: number | null): string {
  const base = `This Month So Far: ${formatUsd(monthSpendUsd)} (estimated)`
  return limitUsd != null ? `${base} of ${formatUsd(limitUsd)}` : base
}

// The input's text for a stored limit: blank when there is none.
export function spendLimitDraft(limitUsd: number | null): string {
  return limitUsd != null ? limitUsd.toFixed(2) : ''
}

// What a host's single Save should do with an embedded field's draft:
//   'none'  → nothing changed (value-equal: '25' vs a saved 25.00 is unchanged), or read-only
//   'error' → invalid input; show it inline and block the Save
//   'save'  → call setLimit(value) (null clears the limit)
export type SpendLimitSaveAction =
  | { kind: 'none' }
  | { kind: 'error'; error: string }
  | { kind: 'save'; value: number | null }
export function spendLimitSaveAction(draft: string, saved: { limitUsd: number | null; canEdit: boolean }): SpendLimitSaveAction {
  if (!saved.canEdit) return { kind: 'none' }
  const parsed = parseSpendLimitInput(draft)
  if (!parsed.ok) return { kind: 'error', error: parsed.error }
  return parsed.value === saved.limitUsd ? { kind: 'none' } : { kind: 'save', value: parsed.value }
}

export default function SpendLimitField(props: SpendLimitFieldProps) {
  const { limitUsd, monthSpendUsd, canEdit, accent = cssVar.primary, style } = props
  const id = useId()
  const [ownDraft, setOwnDraft] = useState(() => spendLimitDraft(limitUsd))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  // Standalone: a new saved/loaded limit from the host replaces the draft.
  useEffect(() => { setOwnDraft(spendLimitDraft(limitUsd)) }, [limitUsd])

  const draft = props.embedded ? props.draft : ownDraft
  const error = props.embedded ? (props.error ?? null) : (msg?.tone === 'error' ? msg.text : null)
  const okText = !props.embedded && msg?.tone === 'ok' ? msg.text : null

  const onChange = (v: string) => {
    if (props.embedded) { props.onDraftChange(v); return }
    setOwnDraft(v)
    if (msg) setMsg(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (props.embedded) return
    const parsed = parseSpendLimitInput(ownDraft)
    if (!parsed.ok) { setMsg({ tone: 'error', text: parsed.error }); return }
    setSaving(true)
    setMsg(null)
    try {
      await props.onSave(parsed.value)
      setOwnDraft(spendLimitDraft(parsed.value))
      setMsg({ tone: 'ok', text: parsed.value === null ? 'No monthly limit on this key.' : `Monthly limit set to ${formatUsd(parsed.value)}.` })
    } catch (err) {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : '.'
      setMsg({ tone: 'error', text: `Could not save the limit${detail}` })
    } finally {
      setSaving(false)
    }
  }

  const caption = textStyle('caption')
  const monthLine = (
    <span style={{ ...caption, color: cssVar.mid, fontVariantNumeric: 'tabular-nums' }}>
      {spendMonthLine(monthSpendUsd, limitUsd)}
    </span>
  )

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
        <span style={{ ...caption, color: cssVar.mid, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Monthly Spend Limit</span>
          <span style={{ color: cssVar.ink, fontVariantNumeric: 'tabular-nums' }}>{limitUsd != null ? formatUsd(limitUsd) : 'No Limit'}</span>
        </span>
        {monthLine}
        <span style={{ ...caption, color: cssVar.dim }}>Your household organizer manages the spend limit for this key.</span>
      </div>
    )
  }

  const disabled = saving || (!props.embedded && !!props.busy)
  const input = (
    <input id={id} className="ds-input" type="text" inputMode="decimal" autoComplete="off"
      placeholder="No Limit" aria-describedby={`${id}-help`} aria-invalid={error ? true : undefined}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...textStyle('body'), flex: '1 1 auto', width: '100%', minWidth: 0, boxSizing: 'border-box',
        color: cssVar.ink, background: cssVar.bg, borderRadius: radius.md, padding: '9px 12px',
        border: `1px solid ${error ? cssVar.danger : cssVar.border}`,
      }} />
  )
  const body = (
    <>
      <label htmlFor={id} style={{ ...caption, color: cssVar.mid }}>Monthly Spend Limit</label>
      {props.embedded ? input : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', minWidth: 0 }}>
          {input}
          <button type="submit" className="ds-btn" disabled={disabled}
            style={{
              ...textStyle('label'), flex: '0 0 auto', whiteSpace: 'nowrap', borderRadius: radius.md,
              padding: '9px 12px', border: `1px solid ${accent}`, background: cssVar.surface, color: accent,
              cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
            }}>{saving ? 'Saving…' : 'Save Limit'}</button>
        </div>
      )}
      <span id={`${id}-help`} style={{ ...caption, color: cssVar.dim }}>
        Optional. Blank = no limit. Applies to everyone using this key.
      </span>
      {monthLine}
      {error && <span role="alert" style={{ ...caption, color: cssVar.danger }}>{error}</span>}
      {okText && <span role="status" style={{ ...caption, color: cssVar.primary }}>{okText}</span>}
    </>
  )
  const boxStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, margin: 0, ...style }
  return props.embedded
    ? <div style={boxStyle}>{body}</div>
    : <form onSubmit={submit} noValidate style={boxStyle}>{body}</form>
}
