// ─── Brain settings: provider / model / key / effort / mode / verbosity ─────────
// Moved out of LivChat.tsx (W3 legibility refactor). State + the model-list memo + the key
// load/save calls; no effects (LivChat's loadKey / listModels effects stay in LivChat.tsx at
// their original positions and call into this).
import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { curateLivModels, ANTHROPIC_FALLBACK_MODELS, ANTHROPIC_FALLBACK_MODEL_ID, PROVIDER_FALLBACK_MODELS, modelsForProvider } from '../livChatModels'
import type { LivModel } from '../livChatModels'
import { DEFAULT_EFFORT, DEFAULT_MODE, isEffort, isMode, DEFAULT_VERBOSITY, isVerbosity } from '../livChatModes'
import type { LivEffort, LivMode, LivVerbosity } from '../livChatModes'
import type { LivChatAdapter, LivHat, LivKeyInfo } from './types'

export function useBrainSettings({ hat, adapter, setMsg }: {
  hat: LivHat
  adapter: LivChatAdapter
  setMsg: Dispatch<SetStateAction<string>>
}) {
  const [providerInput, setProviderInput] = useState('anthropic')
  // The live list remembers which provider it was fetched for, so a provider switch can never
  // show (or let someone pick) the previous provider's models.
  const [live, setLive] = useState<{ provider: string; models: LivModel[] } | null>(null)
  const liveModels = live && live.provider === providerInput ? live.models : null
  const setLiveModels = useCallback((next: LivModel[] | null, forProvider?: string) => {
    setLive(next ? { provider: forProvider ?? providerInput, models: next } : null)
  }, [providerInput])
  // First non-empty of: the live list, the hat's list, the provider's fallback. Each is filtered to
  // the active provider first, so a host's static list for one provider (e.g. Claude ids) never
  // shows up as the choices on another provider's key.
  const models = useMemo(() => {
    for (const list of [liveModels, hat.models, PROVIDER_FALLBACK_MODELS[providerInput]]) {
      const own = curateLivModels(modelsForProvider(providerInput, list))
      if (own.length) return own
    }
    return curateLivModels(modelsForProvider(providerInput, ANTHROPIC_FALLBACK_MODELS))
  }, [liveModels, hat.models, providerInput])
  // Resolves a model id's host-supplied cost hint (LivModel.costPerToken) for usageCost below —
  // see the tierFor/usageCost comment for why this matters for non-Anthropic models.
  const costHintFor = (id?: string | null) => models.find((m) => m.id === id)?.costPerToken

  const [keyInfo, setKeyInfo] = useState<LivKeyInfo>({ hasKey: false, model: null })
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState(models[0]?.id ?? ANTHROPIC_FALLBACK_MODEL_ID)
  // Opt-in Brain-menu controls. Local mirror of the persisted value (loaded via key.get); a
  // change writes through key.set immediately, like the model picker.
  const showEffort = hat.enableEffort === true && !!adapter.key
  const showMode = hat.enableMode === true && !!adapter.key
  const showVerbosity = hat.enableVerbosity === true && !!adapter.key
  const showCompact = !!adapter.chat.compact
  const [effortInput, setEffortInput] = useState<LivEffort>(DEFAULT_EFFORT)
  const [modeInput, setModeInput] = useState<LivMode>(DEFAULT_MODE)
  const [verbosityInput, setVerbosityInput] = useState<LivVerbosity>(DEFAULT_VERBOSITY)
  const [autoCompact, setAutoCompact] = useState(false)
  const [compacting, setCompacting] = useState(false)

  async function loadKey() {
    if (!adapter.key) return
    try {
      const r = await adapter.key.get()
      if (r.ok) {
        setKeyInfo(r.value)
        if (r.value.provider) setProviderInput(r.value.provider)
        if (r.value.model) setModelInput(r.value.model)
        if (isEffort(r.value.effort)) setEffortInput(r.value.effort)
        if (isMode(r.value.mode)) setModeInput(r.value.mode)
        if (isVerbosity(r.value.verbosity)) setVerbosityInput(r.value.verbosity)
        if (typeof r.value.autoCompact === 'boolean') setAutoCompact(r.value.autoCompact)
        if (r.value.provider) setLiveModels(null)
      }
    } catch (e) { console.error('key.get failed', e) }
  }

  async function saveKey() {
    if (!adapter.key) return
    const patch: { apiKey?: string; model?: string; provider?: string } = {}
    if (keyInput.trim()) patch.apiKey = keyInput.trim()
    if (modelInput) patch.model = modelInput
    if (providerInput) patch.provider = providerInput
    if (!patch.apiKey && !patch.model && !patch.provider) return
    const r = await adapter.key.set(patch)
    if (r.ok) { setKeyInfo({ ...r.value, provider: providerInput }); setKeyInput(''); setMsg('Saved. Liv can reply now.') }
    else setMsg(r.error?.message || 'Could not save key.')
  }

  return {
    liveModels, setLiveModels, providerInput, setProviderInput, models, costHintFor,
    keyInfo, setKeyInfo, keyInput, setKeyInput, modelInput, setModelInput,
    showEffort, showMode, showVerbosity, showCompact,
    effortInput, setEffortInput, modeInput, setModeInput, verbosityInput, setVerbosityInput,
    autoCompact, setAutoCompact, compacting, setCompacting,
    loadKey, saveKey,
  }
}
export type BrainSettings = ReturnType<typeof useBrainSettings>
