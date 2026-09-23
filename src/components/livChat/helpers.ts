// ─── LivChat pure helpers ──────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx (W3 legibility refactor).
import type { LivAttachment, LivMessage, LivUsage } from './types'

// Approximate Anthropic list prices, dollars PER TOKEN (list $/1M ÷ 1e6), keyed
// by model family. Cache-write = 1.25× input and cache-read = 0.1× input are the
// standard 5-minute-cache multipliers, so they're derived rather than stored.
// Matched by family substring so a dated snapshot id (…-20251001) still resolves;
// unknown models fall back to the Sonnet tier. Unlike Cash Stash's single flat
// rate, this prices Haiku/Opus turns correctly — the meter is an estimate, not a bill.
// A `hint` (LivModel.costPerToken, resolved by the caller from the current model list) wins
// when present — the escape hatch for a live-discovered non-Anthropic model, which has none of
// the opus/sonnet/haiku substrings below and would otherwise silently borrow Sonnet's price.
type Tier = { input: number; output: number }
const PRICE_PER_TOKEN: Record<string, Tier> = {
  opus: { input: 15 / 1e6, output: 75 / 1e6 },
  sonnet: { input: 3 / 1e6, output: 15 / 1e6 },
  haiku: { input: 1 / 1e6, output: 5 / 1e6 },
}
function tierFor(model?: string | null, hint?: Tier): Tier {
  if (hint) return hint
  const id = (model || '').toLowerCase()
  if (id.includes('opus')) return PRICE_PER_TOKEN.opus
  if (id.includes('haiku')) return PRICE_PER_TOKEN.haiku
  return PRICE_PER_TOKEN.sonnet
}
export function usageCost(u: LivUsage, model?: string | null, hint?: Tier): number {
  const t = tierFor(model, hint)
  return (u.input || 0) * t.input
    + (u.output || 0) * t.output
    + (u.cacheCreate || 0) * t.input * 1.25
    + (u.cacheRead || 0) * t.input * 0.1
}

// A message's `attachments` can arrive as an array, a JSON string (jsonb), or be
// missing — always coerce so `.map` never throws (the crash that took the whole
// card down before the error boundary existed).
export function attachmentsOf(m: LivMessage): LivAttachment[] {
  const a = m?.attachments
  if (Array.isArray(a)) return a
  if (typeof a === 'string' && a.trim()) {
    try { const p = JSON.parse(a); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

// A session's display title, with a friendly fallback while it's still being
// named. Sessions are created untitled (title = null) and named server-side by
// an intelligent one-line SUMMARY of the first exchange — never a raw echo of
// the first message, and never left as "Untitled". Until that background title
// lands (it arrives on the next session-list refresh), the rail shows this
// neutral placeholder rather than a truncated copy of what was just typed.
export function displayTitle(title?: string | null): string {
  return (title || '').trim() || 'New Chat'
}

// No solitary word in a button/header/title ships de-capitalized — short chip/pill
// labels count, even though they aren't full sentences. Applied at the DS component
// so no consumer hat config can regress it.
export function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
}
