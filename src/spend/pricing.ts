// ─── AI model pricing: the single table ─────────────────────────────────────
// Dependency-free and runtime-agnostic (browser, Node, Deno). Deno edge functions import this
// directory by raw GitHub URL at a pinned commit, so keep it free of any import that isn't a
// relative `./*.ts` path.
//
// USD per million tokens, [input, output]. APPROXIMATE: provider pricing drifts, re-check
// periodically. It is only used to ESTIMATE spend against a key owner's optional monthly limit,
// so an unknown model falls back to a deliberately mid-to-high rate (overestimating spend is the
// safe direction for a limit). Replaces the two per-app copies (homlyf-tummyful
// supabase/functions/_shared/aiCost.ts, finlyf-cash-stash api/_cost.js), and covers the model ids
// the DS model lists offer (src/components/livChatModels.ts).
export const PRICING_PER_MTOK: Record<string, readonly [number, number]> = {
  // Anthropic (first-party API list prices)
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5': [1, 5],
  // OpenAI
  'gpt-5.1': [1.25, 10],
  'gpt-5': [1.25, 10],
  'gpt-4.1': [2, 8],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  // Mistral
  'mistral-large-latest': [0.5, 1.5],
  'mistral-medium-latest': [0.4, 2],
  'mistral-small-latest': [0.1, 0.3],
  // Perplexity
  'sonar-pro': [3, 15],
  'sonar': [1, 1],
  // Google
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
}

// Unknown / missing model: Sonnet-4.6-class rates. Higher than most cheap models on purpose.
export const DEFAULT_PRICING_PER_MTOK: readonly [number, number] = [3, 15]

// Longest key first, so 'gpt-5.1' wins over 'gpt-5', 'sonar-pro' over 'sonar', and
// 'claude-opus-5-5' over 'claude-opus-5' when matching by substring.
const KEYS_LONGEST_FIRST = Object.keys(PRICING_PER_MTOK).sort((a, b) => b.length - a.length)

// Exact id first; otherwise the longest table key contained in the id, which covers dated or
// prefixed variants ('claude-sonnet-4-6-20260101', 'anthropic/claude-haiku-4-5').
export function pricingFor(model: string | null | undefined): readonly [number, number] {
  if (!model) return DEFAULT_PRICING_PER_MTOK
  const id = model.trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(PRICING_PER_MTOK, id)) return PRICING_PER_MTOK[id]
  const hit = KEYS_LONGEST_FIRST.find((k) => id.includes(k))
  return hit ? PRICING_PER_MTOK[hit] : DEFAULT_PRICING_PER_MTOK
}

function tokens(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function estimateCostUsd(model: string | null | undefined, inputTokens: number, outputTokens: number): number {
  const [inRate, outRate] = pricingFor(model)
  return (tokens(inputTokens) / 1e6) * inRate + (tokens(outputTokens) / 1e6) * outRate
}
