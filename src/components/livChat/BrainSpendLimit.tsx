// ─── Brain sheet: monthly spend limit section ─────────────────────────────────
// Rendered by BrainSheet only when adapter.spend exists (no dead UI otherwise). Its own component
// so the load effect lives here, not in LivChat: LivChat's hook/effect order is untouched.
// BrainSheet mounts on open and unmounts on close, so mount = "the sheet opened" → one get().
import { useEffect, useRef, useState } from 'react'
import { textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import SpendLimitField from '../SpendLimitField'
import type { LivChatAdapter, LivSpendInfo } from './types'

export function BrainSpendLimit({ spend, accent }: {
  spend: NonNullable<LivChatAdapter['spend']>
  accent: string
}) {
  const [info, setInfo] = useState<LivSpendInfo | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // Hosts may rebuild the adapter object every render; read the latest port through a ref so the
  // load runs once per open instead of once per parent render.
  const spendRef = useRef(spend)
  spendRef.current = spend

  useEffect(() => {
    let live = true
    spendRef.current.get()
      .then((i) => { if (live) setInfo(i) })
      .catch(() => { if (live) setLoadFailed(true) })
    return () => { live = false }
  }, [])

  const onSave = async (limitUsd: number | null) => {
    await spendRef.current.setLimit(limitUsd)
    // Saved. Show it right away, then refresh the month total (a failed refresh keeps the
    // optimistic value rather than reporting a save that succeeded as an error).
    setInfo((prev) => (prev ? { ...prev, limitUsd } : prev))
    try { setInfo(await spendRef.current.get()) } catch { /* keep the optimistic value */ }
  }

  const caption = textStyle('caption')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${cssVar.border}`, paddingTop: 8, minWidth: 0 }}>
      {info ? (
        <SpendLimitField limitUsd={info.limitUsd} monthSpendUsd={info.monthSpendUsd} canEdit={info.canEdit}
          onSave={onSave} accent={accent} />
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
