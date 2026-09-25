// Run with: node --experimental-strip-types --test src/components/livChatModels.test.ts
// (or plain `node --test` on a Node version where TS type-stripping is unflagged).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  curateLivModels,
  ANTHROPIC_FALLBACK_MODELS,
  ANTHROPIC_FALLBACK_MODEL_ID,
  DEFAULT_MODEL_EXCLUDE,
  PROVIDER_LABELS,
  providerLabel,
  PROVIDER_FALLBACK_MODELS,
} from './livChatModels.ts'

test('provider labels are real vendor names, never assistant/model-family brands', () => {
  assert.deepEqual(PROVIDER_LABELS, {
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    openai: 'OpenAI',
    perplexity: 'Perplexity',
    gemini: 'Google',
  })
  for (const label of Object.values(PROVIDER_LABELS)) {
    assert.doesNotMatch(label, /^(Claude|GPT|Gemini)$/i)
  }
  // Every labeled provider has a fallback model list, and vice versa (picker ↔ model list stay in sync).
  assert.deepEqual(Object.keys(PROVIDER_LABELS).sort(), Object.keys(PROVIDER_FALLBACK_MODELS).sort())
})

test('curate strips a leading "Claude " persona word but keeps the model name', () => {
  assert.deepEqual(
    curateLivModels([{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }]),
    [{ id: 'claude-opus-4-6', label: 'Opus 4.6' }],
  )
})

test('curate leaves non-Claude model names (GPT) untouched', () => {
  assert.deepEqual(
    curateLivModels([{ id: 'gpt-5', label: 'GPT-5' }]),
    [{ id: 'gpt-5', label: 'GPT-5' }],
  )
})

test('curate excludes Fable/Mythos by id OR by display label', () => {
  const raw = [
    { id: 'claude-fable-5-1', label: 'Fable 5.1' }, // by id
    { id: 'claude-mythos-5', label: 'Mythos 5' }, // by id
    { id: 'some-internal-id', label: 'Fable 5.1' }, // by label only
    { id: 'claude-opus-5', label: 'Opus 5' }, // kept
  ]
  assert.deepEqual(curateLivModels(raw), [{ id: 'claude-opus-5', label: 'Opus 5' }])
})

test('a future live model (Opus 5) survives curation with no code change', () => {
  // Proves the discovery path: a name we never hardcoded still shows up.
  const live = [{ id: 'claude-opus-5', label: 'Claude Opus 5' }]
  assert.deepEqual(curateLivModels(live), [{ id: 'claude-opus-5', label: 'Opus 5' }])
})

test('curate dedupes by id, first wins, and preserves input order', () => {
  const raw = [
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8 (dupe)' },
  ]
  assert.deepEqual(curateLivModels(raw), [
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  ])
})

test('curate drops blank / malformed entries without throwing', () => {
  const raw = [
    { id: '   ', label: 'blank id' },
    { id: 'claude-haiku-4-5', label: '' }, // empty label → falls back to id
    // deliberately malformed shapes a backend might emit
    null as unknown as { id: string; label: string },
    { label: 'no id' } as unknown as { id: string; label: string },
  ]
  assert.deepEqual(curateLivModels(raw), [{ id: 'claude-haiku-4-5', label: 'claude-haiku-4-5' }])
})

test('curate tolerates null/undefined input', () => {
  assert.deepEqual(curateLivModels(null), [])
  assert.deepEqual(curateLivModels(undefined), [])
})

test('a custom exclude overrides the default (e.g. also hide haiku)', () => {
  const raw = [
    { id: 'claude-opus-4-6', label: 'Opus 4.6' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  ]
  assert.deepEqual(curateLivModels(raw, { exclude: /haiku/i }), [
    { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  ])
})

test('curate preserves a host-supplied costPerToken hint (ds-livchat-cost-estimator-tier-mismatch)', () => {
  // A live-discovered non-Anthropic model has no opus/sonnet/haiku substring for LivChat's
  // internal cost estimator to match — the host can attach a real per-token cost instead of
  // letting the estimate silently default to Sonnet's price.
  const raw = [{ id: 'gpt-5', label: 'GPT-5', costPerToken: { input: 10 / 1e6, output: 30 / 1e6 } }]
  assert.deepEqual(curateLivModels(raw), raw)
})

test('curate does not fabricate a costPerToken key when the input has none', () => {
  // Regression guard: an explicit `costPerToken: undefined` key would break every deepEqual
  // assertion above (own-key presence differs even when the value is undefined).
  const [out] = curateLivModels([{ id: 'claude-opus-4-6', label: 'Opus 4.6' }])
  assert.ok(!('costPerToken' in out))
})

test('the static fallback is self-consistent: no Fable/Mythos, default present & first', () => {
  // curating the fallback is idempotent (no Fable/Mythos slip through)
  assert.deepEqual(curateLivModels(ANTHROPIC_FALLBACK_MODELS), ANTHROPIC_FALLBACK_MODELS)
  assert.ok(!ANTHROPIC_FALLBACK_MODELS.some((m) => DEFAULT_MODEL_EXCLUDE.test(m.id)))
  assert.equal(ANTHROPIC_FALLBACK_MODELS[0].id, ANTHROPIC_FALLBACK_MODEL_ID) // seeded default is first
  assert.ok(ANTHROPIC_FALLBACK_MODELS.some((m) => m.id === ANTHROPIC_FALLBACK_MODEL_ID))
})

test('providerLabel: vendor names for known ids, Title Case for unknown ones (e.g. custom)', () => {
  assert.equal(providerLabel('anthropic'), 'Anthropic')
  assert.equal(providerLabel('custom'), 'Custom')
  assert.equal(providerLabel(''), '')
})

import { modelBelongsTo, modelsForProvider, modelPickerState } from './livChatModels.ts'

test('modelBelongsTo flags only ids that are clearly another provider\'s', () => {
  assert.equal(modelBelongsTo('mistral', 'claude-haiku-4-5'), false)
  assert.equal(modelBelongsTo('mistral', 'gpt-5'), false)
  assert.equal(modelBelongsTo('anthropic', 'mistral-large-latest'), false)
  assert.equal(modelBelongsTo('mistral', 'mistral-large-latest'), true)
  assert.equal(modelBelongsTo('mistral', 'magistral-medium-latest'), true)
  assert.equal(modelBelongsTo('mistral', 'some-future-model'), true)
  assert.equal(modelBelongsTo('mistral', ''), true)
  assert.equal(modelBelongsTo('custom', 'claude-sonnet-4-6'), true)
  assert.equal(modelBelongsTo('gemini', 'models/gemini-2.5-pro'), true)
})

test('modelsForProvider drops another provider\'s models (a Claude list on a Mistral key)', () => {
  assert.deepEqual(modelsForProvider('mistral', ANTHROPIC_FALLBACK_MODELS), [])
  assert.deepEqual(modelsForProvider('mistral', PROVIDER_FALLBACK_MODELS.mistral), PROVIDER_FALLBACK_MODELS.mistral)
  assert.deepEqual(modelsForProvider('anthropic', ANTHROPIC_FALLBACK_MODELS), ANTHROPIC_FALLBACK_MODELS)
  assert.deepEqual(modelsForProvider('custom', ANTHROPIC_FALLBACK_MODELS), ANTHROPIC_FALLBACK_MODELS)
  assert.deepEqual(modelsForProvider('mistral', null), [])
  // Every provider's own fallback list survives its own filter.
  for (const [p, list] of Object.entries(PROVIDER_FALLBACK_MODELS)) assert.deepEqual(modelsForProvider(p, list), list, p)
})

test('modelPickerState shows the saved model as-is when the list lacks it, never the first option in its place', () => {
  const mistral = PROVIDER_FALLBACK_MODELS.mistral
  // Empty list: the saved id is the one option.
  assert.deepEqual(modelPickerState([], 'mistral-medium-2508'), { options: [{ id: 'mistral-medium-2508', label: 'mistral-medium-2508' }], value: 'mistral-medium-2508', savedMissing: true, show: true })
  // A one-model list with that model saved: shown (it says what runs), not hidden as "no choice".
  assert.equal(modelPickerState([{ id: 'llama3', label: 'llama3' }], 'llama3').show, true)
  assert.equal(modelPickerState([{ id: 'llama3', label: 'llama3' }], null).show, false)
  // Listed: unchanged.
  assert.deepEqual(modelPickerState(mistral, 'mistral-small-latest'), { options: mistral, value: 'mistral-small-latest', savedMissing: false, show: true })
  // Not listed: prepended, selected.
  const s = modelPickerState(mistral, 'claude-haiku-4-5')
  assert.equal(s.value, 'claude-haiku-4-5')
  assert.deepEqual(s.options[0], { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5' })
  assert.equal(s.options.length, mistral.length + 1)
  // Nothing saved: a listed draft, else the first option; a stale draft from another list is ignored.
  assert.equal(modelPickerState(mistral, null, 'mistral-small-latest').value, 'mistral-small-latest')
  assert.equal(modelPickerState(mistral, null, 'claude-haiku-4-5').value, 'mistral-large-latest')
  assert.deepEqual(modelPickerState([], null), { options: [], value: '', savedMissing: false, show: false })
})

test('modelPickerState never re-adds a saved Fable/Mythos id as an option', () => {
  const st = modelPickerState([{ id: 'mistral-large-latest', label: 'Large' }], 'claude-fable-5-1')
  assert.equal(st.options.some((m) => /fable/i.test(m.id)), false)
  assert.equal(st.savedMissing, false)
  assert.equal(st.value, 'mistral-large-latest')
})
