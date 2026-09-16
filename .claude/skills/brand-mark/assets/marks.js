// SVG mark vocabulary — the texture and line quality that separates "designed"
// from "clipart". Pure functions returning SVG markup strings; no DOM, no canvas,
// so a mark builds in plain Node and the .svg file is the deliverable.
//
// Two ways to get a hand-drawn line, and the choice matters:
//   wobPath()    bakes the jitter into the path data. Renders identically
//                everywhere, scales cleanly, survives being opened in Figma.
//                USE THIS FOR LOGOS.
//   roughFilter() displaces the shape live with feTurbulence. Richer, but it is
//                a filter: rasterised per-renderer, ignored by some SVG
//                consumers, and it bloats when flattened. Illustration only.
//
// Everything random is seeded. Math.random is banned in this skill: the same
// brief must produce the same mark, or iteration wanders instead of converging.

// ===================== SEEDED RANDOM =====================
// mulberry32 — same generator the animation skill uses, so seeds behave the same way.
export function rng(seed) {
  let a = (seed * 1000003) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = v => Math.round(v * 100) / 100;   // keep path data readable and small

// ===================== GEOMETRY =====================
export function ellPts(cx, cy, rx, ry, rot = 0, steps = 44) {
  const p = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
    p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return p;
}

export const circPts = (cx, cy, r, steps) => ellPts(cx, cy, r, r, 0, steps);

export function rectPts(x, y, w, h, perSide = 8) {
  const p = [], corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4];
    for (let k = 0; k < perSide; k++) p.push([ax + (bx - ax) * (k / perSide), ay + (by - ay) * (k / perSide)]);
  }
  return p;
}

export function polarPts(cx, cy, spec, steps = 120) {
  const p = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2, r = spec(a);
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}

// ===================== LINE QUALITY =====================
// wobPath: polyline with seeded jitter, emitted as path data. amp 0.5-3 for a
// logo; past ~4 it stops reading as "drawn" and starts reading as "broken".
export function wobPath(pts, amp = 1.5, seed = 1, close = true) {
  const r = rng(seed);
  const d = pts.map(([x, y], i) => {
    const jx = n(x + (r() - 0.5) * amp), jy = n(y + (r() - 0.5) * amp);
    return `${i ? 'L' : 'M'}${jx} ${jy}`;
  }).join(' ');
  return close ? `${d} Z` : d;
}

// smoothPath: same jitter, but through a Catmull-Rom -> cubic conversion, so the
// wobble reads as a drawn curve rather than a chain of short segments. Use for
// organic silhouettes (leaves, petals, the Liv tendril); wobPath for geometry.
export function smoothPath(pts, amp = 1.5, seed = 1, close = true, tension = 1) {
  const r = rng(seed);
  const p = pts.map(([x, y]) => [x + (r() - 0.5) * amp, y + (r() - 0.5) * amp]);
  const at = i => p[close ? (i + p.length) % p.length : Math.max(0, Math.min(p.length - 1, i))];
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  const last = close ? p.length : p.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), k = tension / 6;
    d += ` C${n(p1[0] + (p2[0] - p0[0]) * k)} ${n(p1[1] + (p2[1] - p0[1]) * k)}`
       + ` ${n(p2[0] - (p3[0] - p1[0]) * k)} ${n(p2[1] - (p3[1] - p1[1]) * k)}`
       + ` ${n(p2[0])} ${n(p2[1])}`;
  }
  return close ? `${d} Z` : d;
}

// crayon: one stroke drawn three times at decreasing opacity and increasing
// jitter — a grainy edge without a filter. Returns <path> elements, not path data.
export function crayon(pts, { color = '#1c2b21', width = 3, seed = 1, close = false } = {}) {
  return [0, 1, 2].map(k =>
    `<path d="${wobPath(pts, 1.6 + k * 1.4, seed + k * 7, close)}" fill="none" stroke="${color}" `
    + `stroke-width="${n(width * (k ? 0.7 : 1))}" stroke-linecap="round" stroke-linejoin="round" `
    + `opacity="${k ? 0.32 : 0.9}"/>`
  ).join('');
}

// ===================== DEFS: PATTERNS & FILTERS =====================
// Each returns { id, def } — put every def in one <defs>, reference by id.
// ids must be unique per document; pass an explicit id when using two variants.

// hatch: parallel strokes, the ink finish. angle in degrees.
export function hatchDef(id = 'hatch', { angle = 45, gap = 5, width = 1, color = '#5e6c60', opacity = 0.35 } = {}) {
  return { id, def:
    `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" `
    + `patternTransform="rotate(${angle})">`
    + `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    + `</pattern>` };
}

// crossHatch: two hatches at 90 degrees, for the darker value step.
export function crossHatchDef(id = 'crosshatch', o = {}) {
  const { angle = 45, gap = 5, width = 1, color = '#5e6c60', opacity = 0.35 } = o;
  return { id, def:
    `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" `
    + `patternTransform="rotate(${angle})">`
    + `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    + `<line x1="0" y1="0" x2="${gap}" y2="0" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    + `</pattern>` };
}

// dots: halftone / riso screen. cell is the grid pitch, r the dot radius.
export function dotsDef(id = 'dots', { cell = 6, r = 1.6, color = '#5e6c60', opacity = 0.5, angle = 15 } = {}) {
  return { id, def:
    `<pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" `
    + `patternTransform="rotate(${angle})">`
    + `<circle cx="${n(cell / 2)}" cy="${n(cell / 2)}" r="${r}" fill="${color}" opacity="${opacity}"/>`
    + `</pattern>` };
}

// paperGrain: fine speckle over a fill. Cheap, and the one filter that is safe
// on a logo because it degrades to "slightly noisy" rather than "wrong shape".
export function grainDef(id = 'grain', { amount = 0.9, opacity = 0.16, seed = 3 } = {}) {
  return { id, def:
    `<filter id="${id}" x="0%" y="0%" width="100%" height="100%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${amount}" numOctaves="3" seed="${seed}" result="noise"/>`
    + `<feColorMatrix in="noise" type="saturate" values="0" result="mono"/>`
    + `<feComponentTransfer in="mono" result="grain">`
    + `<feFuncA type="linear" slope="${opacity}" intercept="0"/></feComponentTransfer>`
    + `<feComposite in="grain" in2="SourceGraphic" operator="in" result="masked"/>`
    + `<feBlend in="SourceGraphic" in2="masked" mode="multiply"/>`
    + `</filter>` };
}

// roughFilter: live displacement. Illustration only — see the header note.
export function roughDef(id = 'rough', { amount = 2.4, detail = 0.02, seed = 5 } = {}) {
  return { id, def:
    `<filter id="${id}" x="-12%" y="-12%" width="124%" height="124%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${detail}" numOctaves="4" seed="${seed}" result="warp"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="warp" scale="${amount}" `
    + `xChannelSelector="R" yChannelSelector="G"/>`
    + `</filter>` };
}

// inkBleed: soft dark halo hugging the shape, the way ink sinks into paper.
export function bleedDef(id = 'bleed', { blur = 1.6, spread = 0.6 } = {}) {
  return { id, def:
    `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">`
    + `<feMorphology in="SourceAlpha" operator="dilate" radius="${spread}" result="fat"/>`
    + `<feGaussianBlur in="fat" stdDeviation="${blur}" result="soft"/>`
    + `<feComposite in="soft" in2="SourceAlpha" operator="out" result="ring"/>`
    + `<feFlood flood-color="#000" flood-opacity="0.22" result="c"/>`
    + `<feComposite in="c" in2="ring" operator="in" result="halo"/>`
    + `<feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>`
    + `</filter>` };
}

// ===================== DOCUMENT =====================
// svg: wrap body in a root element. Always sets viewBox and omits width/height
// so the mark scales to its container — a logo with baked pixel dimensions is a bug.
export function svg(body, { w = 512, h = 512, defs = [], title, bg } = {}) {
  const d = defs.length ? `<defs>${defs.map(x => (typeof x === 'string' ? x : x.def)).join('')}</defs>` : '';
  const t = title ? `<title>${title}</title>` : '';
  const b = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"`
    + `${title ? ' aria-label="' + title.replace(/"/g, '&quot;') + '"' : ' aria-hidden="true"'}>`
    + `${t}${d}${b}${body}</svg>`;
}

// group: transform helper, so marks compose without hand-writing transform strings.
export function g(body, { x = 0, y = 0, scale = 1, rotate = 0, opacity, fill, stroke } = {}) {
  const tf = [
    x || y ? `translate(${n(x)} ${n(y)})` : '',
    scale !== 1 ? `scale(${n(scale)})` : '',
    rotate ? `rotate(${n(rotate)})` : '',
  ].filter(Boolean).join(' ');
  const a = [
    tf ? ` transform="${tf}"` : '',
    opacity != null ? ` opacity="${opacity}"` : '',
    fill ? ` fill="${fill}"` : '',
    stroke ? ` stroke="${stroke}"` : '',
  ].join('');
  return `<g${a}>${body}</g>`;
}
