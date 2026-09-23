// ─── Background tasks (livchat-agentic-workflows) ──────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor): the in-flight task map, the tray's
// open/cancel state, the short recent-history list, and the polling effect. LivChat calls this
// hook at the same point its polling effect used to sit, so effect order is unchanged.
import { useEffect, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { LivChatAdapter, LivMessage } from './types'

export type PendingTask = { sessionId: string; placeholderId: string; input: string; startedAt: number }
export type RecentTask = { taskId: string; sessionId: string; input: string; status: 'done' | 'error'; completedAt: number }

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
    const id = setInterval(async () => {
      for (const taskId of ids) {
        const entry = pendingTasks[taskId]
        if (!entry) continue
        const r = await adapter.chat.pollTask!(taskId)
        if (!r.ok || r.status === 'queued' || r.status === 'running') continue
        setPendingTasks((t) => { const n = { ...t }; delete n[taskId]; return n })
        setRecentTasks((rt) => [{ taskId, sessionId: entry.sessionId, input: entry.input, status: (r.status === 'done' ? 'done' : 'error') as 'done' | 'error', completedAt: Date.now() }, ...rt].slice(0, 5))
        if (activeIdRef.current !== entry.sessionId) continue // resolved for a session the user isn't looking at; drop it silently
        if (r.status === 'done') {
          const reloaded = await adapter.messages.list(entry.sessionId)
          if (activeIdRef.current === entry.sessionId && reloaded.ok) { setMessages(reloaded.value.messages); resolveUrls(reloaded.value.messages) }
        } else {
          setMessages((m) => m.map((mm) => mm.id === entry.placeholderId ? { ...mm, content: r.error || "Liv couldn't finish this in the background." } : mm))
        }
      }
    }, 3000)
    return () => clearInterval(id)
  }, [pendingTasks, adapter])
  return { pendingTasks, setPendingTasks, tasksOpen, setTasksOpen, cancellingId, recentTasks, cancelTask }
}
