// ─── AI spend tracking + the optional monthly spend limit ───────────────────
// All OneLyf AI is bring-your-own-key: there is no platform key and no platform cap. A key's
// OWNER may set an optional monthly USD limit (blank/null = no limit, the default). It bounds
// everyone using that key, including household members the owner shares it with. Spend is always
// recorded so Settings can show this month's (estimated) total.
//
// Dependency-free and runtime-agnostic: no React, no DOM, no Node or Deno APIs. Runs in the
// browser, Node and Deno. Deno edge functions import this file by raw GitHub URL at a pinned
// commit, e.g.
//   import { checkSpendLimit, recordSpend } from
//     'https://raw.githubusercontent.com/One-Lyf/onelyf-design-system/<sha>/src/spend/index.ts'
// so every import inside src/spend/ MUST be relative with an explicit `.ts` extension.
//
// Storage is the host's: implement SpendStore over whatever it already has (a Supabase table +
// an atomic increment RPC, a KV hash, ...). Everything here is store-agnostic.
import { estimateCostUsd } from './pricing.ts'

export { PRICING_PER_MTOK, DEFAULT_PRICING_PER_MTOK, pricingFor, estimateCostUsd } from './pricing.ts'

// ── Pure helpers ────────────────────────────────────────────────────────────

// The UTC calendar-month bucket spend is tallied under: 'YYYY-MM'.
export function spendMonth(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// '$12.50'
export function formatUsd(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

// A usable limit (positive, rounded to cents) or null for "no limit". Accepts a number or a
// plain decimal string with an optional leading '$' ('12.5', '$12.50', ' 20 ' — Postgres numeric
// columns arrive as strings). Anything else (0, negatives, sub-cent amounts, '1e3', 'abc',
// Infinity, null, objects) is treated as unset.
export function normalizeSpendLimit(raw: unknown): number | null {
  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string') {
    const t = raw.trim().replace(/^\$\s*/, '')
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
    n = Number(t)
  } else {
    return null
  }
  if (!Number.isFinite(n)) return null
  const cents = Math.round(n * 100)
  return cents >= 1 ? cents / 100 : null
}

export const SPEND_LIMIT_INPUT_ERROR = 'Enter a positive dollar amount, or leave blank for no limit.'

// Validates a limit the user TYPED (UI field, or a settings API body): blank/null clears the
// limit, a valid amount sets it, anything else is an error rather than being silently cleared.
export type SpendLimitInput = { ok: true; value: number | null } | { ok: false; error: string }
export function parseSpendLimitInput(raw: unknown): SpendLimitInput {
  if (raw == null || (typeof raw === 'string' && raw.trim().replace(/^\$/, '').trim() === '')) {
    return { ok: true, value: null }
  }
  const value = normalizeSpendLimit(raw)
  return value === null ? { ok: false, error: SPEND_LIMIT_INPUT_ERROR } : { ok: true, value }
}

// The message a blocked call returns. Neutral (no provider names); points at Settings → AI.
export function spendLimitMessage(limitUsd: number): string {
  return `This key's monthly AI spend limit (${formatUsd(limitUsd)}) is reached. It resets next month, or the key's owner can raise it in Settings → AI.`
}

// ── Store port ──────────────────────────────────────────────────────────────

// `ownerId` is the KEY OWNER (the billing identity), not necessarily the signed-in user: a
// household member on a shared key is checked and recorded against the organizer's id.
export interface SpendStore {
  // This owner's accumulated USD for `month` ('YYYY-MM'); 0 when nothing is recorded.
  getMonthSpend(ownerId: string, month: string): Promise<number>
  // Add `usd` to this owner's total for `month`. Should be atomic (increment, not read-modify-write).
  addSpend(ownerId: string, month: string, usd: number): Promise<void>
  // The owner's raw limit (normalized here), or null/undefined for no limit.
  getLimit(ownerId: string): Promise<number | null>
}

export interface SpendClock {
  now?: Date
}

// ── Check / record / summarize ──────────────────────────────────────────────

export type SpendCheck =
  | { blocked: false }
  | {
      blocked: true
      status: 429
      message: string
      limitUsd: number
      // null when the month's spend couldn't be read (a fail-closed block).
      monthSpendUsd: number | null
      reason: 'limit_reached' | 'unverified'
    }

// Pre-call check against the owner's optional limit.
// - No limit → allowed after ONE store call (getLimit); the month total is never read.
// - Limit set → blocked when this month's spend is at or over it.
// - Store error reading the month total with a limit set → blocked when `failClosed` (default),
//   because the owner explicitly asked to be protected; allowed otherwise.
// - Store error reading the LIMIT itself → allowed: there is no known limit to enforce, and
//   blocking would cap every user without a limit (the default) during an outage.
// The check sees spend as of the START of this call (recordSpend lands after the model returns),
// so concurrent calls can overshoot by about one call each: an accepted soft limit.
export async function checkSpendLimit(
  store: SpendStore,
  ownerId: string,
  { failClosed = true, now }: { failClosed?: boolean } & SpendClock = {},
): Promise<SpendCheck> {
  let limitUsd: number | null
  try {
    limitUsd = normalizeSpendLimit(await store.getLimit(ownerId))
  } catch (e) {
    console.error('Spend limit lookup failed; no limit enforced:', errMessage(e))
    return { blocked: false }
  }
  if (limitUsd === null) return { blocked: false }
  let monthSpendUsd: number
  try {
    monthSpendUsd = Number(await store.getMonthSpend(ownerId, spendMonth(now))) || 0
  } catch (e) {
    console.error('Spend total lookup failed:', errMessage(e))
    if (!failClosed) return { blocked: false }
    return { blocked: true, status: 429, message: spendLimitMessage(limitUsd), limitUsd, monthSpendUsd: null, reason: 'unverified' }
  }
  if (monthSpendUsd >= limitUsd) {
    return { blocked: true, status: 429, message: spendLimitMessage(limitUsd), limitUsd, monthSpendUsd, reason: 'limit_reached' }
  }
  return { blocked: false }
}

// Records one call's estimated cost against the owner's current month. NEVER throws: a store
// hiccup here must not break the AI response the user is already waiting on. Returns the USD
// actually recorded (0 when the estimate is zero or the write failed).
export async function recordSpend(
  store: SpendStore,
  ownerId: string,
  { model, inputTokens, outputTokens, now }: { model: string | null | undefined; inputTokens?: number; outputTokens?: number } & SpendClock,
): Promise<number> {
  try {
    const usd = estimateCostUsd(model, inputTokens ?? 0, outputTokens ?? 0)
    if (!(usd > 0)) return 0
    await store.addSpend(ownerId, spendMonth(now), usd)
    return usd
  } catch (e) {
    console.error('recordSpend failed (non-fatal):', errMessage(e))
    return 0
  }
}

// What the settings UI shows (SpendLimitField / LivChat adapter.spend.get). Store errors
// propagate: showing a made-up $0.00 would be worse than an error.
export async function getSpendSummary(
  store: SpendStore,
  ownerId: string,
  { now }: SpendClock = {},
): Promise<{ limitUsd: number | null; monthSpendUsd: number }> {
  const [rawLimit, spend] = await Promise.all([
    store.getLimit(ownerId),
    store.getMonthSpend(ownerId, spendMonth(now)),
  ])
  return { limitUsd: normalizeSpendLimit(rawLimit), monthSpendUsd: Number(spend) || 0 }
}

// ── In-memory store ─────────────────────────────────────────────────────────
// For tests, demos and single-process prototypes. Not durable; not shared across processes.
export interface MemorySpendStore extends SpendStore {
  setLimit(ownerId: string, limitUsd: number | null): Promise<void>
}
export function createMemorySpendStore(): MemorySpendStore {
  const spend = new Map<string, number>()
  const limits = new Map<string, number | null>()
  const key = (ownerId: string, month: string) => `${ownerId}\u0000${month}`
  return {
    async getMonthSpend(ownerId, month) { return spend.get(key(ownerId, month)) ?? 0 },
    async addSpend(ownerId, month, usd) { spend.set(key(ownerId, month), (spend.get(key(ownerId, month)) ?? 0) + usd) },
    async getLimit(ownerId) { return limits.get(ownerId) ?? null },
    async setLimit(ownerId, limitUsd) { limits.set(ownerId, normalizeSpendLimit(limitUsd)) },
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
