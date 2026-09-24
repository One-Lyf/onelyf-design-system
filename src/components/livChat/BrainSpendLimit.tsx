// ─── Brain sheet: monthly spend limit ─────────────────────────────────────────
// The sheet has ONE Save. The limit field is rendered `embedded` (no own button); the sheet's
// Save validates it first (an invalid draft shows inline and blocks the whole Save) and calls
// adapter.spend.setLimit only when the value actually changed.
//
// State lives in useBrainSpend, called by BrainSheet (mounted on open, unmounted on close), so
// mount = "the sheet opened" → one get(). LivChat's own hook/effect order is untouched. With no
// adapter.spend the hook is inert and the section doesn't render.
import { useEffect, useRef, useState } from 'react'
import { textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import SpendLimitField, { spendLimitDraft, spendLimitSaveAction } from '../SpendLimitField'
import type { LivChatAdapter, LivSpendInfo } from './types'

type SpendPort = NonNullable<LivChatAdapter['spend']>

export function useBrainSpend(spend: SpendPort | undefined) {
  const [info, setInfo] = useState<LivSpendInfo | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Hosts may rebuild the adapter object every render; read the latest port through a ref so the
  // load runs once per open instead of once per parent render.
  const spendRef = useRef(spend)
  spendRef.current = spend

  useEffect(() => {
    if (!spendRef.current) return
    let live = true
    spendRef.current.get()
      .then((i) => { if (live) { setInfo(i); setDraft(spendLimitDraft(i.limitUsd)) } })
      .catch(() => { if (live) setLoadFailed(true) })
    return () => { live = false }
  }, [])

  const onDraftChange = (v: string) => { setDraft(v); setError(null) }

  // Before the sheet's Save does anything: false = invalid draft (error shown), block the Save.
  const validate = (): boolean => {
    if (!info) return true
    const action = spendLimitSaveAction(draft, info)
    if (action.kind === 'error') { setError(action.error); return false }
    return true
  }

  // Part of the sheet's Save: persists only a changed, valid limit. false = keep the sheet open.
  const commit = async (): Promise<boolean> => {
    const port = spendRef.current
    if (!port || !info) return true
    const action = spendLimitSaveAction(draft, info)
    if (action.kind === 'none') return true
    if (action.kind === 'error') { setError(action.error); return false }
    try {
      await port.setLimit(action.value)
      setInfo({ ...info, limitUsd: action.value })
      setDraft(spendLimitDraft(action.value))
      return true
    } catch (err) {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : '.'
      setError(`Could not save the limit${detail}`)
      return false
    }
  }

  return { info, loadFailed, draft, error, onDraftChange, validate, commit }
}
export type BrainSpend = ReturnType<typeof useBrainSpend>

export function BrainSpendLimit({ state }: { state: BrainSpend }) {
  const { info, loadFailed, draft, error, onDraftChange } = state
  const caption = textStyle('caption')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${cssVar.border}`, paddingTop: 8, minWidth: 0 }}>
      {info ? (
        <SpendLimitField embedded limitUsd={info.limitUsd} monthSpendUsd={info.monthSpendUsd} canEdit={info.canEdit}
          draft={draft} onDraftChange={onDraftChange} error={error} />
      ) : (
        <>
          <span style={{ ...caption, color: cssVar.mid }}>Monthly Spend Limit</span>
          <span role={loadFailed ? 'alert' : undefined} style={{ ...caption, color: loadFailed ? cssVar.danger : cssVar.dim }}>
            {loadFailed ? 'Could not load the spend limit.' : 'Loading…'}
          </span>
        </>
      )}
    </div>
  )
}
