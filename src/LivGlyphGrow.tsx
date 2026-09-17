// ─── LivGlyphGrow — the CANONICAL interlaced glyph, growing and retracting ──
// Jeff, 2026-09-17: "I want the actual interlaced glyph to grow and retract
// when thinking in Liv Chat surfaces."
//
// The traced asset cannot be stroke-dashed — it is a filled OUTLINE of the
// strands (one `d` of 55,863 chars, 3,461 `L` commands, zero curves), with no
// centrelines to draw along. So it is revealed by an animated MASK instead:
// a circle centred on the amber core, scaled from nothing out to full and back.
//
// The mask edge is displaced by feTurbulence, which is the difference between
// "mycelium creeping outward" and "a clock hand wiping". Verified side by side;
// the plain circular mask reads as a wipe and was rejected.
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
import liveUrl from './assets/glyph-live.svg'

/** Below this rendered size the traced glyph is mud; use the simplified mark. */
export const LIV_GROW_MIN_SIZE = 48

// Native geometry of the traced assets, and the amber core's position in it.
const VB_W = 549, VB_H = 748
const CORE_X = 274, CORE_Y = 443
// Reaches the furthest corner of the artwork from the core, so scale(1) is a
// complete reveal: the top finial is the far point at ~443 units.
const MASK_R = 470

const DUR = 3.2

export const livGlyphGrowStylesheet = `
.lg-grow .lg-mask-c{
  transform-origin:${CORE_X}px ${CORE_Y}px;
  animation:lg-grow ${DUR}s ease-in-out infinite;
  animation-fill-mode:both;
}
/* Starts and ends at the same scale, so the loop wraps with no jump. Holds at
   full across the middle so the complete mark is legible, not just glimpsed. */
@keyframes lg-grow{
  0%{transform:scale(.02)}
  44%{transform:scale(1)}
  58%{transform:scale(1)}
  100%{transform:scale(.02)}
}
/* Degrades to the complete STATIC mark, per brand brief §8. */
@media (prefers-reduced-motion:reduce){
  .lg-grow .lg-mask-c{animation:none!important;transform:none}
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
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="4" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="150" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* maskUnits//bounds are explicit so the displaced edge is not clipped
            by the default objectBoundingBox region. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-200} y={-200} width={VB_W + 400} height={VB_H + 400}>
          <circle
            className="lg-mask-c"
            cx={CORE_X}
            cy={CORE_Y}
            r={MASK_R}
            fill="#fff"
            filter={`url(#${filterId})`}
          />
        </mask>
      </defs>
      <image
        href={liveUrl}
        x="0"
        y="0"
        width={VB_W}
        height={VB_H}
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
