// ─── LivChat model-picker helpers ───────────────────────────────────────────
// Pure helpers for the Brain-menu model list. Kept out of the component so they
// are unit-testable and shared by every consumer (Console/Commis/Advisor/…).
//
// The picker names REAL provider models — it's a selector, not branding (Jeff,
// 2026-09-02). New provider releases should appear on their own: a host wires
// `adapter.key.listModels()` to its own backend, which calls the provider's
// `GET /v1/models` (server-side, where the user's key lives) and returns real
// ids + display names. `curateLivModels()` is the shared policy layer applied to
// BOTH that live list and the static fallback below, so the rules hold suite-wide
// no matter which path a given app is on yet.

export interface LivModel {
  id: string
  label: string
  // Optional cost hint (dollars per token, list price) for LivChat's token/cost meter. LivChat's
  // internal estimator otherwise resolves a tier by matching the id against Anthropic's public
  // model-family names (opus/sonnet/haiku) — accurate for Claude ids, but a live-discovered
  // non-Anthropic model (adapter.key.listModels can return any provider's catalogue, e.g. a
  // GPT/Gemini id) has none of those substrings and would silently fall back to Sonnet's price,
  // which is wrong, not just imprecise. A host that knows a model's real per-token cost can set
  // this to get an accurate estimate instead.
  costPerToken?: { input: number; output: number }
}

// Suite-wide policy: keep Fable / Mythos class models out of the picker for now
// (Jeff, 2026-09-03). Match id OR label so it holds whether a backend sends
// "claude-fable-5-1" or a display name like "Fable 5.1".
export const DEFAULT_MODEL_EXCLUDE = /fable|mythos/i

// NOT a suite-wide default — Anthropic-specific, used only as the last resort when a host
// wires neither `hat.models` nor `adapter.key.listModels` (live discovery for whatever
// provider the user's actual key targets). The picker names REAL provider models and is a
// selector, not branding (Jeff, 2026-09-02) — a static catalog can only ever list ONE
// provider's real ids without fabricating another vendor's, so Anthropic's own ids are the
// only ones this DS can respond for by default without a host wiring its own discovery.
// Constraint (a) — no single provider hardcoded as THE default — is enforced by NOT
// presenting any one of these as "preferred"/primary in its label (see below); it is a
// fallback of last resort, not a suite-wide bias. Any host targeting a different provider
// MUST wire live discovery to get an unbiased picker.
export const ANTHROPIC_FALLBACK_MODEL_ID = 'claude-opus-4-6'

// Deliberately NOT an exhaustive catalog: the whole point of live discovery is that newer
// models (e.g. Opus 5) show up without anyone editing this array. No entry is labeled
// "default"/"preferred" — that framing is exactly what constraint (a) forbids; the array
// order still puts a reasonable general-purpose model first only so an EMPTY `hat.models`
// with no live discovery doesn't land on the cheapest/fastest tier by accident.
export const ANTHROPIC_FALLBACK_MODELS: LivModel[] = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 · most capable' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7 · highly capable' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 · balanced' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · balanced' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 · fastest' },
]

// BYOK Provider picker labels = the real VENDOR whose key the user pastes (Jeff's 2026-09-10
// ruling), never an assistant/model-family brand: "Anthropic" not "Claude", "OpenAI" not "GPT",
// "Google" not "Gemini". Model names (Opus, GPT-5, Gemini 2.5 Pro…) belong in the Model picker.
export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  openai: 'OpenAI',
  perplexity: 'Perplexity',
  gemini: 'Google',
}

// Display label for a provider id. Ids without a vendor entry (e.g. a host's `custom`
// endpoint) render Title Case rather than as the raw lowercase id.
export const providerLabel = (id: string): string =>
  PROVIDER_LABELS[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : id)

export const PROVIDER_FALLBACK_MODELS: Record<string, LivModel[]> = {
  anthropic: ANTHROPIC_FALLBACK_MODELS,
  mistral: [
    { id: 'mistral-large-latest', label: 'Large' },
    { id: 'mistral-medium-latest', label: 'Medium' },
    { id: 'mistral-small-latest', label: 'Small' },
  ],
  openai: [
    { id: 'gpt-5.1', label: 'GPT-5.1' },
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  perplexity: [
    { id: 'sonar', label: 'Sonar' },
    { id: 'sonar-pro', label: 'Sonar Pro' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
}

export interface CurateOptions {
  // Override the excluded class. Defaults to Fable/Mythos.
  exclude?: RegExp
}

// Normalize a raw model list (live from a provider, or a host's `hat.models`)
// into the picker's display list:
//   • drop the excluded class (Fable/Mythos by default),
//   • drop entries with no usable id,
//   • strip a leading vendor-persona word so the chrome stays neutral
//     ("Claude Opus 4.6" → "Opus 4.6"; "GPT-5" is the model name, kept as-is),
//   • dedupe by id (first wins).
// Input order is preserved — ordering is the caller's/​backend's decision.
export function curateLivModels(
  models: LivModel[] | null | undefined,
  opts: CurateOptions = {},
): LivModel[] {
  const exclude = opts.exclude ?? DEFAULT_MODEL_EXCLUDE
  const seen = new Set<string>()
  const out: LivModel[] = []
  for (const m of models ?? []) {
    if (!m || typeof m.id !== 'string') continue
    const id = m.id.trim()
    if (!id) continue
    const rawLabel = typeof m.label === 'string' ? m.label.trim() : ''
    if (exclude.test(id) || (rawLabel && exclude.test(rawLabel))) continue
    if (seen.has(id)) continue
    seen.add(id)
    const label = (rawLabel || id).replace(/^Claude\s+/i, '').trim()
    // Only set the key when actually present — an explicit `costPerToken: undefined` would
    // still differ from a plain `{id, label}` object under deepStrictEqual (distinct own keys).
    out.push(m.costPerToken ? { id, label, costPerToken: m.costPerToken } : { id, label })
  }
  return out
}

// ─── Provider ownership ─────────────────────────────────────────────────────
// Model-id families that clearly belong to one provider. Used only to keep another provider's
// models out of the picker (a Claude list offered on a Mistral key is how a provider/model
// mismatch got saved, Tummyful audit 2026-09-24). An id matching no family is not judged, and a
// provider outside this map (a host's `custom` endpoint, which can serve anything) filters nothing.
const MODEL_FAMILIES: [string, RegExp][] = [
  ['anthropic', /^claude-/i],
  ['openai', /^(gpt-|chatgpt-|o[1-9](-|$))/i],
  ['mistral', /^(mistral-|open-mistral|magistral-|codestral-|pixtral-|ministral-|devstral-|voxtral-)/i],
  ['gemini', /^(models\/)?gemini-/i],
  ['perplexity', /^sonar/i],
]

// False only when `id` is recognizably another known provider's model.
export function modelBelongsTo(provider: string, id: string | null | undefined): boolean {
  if (!id || !MODEL_FAMILIES.some(([p]) => p === provider)) return true
  const owner = MODEL_FAMILIES.find(([, re]) => re.test(id.trim()))?.[0]
  return !owner || owner === provider
}

// `models` without the entries that are clearly another provider's.
export function modelsForProvider(provider: string, models: LivModel[] | null | undefined): LivModel[] {
  return (models ?? []).filter((m) => modelBelongsTo(provider, m?.id))
}

// The Brain picker's options and selected value. The SAVED model (what the key actually runs) is
// always shown: when the list doesn't have it (an empty list, a model the list doesn't offer) it's
// added as its raw id instead of the select silently showing the first option as if it were
// saved. With nothing saved, the selection is the draft if it's listed, else the first option.
// `show`: there is a choice to make, or a saved model to show (even as the only option).
export function modelPickerState(models: LivModel[], saved: string | null | undefined, draft?: string | null):
  { options: LivModel[]; value: string; savedMissing: boolean; show: boolean } {
  // A saved excluded-class id (Fable/Mythos) is treated as unset: never offered, never selected.
  const raw = saved?.trim() || ''
  const savedId = raw && !DEFAULT_MODEL_EXCLUDE.test(raw) ? raw : ''
  const savedMissing = !!savedId && !models.some((m) => m.id === savedId)
  const options = savedMissing ? [{ id: savedId, label: savedId }, ...models] : models
  const value = savedId || (draft && models.some((m) => m.id === draft) ? draft : models[0]?.id ?? '')
  return { options, value, savedMissing, show: options.length > 1 || !!savedId }
}
