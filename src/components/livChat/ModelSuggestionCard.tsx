// ─── Model-switch suggestion card ────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render (W3 legibility refactor): same DOM, classes,
// styles and copy; the parent passes the state/handlers the JSX used to close over.
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import type { Dispatch, SetStateAction } from 'react'
import { PROVIDER_LABELS } from '../livChatModels'
import type { LivModel } from '../livChatModels'
import type { LivChatAdapter, LivKeyInfo, LivModelSuggestion } from './types'

export function ModelSuggestionCard({ accent, adapter, pendingSuggestion, setPendingSuggestion, setProviderInput, setModelInput,
  setKeyInfo, setLiveModels, setMsg }: {
  accent: string
  adapter: LivChatAdapter
  pendingSuggestion: LivModelSuggestion
  setPendingSuggestion: Dispatch<SetStateAction<LivModelSuggestion | null>>
  setProviderInput: Dispatch<SetStateAction<string>>
  setModelInput: Dispatch<SetStateAction<string>>
  setKeyInfo: Dispatch<SetStateAction<LivKeyInfo>>
  setLiveModels: Dispatch<SetStateAction<LivModel[] | null>>
  setMsg: Dispatch<SetStateAction<string>>
}) {
  return (
    <div style={{ background: cssVar.track, border: `1px solid ${accent}`, borderRadius: radius.md, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
      <div style={{ ...textStyle('caption'), color: accent, fontWeight: 700 }}>Model suggestion</div>
      <p style={{ ...textStyle('caption'), color: cssVar.mid, margin: 0 }}>{pendingSuggestion.reason}</p>
      <div style={{ ...textStyle('caption'), color: cssVar.ink, fontWeight: 600 }}>
        {PROVIDER_LABELS[pendingSuggestion.provider] ?? pendingSuggestion.provider} · {pendingSuggestion.model}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 12px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${accent}`, background: accent, color: cssVar.surface }}
          onClick={async () => {
            const s = pendingSuggestion!
            const r = await adapter.key!.set({ provider: s.provider, model: s.model })
            if (r.ok) {
              setProviderInput(s.provider)
              setModelInput(s.model)
              setKeyInfo((k) => ({ ...k, provider: s.provider, model: s.model }))
              setLiveModels(null)
              setMsg(`Switched to ${PROVIDER_LABELS[s.provider] ?? s.provider} ${s.model}.`)
            }
            setPendingSuggestion(null)
          }}>Switch</button>
        <button className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 12px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: 'transparent', color: cssVar.mid }}
          onClick={() => setPendingSuggestion(null)}>Dismiss</button>
      </div>
    </div>
  )
}
