// Run with: node --test src/livRoots.test.ts
// The Liv glyph's roots (scripts/gen-liv-roots.mjs) must stay in the glyph's box and out of its crown,
// the static asset and LivGlyphGrow's data must come from the same run, and every strand must finish
// growing inside the one animation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LIV_ROOTS } from './livRoots.ts'

const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
const points = (d: string) => { const n = nums(d), p: [number, number][] = []; for (let i = 0; i < n.length; i += 2) p.push([n[i], n[i + 1]]); return p }

test('roots stay inside the 549 x 748 box and below the crown', () => {
  assert.ok(LIV_ROOTS.length > 20)
  for (const r of LIV_ROOTS) for (const [x, y] of points(r.o)) {
    assert.ok(x >= 0 && x <= 549 && y <= 748, `point ${x},${y} outside the box`)
    assert.ok(y >= 435, `point ${x},${y} climbs into the crown`)   // CROWN_BOTTOM: the crown never grows
  }
})

test('glyph-rooted.svg is the live glyph plus exactly these roots', () => {
  const rooted = readFileSync(new URL('./assets/glyph-rooted.svg', import.meta.url), 'utf8')
  const live = readFileSync(new URL('./assets/glyph-live.svg', import.meta.url), 'utf8')
  for (const r of LIV_ROOTS) assert.ok(rooted.includes(`d="${r.o}"`), 'a root in livRoots.ts is missing from glyph-rooted.svg')
  assert.equal((rooted.match(/<path /g) ?? []).length, LIV_ROOTS.length + (live.match(/<path /g) ?? []).length)
})

test('every strand starts after 0 and has finished growing by the end', () => {
  for (const r of LIV_ROOTS) {
    assert.ok(r.s >= 0 && r.g > 0, `bad timing s=${r.s} g=${r.g}`)
    assert.ok(r.s + r.g <= 1.001, `strand still growing at the end: s=${r.s} g=${r.g}`)
  }
  assert.ok(LIV_ROOTS.some((r) => r.s === 0), 'nothing starts at the beginning')
  assert.ok(LIV_ROOTS.some((r) => Math.abs(r.s + r.g - 1) < .002), 'nothing ends at the end')
})
