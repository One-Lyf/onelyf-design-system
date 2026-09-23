// Run with: node --test src/components/SpendLimitField.test.ts
// Renders the REAL shipped .tsx through Vite's SSR loader (the repo's own toolchain; no new
// dependency) + react-dom/server, since `node --test` can't strip JSX on its own.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = fileURLToPath(new URL('../..', import.meta.url))
let vite: ViteDevServer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Field: any, BrainSheet: any, useBrainSettings: any, livChatStyles: any

before(async () => {
  vite = await createServer({
    root, configFile: false, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  Field = (await vite.ssrLoadModule('/src/components/SpendLimitField.tsx')).default
  BrainSheet = (await vite.ssrLoadModule('/src/components/livChat/BrainSheet.tsx')).BrainSheet
  useBrainSettings = (await vite.ssrLoadModule('/src/components/livChat/useBrainSettings.ts')).useBrainSettings
  livChatStyles = (await vite.ssrLoadModule('/src/components/livChat/styles.ts')).livChatStyles
})
after(async () => { await vite?.close() })

const noopSave = async () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

test('SpendLimitField: limit set — label, prefilled input, button, help, month line with "of $Y"', () => {
  const html = renderToStaticMarkup(h(Field, { limitUsd: 25, monthSpendUsd: 3.456, canEdit: true, onSave: noopSave }))
  const t = text(html)
  assert.match(t, /Monthly Spend Limit/)
  assert.match(html, /placeholder="No Limit"/)
  assert.match(html, /inputMode="decimal"|inputmode="decimal"/)
  assert.match(html, /value="25.00"/)
  assert.match(t, /Save Limit/)
  assert.match(t, /Optional\. Blank = no limit\. Applies to everyone using this key\./)
  assert.match(t, /This Month So Far: \$3\.46 \(estimated\) of \$25\.00/)
  assert.doesNotMatch(t, /household organizer/)
})

test('SpendLimitField: no limit — empty input, month line without "of"', () => {
  const html = renderToStaticMarkup(h(Field, { limitUsd: null, monthSpendUsd: 0, canEdit: true, onSave: noopSave }))
  assert.match(html, /value=""/)
  const t = text(html)
  assert.match(t, /This Month So Far: \$0\.00 \(estimated\)/)
  assert.doesNotMatch(t, /\(estimated\) of/)
})

test('SpendLimitField: canEdit false — read-only, organizer copy, no input or button', () => {
  const html = renderToStaticMarkup(h(Field, { limitUsd: 40, monthSpendUsd: 12, canEdit: false, onSave: noopSave }))
  const t = text(html)
  assert.doesNotMatch(html, /<input|<button|<form/)
  assert.match(t, /Monthly Spend Limit \$40\.00/)
  assert.match(t, /Your household organizer manages the spend limit for this key\./)
  assert.match(t, /This Month So Far: \$12\.00 \(estimated\) of \$40\.00/)
  const none = text(renderToStaticMarkup(h(Field, { limitUsd: null, monthSpendUsd: 1, canEdit: false, onSave: noopSave })))
  assert.match(none, /Monthly Spend Limit No Limit/)
})

test('SpendLimitField: no provider/brand names in the copy', () => {
  const t = text(renderToStaticMarkup(h(Field, { limitUsd: 25, monthSpendUsd: 1, canEdit: true, onSave: noopSave })))
  assert.doesNotMatch(t, /claude|anthropic|openai|mistral|gemini/i)
})

// ── Brain sheet integration ──
function adapterWith(spend?: unknown) {
  const ok = async () => ({ ok: true as const, value: { hasKey: true } })
  return {
    sessions: { list: ok, create: ok, rename: ok, delete: ok },
    messages: { list: ok },
    chat: { send: async () => ({ ok: true as const }) },
    key: { get: ok, set: ok },
    ...(spend ? { spend } : {}),
  }
}
function renderBrain(adapter: ReturnType<typeof adapterWith>) {
  const hat = { name: 'Liv' }
  function Harness() {
    const brain = useBrainSettings({ hat, adapter, setMsg: () => {} })
    return h(BrainSheet, {
      S: livChatStyles('#3f9e6a'), hat, accent: '#3f9e6a', adapter, brain, setBrainOpen: () => {}, sheetDragY: 0,
      onBrainSheetHandlePointerDown: () => {}, setMsg: () => {}, activeId: null, messages: [], doCompact: () => {},
      usage: {}, lastTurn: null, daily: {},
    })
  }
  return renderToStaticMarkup(h(Harness))
}

test('BrainSheet without adapter.spend renders no spend UI (and the usage rows are intact)', () => {
  const t = text(renderBrain(adapterWith()))
  assert.doesNotMatch(t, /Spend Limit|This Month So Far/)
  for (const row of ['Today', 'Session', 'Last Turn', 'Balance']) assert.match(t, new RegExp(row))
})

test('BrainSheet with adapter.spend renders the spend section (loading until get() resolves)', () => {
  let gets = 0
  const spend = { get: async () => { gets++; return { limitUsd: 10, monthSpendUsd: 1, canEdit: true } }, setLimit: noopSave }
  const html = renderBrain(adapterWith(spend))
  const t = text(html)
  assert.match(t, /Monthly Spend Limit/)
  assert.match(t, /Loading…/)
  // Section sits after the usage rows, before the sheet's Save button.
  assert.ok(t.indexOf('Balance') < t.indexOf('Monthly Spend Limit'))
  assert.ok(t.indexOf('Monthly Spend Limit') < t.lastIndexOf('Save'))
  // Static render runs no effects, so get() is not called during render itself.
  assert.equal(gets, 0)
})
