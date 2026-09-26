// Run with: node --test src/emblems.test.ts
// The generated emblems and mark must stay in step with the tokens: one file per branch, each
// patch on its token accent, the ring in branchOrder, and no Family seat (Family is a tier).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spaces, branchOrder } from './tokens.ts'

const dir = new URL('./assets/emblems/', import.meta.url)

test('one emblem per branch, and only those', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.replace('.svg', '')).sort()
  assert.deepEqual(files, [...branchOrder].sort())
})

test('each emblem sits on its token accent', () => {
  for (const k of branchOrder) {
    const svg = readFileSync(new URL(`${k}.svg`, dir), 'utf8')
    assert.match(svg, new RegExp(`<circle[^>]*fill="${spaces[k].accent}"`, 'i'), `${k} disc is not ${spaces[k].accent}`)
  }
})

test('branch ring: seven branches, Family is a tier not a seat', () => {
  assert.equal(branchOrder.length, 7)
  assert.ok(!(branchOrder as string[]).includes('family'))
  assert.equal(spaces.waves.label, 'Waves')
})

test('the mark seats every branch accent, in ring order', () => {
  for (const f of ['onelyf-mark-light.svg', 'onelyf-mark-dark.svg', 'onelyf-app-icon.svg']) {
    const svg = readFileSync(new URL(`./assets/${f}`, import.meta.url), 'utf8')
    const seats = [...svg.matchAll(/<circle cx="[^"]+" cy="[^"]+" r="51\.2" fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase())
    assert.deepEqual(seats, branchOrder.map((k) => spaces[k].accent.toLowerCase()), f)
  }
})
