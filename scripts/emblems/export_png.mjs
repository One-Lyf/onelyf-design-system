// Rasterise the woven cut into the PNGs apps ship (home-screen icons, favicons, the social card).
//   python3 scripts/emblems/build.py && node scripts/emblems/export_png.mjs
// Playwright isn't a dependency of this repo (same arrangement as film/render-pw.mjs):
//   PLAYWRIGHT  where to import it from (a package name or a path to its index.mjs); default 'playwright'
//   CHROMIUM    an explicit browser executable, when the bundled one isn't installed
// Each SVG is inlined into the page (not an <img>) so the social card's lettering picks up the
// vendored Fraunces face (fonts/, SIL Open Font License).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const HERE = path.dirname(fileURLToPath(import.meta.url))
const A = path.resolve(HERE, '..', '..', 'src', 'assets')
const OUT = path.join(A, 'icons')
mkdirSync(OUT, { recursive: true })

const font = readFileSync(path.join(HERE, 'fonts', 'fraunces-latin.woff2')).toString('base64')
const JOBS = [
  ...[1024, 512, 192].map((s) => ['onelyf-app-icon-woven.svg', `onelyf-app-icon-${s}.png`, s, s]),
  ['onelyf-app-icon-woven.svg', 'apple-touch-icon.png', 180, 180],
  ...[48, 32, 16].map((s) => ['onelyf-favicon.svg', `favicon-${s}.png`, s, s]),
  [path.join(HERE, 'og-card.svg'), 'og-card.png', 1200, 630],
]

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const page = await browser.newPage()
for (const [src, out, w, h] of JOBS) {
  const svg = readFileSync(path.isAbsolute(src) ? src : path.join(A, src), 'utf8').replace('<svg ', `<svg width="${w}" height="${h}" `)
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<style>@font-face{font-family:Fraunces;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
    html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, out), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
  console.log('wrote icons/' + out)
}
await browser.close()

// favicon.ico: the 16/32/48 PNGs in one ICO (PNG-compressed entries, which every current browser
// and Windows since Vista read), for the /favicon.ico requests that ignore <link rel=icon>.
const sizes = [16, 32, 48]
const pngs = sizes.map((s) => readFileSync(path.join(OUT, `favicon-${s}.png`)))
const head = Buffer.alloc(6 + 16 * sizes.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let offset = head.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3)
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12)
  offset += pngs[i].length
})
writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...pngs]))
console.log('wrote icons/favicon.ico')
