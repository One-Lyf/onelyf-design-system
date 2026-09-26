// ─── LivGlyphGrow — the CANONICAL interlaced glyph, growing and retracting ──
// Jeff, 2026-09-17: "I want the actual interlaced glyph to grow and retract
// when thinking in Liv Chat surfaces."
//
// The traced asset cannot be stroke-dashed — it is a filled OUTLINE of the
// strands (one `d` of 55,863 chars, 3,461 `L` commands, zero curves), with no
// centrelines to draw along. So the first cuts revealed it with an animated
// MASK (a turbulence-edged ellipse over the roots) instead.
//
// WHAT GROWS, AND WHY IT MATTERS (Jeff, 2026-09-17): "You keep making the crown
// radial grow, which is more plant like than root like. The roots/dendrils
// should be what's growing out and down, not the crown growing up."
// An earlier cut scaled one circle from the core, which revealed the CROWN
// outward and upward — a plant sprouting, the exact thing brand brief §8
// forbids. The crown is the above-ground part and must never move.
//
// 2026-09-26: the roots are now the brand film's (Jeff: "port the new roots to
// the Liv Builder icon"). The old `rooted` cascade was two small copies of the
// glyph itself, which read as a fractal, too perfect for roots. The film grows
// seeded random-walk strands out of the live glyph's stubs, asymmetric roots
// inside an even, rounded dome; scripts/gen-liv-roots.mjs ports that walk and
// writes both glyph-rooted.svg and src/livRoots.ts.
//
// The new roots are vectors with centrelines, so they grow the way the film
// grows them: each strand along its own length, children starting as their
// parent's tip passes the branch point, and retracting in reverse (tips first,
// so a child is never left hanging off a withdrawn parent). The crown never
// moves: it is the live glyph itself, drawn on top, untouched.
//
// How: each strand's tapered outline is filled, and revealed by a mask of its
// centreline stroked with a dash. One animated number, --lg-p (0 -> 1 -> 0),
// drives every strand; a strand shows clamp((p - s) / g) of its length, where
// s and g are its start and growth time from the film, as fractions of the
// whole. That is one animation for the whole mark, rather than one per strand,
// which matters because this runs while Liv thinks, potentially for minutes,
// on a 2015 MBP. --lg-p is registered with @property so it interpolates; where
// @property is unsupported it steps, and the roots appear and withdraw whole.
//
// At p = 0 no root shows and the mark is exactly `live`, so the idle ->
// thinking handoff is seamless.
//
// Below ~48 px the traced glyph is an amber blob at any phase (measured), so
// callers should use the simplified cut instead — see LIV_GROW_MIN_SIZE.
// The asset is imported directly rather than via Glyph's GLYPH_URLS: Glyph
// renders this component, so reading back from it would be a circular import.
import { useId, type CSSProperties } from 'react'
import liveUrl from './assets/glyph-live.svg?no-inline'
import { LIV_ROOTS, LIV_ROOT_FILL } from './livRoots'

/** Below this rendered size the traced glyph is mud; use the simplified mark. */
export const LIV_GROW_MIN_SIZE = 48

// Native geometry of the traced assets.
const VB_W = 549, VB_H = 748

// Slower than the short-root version: there is visibly more cascade to travel.
const DUR = 3.6

export const livGlyphGrowStylesheet = `
@property --lg-p{syntax:'<number>';inherits:true;initial-value:1}
.lg-grow{animation:lg-grow ${DUR}s ease-in-out infinite both}
/* Starts and ends at the same value, so the loop wraps with no jump. Holds at
   full across the middle so the complete mark is legible, not just glimpsed. */
@keyframes lg-grow{
  0%{--lg-p:0}
  46%{--lg-p:1}
  58%{--lg-p:1}
  100%{--lg-p:0}
}
.lg-grow .lg-r{
  stroke-dasharray:1 2;
  stroke-dashoffset:calc(1 - clamp(0, (var(--lg-p) - var(--s)) / var(--g), 1));
}
/* Degrades to the complete STATIC mark, per brand brief §8. */
@media (prefers-reduced-motion:reduce){
  .lg-grow{animation:none!important;--lg-p:1}
}
`

export interface LivGlyphGrowProps {
  /** Rendered width in px. Height follows the glyph's 549x748 aspect. */
  size?: number
  /** Accessible label; empty by default since this is usually decorative. */
  alt?: string
}

export default function LivGlyphGrow({ size = 64, alt = '' }: LivGlyphGrowProps) {
  const maskId = `lg-m-${useId().replace(/:/g, '')}`

  return (
    <svg
      className="lg-grow"
      width={size}
      height={Math.round((size * VB_H) / VB_W)}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* maskUnits/bounds are explicit so round caps at the box edge are not clipped */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={VB_W + 40} height={VB_H + 40}>
          {LIV_ROOTS.map((r, i) => (
            <path
              key={i}
              className="lg-r"
              d={r.c}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={r.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ '--s': r.s, '--g': r.g } as CSSProperties}
            />
          ))}
        </mask>
      </defs>
      {/* the roots, under the glyph as in glyph-rooted.svg: the stubs overlap them */}
      <g fill={LIV_ROOT_FILL} mask={`url(#${maskId})`}>
        {LIV_ROOTS.map((r, i) => <path key={i} d={r.o} />)}
      </g>
      <image href={liveUrl} x="0" y="0" width={VB_W} height={VB_H} />
    </svg>
  )
}
