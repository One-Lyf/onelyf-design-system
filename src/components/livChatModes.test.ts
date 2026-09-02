// Run with: node --test src/components/livChatModes.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EFFORT_LEVELS, DEFAULT_EFFORT, isEffort, effortIndex, effortAtIndex,
  MODES, DEFAULT_MODE, isMode,
} from './livChatModes.ts'

test('effort ladder is the Anthropic-native low→max order', () => {
  assert.deepEqual(EFFORT_LEVELS.map((e) => e.id), ['low', 'medium', 'high', 'xhigh', 'max'])
})

test('isEffort accepts valid ids, rejects everything else', () => {
  assert.ok(isEffort('xhigh'))
  assert.ok(isEffort(DEFAULT_EFFORT))
  assert.ok(!isEffort('extreme'))
  assert.ok(!isEffort(''))
  assert.ok(!isEffort(3))
  assert.ok(!isEffort(null))
})

test('effortIndex maps ids to slider positions; unknown → default position', () => {
  assert.equal(effortIndex('low'), 0)
  assert.equal(effortIndex('max'), 4)
  assert.equal(effortIndex('high'), 2)
  assert.equal(effortIndex('bogus'), 2) // DEFAULT_EFFORT is 'high' → index 2
  assert.equal(effortIndex(undefined), 2)
})

test('effortAtIndex clamps out-of-range + non-finite indices to the ladder', () => {
  assert.equal(effortAtIndex(0), 'low')
  assert.equal(effortAtIndex(4), 'max')
  assert.equal(effortAtIndex(-3), 'low')
  assert.equal(effortAtIndex(99), 'max')
  assert.equal(effortAtIndex(1.6), 'high') // rounds to 2
  assert.equal(effortAtIndex(NaN), 'low')
})

test('effort index round-trips through the ladder', () => {
  for (const { id } of EFFORT_LEVELS) {
    assert.equal(effortAtIndex(effortIndex(id)), id)
  }
})

test('modes are exactly auto/plan/manual with the confirmed Auto boundary in the hint', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['auto', 'plan', 'manual'])
  const auto = MODES.find((m) => m.id === 'auto')!
  // The hint must state the hard safety boundary Jeff signed off on.
  assert.match(auto.hint, /reversible/i)
  assert.match(auto.hint, /money|confirm/i)
})

test('DEFAULT_MODE is the safe one (manual)', () => {
  assert.equal(DEFAULT_MODE, 'manual')
})

test('isMode accepts valid ids, rejects everything else', () => {
  assert.ok(isMode('auto'))
  assert.ok(isMode('plan'))
  assert.ok(isMode('manual'))
  assert.ok(!isMode('yolo'))
  assert.ok(!isMode(null))
})
