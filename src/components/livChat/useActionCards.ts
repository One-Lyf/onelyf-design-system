// ─── Action-card lifecycle (proposed-change cards) ─────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). State + apply/dismiss/apply-all handlers;
// no effects.
import { useState } from 'react'
import type { LivActionQueue } from './types'

export type CardStatus = 'pending' | 'applying' | 'done' | 'error'

export function useActionCards(actionQueue: LivActionQueue | undefined) {
  // Per-card lifecycle state layered over `actionQueue.cards` — DS owns the pending/applying/
  // done/error transitions so the app doesn't have to plumb them into its own state. Keyed by
  // card id; entries stay until the card is removed from the incoming queue.
  const [cardState, setCardState] = useState<Record<string, { status: CardStatus; result?: string }>>({})
  const [applyAllBusy, setApplyAllBusy] = useState(false)

  // Action-card apply/dismiss handlers. DS owns the visual state transition; the app's
  // onApply/onDismiss handlers own the mutation. On success the card flips to "done" with
  // the returned result; on failure it flips to "error" so a Retry button appears.
  async function applyCard(id: string) {
    if (!actionQueue) return
    setCardState((s) => ({ ...s, [id]: { status: 'applying' } }))
    try {
      const r = await actionQueue.onApply(id)
      if (r.ok) setCardState((s) => ({ ...s, [id]: { status: 'done', result: r.result } }))
      else setCardState((s) => ({ ...s, [id]: { status: 'error', result: r.error || 'Could not apply.' } }))
    } catch (e) {
      console.error('actionQueue.onApply threw', e)
      setCardState((s) => ({ ...s, [id]: { status: 'error', result: (e as Error)?.message || 'Could not apply.' } }))
    }
  }
  function dismissCard(id: string) {
    if (!actionQueue) return
    // Optimistic: drop the local state; the app removes the card from its own list.
    setCardState((s) => { const { [id]: _drop, ...rest } = s; return rest })
    try { actionQueue.onDismiss(id) } catch (e) { console.error('actionQueue.onDismiss threw', e) }
  }
  async function applyAllCards() {
    if (!actionQueue?.onApplyAll) return
    setApplyAllBusy(true)
    try { await actionQueue.onApplyAll() }
    catch (e) { console.error('actionQueue.onApplyAll threw', e) }
    finally { setApplyAllBusy(false) }
  }
  return { cardState, applyAllBusy, applyCard, dismissCard, applyAllCards }
}
