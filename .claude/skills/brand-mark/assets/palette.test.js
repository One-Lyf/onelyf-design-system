// Guards the two things that silently rot: the palette drifting from tokens.ts,
// and lint() either waving off-brand colour through or flagging legitimate
// tints. Run by the repo's `npm test` (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { color, colorDark, spaces, ground, contrast, ramp, lint } from './palette.js'
import { svg, wobPath, smoothPath, rng, ellPts } from './marks.js'

const wrap = fill => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="${fill}"/></svg>`

test('palette is wired to the real tokens, not a copy', () => {
  assert.equal(color.gold, '#c08a14', 'Liv accent gold')
  assert.equal(color.goldDeep, '#8a630e', 'text-safe gold')
  assert.equal(spaces.homlyf.accent, '#bf6b49', 'the only sanctioned orange')
  assert.equal(ground.light.paper, color.bg)
  assert.equal(ground.dark.ink, colorDark.ink)
})

test('contrast matches the ratios tokens.ts documents', () => {
  // tokens.ts claims goldDeep clears 4.5:1 on bg and plain gold does not.
  assert.ok(contrast(color.goldDeep, color.bg) >= 4.5, 'goldDeep clears AA on cream')
  assert.ok(contrast(color.gold, color.bg) < 4.5, 'plain gold does not clear AA on cream')
  assert.ok(contrast(color.ink, color.bg) > 10, 'ink is strong on cream')
})

test('ink on dark ground is the trap the sheet exists to catch', () => {
  assert.ok(contrast(color.ink, colorDark.bg) < 1.5,
    'light-mode ink is effectively invisible on dark bg — marks must swap to chalk')
  assert.ok(contrast(colorDark.ink, colorDark.bg) > 10, 'chalk reads on dark')
})

test('lint passes tokens and their tints and shades', () => {
  for (const c of [color.gold, color.goldDeep, color.ink, color.primary, spaces.homlyf.accent, spaces.gudlyf.accent]) {
    assert.deepEqual(lint(wrap(c)), [], `token ${c} should pass`)
  }
  for (const step of ramp(color.gold, 7)) {
    assert.deepEqual(lint(wrap(step)), [], `tint/shade ${step} of gold should pass`)
  }
  for (const step of ramp(colorDark.gold, 5)) {
    assert.deepEqual(lint(wrap(step)), [], `tint/shade ${step} of dark gold should pass`)
  }
})

test('lint flags saturated off-brand colour', () => {
  for (const c of ['#ff00ff', '#00ffff', '#7a2fd6', '#635bff', '#4a154b', '#e01b24', '#ff6a00']) {
    assert.ok(lint(wrap(c)).length > 0, `${c} should be flagged`)
  }
})

test('lint flags structural mistakes', () => {
  assert.ok(lint('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"></svg>')
    .some(m => /hard width\/height/.test(m)), 'hard dimensions')
  assert.ok(lint('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    .some(m => /viewBox/.test(m)), 'missing viewBox')
  assert.ok(lint('<svg viewBox="0 0 8 8"><text>\u{1F600}</text></svg>')
    .some(m => /emoji/.test(m)), 'emoji')
})

test('svg() emits a scalable root that passes its own lint', () => {
  const out = svg('<circle cx="5" cy="5" r="4" fill="' + color.gold + '"/>', { w: 10, h: 10, title: 'x' })
  assert.match(out, /viewBox="0 0 10 10"/)
  assert.doesNotMatch(out.slice(0, out.indexOf('>') + 1), /\swidth="\d/)
  assert.deepEqual(lint(out), [])
})

test('drawing is deterministic — the same seed gives the same path', () => {
  const pts = ellPts(50, 50, 40, 40, 0, 24)
  assert.equal(wobPath(pts, 2, 7), wobPath(pts, 2, 7), 'wobPath is stable')
  assert.notEqual(wobPath(pts, 2, 7), wobPath(pts, 2, 8), 'a different seed is a different shape')
  assert.equal(smoothPath(pts, 2, 7), smoothPath(pts, 2, 7), 'smoothPath is stable')
  const a = rng(3), b = rng(3)
  assert.equal(a(), b(), 'rng is reproducible')
})
