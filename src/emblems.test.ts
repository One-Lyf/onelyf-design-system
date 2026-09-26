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
  for (const f of ['onelyf-mark-light.svg', 'onelyf-mark-dark.svg', 'onelyf-app-icon.svg', 'onelyf-mark-woven-light.svg', 'onelyf-mark-woven-dark.svg']) {
    const svg = readFileSync(new URL(`./assets/${f}`, import.meta.url), 'utf8')
    const seats = [...svg.matchAll(/<circle cx="[^"]+" cy="[^"]+" r="51\.2" fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase())
    assert.deepEqual(seats, branchOrder.map((k) => spaces[k].accent.toLowerCase()), f)
  }
})

test('the favicon seats every branch accent, in ring order', () => {
  const svg = readFileSync(new URL('./assets/onelyf-favicon.svg', import.meta.url), 'utf8')
  const dots = [...svg.matchAll(/<circle cx="[^"]+" cy="[^"]+" r="[^"]+" fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase())
  assert.deepEqual(dots, branchOrder.map((k) => spaces[k].accent.toLowerCase()))
})

test('woven cut: scalable, token-only thread, and the PNG exports exist', () => {
  const lockups = ['horizontal-light', 'horizontal-dark', 'stacked-light', 'stacked-dark'].map((v) => `lockups/onelyf-lockup-${v}.svg`)
  for (const f of ['onelyf-mark-woven-light.svg', 'onelyf-mark-woven-dark.svg', 'onelyf-app-icon-woven.svg', 'onelyf-favicon.svg', ...lockups]) {
    const svg = readFileSync(new URL(`./assets/${f}`, import.meta.url), 'utf8')
    assert.match(svg.slice(0, svg.indexOf('>')), /viewBox=/, f)
    assert.doesNotMatch(svg.slice(0, svg.indexOf('>')), /\b(width|height)=/, `${f} root must scale`)
    assert.ok(svg.length < 250_000, `${f} is ${svg.length} bytes (budget 250 KB)`)
  }
  const icons = readdirSync(new URL('./assets/icons/', import.meta.url)).sort()
  for (const f of ['apple-touch-icon.png', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'og-card.png',
    'onelyf-app-icon-1024.png', 'onelyf-app-icon-192.png', 'onelyf-app-icon-512.png']) assert.ok(icons.includes(f), f)
})

test('the lockups carry no live text (outlined, so no font is needed)', () => {
  for (const v of ['horizontal-light', 'horizontal-dark', 'stacked-light', 'stacked-dark']) {
    const svg = readFileSync(new URL(`./assets/lockups/onelyf-lockup-${v}.svg`, import.meta.url), 'utf8')
    assert.doesNotMatch(svg, /<text/, v)
  }
})

test('build.py never rewrites the persistent emblems or flat marks', () => {
  const src = readFileSync(new URL('../scripts/emblems/build.py', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /onelyf-mark-(light|dark)\.svg|onelyf-app-icon\.svg|disc_svg|'emblems'/)
})

test('tagline is the canonical Title Case line', async () => {
  const src = readFileSync(new URL('./components/SpaceEmblem.tsx', import.meta.url), 'utf8')
  assert.match(src, /ONELYF_TAGLINE = 'Many Spaces, Woven Together'/)
})
