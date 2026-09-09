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

// Seeded default when nothing is persisted and the list has no entry to fall back
// on. Jeff's standing preference is Opus 4.6; once the user picks a model it
// persists per-device (adapter.key) and this no longer applies.
export const DEFAULT_MODEL_ID = 'claude-opus-4-6'

// Offline / no-backend fallback — used only when a host neither passes
// `hat.models` nor wires `adapter.key.listModels` (or that call fails). Real ids
// by name, seeded default first, Fable/Mythos omitted. Deliberately NOT an
// exhaustive catalog: the whole point of live discovery is that newer models
// (e.g. Opus 5) show up without anyone editing this array.
export const DEFAULT_MODELS: LivModel[] = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6 · preferred default' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 · most capable' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7 · highly capable' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 · balanced' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · balanced' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 · fastest' },
]

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
