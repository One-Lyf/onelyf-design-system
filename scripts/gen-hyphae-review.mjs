// Build the motion review harness for the Liv thinking spinner.
//
//   node scripts/gen-hyphae-review.mjs      # -> playground/livthinking-review.html
//
// Motion cannot be judged from a still, and it cannot be judged from source at
// all. This emits a page that renders each treatment frozen at five phases of
// its loop, on both grounds, plus a live cell and a real-size row.
//
// Freezing works by pausing every animation and pushing each cell backwards in
// time with a negative delay. The delay has to land on the animated elements
// themselves (the paths), not the <svg>, so each cell sets a --phase custom
// property and every path computes calc(var(--d) - var(--phase)).
import { writeFileSync } from 'node:fs'
import { threads, BOX } from './gen-hyphae.mjs'

const T = threads()
const GOLD = '#c08a14', GOLD_DARK = '#d8a83c'
// GLOW_R is a core, not a sun. The glyph's own ratio (149 of 549 ≈ 27%) makes a
// ball that swallows the threads at spinner sizes, so the core is pulled in and
// the outer stops fade sooner.
const CX = 50, CY = 50, GLOW_R = 15
const PHASES = [0, 0.15, 0.3, 0.5, 0.7, 0.85]
const DUR = 3.2   // seconds, one full grow+retract cycle

// pathLength="1" normalises every thread regardless of its real length, so one
// keyframe set drives all 14 and they finish together instead of raggedly.
// Stagger via --d so the network wakes outward rather than all at once.
// Stagger kept small on purpose: at 0.075s x 7 the threads were far enough out
// of step that the loop stopped reading as one gesture and looked like noise.
const paths = extra => T.map((t, i) => {
  const isP = t.tier === 'primary'
  const delay = (isP ? 0 : 0.1) + (i % 7) * 0.03
  return `<path class="${extra} ${isP ? 'p' : 'b'}" pathLength="1" style="--d:${delay.toFixed(3)}s" d="${t.d}"/>`
}).join('')

const glow = id => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${GLOW_R}">`
  + `<stop offset="0%" stop-color="#fffaf0"/><stop offset="24%" stop-color="#ffd35e" stop-opacity=".92"/>`
  + `<stop offset="55%" stop-color="#e89a1c" stop-opacity=".45"/><stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>`
  + `</radialGradient>`

// Geometry is identical across all three treatments — only the animation
// differs, which is exactly the comparison being asked for.
const CSS = `
.hy { overflow: visible; --phase: 0s; }
.hy path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.hy .p { stroke-width: 2.1; }
.hy .b { stroke-width: 1.3; }

/* A · GROW & RETRACT — the literal ask.
   1 -> 0 -> 1, NOT 1 -> 0 -> -1. Going negative slides the dash off the far end,
   so the thread travels away instead of withdrawing; the retract has to walk the
   offset back the way it came. Start and end are identical, so the loop is seamless. */
.A path { stroke: ${GOLD}; stroke-dasharray: 1 1; animation: growRetract ${DUR}s ease-in-out infinite; }
@keyframes growRetract {
  0%   { stroke-dashoffset: 1; opacity: .2; }
  42%  { stroke-dashoffset: 0; opacity: 1;  }
  58%  { stroke-dashoffset: 0; opacity: 1;  }
  100% { stroke-dashoffset: 1; opacity: .2; }
}

/* B · ILLUMINATE — brand brief §8: "paths illuminate; energy gathers" */
.B .rail  { stroke: ${GOLD}; opacity: .18; }
.B .spark { stroke: ${GOLD}; stroke-dasharray: .18 .82; animation: travel ${DUR}s linear infinite; }
@keyframes travel {
  0%   { stroke-dashoffset: 1; opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}

/* C · HYBRID — grow out, light gathers along them, retract */
.C .rail { stroke: ${GOLD}; stroke-dasharray: 1 1; animation: cRail ${DUR}s ease-in-out infinite; }
@keyframes cRail {
  0%   { stroke-dashoffset: 1; opacity: .18; }
  32%  { stroke-dashoffset: 0; opacity: .55; }
  68%  { stroke-dashoffset: 0; opacity: .55; }
  100% { stroke-dashoffset: 1; opacity: .18; }
}
.C .spark { stroke: #ffd35e; stroke-dasharray: .14 .86; animation: cSpark ${DUR}s linear infinite; }
@keyframes cSpark {
  0%, 30%   { stroke-dashoffset: 1; opacity: 0; }
  40%       { opacity: 1; }
  60%       { opacity: 1; }
  70%, 100% { stroke-dashoffset: 0; opacity: 0; }
}

/* core breathe, shared */
.core { animation: breathe ${DUR}s ease-in-out infinite; transform-origin: ${CX}px ${CY}px; }
@keyframes breathe { 0%,100%{ transform: scale(.92); opacity:.75 } 50%{ transform: scale(1.06); opacity:1 } }

.dark .A path, .dark .B .rail, .dark .B .spark, .dark .C .rail { stroke: ${GOLD_DARK}; }

/* MUST come last. Every treatment above sets the \`animation\` SHORTHAND, which
   resets animation-delay AND animation-fill-mode — so these longhands have to
   win on source order.
   fill-mode:both is load-bearing, not tidiness: during a POSITIVE stagger delay
   an un-filled element renders its BASE style (stroke-dashoffset:0 = fully
   drawn), so the threads flash complete for the first ~130ms on mount and every
   frozen cell at phase 0 renders wrong. */
.hy path, .hy .core {
  animation-delay: calc(var(--d, 0s) - var(--phase));
  animation-fill-mode: both;
}
`

const svgFor = (treat, key, phase) => `
  <svg class="hy ${treat}" viewBox="0 0 ${BOX} ${BOX}" style="--phase:${(phase * DUR).toFixed(3)}s">
    <defs>${glow(key)}</defs>
    ${treat === 'A' ? paths('') : paths('rail') + paths('spark')}
    <circle class="core" cx="${CX}" cy="${CY}" r="${GLOW_R}" fill="url(#${key})"/>
  </svg>`

// glyph:true layers the canonical traced glyph over the network. Worth testing
// both ways: at 24-44 px a 3,461-point trace is mud, and the threads plus the
// amber core may already BE the Liv mark.
const stage = (treat, key, phase, px, glyph = true) =>
  `<div class="stage" style="width:${px}px;height:${px}px">${svgFor(treat, key, phase)}`
  + (glyph ? `<img class="glyph" src="/src/assets/glyph-live.svg" alt=""/>` : '')
  + `</div>`

const cell = (treat, gnd, phase, i) => `
  <div class="cell">${stage(treat, `g-${treat}-${gnd}-${i}`, phase, 120)}
    <span class="cap">${Math.round(phase * 100)}%</span></div>`

const row = (treat, name, gnd) => `
  <h3>${name} <em>&mdash; ${gnd} ground</em></h3>
  <div class="row ${gnd}">
    ${PHASES.map((p, i) => cell(treat, gnd, p, i)).join('')}
    <div class="cell"><div class="stage run" style="width:120px;height:120px">
      ${svgFor(treat, `g-live-${treat}-${gnd}`, 0)}
      <img class="glyph" src="/src/assets/glyph-live.svg" alt=""/>
    </div><span class="cap">live</span></div>
  </div>`

// The sizes this actually ships at. Threads that vanish here are a defect.
const SIZES = [96, 64, 44, 32, 24]
const sizeRow = (treat, glyph, note) => `
  <h3>${treat} &mdash; real sizes, ${note}</h3>
  <div class="row light">
    ${SIZES.map((s, i) => `<div class="cell">${stage(treat, `g-sz-${treat}-${glyph ? 'g' : 'n'}-${i}`, 0.45, s, glyph)}<span class="cap">${s}px</span></div>`).join('')}
  </div>
  <div class="row dark">
    ${SIZES.map((s, i) => `<div class="cell">${stage(treat, `g-szd-${treat}-${glyph ? 'g' : 'n'}-${i}`, 0.45, s, glyph)}<span class="cap">${s}px</span></div>`).join('')}
  </div>`

const html = `<!doctype html><meta charset="utf-8"><title>LivThinking — motion review</title>
<style>
  body{margin:0;padding:24px;background:#2a2a28;color:#e8e4d6;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  h1{font:600 20px/1.2 Fraunces,Georgia,serif;margin:0 0 2px}
  .sub{opacity:.6;margin:0 0 18px;max-width:70ch}
  h3{font:600 12px/1 system-ui;letter-spacing:.07em;text-transform:uppercase;opacity:.55;margin:22px 0 8px}
  h3 em{font-style:normal;opacity:.7}
  .row{display:flex;gap:12px;padding:14px;border-radius:10px;flex-wrap:wrap;align-items:flex-end}
  .row.light{background:#f4efe1}.row.dark{background:#171b16}
  .cell{display:flex;flex-direction:column;align-items:center;gap:6px}
  .stage{position:relative}
  .stage .hy{position:absolute;inset:0;width:100%;height:100%}
  .stage .glyph{position:absolute;left:50%;top:50%;width:33%;transform:translate(-50%,-52%);opacity:.95}
  .cap{font-size:10px;opacity:.55}
  .row.light .cap{color:#1c2b21}.row.dark .cap{color:#e8e4d6}
  /* freeze everything except the cells marked .run */
  .stage:not(.run) .hy *{animation-play-state:paused!important}
${CSS}
</style>
<h1>LivThinking — hyphae motion review</h1>
<p class="sub">Three treatments over identical geometry, frozen at ${PHASES.map(p => Math.round(p * 100) + '%').join(' / ')} of a ${DUR}s loop, plus a live cell. 14 threads: 7 primaries (one per OneLyf space) and 7 branches.</p>
${row('A', 'A &middot; grow &amp; retract', 'light')}
${row('A', 'A &middot; grow &amp; retract', 'dark')}
${row('B', 'B &middot; illuminate (brief §8)', 'light')}
${row('B', 'B &middot; illuminate (brief §8)', 'dark')}
${row('C', 'C &middot; hybrid — grow, gather, retract', 'light')}
${row('C', 'C &middot; hybrid — grow, gather, retract', 'dark')}
${sizeRow('A', true, 'WITH the canonical traced glyph over the network')}
${sizeRow('A', false, 'threads + amber core only, NO traced glyph')}
`

writeFileSync(new URL('../playground/livthinking-review.html', import.meta.url), html)
console.log('wrote playground/livthinking-review.html')
console.log(`${T.length} threads · ${PHASES.length} phases x 3 treatments x 2 grounds · sizes ${SIZES.join('/')}`)
