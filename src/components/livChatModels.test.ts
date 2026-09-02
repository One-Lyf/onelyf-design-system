// Run with: node --experimental-strip-types --test src/components/livChatModels.test.ts
// (or plain `node --test` on a Node version where TS type-stripping is unflagged).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  curateLivModels,
  DEFAULT_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_EXCLUDE,
} from './livChatModels.ts'

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

test('the static fallback is self-consistent: no Fable/Mythos, default present & first', () => {
  // curating the fallback is idempotent (no Fable/Mythos slip through)
  assert.deepEqual(curateLivModels(DEFAULT_MODELS), DEFAULT_MODELS)
  assert.ok(!DEFAULT_MODELS.some((m) => DEFAULT_MODEL_EXCLUDE.test(m.id)))
  assert.equal(DEFAULT_MODELS[0].id, DEFAULT_MODEL_ID) // seeded default is first
  assert.ok(DEFAULT_MODELS.some((m) => m.id === DEFAULT_MODEL_ID))
})
