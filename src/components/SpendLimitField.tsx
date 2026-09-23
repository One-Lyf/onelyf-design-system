// ─── SpendLimitField ────────────────────────────────────────────────────────
// The shared "Monthly Spend Limit" control for a bring-your-own-key AI setup. There is no
// platform key and no platform cap: the key's OWNER may set an optional monthly USD limit
// (blank = no limit, the default) that also bounds household members sharing the key. A user
// on someone else's shared key sees it read-only (`canEdit` false).
//
// Presentational + validation only; the host persists via `onSave` (LivChat wires it to
// adapter.spend.setLimit in the Brain sheet). Validation and formatting come from src/spend so
// the UI and the server enforce the same rule.
import { useEffect, useId, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { radius, textStyle } from '../tokens'
import { cssVar } from '../theme'
import { formatUsd, parseSpendLimitInput } from '../spend/index.ts'

export interface SpendLimitFieldProps {
  /** Current limit in USD; null = no limit. */
  limitUsd: number | null
  /** This month's estimated spend on the key, USD. */
  monthSpendUsd: number
  /** False when the user is on someone else's shared key: read-only. */
  canEdit: boolean
  /** Persist the new limit (null clears it). Reject to show an error. */
  onSave(limitUsd: number | null): Promise<void>
  /** Disable Save Limit from outside (e.g. while the host is busy). */
  busy?: boolean
  /** Button/focus accent; defaults to the brand primary. */
  accent?: string
  style?: CSSProperties
}

// "This Month So Far: $X.XX (estimated)" + " of $Y.YY" when a limit is set.
export function spendMonthLine(monthSpendUsd: number, limitUsd: number | null): string {
  const base = `This Month So Far: ${formatUsd(monthSpendUsd)} (estimated)`
  return limitUsd != null ? `${base} of ${formatUsd(limitUsd)}` : base
}

// The input's text for a stored limit: blank when there is none.
export function spendLimitDraft(limitUsd: number | null): string {
  return limitUsd != null ? limitUsd.toFixed(2) : ''
}

export default function SpendLimitField({
  limitUsd, monthSpendUsd, canEdit, onSave, busy, accent = cssVar.primary, style,
}: SpendLimitFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(() => spendLimitDraft(limitUsd))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  // A new saved/loaded limit from the host replaces the draft.
  useEffect(() => { setDraft(spendLimitDraft(limitUsd)) }, [limitUsd])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseSpendLimitInput(draft)
    if (!parsed.ok) { setMsg({ tone: 'error', text: parsed.error }); return }
    setSaving(true)
    setMsg(null)
    try {
      await onSave(parsed.value)
      setDraft(spendLimitDraft(parsed.value))
      setMsg({ tone: 'ok', text: parsed.value === null ? 'No monthly limit on this key.' : `Monthly limit set to ${formatUsd(parsed.value)}.` })
    } catch (err) {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : '.'
      setMsg({ tone: 'error', text: `Could not save the limit${detail}` })
    } finally {
      setSaving(false)
    }
  }

  const caption = textStyle('caption')
  const disabled = saving || !!busy
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

  return (
    <form onSubmit={submit} noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, margin: 0, ...style }}>
      <label htmlFor={id} style={{ ...caption, color: cssVar.mid }}>Monthly Spend Limit</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', minWidth: 0 }}>
        <input id={id} className="ds-input" type="text" inputMode="decimal" autoComplete="off"
          placeholder="No Limit" aria-describedby={`${id}-help`}
          aria-invalid={msg?.tone === 'error' || undefined}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (msg) setMsg(null) }}
          style={{
            ...textStyle('body'), flex: '1 1 auto', minWidth: 0, boxSizing: 'border-box',
            color: cssVar.ink, background: cssVar.bg, borderRadius: radius.md, padding: '9px 12px',
            border: `1px solid ${msg?.tone === 'error' ? cssVar.danger : cssVar.border}`,
          }} />
        <button type="submit" className="ds-btn" disabled={disabled}
          style={{
            ...textStyle('label'), flex: '0 0 auto', whiteSpace: 'nowrap', borderRadius: radius.md,
            padding: '9px 12px', border: `1px solid ${accent}`, background: cssVar.surface, color: accent,
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
          }}>{saving ? 'Saving…' : 'Save Limit'}</button>
      </div>
      <span id={`${id}-help`} style={{ ...caption, color: cssVar.dim }}>
        Optional. Blank = no limit. Applies to everyone using this key.
      </span>
      {monthLine}
      {msg && (
        <span role={msg.tone === 'error' ? 'alert' : 'status'}
          style={{ ...caption, color: msg.tone === 'error' ? cssVar.danger : cssVar.primary }}>
          {msg.text}
        </span>
      )}
    </form>
  )
}
