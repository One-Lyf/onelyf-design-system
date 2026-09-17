// Generate the hyphae thread geometry baked into src/LivThinking.tsx.
//
//   node scripts/gen-hyphae.mjs          # print the paths
//   node scripts/gen-hyphae.mjs --json   # machine-readable
//
// Why a generator and not hand-drawn paths: src/assets/glyph-live.svg is an
// autotraced polyline (a single 55,863-char `d`, 3,461 L commands, zero curve
// commands), so nothing can be stroke-dashed or grown out of it. The threads
// have to be clean curves, and clean curves want to be generated.
//
// rng + smoothPath are lifted from the brand-mark skill's assets/marks.js
// (.claude/skills/brand-mark/, PR #103). Inlined rather than imported so this
// script runs on main today with no cross-branch dependency. If #103 merges,
// swap these for the import.

// ---- from brand-mark/assets/marks.js ----
function rng(seed) {
  let a = (seed * 1000003) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const n = v => Math.round(v * 100) / 100
function smoothPath(pts, amp = 1.5, seed = 1, close = true, tension = 1) {
  const r = rng(seed)
  const p = pts.map(([x, y]) => [x + (r() - 0.5) * amp, y + (r() - 0.5) * amp])
  const at = i => p[close ? (i + p.length) % p.length : Math.max(0, Math.min(p.length - 1, i))]
  let d = `M${n(p[0][0])} ${n(p[0][1])}`
  const last = close ? p.length : p.length - 1
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), k = tension / 6
    d += ` C${n(p1[0] + (p2[0] - p0[0]) * k)} ${n(p1[1] + (p2[1] - p0[1]) * k)}`
       + ` ${n(p2[0] - (p3[0] - p1[0]) * k)} ${n(p2[1] - (p3[1] - p1[1]) * k)}`
       + ` ${n(p2[0])} ${n(p2[1])}`
  }
  return close ? `${d} Z` : d
}

// ---- the hyphal network ----
// Drawn in a 100x100 box so the component can place it at any size. The core
// sits at (50,50) — the same relative spot the glyph's amber core occupies
// (cx 274, cy 443 of a 549x748 viewBox ≈ 0.50, 0.59).
export const BOX = 100
const CX = 50, CY = 50

// A hypha wanders outward from the core: it does not radiate straight, it
// meanders and thickens toward the base, the way real mycelium does.
// wander is deliberately low — at 0.55 the threads accumulated so much turn
// they read as kinked spikes rather than as a network.
function hypha(angle, len, seed, { wander = 0.3, steps = 9 } = {}) {
  const r = rng(seed)
  const pts = [[CX, CY]]
  let a = angle, x = CX, y = CY
  for (let i = 1; i <= steps; i++) {
    const step = (len / steps) * (0.78 + r() * 0.44)
    a += (r() - 0.5) * wander        // meander, biased by nothing — seeded only
    x += Math.cos(a) * step
    y += Math.sin(a) * step
    pts.push([x, y])
  }
  return pts
}

// Branches fork off a parent thread partway along, like real hyphal branching.
function branchOf(parent, atIndex, angleDelta, len, seed, steps = 4) {
  const r = rng(seed)
  const [px, py] = parent[atIndex]
  const [qx, qy] = parent[atIndex - 1] ?? parent[0]
  let a = Math.atan2(py - qy, px - qx) + angleDelta
  const pts = [[px, py]]
  let x = px, y = py
  for (let i = 1; i <= steps; i++) {
    const step = (len / steps) * (0.8 + r() * 0.4)
    a += (r() - 0.5) * 0.5
    x += Math.cos(a) * step
    y += Math.sin(a) * step
    pts.push([x, y])
  }
  return pts
}

// 7 primaries: one per OneLyf space, on the same -90° start as the film's orbit.
// Not decorative — the thread count is the space count, so the mark means something.
const PRIMARIES = 7

export function threads() {
  const out = []
  for (let k = 0; k < PRIMARIES; k++) {
    const angle = -Math.PI / 2 + (k / PRIMARIES) * Math.PI * 2
    const seed = 101 + k * 7
    // reach close to the box edge: the threads have to clear the core glow or
    // the whole mark reads as a glowing blob with some fuzz on it
    const len = 43 + rng(seed)() * 5
    const pts = hypha(angle, len, seed)
    out.push({ id: `p${k}`, tier: 'primary', d: smoothPath(pts, 0.35, seed + 1, false, 0.9) })
    // one branch per primary, alternating side, forking about two-thirds out
    const side = k % 2 ? 1 : -1
    const b = branchOf(pts, 6, side * 0.65, 17, seed + 2)
    out.push({ id: `b${k}`, tier: 'branch', d: smoothPath(b, 0.3, seed + 3, false, 0.9) })
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('gen-hyphae.mjs')) {
  const t = threads()
  if (process.argv.includes('--json')) console.log(JSON.stringify(t, null, 2))
  else for (const x of t) console.log(`${x.id}\t${x.tier}\t${x.d}`)
}
