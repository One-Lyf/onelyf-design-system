// Generate a clean, curve-based Liv glyph for animated and small-size surfaces.
//
//   node scripts/gen-glyph.mjs           # print the parts
//   node scripts/gen-glyph.mjs --json
//
// Authorised by the 2026-09-17 ruling in onelyf-planning/docs/liv-motion-canon.md:
// the shipped glyph assets are autotraced polylines (55,863-char `d`, 3,461 `L`
// commands, zero curves) — unanimatable, and mud below ~32 px. This is a
// FAITHFUL REDRAW of that silhouette in clean beziers, not a new mark. Standing
// law: never invent an L/dot/spark mark for Liv. Jeff reviews this against the
// traced original before it represents Liv anywhere.
//
// What the traced original actually contains, read off a 300px render:
//   - an interlaced vesica rosette: pointed leaf/strand lobes on the compass
//     points, drawn as OUTLINES (open centres), not solid shapes
//   - a tall central spine running top to bottom, with a small looped finial
//     at each end
//   - dendritic ROOTS descending and spreading from the lower half — these are
//     the mycelial hyphae, already part of the mark
//   - the amber core glow at the centre
// The roots are what animates; the ornament stays still (brand brief §8).

const n = v => Math.round(v * 100) / 100
const CX = 50, CY = 50

// ── vesica lobe ─────────────────────────────────────────────────────────────
// A pointed leaf along `angle`, from inner radius r0 out to r1, bulging to
// half-width w at its midpoint. Two quadratics, closed — the shape the rosette
// is built from.
function lobe(angle, r0, r1, w) {
  const ca = Math.cos(angle), sa = Math.sin(angle)
  const px = -sa, py = ca                       // perpendicular
  const at = r => [CX + ca * r, CY + sa * r]
  const [bx, by] = at(r0)
  const [tx, ty] = at(r1)
  const mr = (r0 + r1) / 2
  const [mx, my] = at(mr)
  const c1 = [mx + px * w, my + py * w]
  const c2 = [mx - px * w, my - py * w]
  // control points pushed out so the quadratics actually reach the bulge
  const k = 1.34
  const q1 = [mx + px * w * k, my + py * w * k]
  const q2 = [mx - px * w * k, my - py * w * k]
  return `M${n(bx)} ${n(by)} Q${n(q1[0])} ${n(q1[1])} ${n(tx)} ${n(ty)}`
       + ` Q${n(q2[0])} ${n(q2[1])} ${n(bx)} ${n(by)} Z`
       + (c1 && c2 ? '' : '')
}

// ── the still ornament ──────────────────────────────────────────────────────
// Four cardinal lobes and four shorter diagonals, as in the traced rosette.
export function ornament() {
  const out = []
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k / 4) * Math.PI * 2
    out.push({ id: `lobe-card-${k}`, cls: 'liv-lobe', d: lobe(a, 6, 30, 9) })
  }
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + Math.PI / 4 + (k / 4) * Math.PI * 2
    out.push({ id: `lobe-diag-${k}`, cls: 'liv-lobe liv-lobe-sm', d: lobe(a, 5, 22, 6.5) })
  }
  // central spine — a tall narrow vesica, the mark's vertical axis
  out.push({ id: 'spine', cls: 'liv-spine', d: lobe(-Math.PI / 2, -34, 34, 4.6) })
  // looped finials top and bottom
  for (const s of [-1, 1]) {
    const y = CY + s * 36
    out.push({
      id: `finial-${s > 0 ? 'b' : 't'}`, cls: 'liv-finial',
      d: `M${CX} ${n(y)} C${n(CX - 3.4)} ${n(y + s * 3.2)} ${n(CX - 3.4)} ${n(y + s * 8)} ${CX} ${n(y + s * 9.6)}`
       + ` C${n(CX + 3.4)} ${n(y + s * 8)} ${n(CX + 3.4)} ${n(y + s * 3.2)} ${CX} ${n(y)} Z`,
    })
  }
  return out
}

// ── the roots (the animated hyphae) ─────────────────────────────────────────
// Dendritic, spreading outward with a downward bias, exactly as the traced mark
// does. Deterministic: no rng at all, so the mark is byte-stable.
function rootPath(a0, len, spread, depth, curve) {
  // one smooth arc from the core outward, bending by `curve` radians
  const pts = []
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = a0 + curve * t * t
    const r = 7 + len * t
    pts.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r])
  }
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    d += ` Q${n(x1)} ${n(y1)} ${n((x1 + x2) / 2)} ${n((y1 + y2) / 2)}`
  }
  const last = pts[pts.length - 1]
  d += ` T${n(last[0])} ${n(last[1])}`
  return { d, tipAngle: a0 + curve, tip: last }
}

// Root fan: more roots below the axis than above, which is what makes it read
// as a root system rather than a starburst.
const ROOTS = [
  // angle (rad, 0 = east, +y = down), length, curve
  [Math.PI * 0.62, 40, 0.30], [Math.PI * 0.38, 40, -0.30],
  [Math.PI * 0.78, 36, 0.34], [Math.PI * 0.22, 36, -0.34],
  [Math.PI * 0.95, 30, 0.30], [Math.PI * 0.05, 30, -0.30],
  [Math.PI * 0.50, 34, 0.00],
  [Math.PI * 1.15, 24, 0.26], [Math.PI * 1.85, 24, -0.26],
]

export function roots() {
  const out = []
  ROOTS.forEach(([a, len, curve], i) => {
    const r = rootPath(a, len, 0, 2, curve)
    out.push({ id: `root-${i}`, cls: 'liv-root', d: r.d })
    // one fork per root, two-thirds out, alternating side
    const side = i % 2 ? 1 : -1
    const forkA = a + curve * 0.44 + side * 0.44
    const fx = CX + Math.cos(a + curve * 0.44) * (7 + len * 0.66)
    const fy = CY + Math.sin(a + curve * 0.44) * (7 + len * 0.66)
    const fl = len * 0.36
    const ex = fx + Math.cos(forkA) * fl, ey = fy + Math.sin(forkA) * fl
    const mx = fx + Math.cos(forkA - side * 0.2) * fl * 0.55
    const my = fy + Math.sin(forkA - side * 0.2) * fl * 0.55
    out.push({ id: `fork-${i}`, cls: 'liv-root liv-fork', d: `M${n(fx)} ${n(fy)} Q${n(mx)} ${n(my)} ${n(ex)} ${n(ey)}` })
  })
  return out
}

if (process.argv[1] && process.argv[1].endsWith('gen-glyph.mjs')) {
  const all = { ornament: ornament(), roots: roots() }
  if (process.argv.includes('--json')) console.log(JSON.stringify(all, null, 2))
  else {
    for (const p of all.ornament) console.log(`${p.id}\t${p.cls}\t${p.d}`)
    for (const p of all.roots) console.log(`${p.id}\t${p.cls}\t${p.d}`)
  }
}
