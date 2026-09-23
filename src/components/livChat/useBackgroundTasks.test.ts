// Run with: node --test src/components/livChat/useBackgroundTasks.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { taskPollOutcome } from './useBackgroundTasks.ts'

test('a queued or running task keeps polling', () => {
  assert.equal(taskPollOutcome({ ok: true, status: 'queued' }), 'pending')
  assert.equal(taskPollOutcome({ ok: true, status: 'running' }), 'pending')
})

test('a finished task settles as done or error', () => {
  assert.equal(taskPollOutcome({ ok: true, status: 'done', result: 'hi' }), 'done')
  assert.equal(taskPollOutcome({ ok: true, status: 'error', error: 'boom' }), 'error')
})

test('a task the backend no longer knows (404 not_found) stops polling as an error', () => {
  assert.equal(taskPollOutcome({ ok: false, error: { code: 'not_found', message: 'No such task' } }), 'error')
})

test('any other failed poll is transient and is retried', () => {
  assert.equal(taskPollOutcome({ ok: false, error: { message: 'Network error' } }), 'pending')
  assert.equal(taskPollOutcome({ ok: false }), 'pending')
  assert.equal(taskPollOutcome({ ok: false, error: { code: 'unauthorized' } }), 'pending')
})
