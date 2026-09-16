// Build a mark module into .svg files plus a review sheet.
//
//   node build.mjs <module.js> [--out dir]
//
// The module exports:
//   meta      { name, w, h }
//   variants  () => [{ id, label, svg }]
//
// No browser is involved: the .svg files ARE the deliverable, and the sheet is
// a plain HTML file you look at afterwards. That keeps this working even when
// launching a headless browser from the shell is unavailable.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { lint } from '../assets/palette.js'
import { ground } from '../assets/palette.js'

const argv = process.argv.slice(2)
const modPath = argv.find(a => a.endsWith('.js') || a.endsWith('.mjs'))
if (!modPath) { console.error('usage: node build.mjs <module.js> [--out dir]'); process.exit(2) }
const flag = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }

const mod = await import(pathToFileURL(path.resolve(modPath)).href)
const meta = mod.meta ?? {}
const name = meta.name ?? path.basename(modPath).replace(/\.m?js$/, '')
const outDir = path.resolve(flag('--out') ?? path.join(path.dirname(path.resolve(modPath)), 'out'))
mkdirSync(outDir, { recursive: true })

// A mark is drawn against a ground, and dark ground is not "the same mark on a
// dark card" — ink has to become chalk or the whole thing vanishes. So variants()
// is called once per ground. Modules that ignore the argument get identical cuts,
// which the sheet will then show failing on dark, which is the point.
const cuts = {
  light: mod.variants('light'),
  dark: mod.variants('dark'),
}
for (const [k, v] of Object.entries(cuts)) {
  if (!Array.isArray(v) || !v.length) { console.error(`variants('${k}') returned nothing`); process.exit(1) }
}

// ---- write the artefacts and lint each one against brand canon ----
// Only the light cut is written as the canonical file; the dark cut is written
// alongside with a -dark suffix when it actually differs.
let failures = 0
for (const [i, v] of cuts.light.entries()) {
  writeFileSync(path.join(outDir, `${name}-${v.id}.svg`), v.svg)
  const d = cuts.dark[i]
  if (d && d.svg !== v.svg) writeFileSync(path.join(outDir, `${name}-${v.id}-dark.svg`), d.svg)
  for (const [gnd, s] of [['light', v.svg], ['dark', d?.svg]]) {
    if (!s) continue
    const problems = lint(s, { allow: meta.allowColors ?? [] })
    if (problems.length) {
      failures += problems.length
      console.log(`  ${v.id} (${gnd}): ${problems.length} canon issue(s)`)
      for (const p of problems) console.log(`    - ${p}`)
    }
  }
}

// ---- the review sheet: every variant, both grounds, a scale row, a silhouette ----
// Scale row answers "does it survive a favicon"; silhouette answers "does the
// shape read without colour". Those two kill most bad marks before you ship one.
const SCALES = [128, 64, 32, 24, 16]

// The sheet inlines each SVG many times over. <defs> ids are document-global, so
// without this every copy after the first would resolve url(#hatch) to copy one's
// pattern — and two variants with the same id but different params would render
// identically, hiding the very difference you are reviewing.
let uid = 0
const isolate = svgText => {
  const tag = `i${uid++}`
  const ids = [...svgText.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
  let out = svgText
  for (const id of new Set(ids)) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${tag}-${id}"`)
    out = out.replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${tag}-${id})`)
    out = out.replace(new RegExp(`(href|xlink:href)="#${esc}"`, 'g'), `$1="#${tag}-${id}"`)
  }
  return out
}

const card = (v, gnd) => `
  <figure class="card ${gnd}">
    <div class="big">${isolate(v.svg)}</div>
    <div class="scales">${SCALES.map(s => `<span style="width:${s}px;height:${s}px">${isolate(v.svg)}</span>`).join('')}</div>
    <div class="sil">${isolate(v.svg)}</div>
    <figcaption>${v.id} &middot; ${v.label ?? ''}</figcaption>
  </figure>`

const sheet = `<!doctype html><meta charset="utf-8"><title>${name} — review sheet</title>
<style>
  :root{color-scheme:light}
  body{margin:0;padding:24px;background:#2a2a28;color:#e8e4d6;
       font:13px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  h1{font:600 20px/1.2 'Fraunces',Georgia,serif;margin:0 0 4px}
  .sub{opacity:.65;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .card{margin:0;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px}
  .card.light{background:${ground.light.paper};color:${ground.light.ink}}
  .card.dark{background:${ground.dark.paper};color:${ground.dark.ink}}
  .big{height:180px;display:grid;place-items:center}
  .big svg{width:100%;height:100%;max-width:180px}
  .scales{display:flex;align-items:flex-end;gap:10px;justify-content:center;min-height:36px}
  .scales span{display:inline-block}
  .scales svg{width:100%;height:100%;display:block}
  .sil{height:64px;display:grid;place-items:center}
  .sil svg{width:64px;height:64px;filter:brightness(0) saturate(100%)}
  .card.dark .sil svg{filter:brightness(0) invert(1)}
  figcaption{font-size:11px;opacity:.7;text-align:center;border-top:1px solid currentColor;padding-top:8px;
             border-color:color-mix(in srgb,currentColor 18%,transparent)}
  h2{font:600 13px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;opacity:.5;margin:28px 0 10px}
</style>
<h1>${name}</h1>
<p class="sub">${cuts.light.length} variant(s) &middot; each shown large, at ${SCALES.join('/')} px, and as a silhouette.</p>
<h2>Light ground</h2>
<div class="grid">${cuts.light.map(v => card(v, 'light')).join('')}</div>
<h2>Dark ground</h2>
<div class="grid">${cuts.dark.map(v => card(v, 'dark')).join('')}</div>
`
const sheetPath = path.join(outDir, `${name}-sheet.html`)
writeFileSync(sheetPath, sheet)

console.log(`${name}: ${cuts.light.length} variant(s) x 2 grounds -> ${outDir}`)
console.log(`sheet: ${sheetPath}`)
console.log(failures ? `CANON: ${failures} issue(s) above — fix before delivering` : 'CANON: clean')
process.exit(failures ? 1 : 0)
