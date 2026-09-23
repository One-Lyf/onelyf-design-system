// ─── Background tasks (livchat-agentic-workflows) ──────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor): the in-flight task map, the tray's
// open/cancel state, the short recent-history list, and the polling effect. LivChat calls this
// hook at the same point its polling effect used to sit, so effect order is unchanged.
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { LivChatAdapter, LivMessage, LivTaskPollResult } from './types'

export type PendingTask = { sessionId: string; placeholderId: string; input: string; startedAt: number }
export type RecentTask = { taskId: string; sessionId: string; input: string; status: 'done' | 'error'; completedAt: number }

// What one poll result means for the task. A task the backend no longer knows (HTTP 404, surfaced
// as error.code 'not_found': deleted, expired, or never existed) can never resolve, so it settles
// as an error instead of being polled forever. Any other failed poll is treated as transient and
// retried on the next tick, as before.
export function taskPollOutcome(r: LivTaskPollResult): 'pending' | 'done' | 'error' {
  if (!r.ok) return r.error?.code === 'not_found' ? 'error' : 'pending'
  if (r.status === 'queued' || r.status === 'running') return 'pending'
  return r.status === 'done' ? 'done' : 'error'
}

export function useBackgroundTasks({ adapter, activeIdRef, setMessages, setMsg, resolveUrls }: {
  adapter: LivChatAdapter
  activeIdRef: RefObject<string | null>
  setMessages: Dispatch<SetStateAction<LivMessage[]>>
  setMsg: Dispatch<SetStateAction<string>>
  resolveUrls: (msgs: LivMessage[]) => Promise<void>
}) {
  // Background tasks in flight (livchat-agentic-workflows completion surfacing), keyed by taskId.
  // Each has a locally-synthesized placeholder bubble already sitting in `messages` (inserted at
  // queue time, see send() in LivChat.tsx); this effect polls until every task resolves, then either
  // reloads the transcript (done — the real reply is already in platform.liv_message by the time
  // pollTask reports 'done') or turns the placeholder into an error line (error). Deliberately NOT
  // gated on `sending`/`stillActive` — the whole point of a background task is that it outlives
  // the turn that started it and survives a session switch (checked per-poll via activeIdRef).
  const [pendingTasks, setPendingTasks] = useState<Record<string, PendingTask>>({})
  // Task-visibility tray (replaces the composer's opt-in "Run in Background" affordance as the
  // surface for MANAGING background work): lists every in-flight task, lets the user jump to its
  // session/transcript, and — where adapter.chat.cancelTask exists — stop it.
  const [tasksOpen, setTasksOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // Short-lived local history so the tray can show a just-finished task alongside the in-flight
  // ones ("view a running/completed background task"). Capped and in-memory only — there's no
  // list-tasks backend endpoint yet, so this doesn't survive a reload; it just bridges the gap
  // between "resolved" and "the user opened the tray to look".
  const [recentTasks, setRecentTasks] = useState<Array<RecentTask>>([])
  // Task ids already settled. Shared across effect instances: the effect re-runs whenever
  // pendingTasks changes, and a sweep from the previous instance can still be awaiting pollTask,
  // so without this two sweeps could settle the same task (duplicate tray row, double reload).
  const settledRef = useRef<Set<string>>(new Set())
  async function cancelTask(taskId: string) {
    if (!adapter.chat.cancelTask) return
    setCancellingId(taskId)
    try {
      const r = await adapter.chat.cancelTask(taskId)
      if (r.ok) {
        const entry = pendingTasks[taskId]
        setPendingTasks((t) => { const n = { ...t }; delete n[taskId]; return n })
        if (entry) setMessages((m) => m.map((mm) => mm.id === entry.placeholderId ? { ...mm, content: 'Stopped.' } : mm))
      } else {
        setMsg(r.error?.message || 'Could not stop this task.')
      }
    } catch (e) {
      console.error('adapter.chat.cancelTask threw', e)
      setMsg('Could not stop this task.')
    } finally {
      setCancellingId(null)
    }
  }
  useEffect(() => {
    const ids = Object.keys(pendingTasks)
    if (!ids.length || !adapter.chat.pollTask) return
    // `busy` stops two sweeps overlapping (a slow sweep, or the catch-up sweep on return to the
    // tab), which would otherwise settle the same task twice.
    let busy = false
    let disposed = false
    const sweep = async () => {
      if (busy) return
      busy = true
      try {
        for (const taskId of ids) {
          const entry = pendingTasks[taskId]
          if (!entry || settledRef.current.has(taskId)) continue
          const r = await adapter.chat.pollTask!(taskId)
          if (disposed) return // a newer effect instance owns polling now
          const outcome = taskPollOutcome(r)
          if (outcome === 'pending' || settledRef.current.has(taskId)) continue
          settledRef.current.add(taskId)
          setPendingTasks((t) => { const n = { ...t }; delete n[taskId]; return n })
          setRecentTasks((rt) => [{ taskId, sessionId: entry.sessionId, input: entry.input, status: outcome, completedAt: Date.now() }, ...rt].slice(0, 5))
          if (activeIdRef.current !== entry.sessionId) continue // resolved for a session the user isn't looking at; drop it silently
          if (outcome === 'done') {
            const reloaded = await adapter.messages.list(entry.sessionId)
            if (activeIdRef.current === entry.sessionId && reloaded.ok) { setMessages(reloaded.value.messages); resolveUrls(reloaded.value.messages) }
          } else {
            const reason = r.ok ? r.error : null
            setMessages((m) => m.map((mm) => mm.id === entry.placeholderId ? { ...mm, content: reason || "Liv couldn't finish this in the background." } : mm))
          }
        }
      } finally {
        busy = false
      }
    }
    // Paused while the tab is hidden: nobody is looking, so a request every 3 s is pure waste.
    // Coming back polls once straight away (the task may well have finished meanwhile), then
    // resumes the interval.
    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (timer === null) timer = setInterval(sweep, 3000) }
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null } }
    const onVisibility = () => { if (isHidden()) stop(); else { void sweep(); start() } }
    if (!isHidden()) start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pendingTasks, adapter])
  return { pendingTasks, setPendingTasks, tasksOpen, setTasksOpen, cancellingId, recentTasks, cancelTask }
}
