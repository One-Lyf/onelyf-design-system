// ─── LivThinking — the Liv "thinking" loader ────────────────────────────────
// Liv made visible while the intelligence works (brand brief §8: "thinking —
// paths illuminate, energy gathers"; §7: "loading — energy travels the network").
// A hyphal network grows out from the amber core and withdraws, on a loop.
//
// Why the network is drawn here instead of taken from the glyph asset:
// `assets/glyph-live.svg` is an autotraced raster→vector polyline — one `d` of
// 55,863 chars, 3,461 `L` commands, zero curve commands. Nothing in it can be
// stroke-dashed, morphed or grown. The threads below are generated as clean
// curves by `scripts/gen-hyphae.mjs`; re-run that to change the geometry.
//
// Self-contained: the CSS ships inside the component. The previous version
// documented `liv-think` keyframes as the host app's job and those keyframes
// existed in no app in this repo — so the spinner silently rendered as a static
// image wherever nobody had copied them in.
import { useId } from 'react'
import liveUrl from './assets/glyph-live.svg'
import { cssVar } from './theme'

// ── geometry, baked from scripts/gen-hyphae.mjs (seeded, so it is stable) ────
// 7 primaries — one per OneLyf space — each with one branch, in a 100x100 box.
const PRIMARY = [
  "M49.84 50.09 C49.8 49.49 49.69 47.43 49.56 46.1 C49.43 44.76 49.13 42.73 48.98 41.16 C48.83 39.58 48.73 36.99 48.55 35.6 C48.37 34.2 48.09 33.25 47.78 31.87 C47.47 30.49 46.98 27.88 46.49 26.39 C46.01 24.89 45.06 23.1 44.56 21.9 C44.07 20.7 43.62 19.44 43.18 18.37 C42.74 17.31 42.14 16.13 41.61 14.78 C41.09 13.44 39.96 10.23 39.67 9.43",
  "M50.11 50.11 C50.57 49.74 52.23 48.36 53.16 47.68 C54.09 47.01 55.23 46.28 56.29 45.6 C57.35 44.91 58.94 43.95 60.21 43.12 C61.48 42.29 63.46 41 64.77 40.07 C66.08 39.14 67.83 37.81 68.95 36.93 C70.08 36.04 71.21 34.94 72.26 34.15 C73.32 33.36 74.68 32.5 75.97 31.66 C77.26 30.83 79.36 29.43 80.85 28.57 C82.34 27.71 85.14 26.34 85.9 25.95",
  "M49.9 49.92 C50.66 50.19 53.53 51.11 54.93 51.71 C56.33 52.31 57.85 53.34 59.21 53.96 C60.57 54.58 62.51 55.32 63.96 55.83 C65.41 56.34 67.55 56.79 68.85 57.24 C70.15 57.69 71.57 58.19 72.65 58.72 C73.73 59.25 74.96 60.13 76 60.65 C77.04 61.17 78.99 61.86 79.53 62.11 C80.06 62.35 82.51 63.6 83.9 64.28 C85.29 64.96 88.4 66.4 89.11 66.73",
  "M50.06 50.1 C50.45 50.68 51.79 52.72 52.45 53.81 C53.11 54.9 53.73 56.19 54.34 57.28 C54.95 58.37 55.79 59.77 56.34 60.85 C56.89 61.94 57.3 63.2 57.76 64.35 C58.22 65.5 58.85 66.9 59.27 68.06 C59.69 69.22 60.03 70.59 60.4 71.72 C60.77 72.85 61.28 74.09 61.6 75.16 C61.93 76.24 62.35 77.85 62.61 78.77 C62.88 79.7 63.64 82.27 63.93 83.25",
  "M49.94 50.13 C49.62 50.75 48.47 52.85 47.83 53.96 C47.19 55.07 46.33 56.32 45.66 57.42 C44.99 58.52 44.05 59.94 43.42 61.03 C42.79 62.13 42.31 63.34 41.72 64.45 C41.13 65.55 40.27 67.02 39.75 68.13 C39.24 69.24 38.94 70.46 38.5 71.56 C38.06 72.66 37.42 73.98 37.06 75.03 C36.7 76.09 36.35 77.62 36.09 78.52 C35.83 79.42 35.09 81.94 34.81 82.88",
  "M50.05 49.93 C49.43 50.24 47.36 51.29 46.23 51.9 C45.1 52.51 43.87 53.26 42.8 53.87 C41.73 54.48 40.31 55.24 39.24 55.87 C38.17 56.5 36.9 57.32 35.87 57.95 C34.84 58.58 33.61 59.28 32.68 59.91 C31.76 60.54 30.9 61.34 30.02 61.93 C29.14 62.52 27.94 63.15 27.16 63.65 C26.38 64.16 24.98 65.11 24.29 65.57 C23.6 66.03 21.6 67.4 20.8 67.95",
  "M49.86 49.92 C49.19 49.65 47 48.77 45.62 48.16 C44.25 47.55 42.68 46.75 41.44 46.14 C40.2 45.53 38.5 44.71 37.32 44.11 C36.13 43.51 34.82 42.8 33.79 42.25 C32.75 41.7 31.5 41.02 30.65 40.53 C29.8 40.05 28.86 39.44 28.1 38.98 C27.34 38.53 26.28 37.93 25.62 37.53 C24.96 37.14 23.75 36.35 23.13 35.94 C22.51 35.53 20.68 34.29 19.96 33.8",
]
const BRANCH = [
  "M46.47 26.41 C46.06 26.16 44.5 25.2 43.68 24.64 C42.86 24.09 42.01 23.24 41.13 22.61 C40.25 21.98 38.94 21.11 38.14 20.53 C37.34 19.95 36.19 19.09 35.6 18.66",
  "M68.93 36.95 C69.6 36.76 72.21 36 73.4 35.6 C74.58 35.21 75.71 34.72 76.7 34.32 C77.68 33.92 78.87 33.35 79.77 32.96 C80.68 32.57 82.39 31.83 82.87 31.6",
  "M68.83 57.26 C69.44 57.66 71.87 59.26 72.85 59.99 C73.83 60.72 74.61 61.6 75.44 62.31 C76.27 63.03 77.51 63.99 78.22 64.63 C78.93 65.28 80.11 66.44 80.53 66.86",
  "M60.38 71.74 C60.91 71.36 63.03 69.84 63.9 69.19 C64.77 68.53 65.48 67.86 66.24 67.17 C67.01 66.48 68.19 65.53 68.83 64.9 C69.47 64.27 70.62 63.1 71.06 62.64",
  "M38.52 71.58 C38.06 71.14 36.27 69.4 35.53 68.64 C34.79 67.88 34.29 67.14 33.65 66.4 C33 65.66 31.98 64.61 31.43 63.94 C30.88 63.27 29.83 61.96 29.44 61.45",
  "M30 61.95 C29.52 62.32 27.62 63.79 26.82 64.44 C26.02 65.08 25.38 65.72 24.65 66.36 C23.92 67 22.83 67.86 22.2 68.45 C21.57 69.05 20.44 70.19 20.02 70.63",
  "M28.08 39 C27.51 38.68 25.27 37.4 24.31 36.79 C23.34 36.19 22.6 35.6 21.75 35.02 C20.9 34.44 19.62 33.65 18.88 33.14 C18.14 32.63 16.78 31.64 16.29 31.28",
]

// ── motion ──────────────────────────────────────────────────────────────────
// 'grow'       threads extend from the core and withdraw the way they came.
// 'illuminate' threads stay present; light travels outward along them
//              (brand brief §8 wording, for when the network should read as
//              already-there rather than being built each cycle).
export type LivThinkingMotion = 'grow' | 'illuminate'

const DUR = 3.2

// Scoped under .liv-hy so nothing here can leak into a host app's styles.
// An SVG <style> in inline SVG is document-scoped, so the first mounted spinner
// styles them all and duplicate copies are harmless — no head injection, no
// SSR hazard, and no "remember to add these keyframes" note in the docs.
const CSS = `
.liv-hy{overflow:visible}
.liv-hy path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.liv-hy .liv-p{stroke-width:2.1}
.liv-hy .liv-b{stroke-width:1.3}
.liv-hy .liv-core{transform-origin:50px 50px;animation:liv-breathe ${DUR}s ease-in-out infinite}
@keyframes liv-breathe{0%,100%{transform:scale(.92);opacity:.75}50%{transform:scale(1.06);opacity:1}}

/* grow: 1 -> 0 -> 1. Never animate to a NEGATIVE offset: that slides the dash
   off the far end, so the thread travels away instead of withdrawing. Start and
   end are identical, so the loop wraps with no jump. */
/* :where() keeps these at the same specificity as the .liv-hy path longhand
   below (0,1,1). Written as .liv-hy.liv-grow they would score 0,2,1, outrank it,
   and silently reset animation-fill-mode no matter what the source order is. */
.liv-hy:where(.liv-grow) path{stroke-dasharray:1 1;animation:liv-grow ${DUR}s ease-in-out infinite}
@keyframes liv-grow{0%{stroke-dashoffset:1;opacity:.2}42%{stroke-dashoffset:0;opacity:1}58%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:1;opacity:.2}}

.liv-hy:where(.liv-illuminate) :where(.liv-rail){opacity:.18}
.liv-hy:where(.liv-illuminate) :where(.liv-spark){stroke-dasharray:.18 .82;animation:liv-travel ${DUR}s linear infinite}
@keyframes liv-travel{0%{stroke-dashoffset:1;opacity:0}15%{opacity:1}85%{opacity:1}100%{stroke-dashoffset:0;opacity:0}}

/* Must come after the shorthands above: \`animation:\` resets both of these.
   fill-mode:both is load-bearing — during a positive stagger delay an unfilled
   path renders its BASE stroke-dashoffset of 0, i.e. fully drawn, so the whole
   network flashes complete for the first frames after mount. */
.liv-hy path,.liv-hy .liv-core{animation-delay:var(--liv-d,0s);animation-fill-mode:both}

/* Degrades to a recognisable STATIC form, per brand brief §8. */
@media (prefers-reduced-motion:reduce){
  .liv-hy path,.liv-hy .liv-core{animation:none!important}
  .liv-hy path{stroke-dashoffset:0;opacity:.55}
  .liv-hy .liv-core{opacity:1;transform:none}
}`

export interface LivThinkingProps {
  /** Glyph size in px. */
  size?: number
  /** Optional caption shown beside the mark (e.g. "Liv is thinking…"). */
  caption?: string
  /** Accessible status label (announced to screen readers). */
  label?: string
  /** How the network animates. Defaults to `grow`. */
  motion?: LivThinkingMotion
  /** Lay the canonical traced glyph over the network. Defaults to true. */
  glyph?: boolean
}

export default function LivThinking({
  size = 44,
  caption,
  label = 'Liv is thinking…',
  motion = 'grow',
  glyph = true,
}: LivThinkingProps) {
  // unique per instance so multiple spinners cannot share a gradient id
  const uid = useId().replace(/:/g, '')
  const gradId = `liv-glow-${uid}`

  // Small stagger so the network wakes outward rather than all at once. Larger
  // values pull the threads far enough out of step that the loop stops reading
  // as one gesture.
  const stroke = (d: string, i: number, tier: 'p' | 'b', extra = '') => (
    <path
      key={`${tier}${i}${extra}`}
      className={`liv-${tier}${extra ? ' ' + extra : ''}`}
      d={d}
      pathLength={1}
      style={{ ['--liv-d' as string]: `${((tier === 'b' ? 0.1 : 0) + (i % 7) * 0.03).toFixed(3)}s` }}
    />
  )

  const rails = motion === 'illuminate'
  return (
    <span role="status" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <span style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'block' }}>
        <svg
          className={`liv-hy liv-${motion}`}
          viewBox="0 0 100 100"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', stroke: cssVar.gold }}
        >
          <defs>
            <style>{CSS}</style>
            <radialGradient id={gradId} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="15">
              <stop offset="0%" stopColor="#fffaf0" />
              <stop offset="24%" stopColor="#ffd35e" stopOpacity="0.92" />
              <stop offset="55%" stopColor="#e89a1c" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--ds-gold, #c08a14)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {PRIMARY.map((d, i) => stroke(d, i, 'p', rails ? 'liv-rail' : ''))}
          {BRANCH.map((d, i) => stroke(d, i, 'b', rails ? 'liv-rail' : ''))}
          {rails && PRIMARY.map((d, i) => stroke(d, i, 'p', 'liv-spark'))}
          {rails && BRANCH.map((d, i) => stroke(d, i, 'b', 'liv-spark'))}
          <circle className="liv-core" cx="50" cy="50" r="15" fill={`url(#${gradId})`} stroke="none" />
        </svg>
        {glyph && (
          <img
            src={liveUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute', left: '50%', top: '50%', width: '33%',
              transform: 'translate(-50%, -52%)', display: 'block', objectFit: 'contain',
            }}
          />
        )}
      </span>
      {caption && <span style={{ fontSize: 13, color: cssVar.mid }}>{caption}</span>}
    </span>
  )
}
