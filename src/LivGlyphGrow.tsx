// ─── LivGlyphGrow — the CANONICAL interlaced glyph, growing and retracting ──
// Jeff, 2026-09-17: "I want the actual interlaced glyph to grow and retract
// when thinking in Liv Chat surfaces."
//
// The traced asset cannot be stroke-dashed — it is a filled OUTLINE of the
// strands (one `d` of 55,863 chars, 3,461 `L` commands, zero curves), with no
// centrelines to draw along. So it is revealed by an animated MASK instead.
//
// WHAT GROWS, AND WHY IT MATTERS (Jeff, 2026-09-17): "You keep making the crown
// radial grow, which is more plant like than root like. The roots/dendrils
// should be what's growing out and down, not the crown growing up."
// An earlier cut scaled one circle from the core, which revealed the CROWN
// outward and upward — a plant sprouting, the exact thing brand brief §8
// forbids. The crown is the above-ground part and must never move.
//
// So the mask has two halves:
//   STATIC   a rect over everything above y=435 (the knot and the lateral
//            petals, measured off a gridded render) plus a circle over the
//            amber core. The circle is what stops the core's r=149 glow being
//            sliced by the rect edge, which showed as a hard horizontal cut.
//   GROWING  an ellipse anchored AT THE ROOT ORIGIN (274, 420) and scaled from
//            nothing, so the dendrils extend down and outward, then withdraw.
//
// WHICH ARTWORK (Jeff, 2026-09-17): "I want the root growth to continue deeper
// like in the newer glyph that is used for the Liv Builder PWA icon."
// That is the ROOTED variant — same crown and junction as live, but the roots
// continue into a full mycelium cascade instead of stopping at short stubs.
// live simply has no deep roots to grow, so the thinking state draws `rooted`.
// At phase 0 the cascade is masked away and what remains reads almost exactly
// like `live`, so the idle -> thinking handoff is close to seamless.
//
// The growing edge is displaced by feTurbulence, which is the difference
// between "mycelium creeping outward" and "a clock hand wiping". Verified side
// by side; the plain-edged version reads as a wipe and was rejected.
//
// transform:scale() drives it rather than animating the circle's `r`, because
// `r`-as-a-CSS-property has patchier support and transform is GPU-cheap. This
// runs while Liv thinks, potentially for minutes, on a 2015 MBP.
//
// Below ~48 px the traced glyph is an amber blob at any phase (measured), so
// callers should use the simplified cut instead — see LIV_GROW_MIN_SIZE.
// The asset is imported directly rather than via Glyph's GLYPH_URLS: Glyph
// renders this component, so reading back from it would be a circular import.
import { useId } from 'react'
import rootedUrl from './assets/glyph-rooted.svg?no-inline'

/** Below this rendered size the traced glyph is mud; use the simplified mark. */
export const LIV_GROW_MIN_SIZE = 48

// Native geometry of the traced assets, measured off a gridded render.
const VB_W = 549, VB_H = 748
const CORE_X = 274, CORE_Y = 443
// Everything above this is crown (knot + lateral petals) and is always visible.
const CROWN_BOTTOM = 435
// Covers the core's radial glow (r=149 in the asset) so the crown rect cannot
// slice it into a hard horizontal edge.
const CORE_COVER_R = 168
// Where the dendrils leave the core, and how far they reach. RY spans the
// ellipse from ROOT_ORIGIN_Y down to ROOT_ORIGIN_Y + 2*RY, so 210 carries the
// cascade past the bottom of the 748-tall artwork — the roots run all the way
// down rather than stopping mid-frame.
const ROOT_ORIGIN_Y = 420
const ROOT_RX = 340, ROOT_RY = 210

// Slower than the short-root version: there is visibly more cascade to travel.
const DUR = 3.6

export const livGlyphGrowStylesheet = `
.lg-grow .lg-roots{
  transform-origin:${CORE_X}px ${ROOT_ORIGIN_Y}px;
  animation:lg-grow ${DUR}s ease-in-out infinite;
  animation-fill-mode:both;
}
/* Starts and ends at the same scale, so the loop wraps with no jump. Holds at
   full across the middle so the complete mark is legible, not just glimpsed. */
@keyframes lg-grow{
  0%{transform:scale(.01)}
  46%{transform:scale(1)}
  58%{transform:scale(1)}
  100%{transform:scale(.01)}
}
/* Degrades to the complete STATIC mark, per brand brief §8. */
@media (prefers-reduced-motion:reduce){
  .lg-grow .lg-roots{animation:none!important;transform:none}
}
`

export interface LivGlyphGrowProps {
  /** Rendered width in px. Height follows the glyph's 549x748 aspect. */
  size?: number
  /** Accessible label; empty by default since this is usually decorative. */
  alt?: string
}

export default function LivGlyphGrow({ size = 64, alt = '' }: LivGlyphGrowProps) {
  const uid = useId().replace(/:/g, '')
  const maskId = `lg-m-${uid}`, filterId = `lg-f-${uid}`

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
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="4" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* maskUnits/bounds are explicit so the displaced edge is not clipped
            by the default objectBoundingBox region. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-300} y={-300} width={VB_W + 600} height={VB_H + 600}>
          {/* static: the crown never moves */}
          <rect x={-300} y={-300} width={VB_W + 600} height={300 + CROWN_BOTTOM} fill="#fff" />
          <circle cx={CORE_X} cy={CORE_Y} r={CORE_COVER_R} fill="#fff" />
          {/* growing: the dendrils, out and down from the root origin */}
          <ellipse
            className="lg-roots"
            cx={CORE_X}
            cy={ROOT_ORIGIN_Y + ROOT_RY}
            rx={ROOT_RX}
            ry={ROOT_RY}
            fill="#fff"
            filter={`url(#${filterId})`}
          />
        </mask>
      </defs>
      <image
        href={rootedUrl}
        x="0"
        y="0"
        width={VB_W}
        height={VB_H}
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
