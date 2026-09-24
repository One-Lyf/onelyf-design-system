// Run with: node --test src/spend/spend.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRICING_PER_MTOK, DEFAULT_PRICING_PER_MTOK, pricingFor, estimateCostUsd,
  spendMonth, formatUsd, normalizeSpendLimit, parseSpendLimitInput, SPEND_LIMIT_INPUT_ERROR, spendLimitMessage,
  SPEND_UNAVAILABLE_MESSAGE, CACHE_WRITE_MULTIPLIER, CACHE_READ_MULTIPLIER, checkSpendLimit, recordSpend, getSpendSummary, createMemorySpendStore,
  type SpendStore,
} from './index.ts'

// A store that counts calls and can be told to fail, wrapping the real in-memory one.
function spyStore(opts: { limit?: number | null | string; failGetLimit?: boolean; failGetMonth?: boolean; failAdd?: boolean } = {}) {
  const inner = createMemorySpendStore()
  const calls = { getLimit: 0, getMonthSpend: 0, addSpend: 0 }
  // getLimit hands back the RAW stored value (as a DB row would), so normalization is exercised.
  const rawLimit = (opts.limit ?? null) as number | null
  const store: SpendStore & { calls: typeof calls; inner: typeof inner } = {
    calls, inner,
    async getLimit() { calls.getLimit++; if (opts.failGetLimit) throw new Error('db down'); return rawLimit },
    async getMonthSpend(id, m) { calls.getMonthSpend++; if (opts.failGetMonth) throw new Error('db down'); return inner.getMonthSpend(id, m) },
    async addSpend(id, m, usd) { calls.addSpend++; if (opts.failAdd) throw new Error('db down'); return inner.addSpend(id, m, usd) },
  }
  return store
}

// Silence the module's console.error on the deliberate failure paths.
const quiet = <T>(fn: () => Promise<T>) => async () => {
  const orig = console.error
  console.error = () => {}
  try { return await fn() } finally { console.error = orig }
}

const SEPT = new Date(Date.UTC(2026, 8, 23, 12))

// ── pricing ──
test('pricing: every table entry is a finite [input, output] pair', () => {
  for (const [id, [i, o]] of Object.entries(PRICING_PER_MTOK)) {
    assert.ok(Number.isFinite(i) && i > 0 && Number.isFinite(o) && o > 0, id)
  }
})

test('pricing: covers the DS model-list ids', () => {
  for (const id of ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5', 'mistral-large-latest', 'mistral-small-latest',
    'gpt-5.1', 'gpt-5', 'gpt-4.1', 'sonar', 'sonar-pro', 'gemini-2.5-flash', 'gemini-2.5-pro']) {
    assert.equal(pricingFor(id), PRICING_PER_MTOK[id], id)
  }
})

test('pricing: longest key wins on substring match (no gpt-5 / sonar / opus-5 shadowing)', () => {
  assert.equal(pricingFor('gpt-5.1-2026-01-01'), PRICING_PER_MTOK['gpt-5.1'])
  assert.equal(pricingFor('perplexity/sonar-pro'), PRICING_PER_MTOK['sonar-pro'])
  assert.equal(pricingFor('claude-opus-5-5'), PRICING_PER_MTOK['claude-opus-5-5'])
  assert.equal(pricingFor('claude-sonnet-4-6-20260101'), PRICING_PER_MTOK['claude-sonnet-4-6'])
  assert.equal(pricingFor('  Claude-Haiku-4-5 '), PRICING_PER_MTOK['claude-haiku-4-5'])
})

test('pricing: unknown / missing model uses the safe default', () => {
  assert.equal(pricingFor('some-new-model'), DEFAULT_PRICING_PER_MTOK)
  assert.equal(pricingFor(null), DEFAULT_PRICING_PER_MTOK)
  assert.equal(pricingFor(''), DEFAULT_PRICING_PER_MTOK)
  assert.equal(pricingFor('constructor'), DEFAULT_PRICING_PER_MTOK) // no prototype lookups
  const [i, o] = DEFAULT_PRICING_PER_MTOK
  assert.equal(estimateCostUsd('some-new-model', 1_000_000, 1_000_000), i + o)
})

test('estimateCostUsd: per-million math; bad token counts count as 0', () => {
  const [i, o] = PRICING_PER_MTOK['claude-sonnet-4-6']
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 2_000_000, 500_000), 2 * i + 0.5 * o)
  assert.equal(estimateCostUsd('claude-sonnet-4-6', -5, Number.NaN), 0)
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 0, 0), 0)
})

test('estimateCostUsd: cache write 1.25x / read 0.1x the input rate; optional (backward compatible)', () => {
  const [i, o] = PRICING_PER_MTOK['claude-sonnet-4-6']
  assert.equal(CACHE_WRITE_MULTIPLIER, 1.25)
  assert.equal(CACHE_READ_MULTIPLIER, 0.1)
  const base = estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)
  assert.equal(base, i + o)
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000, {}), base)
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 0, 0, { cacheWriteTokens: 1_000_000 }), i * 1.25)
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 0, 0, { cacheReadTokens: 1_000_000 }), i * 0.1)
  assert.equal(
    estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000, { cacheWriteTokens: 2_000_000, cacheReadTokens: 10_000_000 }),
    i + o + 2 * i * 1.25 + 10 * i * 0.1,
  )
  assert.equal(estimateCostUsd('claude-sonnet-4-6', 0, 0, { cacheWriteTokens: -1, cacheReadTokens: Number.NaN }), 0)
})

// ── pure helpers ──
test('spendMonth: UTC YYYY-MM bucket, rolls over at the UTC month boundary', () => {
  assert.equal(spendMonth(SEPT), '2026-09')
  assert.equal(spendMonth(new Date(Date.UTC(2026, 8, 30, 23, 59, 59))), '2026-09')
  assert.equal(spendMonth(new Date(Date.UTC(2026, 9, 1, 0, 0, 0))), '2026-10')
  assert.equal(spendMonth(new Date(Date.UTC(2026, 11, 31, 23, 59))), '2026-12')
  assert.equal(spendMonth(new Date(Date.UTC(2027, 0, 1))), '2027-01')
  assert.match(spendMonth(), /^\d{4}-\d{2}$/)
})

test('formatUsd', () => {
  assert.equal(formatUsd(12.5), '$12.50')
  assert.equal(formatUsd(0), '$0.00')
  assert.equal(formatUsd(Number.NaN), '$0.00')
})

test('normalizeSpendLimit: positive amounts (numbers, numeric strings, "$12.50"), rounded to cents', () => {
  assert.equal(normalizeSpendLimit('$12.50'), 12.5)
  assert.equal(normalizeSpendLimit('$ 12.50'), 12.5)
  assert.equal(normalizeSpendLimit('12.5'), 12.5)
  assert.equal(normalizeSpendLimit(' 20 '), 20)
  assert.equal(normalizeSpendLimit('.5'), 0.5)
  assert.equal(normalizeSpendLimit('7.'), 7)
  assert.equal(normalizeSpendLimit(25), 25)
  assert.equal(normalizeSpendLimit(10.005), 10.01)
  assert.equal(normalizeSpendLimit('0.01'), 0.01)
})

test('normalizeSpendLimit: everything else is "no limit" (null)', () => {
  for (const raw of [null, undefined, '', '   ', '$', 0, '0', '0.00', '0.004', -5, '-5', 'abc', '1e3', '12.5.1', '$-3',
    '1,000', Number.NaN, Number.POSITIVE_INFINITY, 'Infinity', {}, [], true]) {
    assert.equal(normalizeSpendLimit(raw), null, JSON.stringify(raw) ?? String(raw))
  }
})

test('parseSpendLimitInput: blank → null (clear); "$12.5" → 12.5; 0 / negative / garbage → error', () => {
  assert.deepEqual(parseSpendLimitInput(''), { ok: true, value: null })
  assert.deepEqual(parseSpendLimitInput('   '), { ok: true, value: null })
  assert.deepEqual(parseSpendLimitInput('$'), { ok: true, value: null })
  assert.deepEqual(parseSpendLimitInput(null), { ok: true, value: null })
  assert.deepEqual(parseSpendLimitInput('$12.5'), { ok: true, value: 12.5 })
  assert.deepEqual(parseSpendLimitInput('$12.50'), { ok: true, value: 12.5 })
  assert.deepEqual(parseSpendLimitInput(40), { ok: true, value: 40 })
  for (const bad of ['0', '0.00', '-5', '$-5', 'abc', '12..5', '1e3', 0, -1]) {
    assert.deepEqual(parseSpendLimitInput(bad), { ok: false, error: SPEND_LIMIT_INPUT_ERROR }, String(bad))
  }
})

test('spendLimitMessage: neutral copy naming Settings → AI', () => {
  const m = spendLimitMessage(20)
  assert.match(m, /\$20\.00/)
  assert.match(m, /Settings → AI/)
  assert.doesNotMatch(m, /claude|anthropic|openai|mistral|gemini/i)
})

// ── checkSpendLimit ──
test('checkSpendLimit: no limit → allowed with ONLY getLimit called (fast path)', async () => {
  const s = spyStore({ limit: null })
  assert.deepEqual(await checkSpendLimit(s, 'owner', { now: SEPT }), { blocked: false })
  assert.deepEqual(s.calls, { getLimit: 1, getMonthSpend: 0, addSpend: 0 })
})

test('checkSpendLimit: an unusable stored limit (0, garbage) counts as no limit', async () => {
  for (const limit of [0, 'abc', -3]) {
    const s = spyStore({ limit: limit as number })
    assert.deepEqual(await checkSpendLimit(s, 'owner'), { blocked: false })
    assert.equal(s.calls.getMonthSpend, 0)
  }
})

test('checkSpendLimit: under the limit → allowed', async () => {
  const s = spyStore({ limit: 10 })
  await s.inner.addSpend('owner', '2026-09', 9.99)
  assert.deepEqual(await checkSpendLimit(s, 'owner', { now: SEPT }), { blocked: false })
  assert.equal(s.calls.getMonthSpend, 1)
})

test('checkSpendLimit: AT the limit → blocked (429, message, figures)', async () => {
  const s = spyStore({ limit: 10 })
  await s.inner.addSpend('owner', '2026-09', 10)
  const r = await checkSpendLimit(s, 'owner', { now: SEPT })
  assert.deepEqual(r, {
    blocked: true, status: 429, reason: 'limit', message: spendLimitMessage(10), limitUsd: 10, monthSpendUsd: 10,
  })
})

test('checkSpendLimit: over the limit → blocked', async () => {
  const s = spyStore({ limit: 5 })
  await s.inner.addSpend('owner', '2026-09', 7.25)
  const r = await checkSpendLimit(s, 'owner', { now: SEPT })
  assert.equal(r.blocked, true)
  if (r.blocked) { assert.equal(r.monthSpendUsd, 7.25); assert.equal(r.limitUsd, 5) }
})

test('checkSpendLimit: month rollover — last month\'s spend does not count', async () => {
  const s = spyStore({ limit: 5 })
  await s.inner.addSpend('owner', '2026-09', 50)
  assert.equal((await checkSpendLimit(s, 'owner', { now: SEPT })).blocked, true)
  assert.deepEqual(await checkSpendLimit(s, 'owner', { now: new Date(Date.UTC(2026, 9, 1)) }), { blocked: false })
})

test('checkSpendLimit: spend is per owner', async () => {
  const s = spyStore({ limit: 5 })
  await s.inner.addSpend('someone-else', '2026-09', 50)
  assert.deepEqual(await checkSpendLimit(s, 'owner', { now: SEPT }), { blocked: false })
})

test('checkSpendLimit: store error with a limit set → fails CLOSED as 503 unavailable (not "limit reached")', quiet(async () => {
  const s = spyStore({ limit: 10, failGetMonth: true })
  const r = await checkSpendLimit(s, 'owner', { now: SEPT })
  assert.deepEqual(r, {
    blocked: true, status: 503, reason: 'unavailable', message: SPEND_UNAVAILABLE_MESSAGE, limitUsd: 10,
  })
  assert.equal(SPEND_UNAVAILABLE_MESSAGE, "Couldn't check your AI spend right now; try again shortly.")
  assert.doesNotMatch(SPEND_UNAVAILABLE_MESSAGE, /reached/)
}))

test('checkSpendLimit: store error with a limit set and failClosed:false → allowed', quiet(async () => {
  const s = spyStore({ limit: 10, failGetMonth: true })
  assert.deepEqual(await checkSpendLimit(s, 'owner', { failClosed: false }), { blocked: false })
}))

test('checkSpendLimit: store error with NO limit → allowed (never reads the month)', quiet(async () => {
  const s = spyStore({ limit: null, failGetMonth: true })
  assert.deepEqual(await checkSpendLimit(s, 'owner'), { blocked: false })
  assert.equal(s.calls.getMonthSpend, 0)
}))

test('checkSpendLimit: the limit lookup itself failing → allowed (no known limit to enforce)', quiet(async () => {
  const s = spyStore({ limit: 10, failGetLimit: true })
  assert.deepEqual(await checkSpendLimit(s, 'owner'), { blocked: false })
  assert.equal(s.calls.getMonthSpend, 0)
}))

// ── recordSpend ──
test('recordSpend: records the estimate under the current month and returns it', async () => {
  const s = spyStore()
  const usd = await recordSpend(s, 'owner', { model: 'claude-sonnet-4-6', inputTokens: 1_000_000, outputTokens: 100_000, now: SEPT })
  assert.equal(usd, estimateCostUsd('claude-sonnet-4-6', 1_000_000, 100_000))
  assert.equal(await s.inner.getMonthSpend('owner', '2026-09'), usd)
  await recordSpend(s, 'owner', { model: 'claude-sonnet-4-6', inputTokens: 1_000_000, outputTokens: 100_000, now: SEPT })
  assert.equal(await s.inner.getMonthSpend('owner', '2026-09'), usd * 2)
})

test('recordSpend: month rollover writes to the new month', async () => {
  const s = spyStore()
  await recordSpend(s, 'owner', { model: 'gpt-5.1', inputTokens: 1000, outputTokens: 1000, now: SEPT })
  await recordSpend(s, 'owner', { model: 'gpt-5.1', inputTokens: 1000, outputTokens: 1000, now: new Date(Date.UTC(2026, 9, 2)) })
  const each = estimateCostUsd('gpt-5.1', 1000, 1000)
  assert.equal(await s.inner.getMonthSpend('owner', '2026-09'), each)
  assert.equal(await s.inner.getMonthSpend('owner', '2026-10'), each)
})

test('recordSpend: passes cache tokens through to the estimate', async () => {
  const s = spyStore()
  const args = { model: 'claude-haiku-4-5', inputTokens: 10_000, outputTokens: 2_000, cacheWriteTokens: 50_000, cacheReadTokens: 400_000 }
  const usd = await recordSpend(s, 'owner', { ...args, now: SEPT })
  const expected = estimateCostUsd(args.model, args.inputTokens, args.outputTokens, { cacheWriteTokens: args.cacheWriteTokens, cacheReadTokens: args.cacheReadTokens })
  assert.equal(usd, expected)
  assert.ok(usd > estimateCostUsd(args.model, args.inputTokens, args.outputTokens))
  assert.equal(await s.inner.getMonthSpend('owner', '2026-09'), usd)
  // Cache-only turn (all input served from cache) still records.
  assert.ok(await recordSpend(s, 'owner', { model: 'claude-haiku-4-5', cacheReadTokens: 100_000, now: SEPT }) > 0)
})

test('recordSpend: unknown model is priced at the default', async () => {
  const s = spyStore()
  const usd = await recordSpend(s, 'owner', { model: 'brand-new-model-x', inputTokens: 1_000_000, outputTokens: 0, now: SEPT })
  assert.equal(usd, DEFAULT_PRICING_PER_MTOK[0])
})

test('recordSpend: zero tokens → no write, returns 0', async () => {
  const s = spyStore()
  assert.equal(await recordSpend(s, 'owner', { model: 'gpt-5.1' }), 0)
  assert.equal(s.calls.addSpend, 0)
})

test('recordSpend: never throws; a failed write returns 0', quiet(async () => {
  const s = spyStore({ failAdd: true })
  assert.equal(await recordSpend(s, 'owner', { model: 'gpt-5.1', inputTokens: 5000, outputTokens: 5000 }), 0)
  assert.equal(s.calls.addSpend, 1)
  // Even a store whose method throws synchronously.
  const sync = { ...s, addSpend() { throw new Error('sync boom') } } as unknown as SpendStore
  assert.equal(await recordSpend(sync, 'owner', { model: 'gpt-5.1', inputTokens: 5000, outputTokens: 5000 }), 0)
}))

test('record then check: spend accumulates into a block', async () => {
  const s = spyStore({ limit: 1 })
  // Sonnet 4.6 at [3, 15]: 100k in + 50k out = $1.05, over a $1 limit.
  await recordSpend(s, 'owner', { model: 'claude-sonnet-4-6', inputTokens: 100_000, outputTokens: 50_000, now: SEPT })
  assert.equal((await checkSpendLimit(s, 'owner', { now: SEPT })).blocked, true)
})

// ── getSpendSummary ──
test('getSpendSummary: limit + this month\'s total', async () => {
  const s = spyStore({ limit: '$12.50' })
  await s.inner.addSpend('owner', '2026-09', 3.2)
  await s.inner.addSpend('owner', '2026-08', 99)
  assert.deepEqual(await getSpendSummary(s, 'owner', { now: SEPT }), { limitUsd: 12.5, monthSpendUsd: 3.2 })
  const none = spyStore()
  assert.deepEqual(await getSpendSummary(none, 'owner', { now: SEPT }), { limitUsd: null, monthSpendUsd: 0 })
})

test('getSpendSummary: store errors propagate (no made-up $0)', async () => {
  const s = spyStore({ failGetMonth: true })
  await assert.rejects(getSpendSummary(s, 'owner'))
})

test('createMemorySpendStore: setLimit normalizes', async () => {
  const s = createMemorySpendStore()
  await s.setLimit('a', 0)
  assert.equal(await s.getLimit('a'), null)
  await s.setLimit('a', 20)
  assert.equal(await s.getLimit('a'), 20)
})

// Deno imports src/spend by raw URL: every import in the shipped files must be relative './*.ts'.
test('src/spend ships only relative .ts imports (Deno raw-URL constraint)', async () => {
  const { readFile } = await import('node:fs/promises')
  for (const f of ['index.ts', 'pricing.ts']) {
    const code = (await readFile(new URL(`./${f}`, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '')
    const specs = [...code.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    if (f === 'index.ts') assert.ok(specs.length >= 2, 'expected to see index.ts importing pricing.ts')
    for (const spec of specs) assert.match(spec, /^\.\/[\w-]+\.ts$/, `${f}: ${spec}`)
  }
})
