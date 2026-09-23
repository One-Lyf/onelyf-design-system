// ─── Token/cost meter state ────────────────────────────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). State only, no effects — the session
// total, the most-recent turn, and the localStorage-backed daily total that feed the header
// meter and the Brain sheet's usage rows.
import { useState } from 'react'
import type { LivUsage } from './types'

export function useUsageMeter(hatName: string) {
  // Running token/cost total for this console (spans sessions), reset by tapping
  // the meter. Cost is derived at render time from the current model's tier.
  const [usage, setUsage] = useState<LivUsage>({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 })
  // Most-recent turn's usage. Cleared on meter reset (tap the token cost pill).
  const [lastTurn, setLastTurn] = useState<LivUsage | null>(null)
  // Daily meter — localStorage-backed, rolls over at LOCAL midnight (a saved key from
  // yesterday is dropped, today starts at zero). Matches Cash Stash's canon (see
  // src/App.jsx's advisorDailyMeter). Scoped by hat.name so Commis / Advisor / Liv Console
  // each track their own daily spend. Failures are silent (private-browsing/quota) — worst
  // case the row shows this-session-only totals.
  const localDateKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dailyStorageKey = `ds-liv-daily.${hatName || 'liv'}.${localDateKey()}`
  const readDaily = (): LivUsage => {
    const zero: LivUsage = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }
    if (typeof window === 'undefined' || !window.localStorage) return zero
    try {
      const raw = window.localStorage.getItem(dailyStorageKey)
      if (!raw) return zero
      const p = JSON.parse(raw)
      return { input: p.input | 0, output: p.output | 0, cacheCreate: p.cacheCreate | 0, cacheRead: p.cacheRead | 0 }
    } catch { return zero }
  }
  const [daily, setDaily] = useState<LivUsage>(() => readDaily())
  function addUsage(u: LivUsage) {
    setUsage((p) => ({
      input: (p.input || 0) + (u.input || 0),
      output: (p.output || 0) + (u.output || 0),
      cacheCreate: (p.cacheCreate || 0) + (u.cacheCreate || 0),
      cacheRead: (p.cacheRead || 0) + (u.cacheRead || 0),
    }))
    setLastTurn(u)
    // Rollover-safe: base every daily update on the CURRENT day's storage value (which
    // returns zero if today's key doesn't exist yet — either fresh install, or the day
    // just rolled over past local midnight), NOT on the in-memory `daily` accumulator
    // (which would carry yesterday's cumulative total into today's key on a long-lived
    // tab open across midnight).
    setDaily(() => {
      const today = readDaily()
      const next: LivUsage = {
        input: (today.input || 0) + (u.input || 0),
        output: (today.output || 0) + (u.output || 0),
        cacheCreate: (today.cacheCreate || 0) + (u.cacheCreate || 0),
        cacheRead: (today.cacheRead || 0) + (u.cacheRead || 0),
      }
      try { window.localStorage.setItem(dailyStorageKey, JSON.stringify(next)) } catch { /* quota/private */ }
      return next
    })
  }
  return { usage, setUsage, lastTurn, setLastTurn, daily, addUsage }
}
