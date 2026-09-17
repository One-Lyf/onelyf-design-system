// Side-by-side: the traced original vs the clean redraw, at every size that
// matters, on both grounds. The redraw is NOT allowed to represent Liv until
// Jeff has judged it against the original — this is the page he judges it on.
//
//   node scripts/gen-glyph-review.mjs   # -> playground/_glyph-review.html
import { writeFileSync } from 'node:fs'
import { ornament, roots } from './gen-glyph.mjs'

const O = ornament(), R = roots()
const SIZES = [160, 96, 64, 44, 32, 24]

const clean = (animated = false) => `
<svg viewBox="0 0 100 100" class="cleanglyph${animated ? ' anim' : ''}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cg" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="15">
      <stop offset="0%" stop-color="#fffaf0"/><stop offset="24%" stop-color="#ffd35e" stop-opacity=".92"/>
      <stop offset="55%" stop-color="#e89a1c" stop-opacity=".45"/><stop offset="100%" stop-color="#c08a14" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${R.map((p, i) => `<path class="${p.cls}" pathLength="1" style="--d:${(i * 0.02).toFixed(2)}s" d="${p.d}"/>`).join('')}
  ${O.map(p => `<path class="${p.cls}" d="${p.d}"/>`).join('')}
  <circle class="cg-core" cx="50" cy="50" r="15" fill="url(#cg)"/>
</svg>`

const html = `<!doctype html><meta charset="utf-8"><title>Liv glyph — traced vs clean redraw</title>
<style>
  body{margin:0;padding:24px;background:#2a2a28;color:#e8e4d6;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  h1{font:600 20px/1.2 Fraunces,Georgia,serif;margin:0 0 2px}
  .sub{opacity:.6;margin:0 0 18px;max-width:78ch}
  h3{font:600 12px/1 system-ui;letter-spacing:.07em;text-transform:uppercase;opacity:.55;margin:24px 0 8px}
  .row{display:flex;gap:18px;padding:16px;border-radius:10px;align-items:flex-end;flex-wrap:wrap}
  .light{background:#f4efe1}.dark{background:#171b16}
  .cell{display:flex;flex-direction:column;align-items:center;gap:6px}
  .cap{font-size:10px;opacity:.6}
  .light .cap{color:#1c2b21}.dark .cap{color:#e8e4d6}
  img,svg{display:block}

  .cleanglyph .liv-lobe,.cleanglyph .liv-spine,.cleanglyph .liv-finial{
    fill:none;stroke:#c08a14;stroke-width:2.2;stroke-linejoin:round}
  .cleanglyph .liv-lobe-sm{stroke-width:1.7;opacity:.8}
  .cleanglyph .liv-spine{stroke-width:2}
  .cleanglyph .liv-root{fill:none;stroke:#c08a14;stroke-width:1.9;stroke-linecap:round}
  .cleanglyph .liv-fork{stroke-width:1.2;opacity:.85}
  .dark .cleanglyph .liv-lobe,.dark .cleanglyph .liv-spine,.dark .cleanglyph .liv-finial,
  .dark .cleanglyph .liv-root{stroke:#d8a83c}

  .anim .liv-root{stroke-dasharray:1 1;animation:grow 3.2s ease-in-out infinite;animation-delay:var(--d,0s);animation-fill-mode:both}
  @keyframes grow{0%{stroke-dashoffset:1;opacity:.2}42%{stroke-dashoffset:0;opacity:1}58%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:1;opacity:.2}}
</style>
<h1>Liv glyph — traced original vs clean redraw</h1>
<p class="sub">Left of each pair is the shipped autotraced asset (55,863-char <code>d</code>, 3,461 L commands, zero curves).
Right is the curve redraw. <strong>This is a faithful-redraw check, not a new mark</strong> — judge whether the redraw
still reads as Liv, especially at 32 and 24 px where the traced one turns to mud.</p>

${['light', 'dark'].map(g => `
<h3>traced original &mdash; ${g}</h3>
<div class="row ${g}">
  ${SIZES.map(s => `<div class="cell"><img src="/src/assets/glyph-live.svg" width="${s}" height="${s}"><span class="cap">${s}px</span></div>`).join('')}
</div>
<h3>clean redraw &mdash; ${g}</h3>
<div class="row ${g}">
  ${SIZES.map(s => `<div class="cell"><div style="width:${s}px;height:${s}px">${clean()}</div><span class="cap">${s}px</span></div>`).join('')}
</div>`).join('')}

<h3>clean redraw &mdash; roots animating (the thinking state)</h3>
<div class="row light">
  ${[160, 96, 64, 44].map(s => `<div class="cell"><div style="width:${s}px;height:${s}px">${clean(true)}</div><span class="cap">${s}px</span></div>`).join('')}
</div>
<div class="row dark">
  ${[160, 96, 64, 44].map(s => `<div class="cell"><div style="width:${s}px;height:${s}px">${clean(true)}</div><span class="cap">${s}px</span></div>`).join('')}
</div>
`

writeFileSync(new URL('../playground/_glyph-review.html', import.meta.url), html)
console.log('wrote playground/_glyph-review.html')
console.log(`${O.length} ornament parts, ${R.length} root parts`)
