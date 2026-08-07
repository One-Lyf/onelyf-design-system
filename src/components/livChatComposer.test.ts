// Run with: node --experimental-strip-types --test src/components/livChatComposer.test.ts
// (or plain `node --test` on a Node version where TS type-stripping is unflagged).
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSendOnEnter } from './livChatComposer.ts'

test('plain Enter sends', () => {
  assert.equal(shouldSendOnEnter('Enter', false, false), true)
})

test('Shift+Enter never sends (newline)', () => {
  assert.equal(shouldSendOnEnter('Enter', true, false), false)
  assert.equal(shouldSendOnEnter('Enter', true, true), false)
})

test('Enter that confirms an IME composition does not send — the bug this fixes', () => {
  // Before the fix this returned true, so confirming a Japanese/Chinese/Korean
  // candidate via Enter submitted the message mid-composition and cut it off.
  assert.equal(shouldSendOnEnter('Enter', false, true), false)
})

test('non-Enter keys never send', () => {
  assert.equal(shouldSendOnEnter('a', false, false), false)
  assert.equal(shouldSendOnEnter('Tab', false, false), false)
})
