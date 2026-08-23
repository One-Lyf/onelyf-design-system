// Run with: node --test  (Node strips TS types)
// Dashboard tile-order reconciliation — the canonical mergeOrder rules, ported from Tummyful
// where the pattern originated. Pin down that a NEW tile that ships at the top lands at the top
// of an existing saved order (not appended), the user's arranged order survives as a
// subsequence, garbage falls back to default, and stale/dupe ids are dropped.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeOrder } from './useTileReorder.ts'

const DEF = ['pendingReview', 'netWorth', 'household', 'bills', 'expectedIncome', 'cashflow']

test('a new top tile lands at the top of an existing saved order, not the bottom', () => {
  const saved = ['netWorth', 'household', 'bills', 'expectedIncome', 'cashflow']
  assert.deepEqual(mergeOrder(saved, DEF), DEF)
})

test("the user's customized order is preserved as a subsequence around new tiles", () => {
  const saved = ['cashflow', 'netWorth', 'bills']
  const out = mergeOrder(saved, DEF)
  const positions = saved.map((id) => out.indexOf(id))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  assert.equal(out[0], 'pendingReview')
  assert.deepEqual([...out].sort(), [...DEF].sort())
})

test('no saved order falls back to the shipped default', () => {
  assert.deepEqual(mergeOrder([], DEF), DEF)
  assert.deepEqual(mergeOrder(null, DEF), DEF)
  assert.deepEqual(mergeOrder('nonsense', DEF), DEF)
})

test('stale ids are dropped and every current tile still appears exactly once', () => {
  const saved = ['netWorth', 'retiredTile', 'netWorth', 'cashflow']
  const out = mergeOrder(saved, DEF)
  assert.equal(out.includes('retiredTile'), false)
  assert.deepEqual([...out].sort(), [...DEF].sort())
  assert.equal(new Set(out).size, out.length)
})
