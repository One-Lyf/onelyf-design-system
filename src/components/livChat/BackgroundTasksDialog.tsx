// ─── Background-tasks tray dialog ────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { LivChatAdapter } from './types'
import type { PendingTask, RecentTask } from './useBackgroundTasks'

export function BackgroundTasksDialog({ accent, adapter, setTasksOpen, pendingTasks, recentTasks, cancellingId, cancelTask, activeId, selectSession }: {
  accent: string
  adapter: LivChatAdapter
  setTasksOpen: (open: boolean) => void
  pendingTasks: Record<string, PendingTask>
  recentTasks: RecentTask[]
  cancellingId: string | null
  cancelTask: (taskId: string) => void
  activeId: string | null
  selectSession: (id: string) => void
}) {
  return (
    <div onClick={() => setTasksOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Background tasks" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="lc-glass"
        style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.md, boxShadow: 'var(--ds-shadow-card)', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Background Tasks</span>
          <button type="button" className="ds-btn" style={{ ...textStyle('caption'), color: cssVar.mid, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            aria-label="Close background tasks" onClick={() => setTasksOpen(false)}>Close</button>
        </div>
        {Object.keys(pendingTasks).length === 0 && recentTasks.length === 0 ? (
          <p style={{ ...textStyle('bodySm'), color: cssVar.mid, margin: 0, padding: '8px 0' }}>Nothing running in the background right now.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
            {Object.entries(pendingTasks).map(([taskId, t]) => (
              <div key={taskId} style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ ...textStyle('bodySm'), color: cssVar.ink, overflowWrap: 'anywhere' }}>{t.input.length > 96 ? `${t.input.slice(0, 96)}…` : t.input}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...textStyle('caption'), color: cssVar.mid, flex: 1 }}>Running, started {new Date(t.startedAt).toLocaleTimeString()}</span>
                  <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.ink }}
                    onClick={() => { setTasksOpen(false); if (t.sessionId !== activeId) void selectSession(t.sessionId) }}>View</button>
                  {adapter.chat.cancelTask && (
                    <button type="button" className="ds-btn" disabled={cancellingId === taskId}
                      style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: cancellingId === taskId ? 'not-allowed' : 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.mid, opacity: cancellingId === taskId ? 0.6 : 1 }}
                      onClick={() => void cancelTask(taskId)}>Stop</button>
                  )}
                </div>
              </div>
            ))}
            {recentTasks.map((t) => (
              <div key={t.taskId} style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.85 }}>
                <span style={{ ...textStyle('bodySm'), color: cssVar.ink, overflowWrap: 'anywhere' }}>{t.input.length > 96 ? `${t.input.slice(0, 96)}…` : t.input}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...textStyle('caption'), color: t.status === 'error' ? cssVar.danger : cssVar.mid, flex: 1 }}>
                    {t.status === 'done' ? 'Finished' : 'Failed'} {new Date(t.completedAt).toLocaleTimeString()}
                  </span>
                  <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.ink }}
                    onClick={() => { setTasksOpen(false); if (t.sessionId !== activeId) void selectSession(t.sessionId) }}>View</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
