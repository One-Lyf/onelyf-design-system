// ─── Proposed-action card stack ──────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { LivActionQueue } from './types'
import type { LivChatStyles } from './styles'
import type { CardStatus } from './useActionCards'

export function ActionCardStack({ S, actionQueue, cardState, applyAllBusy, applyAllCards, applyCard, dismissCard }: {
  S: LivChatStyles
  actionQueue: LivActionQueue
  cardState: Record<string, { status: CardStatus; result?: string }>
  applyAllBusy: boolean
  applyAllCards: () => void
  applyCard: (id: string) => void
  dismissCard: (id: string) => void
}) {
  const cards = actionQueue.cards.map((c) => {
    const overlay = cardState[c.id]
    return { ...c, status: overlay?.status ?? c.status ?? 'pending', result: overlay?.result ?? c.result }
  })
  const readyCount = cards.filter((c) => c.status !== 'done' && c.ready !== false).length
  const showBatch = cards.length > 1 && !!actionQueue.onApplyAll
  return (
    <div className="lc-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: space.sm }}>
      {actionQueue.introText !== '' && (
        <p style={{ ...S.muted, margin: 0 }}>
          {actionQueue.introText || ('Liv ' + (cards.length === 1 ? 'proposes this change. Nothing happens until you tap Apply:' : 'proposes these changes. Nothing happens until you tap Apply:'))}
        </p>
      )}
      {showBatch && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: `1px solid ${cssVar.border}`, borderRadius: radius.md, background: cssVar.surface }}>
          <ul style={{ ...textStyle('caption'), color: cssVar.mid, listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            {cards.map((c) => (
              <li key={c.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: c.status === 'done' ? 'line-through' : undefined }}>
                {c.summary}{c.status === 'done' ? ' — done' : ''}
              </li>
            ))}
          </ul>
          <button className="ds-btn" style={{ ...S.primaryBtn, whiteSpace: 'nowrap' }}
            disabled={!readyCount || applyAllBusy} onClick={applyAllCards}
            title={readyCount ? 'Apply every ready change above in one tap' : 'No cards are ready yet'}>
            {applyAllBusy ? 'Applying all…' : `Apply all (${readyCount})`}
          </button>
        </div>
      )}
      {cards.map((c) => {
        const done = c.status === 'done', err = c.status === 'error', applying = c.status === 'applying'
        const notReady = c.ready === false
        return (
          <div key={c.id} className="lc-card" style={{
            border: `1px solid ${cssVar.border}`, borderRadius: radius.md,
            background: cssVar.surface, padding: 10,
            opacity: done ? 0.72 : 1,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ ...textStyle('bodySm'), color: cssVar.ink }}>{c.summary}</div>
            {!done && c.renderBody && <div>{c.renderBody()}</div>}
            {!done && c.note && <p style={{ ...S.muted, margin: 0 }}>{c.note}</p>}
            {done ? (
              <p style={{ ...textStyle('caption'), color: cssVar.mid, margin: 0 }}>{c.result ? `✓ ${c.result}` : '✓ Applied'}</p>
            ) : err ? (
              <>
                <p style={{ ...textStyle('caption'), color: cssVar.danger, margin: 0 }}>{c.result || 'Could not apply.'}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ds-btn" style={S.primaryBtn} disabled={notReady} onClick={() => applyCard(c.id)}>Retry</button>
                  <button className="ds-btn" style={S.ghostBtn} onClick={() => dismissCard(c.id)}>Dismiss</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ds-btn" style={{ ...S.primaryBtn, opacity: (notReady || applying) ? 0.6 : 1 }}
                  disabled={notReady || applying} onClick={() => applyCard(c.id)}
                  title={notReady ? "Needs a detail. Tell Liv the missing part and it'll update this card" : 'Apply this change'}>
                  {applying ? 'Applying…' : 'Apply'}
                </button>
                <button className="ds-btn" style={S.ghostBtn} onClick={() => dismissCard(c.id)}>Dismiss</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
