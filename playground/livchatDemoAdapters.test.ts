// Run with: node --experimental-strip-types --test playground/livchatDemoAdapters.test.ts
// (or plain `node --test` on a Node version where TS type-stripping is unflagged).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advisorReplyFor,
  commisReplyFor,
  createDemoAdapter,
  createInMemoryLivBackend,
} from './livchatDemoAdapters.ts'
import type { LivToolActivity } from '../src/components/LivChat.ts'

test('commisReplyFor proposes a meal-plan action', () => {
  const reply = commisReplyFor('what can I cook tonight?')
  assert.equal(reply.proposed?.length, 1)
  assert.equal(reply.proposed?.[0].type, 'add_to_meal_plan')
})

test('advisorReplyFor proposes two finance actions', () => {
  const reply = advisorReplyFor('categorize my spending')
  assert.equal(reply.proposed?.length, 2)
  assert.deepEqual(
    reply.proposed?.map((p) => p.type),
    ['categorize_transaction', 'move_envelope'],
  )
})

test('in-memory backend: create/list/rename/delete sessions round-trip', async () => {
  const backend = createInMemoryLivBackend()
  const created = await backend.sessions.create('Tuesday dinner')
  assert.equal(created.ok, true)
  if (!created.ok) return
  const { id } = created.value

  const listed = await backend.sessions.list()
  assert.equal(listed.ok, true)
  if (listed.ok) assert.equal(listed.value.sessions.some((s) => s.id === id), true)

  const renamed = await backend.sessions.rename(id, 'Renamed')
  assert.equal(renamed.ok, true)

  const deleted = await backend.sessions.delete(id)
  assert.equal(deleted.ok, true)

  const afterDelete = await backend.sessions.list()
  assert.equal(afterDelete.ok, true)
  if (afterDelete.ok) assert.equal(afterDelete.value.sessions.some((s) => s.id === id), false)
})

test('rename/delete on an unknown session id fails, not throws', async () => {
  const backend = createInMemoryLivBackend()
  const renamed = await backend.sessions.rename('missing', 'x')
  assert.equal(renamed.ok, false)
  const deleted = await backend.sessions.delete('missing')
  assert.equal(deleted.ok, false)
})

// The core gate this harness exists to prove: a Commis-shaped adapter and an Advisor-shaped
// adapter both round-trip proposed actions through chat.send's extras — the exact seam
// docs/liv-chat-adapter-v2.md §5's Q-gated migrations will plug into later.
test('Commis adapter round-trips a proposed action through chat.send extras', async () => {
  const backend = createInMemoryLivBackend()
  const proposedBatches: unknown[][] = []
  const adapter = createDemoAdapter(backend, commisReplyFor, (proposed) => proposedBatches.push(proposed))

  const created = await backend.sessions.create()
  assert.equal(created.ok, true)
  if (!created.ok) return

  const chunks: (string | LivToolActivity)[] = []
  const result = await adapter.chat.send({ sessionId: created.value.id, text: 'cook dinner' }, (c) => chunks.push(c))

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal((result.extras as { proposed: unknown[] }).proposed.length, 1)
  assert.equal(proposedBatches.length, 1)
  assert.equal(proposedBatches[0].length, 1)
  // Tool activity (start + end) plus the text delta all reached the streaming callback.
  assert.equal(chunks.length, 3)

  const messages = await backend.messages.list(created.value.id)
  assert.equal(messages.ok, true)
  if (messages.ok) assert.equal(messages.value.messages.length, 2) // user turn + Liv reply
})

test('Advisor adapter round-trips two proposed actions through chat.send extras', async () => {
  const backend = createInMemoryLivBackend()
  const proposedBatches: unknown[][] = []
  const adapter = createDemoAdapter(backend, advisorReplyFor, (proposed) => proposedBatches.push(proposed))

  const created = await backend.sessions.create()
  assert.equal(created.ok, true)
  if (!created.ok) return

  const result = await adapter.chat.send({ sessionId: created.value.id, text: 'categorize my spending' }, () => {})

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal((result.extras as { proposed: unknown[] }).proposed.length, 2)
  assert.equal(proposedBatches.length, 1)
  assert.equal(proposedBatches[0].length, 2)
})

test('a turn with no proposed actions does not fire onProposed', async () => {
  const backend = createInMemoryLivBackend()
  const proposedBatches: unknown[][] = []
  const adapter = createDemoAdapter(backend, () => ({ text: 'just chatting' }), (proposed) => proposedBatches.push(proposed))

  const created = await backend.sessions.create()
  assert.equal(created.ok, true)
  if (!created.ok) return

  await adapter.chat.send({ sessionId: created.value.id, text: 'hi' }, () => {})
  assert.equal(proposedBatches.length, 0)
})
