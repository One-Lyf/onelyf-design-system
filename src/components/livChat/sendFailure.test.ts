// Run with: node --test src/components/livChat/sendFailure.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { sendFailureNotice, sentMessageSaved } from './sendFailure.ts'

test('a coded error: only NO_KEY asks for a key; a rejected key shows its own message', () => {
  assert.equal(sendFailureNotice({ message: 'NO_KEY', code: 'NO_KEY' }, false).noKey, true)
  const rejected = sendFailureNotice({ message: 'Your AI provider rejected your key. Check it in Settings → AI.', code: 'KEY_REJECTED' }, false)
  assert.deepEqual(rejected, { noKey: false, text: 'Your AI provider rejected your key. Check it in Settings → AI.' })
  // A detail mentioning "key" doesn't override the code.
  assert.equal(sendFailureNotice({ message: 'Pick a model.', code: 'MODEL_MISMATCH', detail: 'Error: key thing' }, false).noKey, false)
  for (const code of ['MODEL_MISMATCH', 'UNSUPPORTED_PROVIDER', 'COST_CAP_EXCEEDED', 'RATE_LIMITED', 'AI_ERROR']) {
    const n = sendFailureNotice({ message: `msg ${code}`, code }, false)
    assert.deepEqual(n, { noKey: false, text: `msg ${code}` }, code)
  }
})

test('an uncoded error keeps the old guess (message NO_KEY, or a detail about a key)', () => {
  assert.equal(sendFailureNotice({ message: 'NO_KEY' }, true).noKey, true)
  assert.equal(sendFailureNotice({ message: 'x', detail: 'Missing API key' }, true).noKey, true)
  assert.deepEqual(sendFailureNotice({ message: 'Server busy' }, true), { noKey: false, text: 'Server busy' })
  assert.deepEqual(sendFailureNotice(undefined, true), { noKey: false, text: "Liv couldn't reply." })
})

test('the add-key copy only claims "saved" when the backend saved it', () => {
  assert.match(sendFailureNotice({ code: 'NO_KEY', message: 'NO_KEY' }, true).text, /saved either way/)
  assert.match(sendFailureNotice({ code: 'NO_KEY', message: 'NO_KEY' }, false).text, /tap Retry/)
  // A code with the NO_KEY sentinel as its message never shows the raw sentinel.
  assert.equal(sendFailureNotice({ code: 'X', message: 'NO_KEY' }, false).text, "Liv couldn't reply.")
})

test('sentMessageSaved: a NEW user message with the sent text', () => {
  const before = new Set(['m1'])
  const m = (id: string, role: 'user' | 'liv', content: string) => ({ id, role, modality: 'text', channel: 'app', content })
  assert.equal(sentMessageSaved([m('m1', 'user', 'hi')], before, 'hi'), false) // the old one, not this send
  assert.equal(sentMessageSaved([m('m1', 'user', 'hi'), m('m2', 'user', 'hi')], before, 'hi'), true)
  assert.equal(sentMessageSaved([m('m1', 'user', 'hi'), m('m2', 'liv', 'hi')], before, 'hi'), false)
  assert.equal(sentMessageSaved([], new Set(), 'hi'), false)
})
