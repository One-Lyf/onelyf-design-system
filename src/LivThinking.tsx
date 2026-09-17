// ─── LivThinking — the Liv "thinking" loader ────────────────────────────────
// Liv made visible while the intelligence works. The ornament holds still and
// the mycelial roots grow outward and withdraw, on a loop.
//
// Canon: onelyf-planning/docs/liv-motion-canon.md, ruling 2026-09-17 —
// brand brief §8's "No plant-growth animation" forbids the glyph behaving like
// a PLANT. Liv is a root/mycelial structure, so hyphal growth is Liv being
// itself. §8 also asks for "movement beneath the surface", which is exactly
// what the roots are; the ornament above them stays still.
//
// The mark here is a clean curve redraw, not the shipped asset. The traced
// `assets/glyph-live.svg` is one `d` of 55,863 chars, 3,461 `L` commands and
// zero curve commands: it cannot be stroke-dashed or grown, and it collapses to
// an amber dot below ~32 px. `scripts/gen-glyph.mjs` regenerates the geometry
// below — it is a faithful redraw of the same rosette (vesica lobes, central
// spine, looped finials, dendritic roots, amber core), NOT a new mark.
//
// Self-contained: the CSS ships inside the SVG. The previous version documented
// `liv-think` keyframes as the host app's job, and every consuming app had to
// hand-copy them or the spinner silently rendered static.
import { useId } from 'react'

// ── geometry, baked from scripts/gen-glyph.mjs (deterministic, no rng) ──────
const ORNAMENT = [
  { c: "liv-lobe", d: "M50 44 Q62.06 32 50 20 Q37.94 32 50 44 Z" },
  { c: "liv-lobe", d: "M56 50 Q68 62.06 80 50 Q68 37.94 56 50 Z" },
  { c: "liv-lobe", d: "M50 56 Q37.94 68 50 80 Q62.06 68 50 56 Z" },
  { c: "liv-lobe", d: "M44 50 Q32 37.94 20 50 Q32 62.06 44 50 Z" },
  { c: "liv-lobe liv-lobe-sm", d: "M53.54 46.46 Q65.7 46.61 65.56 34.44 Q53.39 34.3 53.54 46.46 Z" },
  { c: "liv-lobe liv-lobe-sm", d: "M53.54 53.54 Q53.39 65.7 65.56 65.56 Q65.7 53.39 53.54 53.54 Z" },
  { c: "liv-lobe liv-lobe-sm", d: "M46.46 53.54 Q34.3 53.39 34.44 65.56 Q46.61 65.7 46.46 53.54 Z" },
  { c: "liv-lobe liv-lobe-sm", d: "M46.46 46.46 Q46.61 34.3 34.44 34.44 Q34.3 46.61 46.46 46.46 Z" },
  { c: "liv-spine", d: "M50 84 Q56.16 50 50 16 Q43.84 50 50 84 Z" },
  { c: "liv-finial", d: "M50 14 C46.6 10.8 46.6 6 50 4.4 C53.4 6 53.4 10.8 50 14 Z" },
  { c: "liv-finial", d: "M50 86 C46.6 89.2 46.6 94 50 95.6 C53.4 94 53.4 89.2 50 86 Z" },
]
const ROOTS = [
  { c: "liv-root", d: "M47.42 56.51 Q44.31 63.88 42.41 67.42 Q40.52 70.95 38.03 74.19 Q35.55 77.43 32.27 80.14 Q28.99 82.86 24.77 84.75 T20.56 86.63" },
  { c: "liv-root liv-fork", d: "M33.72 79.17 Q31.62 86.8 32.73 93.53" },
  { c: "liv-root", d: "M52.58 56.51 Q55.69 63.88 57.59 67.42 Q59.48 70.95 61.97 74.19 Q64.45 77.43 67.73 80.14 Q71.01 82.86 75.23 84.75 T79.44 86.63" },
  { c: "liv-root liv-fork", d: "M66.28 79.17 Q68.38 86.8 67.27 93.53" },
  { c: "liv-root", d: "M44.61 54.46 Q38.94 58.9 35.87 60.81 Q32.79 62.72 29.35 64.06 Q25.9 65.4 22.02 65.86 Q18.14 66.33 13.88 65.56 T9.62 64.79" },
  { c: "liv-root liv-fork", d: "M23.64 65.86 Q18.58 70.88 16.44 76.63" },
  { c: "liv-root", d: "M55.39 54.46 Q61.06 58.9 64.13 60.81 Q67.21 62.72 70.65 64.06 Q74.1 65.4 77.98 65.86 Q81.86 66.33 86.12 65.56 T90.38 64.79" },
  { c: "liv-root liv-fork", d: "M76.36 65.86 Q81.42 70.88 83.56 76.63" },
  { c: "liv-root", d: "M43.09 51.1 Q37.14 51.88 34.12 51.97 Q31.11 52.07 28.07 51.65 Q25.03 51.23 22.02 50.07 Q19.02 48.92 16.2 46.82 T13.38 44.73" },
  { c: "liv-root liv-fork", d: "M23.21 50.67 Q17.48 52.23 13.56 55.52" },
  { c: "liv-root", d: "M56.91 51.1 Q62.86 51.88 65.88 51.97 Q68.89 52.07 71.93 51.65 Q74.97 51.23 77.98 50.07 Q80.98 48.92 83.8 46.82 T86.62 44.73" },
  { c: "liv-root liv-fork", d: "M76.79 50.67 Q82.52 52.23 86.44 55.52" },
  { c: "liv-root", d: "M50 57 Q50 63.8 50 67.2 Q50 70.6 50 74 Q50 77.4 50 80.8 Q50 84.2 50 87.6 T50 91" },
  { c: "liv-root liv-fork", d: "M50 79.44 Q51.6 85.98 55.21 90.51" },
  { c: "liv-root", d: "M43.76 46.82 Q39.54 44.53 37.54 43.19 Q35.54 41.86 33.73 40.2 Q31.92 38.55 30.44 36.47 Q28.95 34.4 27.94 31.85 T26.93 29.3" },
  { c: "liv-root liv-fork", d: "M30.97 37.38 Q27.74 33.88 26.49 29.99" },
  { c: "liv-root", d: "M56.24 46.82 Q60.46 44.53 62.46 43.19 Q64.46 41.86 66.27 40.2 Q68.08 38.55 69.56 36.47 Q71.05 34.4 72.06 31.85 T73.07 29.3" },
  { c: "liv-root liv-fork", d: "M69.03 37.38 Q72.26 33.88 73.51 29.99" },
]

// 'grow'       roots extend from the core and withdraw the way they came (canon)
// 'illuminate' roots stay present; light travels outward along them
export type LivThinkingMotion = 'grow' | 'illuminate'

const DUR = 3.2

// Scoped under .liv-hy. An SVG <style> in inline SVG is document-scoped, so the
// first mounted spinner styles them all and duplicates are harmless — no head
// injection, no SSR hazard, nothing for a host app to remember.
const CSS = `
.liv-hy{overflow:visible}
.liv-hy path{vector-effect:none}
.liv-hy .liv-lobe,.liv-hy .liv-spine,.liv-hy .liv-finial{fill:none;stroke:var(--ds-gold,#c08a14);stroke-width:2.2;stroke-linejoin:round}
.liv-hy .liv-lobe-sm{stroke-width:1.7;opacity:.8}
.liv-hy .liv-spine{stroke-width:2}
.liv-hy .liv-root{fill:none;stroke:var(--ds-gold,#c08a14);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.liv-hy .liv-fork{stroke-width:1.2}
.liv-hy .liv-core{transform-origin:50px 50px;animation:liv-breathe ${DUR}s ease-in-out infinite}
@keyframes liv-breathe{0%,100%{transform:scale(.92);opacity:.75}50%{transform:scale(1.06);opacity:1}}

/* :where() keeps these at the same specificity (0,1,1) as the longhand block at
   the end. Written as .liv-hy.liv-grow they would score 0,2,1, outrank it, and
   silently reset animation-fill-mode whatever the source order. */
.liv-hy:where(.liv-grow) :where(.liv-root){stroke-dasharray:1 1;animation:liv-grow ${DUR}s ease-in-out infinite}
/* 1 -> 0 -> 1, never to a NEGATIVE offset: negative slides the dash off the far
   end so the root travels away instead of withdrawing. Ends where it starts, so
   the loop wraps with no jump. */
@keyframes liv-grow{0%{stroke-dashoffset:1;opacity:.2}42%{stroke-dashoffset:0;opacity:1}58%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:1;opacity:.2}}

.liv-hy:where(.liv-illuminate) :where(.liv-root){opacity:.2}
.liv-hy:where(.liv-illuminate) :where(.liv-spark){opacity:1;stroke-dasharray:.2 .8;animation:liv-travel ${DUR}s linear infinite}
@keyframes liv-travel{0%{stroke-dashoffset:1;opacity:0}15%{opacity:1}85%{opacity:1}100%{stroke-dashoffset:0;opacity:0}}

/* Must come last: every \`animation:\` shorthand above resets both of these.
   fill-mode:both is load-bearing — during a positive stagger delay an unfilled
   path renders its BASE stroke-dashoffset of 0, i.e. fully drawn, so the whole
   root system flashes complete for the first frames after mount. */
.liv-hy path{animation-delay:var(--liv-d,0s);animation-fill-mode:both}

/* Degrades to a recognisable STATIC form, per brand brief §8. */
@media (prefers-reduced-motion:reduce){
  .liv-hy path,.liv-hy .liv-core{animation:none!important}
  .liv-hy .liv-root{stroke-dashoffset:0;opacity:.6}
  .liv-hy .liv-spark{display:none}
  .liv-hy .liv-core{opacity:1;transform:none}
}`

export interface LivThinkingProps {
  /** Mark size in px. */
  size?: number
  /** Optional caption shown beside the mark (e.g. "Liv is thinking…"). */
  caption?: string
  /** Accessible status label (announced to screen readers). */
  label?: string
  /** How the root network animates. Defaults to `grow` (canon). */
  motion?: LivThinkingMotion
}

export default function LivThinking({
  size = 64,
  caption,
  label = 'Liv is thinking…',
  motion = 'grow',
}: LivThinkingProps) {
  // unique per instance so two spinners cannot share a gradient id
  const gradId = `liv-glow-${useId().replace(/:/g, '')}`
  const spark = motion === 'illuminate'

  // Small stagger so the network wakes outward rather than all at once. Larger
  // values pull the roots far enough out of step that the loop stops reading as
  // one gesture.
  const root = (p: { c: string; d: string }, i: number, extra = '') => (
    <path
      key={`${i}${extra}`}
      className={extra ? `${p.c} ${extra}` : p.c}
      d={p.d}
      pathLength={1}
      style={{ ['--liv-d' as string]: `${(i * 0.02).toFixed(2)}s` }}
    />
  )

  return (
    <span role="status" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <svg
        className={`liv-hy liv-${motion}`}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        style={{ display: 'block', flex: '0 0 auto' }}
      >
        <defs>
          <style>{CSS}</style>
          <radialGradient id={gradId} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="19">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="24%" stopColor="#ffd35e" stopOpacity="0.95" />
            <stop offset="52%" stopColor="#e89a1c" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--ds-gold, #c08a14)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {ROOTS.map((p, i) => root(p, i))}
        {spark && ROOTS.map((p, i) => root(p, i, 'liv-spark'))}
        <circle className="liv-core" cx="50" cy="50" r="19" fill={`url(#${gradId})`} />
        {ORNAMENT.map((p, i) => <path key={`o${i}`} className={p.c} d={p.d} />)}
      </svg>
      {caption && <span style={{ fontSize: 13, color: 'var(--ds-mid, #5e6c60)' }}>{caption}</span>}
    </span>
  )
}
